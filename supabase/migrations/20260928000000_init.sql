-- Training Attendance Tracker: initial schema, RLS and RPC functions.
-- All dates are Postgres `date` (no time zone); "today" is Australia/Melbourne.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.melbourne_today()
returns date language sql stable as $$
  select (now() at time zone 'Australia/Melbourne')::date
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null default '',
  role text not null check (role in ('manager', 'committee', 'coach')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 100),
  player_number text check (player_number is null or (player_number = btrim(player_number) and char_length(player_number) between 1 and 10)),
  -- Current status only, kept in sync with player_active_periods by trigger.
  -- Used for list filtering, never for % calculation.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.player_active_periods (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  start_date date not null,
  end_date date, -- exclusive; null = still active
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint period_end_after_start check (end_date is null or end_date > start_date),
  -- No overlapping periods per player (this also allows at most one open period).
  constraint period_no_overlap exclude using gist (
    player_id with =,
    daterange(start_date, end_date, '[)') with &&
  )
);
create unique index player_active_periods_one_open
  on public.player_active_periods (player_id) where end_date is null;

create table public.season (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  training_weekdays int[] not null default '{2,4}',
  report_weekday int not null default 3 check (report_weekday between 1 and 7),
  low_attendance_threshold int not null default 75 check (low_attendance_threshold between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint season_dates check (end_date >= start_date),
  constraint season_weekdays check (training_weekdays <@ '{1,2,3,4,5,6,7}'::int[] and cardinality(training_weekdays) > 0)
);

create table public.season_breaks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  start_date date not null,
  end_date date not null, -- inclusive
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint break_dates check (end_date >= start_date)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season (id) on delete cascade,
  date date not null,
  source text not null default 'generated' check (source in ('generated', 'manual')),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  note text check (note is null or char_length(note) <= 200),
  attendance_taken boolean not null default false,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, date)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete restrict,
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null check (status in ('present', 'excused', 'absent')),
  updated_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, player_id)
);
create index attendance_player_idx on public.attendance (player_id);

-- updated_at triggers
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger players_updated_at before update on public.players for each row execute function public.set_updated_at();
create trigger periods_updated_at before update on public.player_active_periods for each row execute function public.set_updated_at();
create trigger season_updated_at before update on public.season for each row execute function public.set_updated_at();
create trigger breaks_updated_at before update on public.season_breaks for each row execute function public.set_updated_at();
create trigger sessions_updated_at before update on public.sessions for each row execute function public.set_updated_at();

-- attendance: record who edited and when (FR-09)
create or replace function public.attendance_audit()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
create trigger attendance_audit before insert or update on public.attendance
  for each row execute function public.attendance_audit();

-- keep players.is_active in sync with player_active_periods
create or replace function public.sync_player_is_active()
returns trigger language plpgsql as $$
declare
  pid uuid := coalesce(new.player_id, old.player_id);
begin
  update public.players p
     set is_active = exists (
       select 1 from public.player_active_periods ap
        where ap.player_id = pid and ap.end_date is null)
   where p.id = pid;
  if tg_op = 'UPDATE' and old.player_id <> new.player_id then
    update public.players p
       set is_active = exists (
         select 1 from public.player_active_periods ap
          where ap.player_id = old.player_id and ap.end_date is null)
     where p.id = old.player_id;
  end if;
  return null;
end $$;
create trigger periods_sync_is_active after insert or update or delete on public.player_active_periods
  for each row execute function public.sync_player_is_active();

-- ---------------------------------------------------------------------------
-- Row Level Security: only authenticated users with a role may read or write.
-- MVP: the manager has full access. Committee and coach roles exist in the
-- schema but have no access until their permissions are defined (add policies
-- in a later migration; no schema change needed).
-- ---------------------------------------------------------------------------

create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'manager')
$$;

revoke all on function public.current_role_name() from public, anon;
revoke all on function public.is_manager() from public, anon;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.is_manager() to authenticated;

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.player_active_periods enable row level security;
alter table public.season enable row level security;
alter table public.season_breaks enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;

