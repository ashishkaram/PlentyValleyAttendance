-- One-time production setup, run in the Supabase dashboard: SQL Editor -> New query.
-- Run AFTER the schema (supabase/migrations/20260928000000_init.sql) and AFTER
-- creating your login under Authentication -> Users -> Add user.
--
-- 1. Change the email and display name on the two lines marked CHANGE ME.
-- 2. Click Run. It is safe to run more than once.
--
-- Creates: your manager profile, the 2026-27 season, the Christmas break and
-- the 44 training sessions. Later changes to the season go through the app's
-- Settings page (which previews changes first).

do $$
declare
  manager_email text := 'you@example.com';          -- CHANGE ME: the email you used in Add user
  manager_name  text := 'Ashish Karambelkar';       -- CHANGE ME: shown in the app
  uid uuid;
  sid uuid;
  n int;
begin
  select id into uid from auth.users where lower(email) = lower(manager_email);
  if uid is null then
    raise exception 'No login found for %. Create it first under Authentication -> Users -> Add user.', manager_email;
  end if;

  insert into public.profiles (user_id, display_name, role)
  values (uid, manager_name, 'manager')
  on conflict (user_id) do update set display_name = excluded.display_name, role = 'manager';

  select id into sid from public.season where name = '2026-27';
  if sid is null then
    insert into public.season (name, start_date, end_date, training_weekdays, report_weekday, low_attendance_threshold)
    values ('2026-27', '2026-09-29', '2027-03-30', '{2,4}', 3, 75)
    returning id into sid;
    insert into public.season_breaks (season_id, name, start_date, end_date)
    values (sid, 'Christmas break', '2026-12-16', '2027-01-15');
  end if;

  -- Every Tuesday and Thursday in the season that is not inside a break.
  insert into public.sessions (season_id, date, source)
  select sid, d::date, 'generated'
    from generate_series('2026-09-29'::date, '2027-03-30'::date, interval '1 day') d
   where extract(isodow from d) in (2, 4)
     and not exists (select 1 from public.season_breaks b
                      where b.season_id = sid and d::date between b.start_date and b.end_date)
  on conflict (season_id, date) do nothing;

  select count(*) into n from public.sessions where season_id = sid;
  raise notice 'Done: manager profile for %, season 2026-27 with % sessions (expected 44).', manager_email, n;
end $$;
