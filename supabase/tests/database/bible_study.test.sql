begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Fixed clock: Monday 9 Nov 2026, 10:00 in Singapore. Last week = Mon 2 Nov – Sun 8 Nov.
create temp table clock as select timestamptz '2026-11-09 10:00+08' as now;

insert into public.users (id, telegram_user_id, timezone, reminder_time, privacy_accepted_at, created_at) values
  ('00000000-0000-0000-0000-000000000001', 1, 'Asia/Singapore', '08:00', now(), '2026-10-01'),
  ('00000000-0000-0000-0000-000000000002', 2, 'Asia/Singapore', '08:00', now(), '2026-10-01');

-- User 1 studied 5–8 Nov (two sessions on the 7th), this morning, and once after the clock.
insert into public.study_logs (user_id, minutes, note, source, studied_at) values
  ('00000000-0000-0000-0000-000000000001', 30, 'John 1', 'command', '2026-11-05 20:00+08'),
  ('00000000-0000-0000-0000-000000000001', 20, null,     'command', '2026-11-06 20:00+08'),
  ('00000000-0000-0000-0000-000000000001', 45, null,     'miniapp', '2026-11-07 07:00+08'),
  ('00000000-0000-0000-0000-000000000001', 15, null,     'miniapp', '2026-11-07 21:00+08'),
  ('00000000-0000-0000-0000-000000000001', 60, null,     'command', '2026-11-08 20:00+08'),
  ('00000000-0000-0000-0000-000000000001', 25, 'Psalm 23', 'command', '2026-11-09 08:00+08'),
  ('00000000-0000-0000-0000-000000000001', 10, null,     'command', '2026-11-09 12:00+08');  -- after the clock
-- User 2 never prayed, but studied last week: that alone earns a weekly summary.
insert into public.study_logs (user_id, minutes, source, studied_at)
values ('00000000-0000-0000-0000-000000000002', 40, 'command', '2026-11-04 20:00+08');

-- study_streaks ---------------------------------------------------------------------------

select is((select current_streak from public.study_streaks('00000000-0000-0000-0000-000000000001', (select now from clock))),
  5, 'current streak runs to today, two sessions on one day count once');
select is((select best_streak from public.study_streaks('00000000-0000-0000-0000-000000000001', (select now from clock))),
  5, 'best streak');
select is((select current_streak from public.study_streaks('00000000-0000-0000-0000-000000000001', '2026-11-11 10:00+08')),
  0, 'streak is broken after a missed day');

-- study_summary ---------------------------------------------------------------------------

create temp table summary as
  select public.study_summary('00000000-0000-0000-0000-000000000001', (select now from clock)) as j;

select is((select (j ->> 'days_this_week')::int from summary), 1, 'days this week (week starts Monday)');
select is((select (j ->> 'minutes_this_week')::int from summary), 25, 'minutes this week');
select is((select (j ->> 'total_minutes')::int from summary), 195, 'total minutes, ignoring sessions after now');
select is((select (j ->> 'total_days')::int from summary), 5, 'total days');
select is((select j -> 'recent' -> 0 ->> 'label' from summary), 'Mon 9 Nov, 8:00 am', 'newest session first, local time');
select is((select j -> 'recent' -> 0 ->> 'note' from summary), 'Psalm 23', 'recent sessions include the note');
select is((select jsonb_array_length(j -> 'this_week') from summary), 1, 'one day studied this week');

-- claim_due_weekly_summaries --------------------------------------------------------------

create temp table claimed as
  select * from public.claim_due_weekly_summaries(200, (select now from clock)) where telegram_user_id < 100;

select results_eq(
  $$ select telegram_user_id, study_days, study_minutes from claimed order by 1 $$,
  $$ values (1::bigint, 4, 170), (2::bigint, 1, 40) $$,
  'weekly summary counts last week''s study days and minutes; study alone counts as activity'
);

-- log_study, update_study_log, delete_study_log -------------------------------------------

create temp table logged as
  select public.log_study('00000000-0000-0000-0000-000000000002', 30, '  ', 'command', 555) as id;

select isnt((select id from logged), null, 'log_study returns the new session id');
select is((select note from public.study_logs where id = (select id from logged)), null, 'a blank note is stored as null');
select is(public.log_study('00000000-0000-0000-0000-000000000002', 30, null, 'command', 555), null,
  'a second tap on the same message logs nothing');
select throws_ok(
  $$ select public.log_study('00000000-0000-0000-0000-000000000002', 0, null, 'miniapp') $$,
  '23514', null, 'minutes must be at least 1'
);

select is(public.update_study_log('00000000-0000-0000-0000-000000000001', (select id from logged), 90, 'x'), false,
  'another user cannot edit the session');
select is(public.update_study_log('00000000-0000-0000-0000-000000000002', (select id from logged), null, 'Mark 4'), true,
  'the owner can add a note');
select is((select minutes from public.study_logs where id = (select id from logged)), 30, 'null minutes leaves them unchanged');
select is(public.delete_study_log('00000000-0000-0000-0000-000000000001', (select id from logged)), false,
  'another user cannot delete the session');

delete from public.users where id = '00000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.study_logs where user_id = '00000000-0000-0000-0000-000000000001'), 0,
  'deleting the user deletes their Bible study');

select * from finish();
rollback;
