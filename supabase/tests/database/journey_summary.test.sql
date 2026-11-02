begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Fixed clock for streaks and weekly summaries: Monday 9 Nov 2026, 10:00 in Singapore.
-- Last week = Mon 2 Nov – Sun 8 Nov.
create temp table clock as select timestamptz '2026-11-09 10:00+08' as now;

insert into public.users (id, telegram_user_id, timezone, reminder_time, privacy_accepted_at, created_at) values
  ('00000000-0000-0000-0000-000000000001', 1, 'Asia/Singapore', '08:00', now(), '2026-10-01'),  -- due
  ('00000000-0000-0000-0000-000000000002', 2, 'Asia/Singapore', '21:00', now(), '2026-10-01'),  -- later today
  ('00000000-0000-0000-0000-000000000003', 3, 'Asia/Singapore', '08:00', now(), '2026-11-09 09:00+08'), -- joined today
  ('00000000-0000-0000-0000-000000000004', 4, 'Asia/Singapore', '08:00', now(), '2026-10-01'),  -- inactive
  ('00000000-0000-0000-0000-000000000005', 5, 'Asia/Singapore', '08:00', now(), '2026-10-01');  -- opted out
update public.users set weekly_summary_enabled = false where telegram_user_id = 5;

-- User 1 prayed 20–26 Oct (7 days), 30–31 Oct (2 days), 3–8 Nov (6 days, ending yesterday).
insert into public.prayer_logs (user_id, source, prayed_at)
select '00000000-0000-0000-0000-000000000001'::uuid, 'command', (d::date + time '12:00') at time zone 'Asia/Singapore'
from generate_series(date '2026-10-20', date '2026-10-26', interval '1 day') d
union all
select '00000000-0000-0000-0000-000000000001'::uuid, 'command', (d::date + time '12:00') at time zone 'Asia/Singapore'
from generate_series(date '2026-10-30', date '2026-10-31', interval '1 day') d
union all
select '00000000-0000-0000-0000-000000000001'::uuid, 'command', (d::date + time '12:00') at time zone 'Asia/Singapore'
from generate_series(date '2026-11-03', date '2026-11-08', interval '1 day') d;
-- Two prayers on the same day count as one day.
insert into public.prayer_logs (user_id, source, prayed_at)
values ('00000000-0000-0000-0000-000000000001', 'command', '2026-11-08 20:00+08');

-- Users 2, 3 and 5 prayed recently too, so only their other conditions exclude them.
insert into public.prayer_logs (user_id, source, prayed_at)
select id, 'command', '2026-11-05 12:00+08' from public.users where telegram_user_id in (2, 3, 5);

-- User 1: one request answered on 5 Nov, one still active.
insert into public.prayer_requests (user_id, title, status, answered_at) values
  ('00000000-0000-0000-0000-000000000001', 'Sarah', 'answered', '2026-11-05 18:00+08'),
  ('00000000-0000-0000-0000-000000000001', 'Dad', 'active', null);

-- prayer_streaks -----------------------------------------------------------------------

select is((select current_streak from public.prayer_streaks('00000000-0000-0000-0000-000000000001', (select now from clock))),
  6, 'current streak counts back from yesterday');
select is((select best_streak from public.prayer_streaks('00000000-0000-0000-0000-000000000001', (select now from clock))),
  7, 'best streak is the longest run');
select is((select current_streak from public.prayer_streaks('00000000-0000-0000-0000-000000000001', '2026-11-11 10:00+08')),
  0, 'streak is broken after a missed day');
select is((select current_streak from public.prayer_streaks('00000000-0000-0000-0000-000000000004', (select now from clock))),
  0, 'no prayers, no streak');

-- claim_due_weekly_summaries ----------------------------------------------------------------
-- The local database may hold real dev users, so assertions only look at this file's users (ids < 100).

create temp table claimed as
  select * from public.claim_due_weekly_summaries(200, (select now from clock)) where telegram_user_id < 100;

select is((select array_agg(telegram_user_id) from claimed), array[1::bigint],
  'only the active, opted-in user past their Monday reminder time who joined before this week');
select is((select week_label from claimed), '2 Nov – 8 Nov', 'covers last week');
select is((select days_prayed from claimed), 6, 'counts distinct days prayed last week');
select is((select answered_titles from claimed), array['Sarah'], 'lists prayers answered last week');
select is((select active_requests from claimed), 1, 'counts active requests');
select is((select current_streak from claimed), 6, 'includes the current streak');
select is((select period_key from public.notifications
            where kind = 'weekly_digest' and user_id = '00000000-0000-0000-0000-000000000001'), '2026-W45',
  'period key is last week''s ISO week');

select is_empty($$ select * from public.claim_due_weekly_summaries(200, (select now from clock)) where telegram_user_id < 100 $$,
  'a second run claims nothing');
select is_empty($$ select * from public.claim_due_weekly_summaries(200, '2026-11-09 07:59+08') where telegram_user_id < 100 $$,
  'nothing before the reminder time');
select is_empty($$ select * from public.claim_due_weekly_summaries(200, '2026-11-10 10:00+08') where telegram_user_id < 100 $$,
  'nothing on a Tuesday');
select is((select array_agg(telegram_user_id) from public.claim_due_weekly_summaries(200, '2026-11-09 21:30+08')
            where telegram_user_id < 100), array[2::bigint],
  'the 9 pm user gets theirs that evening');

-- update_user_settings -------------------------------------------------------------------

create temp table t as
  select public.create_prayer_request('00000000-0000-0000-0000-000000000004', 'Mum', null) as id;
update public.users set reminder_time = '21:00' where telegram_user_id = 4;
select public.schedule_follow_up('00000000-0000-0000-0000-000000000004', (select id from t), 7);
create temp table before as
  select (due_at at time zone 'Asia/Singapore')::date as local_day from public.follow_ups
  where prayer_request_id = (select id from t) and status = 'pending';

select is(
  (public.update_user_settings('00000000-0000-0000-0000-000000000004', p_reminder_time => '07:00')).reminder_time,
  time '07:00', 'reminder time updated');
select is(
  (select (due_at at time zone 'Asia/Singapore')::time from public.follow_ups
     where prayer_request_id = (select id from t) and status = 'pending'),
  time '07:00', 'pending follow-up moves to the new time');
select is(
  (select (due_at at time zone 'Asia/Singapore')::date from public.follow_ups
     where prayer_request_id = (select id from t) and status = 'pending'),
  (select local_day from before), '...on the same local day');

select public.update_user_settings('00000000-0000-0000-0000-000000000004', p_timezone => 'Europe/London');
select is(
  (select (due_at at time zone 'Europe/London')::time from public.follow_ups
     where prayer_request_id = (select id from t) and status = 'pending'),
  time '07:00', 'changing timezone keeps 7:00 local in the new timezone');

select throws_ok(
  $$ select public.update_user_settings('00000000-0000-0000-0000-000000000004', p_timezone => 'Mars/Olympus') $$,
  '22023', null, 'unknown timezone is rejected');

select is(
  (public.update_user_settings('00000000-0000-0000-0000-000000000004', p_weekly_summary => false)).nudges_enabled,
  true, 'unspecified settings are left alone');

select * from finish();
rollback;
