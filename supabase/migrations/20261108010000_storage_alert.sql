-- Warnings for the maintainer (not for users), e.g. the database nearing its storage quota. One row per
-- kind per UTC day, so the scheduler sends each warning at most once a day.

create table public.admin_alerts (
  kind       text not null check (kind in ('storage')),
  period_key text not null,                         -- UTC date, "YYYY-MM-DD"
  sent_at    timestamptz not null default now(),
  primary key (kind, period_key)
);

alter table public.admin_alerts enable row level security;
revoke all on public.admin_alerts from anon, authenticated;

-- Claims today's storage warning if the database uses at least p_threshold of p_quota_bytes. Returns no
-- row below the threshold or if today's warning is already claimed. p_now and p_size_bytes are for tests.
create function public.claim_storage_alert(
  p_quota_bytes bigint,
  p_threshold   numeric default 0.8,
  p_now         timestamptz default now(),
  p_size_bytes  bigint default null
)
returns table (alert_period text, used_bytes bigint, limit_bytes bigint)
language sql
set search_path = ''
as $$
  with s as (
    select coalesce(p_size_bytes, pg_database_size(current_database())) as size
  ), claimed as (
    insert into public.admin_alerts (kind, period_key)
    select 'storage', to_char(p_now at time zone 'UTC', 'YYYY-MM-DD') from s
    where s.size >= p_threshold * p_quota_bytes
    on conflict do nothing
    returning admin_alerts.period_key
  )
  select c.period_key, s.size, p_quota_bytes from claimed c, s;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
