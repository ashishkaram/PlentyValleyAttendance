-- PRD §9 rows 21–24 plus the last-admin rule. Any failed assertion aborts the run.
\set ON_ERROR_STOP 1
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-00000000000e');

create function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'ok (refused): %', label; return; end;
  raise exception 'SHOULD HAVE FAILED: %', label;
end $$;
create function pg_temp.expect(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', label; end if;
  raise notice 'ok: %', label;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

set role authenticated;

-- Club A (admin a), Club B (admin b)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_club('Club A', 'Alice') as club_a \gset
select code as coach_code from public.create_invite('coach') \gset
select code as player_code from public.create_invite('player') \gset
insert into public.players (club_id, name, batting_hand, bowls, bowl_arm, bowl_family, pace_band)
  values (:'club_a', 'Meg', 'R', true, 'R', 'pace', 'medium') returning id as meg \gset
insert into public.player_bowling_data (player_id, club_id, format, phase_scope, line_outside_off, line_off, line_middle, line_leg, line_outside_leg)
  values (:'meg', :'club_a', 't20', 'overall', 40, 20, 20, 10, 10);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.create_club('Club B', 'Bea') as club_b \gset

-- Row 21: Club B cannot see or touch Club A's data
select pg_temp.expect((select count(*) from public.players) = 0, 'club B sees no club A players');
select pg_temp.expect((select count(*) from public.player_bowling_data) = 0, 'club B sees no club A bowling data');
select pg_temp.expect((select count(*) from public.clubs) = 1, 'club B sees only its own club');
select pg_temp.expect((select count(*) from public.profiles) = 1, 'club B sees only its own members');
update public.players set name = 'hacked' where id = :'meg';
select pg_temp.expect_fail(format($$insert into public.players (club_id, name, batting_hand) values (%L, 'x', 'R')$$, :'club_a'), 'club B insert into club A');
select pg_temp.expect_fail(format($$insert into public.player_bowling_data (player_id, club_id, format, phase_scope, len_short, len_good, len_full) values (%L, %L, 't20', 'death', 30, 40, 30)$$, :'meg', :'club_b'), 'club B attaches data to club A player');
select pg_temp.expect_fail($$select * from public.invites$$, 'invites table is not readable');
select pg_temp.expect_fail($$select public.create_club('Second', 'Bea')$$, 'one club per user');

-- Row 24 (single use) and joining
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.claim_invite(:'coach_code', 'Cara');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select pg_temp.expect_fail(format($$select public.claim_invite(%L, 'Dee')$$, :'coach_code'), 'invite cannot be claimed twice');
select pg_temp.expect_fail($$select public.claim_invite('NOPE', 'Dee')$$, 'unknown invite');
select public.claim_invite(:'player_code', 'Dee');

-- Row 22: a Player can read but not write
select pg_temp.expect((select count(*) from public.players) = 1, 'player can read club players');
select pg_temp.expect_fail(format($$insert into public.players (club_id, name, batting_hand) values (%L, 'x', 'R')$$, :'club_a'), 'player insert refused');
update public.players set name = 'hacked' where id = :'meg';
delete from public.player_bowling_data where player_id = :'meg';
select pg_temp.expect((select count(*) from public.player_bowling_data) = 1, 'player delete had no effect');
select pg_temp.expect_fail($$select public.create_invite('admin')$$, 'player cannot invite');

-- Row 23: a Coach can edit players but cannot promote herself
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
update public.players set name = 'Meg L' where id = :'meg';
select pg_temp.expect((select name from public.players where id = :'meg') = 'Meg L', 'coach can edit; earlier hack attempts had no effect');
select pg_temp.expect_fail($$update public.profiles set role = 'admin' where user_id = auth.uid()$$, 'coach cannot update own profile');
select pg_temp.expect_fail($$select public.set_member_role(auth.uid(), 'admin')$$, 'coach cannot call set_member_role');
select pg_temp.expect_fail(format($$update public.players set club_id = %L where id = %L$$, :'club_b', :'meg'), 'cannot move a player to another club');

-- Data constraints
select pg_temp.expect_fail(format($$insert into public.player_bowling_data (player_id, club_id, format, phase_scope, line_outside_off, line_off, line_middle, line_leg, line_outside_leg) values (%L, %L, 't20', 'death', 40, 20, 20, 10, 5)$$, :'meg', :'club_a'), 'line must total 100');
select pg_temp.expect_fail(format($$insert into public.player_bowling_data (player_id, club_id, format, phase_scope, len_short, len_good) values (%L, %L, 't20', 'death', 50, 50)$$, :'meg', :'club_a'), 'length group is all or nothing');

-- Last admin is protected; admin of B cannot touch members of A
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.expect_fail($$select public.set_member_role(auth.uid(), 'coach')$$, 'last admin cannot be demoted');
select pg_temp.expect_fail($$select public.remove_member(auth.uid())$$, 'last admin cannot be removed');
select public.set_member_role('00000000-0000-0000-0000-00000000000c', 'admin');
select public.set_member_role(auth.uid(), 'coach');
select pg_temp.expect(public.my_role() = 'coach', 'admin can step down once there is a second admin');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.expect_fail($$select public.remove_member('00000000-0000-0000-0000-00000000000d')$$, 'admin of B cannot remove a member of A');

-- Signed-in user with no club sees nothing
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select pg_temp.expect((select count(*) from public.players) + (select count(*) from public.clubs) = 0, 'user with no club sees nothing');

reset role;
set role anon;
select pg_temp.expect_fail($$select * from public.players$$, 'anonymous cannot read players');
select pg_temp.expect_fail($$select public.create_club('x', 'y')$$, 'anonymous cannot create a club');
reset role;
\echo ALL SECURITY TESTS PASSED
