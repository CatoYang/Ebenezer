begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- Fixture runs use negative job and run ids (no real job has them, and the test role can't use
-- cron's id sequence), so assertions only see the test's own rows.
-- A fixed p_now keeps the ages exact.
insert into cron.job_run_details (runid, jobid, username, command, status, start_time, end_time) values
  (-1, -1, current_user, 'ok-recent',  'succeeded', '2026-11-01 00:00+00', '2026-11-01 00:00+00'),  -- 2 days
  (-2, -1, current_user, 'ok-old',     'succeeded', '2026-10-20 00:00+00', '2026-10-20 00:00+00'),  -- 14 days
  (-3, -1, current_user, 'fail-old',   'failed',    '2026-10-01 00:00+00', '2026-10-01 00:00+00'),  -- 33 days
  (-4, -1, current_user, 'fail-older', 'failed',    '2026-07-01 00:00+00', '2026-07-01 00:00+00');  -- 125 days

select ok(
  public.prune_cron_history('2026-11-03 00:00+00') >= 2,
  'returns how many rows it deleted'
);

select results_eq(
  $$ select command from cron.job_run_details where jobid = -1 order by command $$,
  $$ values ('fail-old'), ('ok-recent') $$,
  'keeps a week of successful runs and 90 days of failures'
);

select is(
  public.prune_cron_history('2026-11-03 00:00+00'),
  0,
  'a second run deletes nothing'
);

select is(
  (select schedule from cron.job where jobname = 'prune-cron-history'),
  '27 3 * * *',
  'the daily prune job is scheduled'
);

select * from finish();
rollback;