create policy "own profile readable" on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy "manager manages profiles" on public.profiles
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "manager full access" on public.players
  for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "manager full access" on public.player_active_periods
  for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "manager full access" on public.season
  for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "manager full access" on public.season_breaks
  for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "manager full access" on public.sessions
  for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "manager full access" on public.attendance
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- Explicit grants (do not rely on the platform auto-exposing new tables).
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------------------
-- RPC functions (security invoker: RLS applies). Each runs in one transaction
-- so multi-row changes are atomic. Business rules are validated in the app
-- (src/lib/domain) and enforced again here by constraints.
-- ---------------------------------------------------------------------------

create or replace function public.create_player(p_name text, p_number text, p_active_from date)
returns uuid language plpgsql set search_path = public as $$
declare
  new_id uuid;
begin
  insert into players (name, player_number, is_active)
  values (btrim(p_name), nullif(btrim(p_number), ''), true)
  returning id into new_id;
  insert into player_active_periods (player_id, start_date) values (new_id, p_active_from);
  return new_id;
end $$;

-- FR-05: close the open period with end_date = today (Melbourne). If the open
-- period starts today or later, remove it instead.
create or replace function public.deactivate_player(p_player_id uuid)
returns void language plpgsql set search_path = public as $$
declare
  today date := public.melbourne_today();
  open_period player_active_periods;
begin
  select * into open_period from player_active_periods
   where player_id = p_player_id and end_date is null for update;
  if not found then
    raise exception 'Player is already inactive';
  end if;
  if open_period.start_date >= today then
    delete from player_active_periods where id = open_period.id;
  else
    update player_active_periods set end_date = today where id = open_period.id;
  end if;
end $$;

create or replace function public.reactivate_player(p_player_id uuid, p_start date)
returns void language plpgsql set search_path = public as $$
begin
  if exists (select 1 from player_active_periods where player_id = p_player_id and end_date is null) then
    raise exception 'Player is already active';
  end if;
  if exists (select 1 from player_active_periods where player_id = p_player_id and end_date > p_start) then
    raise exception 'Start date cannot be before the end of her previous period';
  end if;
  insert into player_active_periods (player_id, start_date) values (p_player_id, p_start);
end $$;

-- FR-08: upsert one row per listed player and mark attendance as taken.
-- p_marks: [{"player_id": "...", "status": "present|excused|absent"}]
create or replace function public.save_attendance(p_session_id uuid, p_marks jsonb)
returns void language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from sessions where id = p_session_id) then
    raise exception 'Session not found';
  end if;
  insert into attendance (session_id, player_id, status)
  select p_session_id, (m->>'player_id')::uuid, m->>'status'
    from jsonb_array_elements(p_marks) m
  on conflict (session_id, player_id) do update
    set status = excluded.status
    where attendance.status is distinct from excluded.status;
  update sessions set attendance_taken = true where id = p_session_id;
end $$;

-- 7.1: apply a regeneration plan computed by the app. Deletes are re-checked
-- here so a session that gained attendance in the meantime is never removed.
create or replace function public.apply_regeneration(
  p_season_id uuid,
  p_add date[],
  p_delete uuid[],
  p_flag uuid[],
  p_unflag uuid[]
) returns jsonb language plpgsql set search_path = public as $$
declare
  added int;
  deleted int;
  flagged int;
begin
  insert into sessions (season_id, date, source)
  select p_season_id, d, 'generated' from unnest(p_add) d
  on conflict (season_id, date) do nothing;
  get diagnostics added = row_count;

  -- Anything asked to be deleted that has attendance is flagged instead.
  update sessions s set needs_review = true
   where s.season_id = p_season_id and s.source = 'generated'
     and (s.id = any (p_flag) or (s.id = any (p_delete)
          and (s.attendance_taken or exists (select 1 from attendance a where a.session_id = s.id))));
  get diagnostics flagged = row_count;

  delete from sessions s
   where s.season_id = p_season_id and s.source = 'generated' and s.id = any (p_delete)
     and not s.attendance_taken
     and not exists (select 1 from attendance a where a.session_id = s.id);
  get diagnostics deleted = row_count;

  update sessions s set needs_review = false
   where s.season_id = p_season_id and s.source = 'generated' and s.id = any (p_unflag);

  return jsonb_build_object('added', added, 'deleted', deleted, 'flagged', flagged);
end $$;

