-- pg_cron logs every run in cron.job_run_details and never deletes them: the 5-minute scheduler-tick
-- alone adds ~105,000 rows a year. Keep a week of routine runs (enough to check the timer is running)
-- and 90 days of anything that didn't succeed, so problems stay visible for troubleshooting.

create or replace function public.prune_cron_history(p_now timestamptz default now())
returns integer
language sql
set search_path = ''
as $$
  with deleted as (
    delete from cron.job_run_details
    where start_time < p_now - interval '90 days'
       or (status = 'succeeded' and start_time < p_now - interval '7 days')
    returning 1
  )
  select count(*)::int from deleted;
$$;

select cron.schedule(
  'prune-cron-history',
  '27 3 * * *',
  $$ select public.prune_cron_history() $$
);

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
