-- FieldCraft — clubs, roles, players and bowling data (PRD §3, §4, §8).
-- Shared by the T20 and One-Day instances.

create type public.member_role as enum ('admin', 'coach', 'captain', 'player');

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  role public.member_role not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create index profiles_club_idx on public.profiles (club_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  code text not null unique,
  role public.member_role not null,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_club_idx on public.invites (club_id);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  batting_hand text not null check (batting_hand in ('R', 'L')),
  batting_type text check (batting_type in ('aggressive', 'accumulator', 'technical', 'finisher', 'tail')),
  bowls boolean not null default false,
  bowl_arm text check (bowl_arm in ('R', 'L')),
  bowl_family text check (bowl_family in ('pace', 'spin')),
  pace_band text check (pace_band in ('fast', 'fast-medium', 'medium')),
  swing_shape text check (swing_shape in ('out', 'in', 'none')),
  spin_type text check (spin_type in ('off', 'leg', 'lao', 'law')),
  keeper_up boolean,
  active boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint bowler_complete check (
    not bowls
    or (bowl_arm is not null and bowl_family is not null
        and ((bowl_family = 'pace' and pace_band is not null) or (bowl_family = 'spin' and spin_type is not null)))
  )
);
create index players_club_idx on public.players (club_id);

create table public.player_bowling_data (
  player_id uuid not null references public.players (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  format text not null check (format in ('t20', 'oneday')),
  phase_scope text not null check (phase_scope in ('overall', 'powerplay', 'middle', 'death')),
  line_outside_off smallint check (line_outside_off between 0 and 100),
  line_off smallint check (line_off between 0 and 100),
  line_middle smallint check (line_middle between 0 and 100),
  line_leg smallint check (line_leg between 0 and 100),
  line_outside_leg smallint check (line_outside_leg between 0 and 100),
  len_short smallint check (len_short between 0 and 100),
  len_good smallint check (len_good between 0 and 100),
  len_full smallint check (len_full between 0 and 100),
  balls_sampled integer check (balls_sampled >= 0),
  source_note text check (char_length(source_note) <= 200),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (player_id, format, phase_scope),
  -- each group is all-null or totals exactly 100
  constraint line_group check (
    num_nulls(line_outside_off, line_off, line_middle, line_leg, line_outside_leg) = 5
    or (num_nulls(line_outside_off, line_off, line_middle, line_leg, line_outside_leg) = 0
        and line_outside_off + line_off + line_middle + line_leg + line_outside_leg = 100)
  ),
  constraint length_group check (
    num_nulls(len_short, len_good, len_full) = 3
    or (num_nulls(len_short, len_good, len_full) = 0 and len_short + len_good + len_full = 100)
  ),
  constraint has_some_data check (line_off is not null or len_good is not null)
);
create index player_bowling_data_club_idx on public.player_bowling_data (club_id);

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so policies can read the caller's own profile
-- without recursing into the profiles policy.
-- ---------------------------------------------------------------------------
create function public.my_club() returns uuid
language sql stable security definer set search_path = '' as $$
  select club_id from public.profiles where user_id = auth.uid()
$$;

create function public.my_role() returns public.member_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where user_id = auth.uid()
$$;

create function public.can_edit_players() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() in ('admin', 'coach'), false)
$$;

-- ---------------------------------------------------------------------------
-- Row-level security: a row is visible only inside the caller's club.
-- Membership tables are read-only to clients; every change goes through the
-- functions below.
-- ---------------------------------------------------------------------------
alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.players enable row level security;
alter table public.player_bowling_data enable row level security;

revoke all on public.clubs, public.profiles, public.invites, public.players, public.player_bowling_data from anon, authenticated;
grant select on public.clubs, public.profiles to authenticated;
grant select, insert, update on public.players to authenticated;
grant select, insert, update, delete on public.player_bowling_data to authenticated;
-- invites: no grants and no policies — reachable only through functions.

create policy clubs_select on public.clubs for select to authenticated
  using (id = public.my_club());

create policy profiles_select on public.profiles for select to authenticated
  using (club_id = public.my_club());

create policy players_select on public.players for select to authenticated
  using (club_id = public.my_club());
create policy players_insert on public.players for insert to authenticated
  with check (club_id = public.my_club() and public.can_edit_players());
create policy players_update on public.players for update to authenticated
  using (club_id = public.my_club() and public.can_edit_players())
  with check (club_id = public.my_club() and public.can_edit_players());

create policy bowling_select on public.player_bowling_data for select to authenticated
  using (club_id = public.my_club());
create policy bowling_insert on public.player_bowling_data for insert to authenticated
  with check (
    club_id = public.my_club() and public.can_edit_players()
    and exists (select 1 from public.players p where p.id = player_id and p.club_id = public.my_club())
  );