-- Settings (section 7.1): save the season and its breaks and apply the
-- regeneration plan the app computed for the new settings, in one transaction.
-- p_season: {"name","start_date","end_date","training_weekdays","report_weekday","low_attendance_threshold"}
-- p_breaks: [{"id"?: uuid, "name", "start_date", "end_date"}] (breaks not listed are removed)
create or replace function public.save_season_settings(
  p_season_id uuid,
  p_season jsonb,
  p_breaks jsonb,
  p_add date[],
  p_delete uuid[],
  p_flag uuid[],
  p_unflag uuid[]
) returns jsonb language plpgsql set search_path = public as $$
declare
  sid uuid := p_season_id;
  result jsonb;
begin
  if sid is null then
    insert into season (name, start_date, end_date, training_weekdays, report_weekday, low_attendance_threshold)
    values (
      p_season->>'name',
      (p_season->>'start_date')::date,
      (p_season->>'end_date')::date,
      array(select jsonb_array_elements_text(p_season->'training_weekdays')::int),
      (p_season->>'report_weekday')::int,
      (p_season->>'low_attendance_threshold')::int)
    returning id into sid;
  else
    update season set
      name = p_season->>'name',
      start_date = (p_season->>'start_date')::date,
      end_date = (p_season->>'end_date')::date,
      training_weekdays = array(select jsonb_array_elements_text(p_season->'training_weekdays')::int),
      report_weekday = (p_season->>'report_weekday')::int,
      low_attendance_threshold = (p_season->>'low_attendance_threshold')::int
    where id = sid;
    if not found then
      raise exception 'Season not found';
    end if;
  end if;

  delete from season_breaks b
   where b.season_id = sid
     and b.id not in (select (x->>'id')::uuid from jsonb_array_elements(p_breaks) x where x->>'id' is not null);

  update season_breaks b set
    name = x->>'name', start_date = (x->>'start_date')::date, end_date = (x->>'end_date')::date
  from jsonb_array_elements(p_breaks) x
  where x->>'id' is not null and b.id = (x->>'id')::uuid and b.season_id = sid;

  insert into season_breaks (season_id, name, start_date, end_date)
  select sid, x->>'name', (x->>'start_date')::date, (x->>'end_date')::date
    from jsonb_array_elements(p_breaks) x
   where x->>'id' is null;

  result := apply_regeneration(sid, p_add, p_delete, p_flag, p_unflag);
  return result || jsonb_build_object('season_id', sid);
end $$;

-- FR-03: bulk import. p_ops: [{"kind":"add","name":..,"player_number":..,"active_from":..}
--                            | {"kind":"update_number","player_id":..,"player_number":..}]
create or replace function public.import_players(p_ops jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  op jsonb;
  added int := 0;
  updated int := 0;
begin
  for op in select * from jsonb_array_elements(p_ops) loop
    if op->>'kind' = 'add' then
      perform create_player(op->>'name', op->>'player_number', (op->>'active_from')::date);
      added := added + 1;
    elsif op->>'kind' = 'update_number' then
      update players set player_number = nullif(btrim(op->>'player_number'), '')
       where id = (op->>'player_id')::uuid;
      updated := updated + 1;
    else
      raise exception 'Unknown import operation %', op->>'kind';
    end if;
  end loop;
  return jsonb_build_object('added', added, 'updated', updated);
end $$;

revoke all on function public.create_player(text, text, date) from public, anon;
revoke all on function public.deactivate_player(uuid) from public, anon;
revoke all on function public.reactivate_player(uuid, date) from public, anon;
revoke all on function public.save_attendance(uuid, jsonb) from public, anon;
revoke all on function public.apply_regeneration(uuid, date[], uuid[], uuid[], uuid[]) from public, anon;
revoke all on function public.import_players(jsonb) from public, anon;
revoke all on function public.save_season_settings(uuid, jsonb, jsonb, date[], uuid[], uuid[], uuid[]) from public, anon;
grant execute on function public.create_player(text, text, date) to authenticated;
grant execute on function public.deactivate_player(uuid) to authenticated;
grant execute on function public.reactivate_player(uuid, date) to authenticated;
grant execute on function public.save_attendance(uuid, jsonb) to authenticated;
grant execute on function public.apply_regeneration(uuid, date[], uuid[], uuid[], uuid[]) to authenticated;
grant execute on function public.import_players(jsonb) to authenticated;
grant execute on function public.save_season_settings(uuid, jsonb, jsonb, date[], uuid[], uuid[], uuid[]) to authenticated;
