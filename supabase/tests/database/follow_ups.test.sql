begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into public.users (id, telegram_user_id, timezone, reminder_time, privacy_accepted_at) values
  ('00000000-0000-0000-0000-000000000001', 1, 'Asia/Singapore', '21:00', now()),
  ('00000000-0000-0000-0000-000000000002', 2, 'Asia/Singapore', '21:00', now());

-- create_prayer_request ----------------------------------------------------------

create temp table t as
  select public.create_prayer_request('00000000-0000-0000-0000-000000000001', 'Sarah', 'surgery on Friday') as id;

select is(
  (select status from public.prayer_requests where id = (select id from t)), 'active', 'new request is active');
select is(
  (select count(*)::int from public.prayer_logs where prayer_request_id = (select id from t) and source = 'request'),
  1, 'adding a request logs a prayer');

-- schedule_follow_up -------------------------------------------------------------

select is_empty(
  $$ select * from public.schedule_follow_up('00000000-0000-0000-0000-000000000002', (select id from t), 7) $$,
  'another user cannot schedule my request');

select is(
  (select due_label from public.schedule_follow_up('00000000-0000-0000-0000-000000000001', (select id from t), 7)),
  public.format_local(public.follow_up_due_at('00000000-0000-0000-0000-000000000001', 7), 'Asia/Singapore'),
  'scheduling returns the local due label');
select is(
  public.format_local('2026-11-10 13:00+00', 'Asia/Singapore'), 'Tue 10 Nov, 9:00 pm', 'format_local is readable');

select is(
  (select count(*)::int from public.follow_ups where prayer_request_id = (select id from t) and status = 'pending'),
  1, 'one pending follow-up');

select public.schedule_follow_up('00000000-0000-0000-0000-000000000001', (select id from t), 3);
select is(
  (select count(*)::int from public.follow_ups where prayer_request_id = (select id from t) and status = 'pending'),
  1, 'rescheduling replaces the pending follow-up instead of adding one');
select is(
  (select follow_up_days from public.prayer_requests where id = (select id from t)), 3, 'interval updated');

select is(
  (select due_label from public.schedule_follow_up('00000000-0000-0000-0000-000000000001', (select id from t), null)),
  null, '"don''t check in" returns no due label');
select is(
  (select count(*)::int from public.follow_ups where prayer_request_id = (select id from t) and status = 'pending'),
  0, '"don''t check in" cancels the pending follow-up');

-- claim_due_follow_ups -------------------------------------------------------------

select public.schedule_follow_up('00000000-0000-0000-0000-000000000001', (select id from t), 7);
select is_empty($$ select * from public.claim_due_follow_ups() $$, 'nothing claimed before it is due');

update public.follow_ups set due_at = now() - interval '1 minute' where status = 'pending';
create temp table claimed as select * from public.claim_due_follow_ups();
select is((select count(*)::int from claimed), 1, 'due follow-up is claimed');
select is((select title from claimed), 'Sarah', 'claim returns the request title');
select is((select prayer_count from claimed), 1::bigint, 'claim returns how many times they prayed');
select is_empty($$ select * from public.claim_due_follow_ups() $$, 'a second run claims nothing');

-- respond_follow_up -------------------------------------------------------------------

select is_empty(
  $$ select * from public.respond_follow_up('00000000-0000-0000-0000-000000000002',
       (select follow_up_id from claimed), 'answered') $$,
  'another user cannot answer my follow-up');

select isnt(
  (select next_label from public.respond_follow_up('00000000-0000-0000-0000-000000000001',
     (select follow_up_id from claimed), 'still_praying')),
  null, 'still praying schedules the next follow-up');
select is(
  (select count(*)::int from public.prayer_logs where prayer_request_id = (select id from t)),
  2, 'still praying logs a prayer');
select is_empty(
  $$ select * from public.respond_follow_up('00000000-0000-0000-0000-000000000001',
       (select follow_up_id from claimed), 'still_praying') $$,
  'a double tap does nothing the second time');

update public.follow_ups set due_at = now() - interval '1 minute' where status = 'pending';
delete from claimed;
insert into claimed select * from public.claim_due_follow_ups();
select is(
  (select next_label from public.respond_follow_up('00000000-0000-0000-0000-000000000001',
     (select follow_up_id from claimed), 'answered')),
  null, 'answered schedules nothing');
select is(
  (select status from public.prayer_requests where id = (select id from t)), 'answered', 'request marked answered');

-- list_active_requests ----------------------------------------------------------------

select is_empty(
  $$ select * from public.list_active_requests('00000000-0000-0000-0000-000000000001') $$,
  'answered requests are not listed as active');

-- privileges ----------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.respond_follow_up(uuid, uuid, text)', 'execute'),
  'anon cannot call the functions');
select ok(
  not has_table_privilege('authenticated', 'public.prayer_requests', 'select'),
  'authenticated cannot read prayer requests');

select * from finish();
rollback;
