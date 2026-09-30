-- Add "injured" as an attendance status. Like "excused", it does not count
-- against a player's attendance % (the % is calculated in the app).
alter table public.attendance drop constraint attendance_status_check;
alter table public.attendance add constraint attendance_status_check
  check (status in ('present', 'absent', 'excused', 'injured'));
