begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into public.users (id, telegram_user_id, timezone, reminder_time, privacy_accepted_at) values
  ('00000000-0000-0000-0000-000000000001', 1, 'Asia/Singapore', '21:00', now()),
  ('00000000-0000-0000-0000-000000000002', 2, 'Asia/Singapore', '21:00', now());

create temp table t as
  select public.create_prayer_request('00000000-0000-0000-0000-000000000001', 'Sarah', 'surgery') as id;
select public.schedule_follow_up('00000000-0000-0000-0000-000000000001', (select id from t), 7);

-- list_active_requests -------------------------------------------------------------

select is(
  (select id from public.list_active_requests('00000000-0000-0000-0000-000000000001')),
  (select id from t), 'active list includes the request id');
select is(
  (select follow_up_days from public.list_active_requests('00000000-0000-0000-0000-000000000001')),
  7, 'active list includes the interval');
select is_empty(
  $$ select * from public.list_active_requests('00000000-0000-0000-0000-000000000002') $$,
  'other users see nothing');

-- log_request_prayer ---------------------------------------------------------------

select is(public.log_request_prayer('00000000-0000-0000-0000-000000000001', (select id from t)), 2::bigint,
  'logging a prayer returns the new count');
select is(public.log_request_prayer('00000000-0000-0000-0000-000000000002', (select id from t)), null,
  'another user cannot log against my request');
select is(
  (select source from public.prayer_logs where prayer_request_id = (select id from t) order by id desc limit 1),
  'miniapp', 'logged with source miniapp');

-- answer_request -------------------------------------------------------------------

select is(public.answer_request('00000000-0000-0000-0000-000000000002', (select id from t), 'x'), false,
  'another user cannot answer my request');
select is(public.answer_request('00000000-0000-0000-0000-000000000001', (select id from t), '  She recovered  '),
  true, 'answer succeeds');
select is((select answer_note from public.prayer_requests where id = (select id from t)), 'She recovered',
  'note is trimmed');
select is(
  (select count(*)::int from public.follow_ups where prayer_request_id = (select id from t)
     and status in ('pending', 'sent')),
  0, 'answering cancels the open follow-up');
select is(public.answer_request('00000000-0000-0000-0000-000000000001', (select id from t), null), false,
  'answering twice does nothing');

-- list_answered_requests -----------------------------------------------------------

select is(
  (select answer_note from public.list_answered_requests('00000000-0000-0000-0000-000000000001')),
  'She recovered', 'stones list shows the note');

-- close_request --------------------------------------------------------------------

create temp table t2 as
  select public.create_prayer_request('00000000-0000-0000-0000-000000000001', 'Dad', null) as id;
select public.schedule_follow_up('00000000-0000-0000-0000-000000000001', (select id from t2), 3);
select is(public.close_request('00000000-0000-0000-0000-000000000001', (select id from t2)), true, 'close succeeds');
select is((select status from public.prayer_requests where id = (select id from t2)), 'closed', 'request closed');
select is_empty(
  $$ select * from public.list_answered_requests('00000000-0000-0000-0000-000000000001')
     where title = 'Dad' $$,
  'closed requests are not stones');

select * from finish();
rollback;