create policy bowling_update on public.player_bowling_data for update to authenticated
  using (club_id = public.my_club() and public.can_edit_players())
  with check (
    club_id = public.my_club() and public.can_edit_players()
    and exists (select 1 from public.players p where p.id = player_id and p.club_id = public.my_club())
  );
create policy bowling_delete on public.player_bowling_data for delete to authenticated
  using (club_id = public.my_club() and public.can_edit_players());

-- Stamp who changed a row and when; the client cannot spoof either.
create function public.stamp_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
create trigger players_stamp before insert or update on public.players
  for each row execute function public.stamp_update();
create trigger bowling_stamp before insert or update on public.player_bowling_data
  for each row execute function public.stamp_update();

-- ---------------------------------------------------------------------------
-- Membership functions
-- ---------------------------------------------------------------------------
create function public.create_club(club_name text, display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_club uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.profiles where user_id = auth.uid()) then
    raise exception 'You already belong to a club';
  end if;
  insert into public.clubs (name) values (btrim(club_name)) returning id into new_club;
  insert into public.profiles (user_id, club_id, role, display_name)
    values (auth.uid(), new_club, 'admin', btrim(display_name));
  return new_club;
end $$;

-- Single transaction: the row lock makes an invite strictly single-use.
create function public.claim_invite(invite_code text, display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.profiles where user_id = auth.uid()) then
    raise exception 'You already belong to a club';
  end if;
  select * into inv from public.invites where code = upper(btrim(invite_code)) for update;
  if not found or inv.used_by is not null or inv.expires_at < now() then
    raise exception 'This invite is not valid, has expired, or has already been used';
  end if;
  insert into public.profiles (user_id, club_id, role, display_name)
    values (auth.uid(), inv.club_id, inv.role, btrim(display_name));
  update public.invites set used_by = auth.uid(), used_at = now() where id = inv.id;
  return inv.club_id;
end $$;

create function public.create_invite(invite_role public.member_role, valid_days integer default 14)
returns table (id uuid, code text, role public.member_role, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare new_code text;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Admins only'; end if;
  if valid_days < 1 or valid_days > 90 then raise exception 'Expiry must be 1 to 90 days'; end if;
  -- 10 characters from an unambiguous alphabet (no 0/O/1/I), ~50 bits
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '')
    into new_code
    from (select extensions.gen_random_bytes(10) as b) r, generate_series(0, 9) i;
  return query
    insert into public.invites (club_id, code, role, created_by, expires_at)
    values (public.my_club(), new_code, invite_role, auth.uid(), now() + make_interval(days => valid_days))
    returning invites.id, invites.code, invites.role, invites.expires_at;
end $$;

create function public.list_invites()
returns table (id uuid, code text, role public.member_role, expires_at timestamptz, used boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Admins only'; end if;
  return query
    select i.id, i.code, i.role, i.expires_at, i.used_by is not null
    from public.invites i where i.club_id = public.my_club()
    order by i.created_at desc;
end $$;

create function public.revoke_invite(invite_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Admins only'; end if;
  delete from public.invites where id = invite_id and club_id = public.my_club() and used_by is null;
end $$;

create function public.set_member_role(member uuid, new_role public.member_role) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Admins only'; end if;
  -- lock every admin row of the club so two demotions cannot race past the last-admin check
  perform 1 from public.profiles where club_id = public.my_club() and role = 'admin' for update;
  select * into target from public.profiles where user_id = member and club_id = public.my_club();
  if not found then raise exception 'Member not found'; end if;
  if target.role = 'admin' and new_role <> 'admin'
     and (select count(*) from public.profiles where club_id = target.club_id and role = 'admin') <= 1 then
    raise exception 'A club must keep at least one Admin';
  end if;
  update public.profiles set role = new_role where user_id = member;
end $$;

create function public.remove_member(member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Admins only'; end if;
  perform 1 from public.profiles where club_id = public.my_club() and role = 'admin' for update;
  select * into target from public.profiles where user_id = member and club_id = public.my_club();
  if not found then raise exception 'Member not found'; end if;
  if target.role = 'admin'
     and (select count(*) from public.profiles where club_id = target.club_id and role = 'admin') <= 1 then
    raise exception 'A club must keep at least one Admin';
  end if;
  delete from public.profiles where user_id = member;
end $$;

create function public.rename_club(new_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Admins only'; end if;
  update public.clubs set name = btrim(new_name) where id = public.my_club();
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.my_club(), public.my_role(), public.can_edit_players(),
  public.create_club(text, text), public.claim_invite(text, text),
  public.create_invite(public.member_role, integer), public.list_invites(), public.revoke_invite(uuid),
  public.set_member_role(uuid, public.member_role), public.remove_member(uuid), public.rename_club(text)
  to authenticated;
