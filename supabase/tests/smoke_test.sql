-- Smoke test for constraints, triggers, RLS and RPC functions.
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'manager@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'coach@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'norole@example.com');
insert into public.profiles (user_id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Manager', 'manager'),
  ('00000000-0000-0000-0000-00000000000b', 'Coach', 'coach');
insert into public.season (id, name, start_date, end_date) values
  ('10000000-0000-0000-0000-000000000001', '2026-27', '2026-09-29', '2027-03-30');

-- As the manager -----------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \gset

do $$
declare
  pid uuid;
  sid uuid;
  sid2 uuid;
  r jsonb;
begin
  pid := public.create_player('Amy Adams', '07', '2026-09-29');
  assert (select is_active from players where id = pid), 'new player active';
  assert (select player_number from players where id = pid) = '07', 'number kept as text';

  r := public.apply_regeneration('10000000-0000-0000-0000-000000000001',
        array['2026-09-29','2026-10-01','2026-10-06']::date[], '{}', '{}', '{}');
  assert (r->>'added')::int = 3, 'added 3';
  r := public.apply_regeneration('10000000-0000-0000-0000-000000000001',
        array['2026-09-29']::date[], '{}', '{}', '{}');
  assert (r->>'added')::int = 0, 'idempotent';

  select id into sid from sessions where date = '2026-09-29';
  select id into sid2 from sessions where date = '2026-10-01';
  perform public.save_attendance(sid, jsonb_build_array(jsonb_build_object('player_id', pid, 'status', 'present')));
  assert (select attendance_taken from sessions where id = sid), 'attendance taken';
  assert (select updated_by from attendance where session_id = sid) = '00000000-0000-0000-0000-00000000000a', 'updated_by set';
  perform public.save_attendance(sid, jsonb_build_array(jsonb_build_object('player_id', pid, 'status', 'excused')));
  assert (select status from attendance where session_id = sid) = 'excused', 'upsert';
  assert (select count(*) from attendance) = 1, 'one row per player/session';

  -- Deleting a session with attendance is refused (it is flagged instead).
  r := public.apply_regeneration('10000000-0000-0000-0000-000000000001', '{}', array[sid, sid2], '{}', '{}');
  assert (r->>'deleted')::int = 1 and (r->>'flagged')::int = 1, 'delete empty, flag with attendance: ' || r::text;
  assert (select needs_review from sessions where id = sid), 'flagged';

  -- Manual sessions are never touched.
  insert into sessions (season_id, date, source) values ('10000000-0000-0000-0000-000000000001', '2026-10-03', 'manual')
    returning id into sid2;
  r := public.apply_regeneration('10000000-0000-0000-0000-000000000001', '{}', array[sid2], array[sid2], '{}');
  assert exists (select 1 from sessions where id = sid2 and not needs_review), 'manual untouched';

  -- Deactivate / reactivate keeps history and syncs is_active.
  update player_active_periods set start_date = public.melbourne_today() - 10 where player_id = pid;
  perform public.deactivate_player(pid);
  assert not (select is_active from players where id = pid), 'deactivated';
  assert (select end_date from player_active_periods where player_id = pid) = public.melbourne_today(), 'closed today';
  begin
    perform public.reactivate_player(pid, public.melbourne_today() - 5);
    raise exception 'should not reactivate before previous end';
  exception when raise_exception then
    if sqlerrm like 'should not%' then raise; end if;
  end;
  perform public.reactivate_player(pid, public.melbourne_today());
  assert (select is_active from players where id = pid), 'reactivated';
  assert (select count(*) from player_active_periods where player_id = pid) = 2, 'two periods';

  -- Overlapping periods are rejected.
  begin
    insert into player_active_periods (player_id, start_date, end_date) values (pid, public.melbourne_today() - 8, public.melbourne_today() - 2);
    raise exception 'overlap allowed';
  exception when exclusion_violation then null;
  end;
  begin
    insert into player_active_periods (player_id, start_date, end_date) values (pid, '2020-10-10', '2020-10-10');
    raise exception 'end = start allowed';
  exception when check_violation then null;
  end;

  -- Bulk import.
  r := public.import_players(jsonb_build_array(
    jsonb_build_object('kind', 'add', 'name', 'Bea', 'player_number', null, 'active_from', '2026-09-29'),
    jsonb_build_object('kind', 'update_number', 'player_id', pid, 'player_number', '8')));
  assert (r->>'added')::int = 1 and (r->>'updated')::int = 1, 'import';
  assert (select player_number from players where id = pid) = '8', 'number updated';
  assert (select player_number from players where name = 'Bea') is null, 'blank number stays null';

  -- Name validation.
  begin
    insert into players (name) values ('  ');
    raise exception 'blank name allowed';
  exception when check_violation then null;
  end;
end $$;

-- As a user with a non-manager role: sees nothing, cannot write ------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \gset
do $$
begin
  assert (select count(*) from players) = 0, 'coach sees no players';
  assert (select count(*) from sessions) = 0, 'coach sees no sessions';
  assert (select count(*) from profiles) = 1, 'coach sees only own profile';
  begin
    insert into players (name) values ('Hacker');
    raise exception 'coach could insert';
  exception when insufficient_privilege then null;
  end;
end $$;

-- As a user with no profile ------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false) \gset
do $$
begin
  assert (select count(*) from players) = 0, 'no-role user sees nothing';
  assert (select count(*) from profiles) = 0, 'no-role user sees no profiles';
end $$;

-- Anonymous ----------------------------------------------------------------
reset role;
set role anon;
do $$
begin
  begin
    perform count(*) from public.players;
    raise exception 'anon could read players';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'smoke test passed' as result;
