begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Fixture users in Singapore. Reminder times are set relative to "now" so the test works at any hour.
-- (Flaky only in the first ~2 hours after local midnight, when "now minus 2 hours" is yesterday.)
insert into public.users (id, telegram_user_id, timezone, reminder_time, privacy_accepted_at) values
  ('00000000-0000-0000-0000-000000000001', 1, 'Asia/Singapore',
     ((now() at time zone 'Asia/Singapore') - interval '10 minutes')::time, now()),  -- due
  ('00000000-0000-0000-0000-000000000002', 2, 'Asia/Singapore',
     ((now() at time zone 'Asia/Singapore') - interval '2 hours')::time, now()),     -- window passed
  ('00000000-0000-0000-0000-000000000003', 3, 'Asia/Singapore',
     ((now() at time zone 'Asia/Singapore') - interval '10 minutes')::time, now()),  -- already prayed
  ('00000000-0000-0000-0000-000000000004', 4, 'Asia/Singapore',
     ((now() at time zone 'Asia/Singapore') - interval '10 minutes')::time, null),   -- no consent
  ('00000000-0000-0000-0000-000000000005', 5, 'America/New_York', '21:00', now());

update public.users set blocked_at = now() where telegram_user_id = 5;
insert into public.prayer_logs (user_id, source) values ('00000000-0000-0000-0000-000000000003', 'command');

-- claim_due_nudges -----------------------------------------------------------

select results_eq(
  $$ select telegram_user_id from public.claim_due_nudges() order by 1 $$,
  $$ values (1::bigint) $$,
  'only the user inside their reminder window, consented, unblocked and not yet prayed is claimed'
);

select is_empty(
  $$ select * from public.claim_due_nudges() $$,
  'a second run claims nothing (no double send)'
);

select is(
  (select period_key from public.notifications where user_id = '00000000-0000-0000-0000-000000000001'),
  ((now() at time zone 'Asia/Singapore')::date)::text,
  'period_key is the user''s local date'
);

update public.users set nudges_enabled = false where telegram_user_id = 1;
delete from public.notifications;
select is_empty($$ select * from public.claim_due_nudges() $$, 'nudges_enabled = false is skipped');

-- follow_up_due_at -----------------------------------------------------------

update public.users set reminder_time = '21:00' where telegram_user_id = 1;

select is(
  (public.follow_up_due_at('00000000-0000-0000-0000-000000000001', 7) at time zone 'Asia/Singapore')::time,
  time '21:00',
  'follow-up lands at the user''s reminder time'
);

select is(
  (public.follow_up_due_at('00000000-0000-0000-0000-000000000001', 7) at time zone 'Asia/Singapore')::date,
  (now() at time zone 'Asia/Singapore')::date + 7,
  'follow-up lands N local days out'
);

update public.users set reminder_time = null where telegram_user_id = 1;
select is(
  (public.follow_up_due_at('00000000-0000-0000-0000-000000000001', 3) at time zone 'Asia/Singapore')::time,
  time '20:00',
  'no reminder time chosen yet falls back to 8 pm'
);

select is(
  (public.follow_up_due_at('00000000-0000-0000-0000-000000000005', 1) at time zone 'America/New_York')::time,
  time '21:00',
  'other timezones convert correctly'
);

-- one open follow-up per request ------------------------------------------------

insert into public.prayer_requests (id, user_id, title, follow_up_days)
values ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000001', 'Sarah', 7);
insert into public.follow_ups (prayer_request_id, due_at) values ('00000000-0000-0000-0000-0000000000aa', now());

select throws_ok(
  $$ insert into public.follow_ups (prayer_request_id, due_at)
     values ('00000000-0000-0000-0000-0000000000aa', now() + interval '1 day') $$,
  '23505',
  null,
  'a second open follow-up for the same request is rejected'
);

select * from finish();
rollback;
