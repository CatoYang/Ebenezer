-- Phase 1 schema: individual users only. Connections (shepherds) come in a later phase.
-- All times are timestamptz (UTC). Local times are derived with users.timezone.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.users (
  id                  uuid primary key default gen_random_uuid(),
  telegram_user_id    bigint not null unique,
  first_name          text,
  language_code       text,
  timezone            text not null default 'Asia/Singapore',
  -- Local time for daily nudges and follow-ups. Null until the user picks one during onboarding.
  reminder_time       time,
  nudges_enabled      boolean not null default true,
  privacy_accepted_at timestamptz,
  -- Free-text reply the bot is waiting for, e.g. {"kind":"request_title","prompt_message_id":123}.
  -- Replaces a conversation framework: everything else is structured buttons.
  awaiting            jsonb,
  -- Set when Telegram returns 403 (user blocked the bot). Cleared on their next message.
  blocked_at          timestamptz,
  created_at          timestamptz not null default now()
);

create table public.prayer_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete cascade,
  title          text not null,          -- who or what, e.g. "Sarah"
  details        text,                   -- e.g. "surgery on Friday"
  status         text not null default 'active' check (status in ('active', 'answered', 'closed')),
  follow_up_days int  not null check (follow_up_days between 1 and 90),
  answer_note    text,
  created_at     timestamptz not null default now(),
  answered_at    timestamptz,
  closed_at      timestamptz
);
create index prayer_requests_user_status_idx on public.prayer_requests (user_id, status);

create table public.follow_ups (
  id                  uuid primary key default gen_random_uuid(),
  prayer_request_id   uuid not null references public.prayer_requests (id) on delete cascade,
  due_at              timestamptz not null,
  status              text not null default 'pending'
                        check (status in ('pending', 'sent', 'responded', 'cancelled')),
  response            text check (response in ('answered', 'still_praying', 'later', 'stop')),
  telegram_message_id bigint,
  sent_at             timestamptz,
  responded_at        timestamptz,
  created_at          timestamptz not null default now()
);
-- At most one open follow-up per request, so a double-tapped button can't schedule two.
create unique index follow_ups_one_open_per_request
  on public.follow_ups (prayer_request_id) where status in ('pending', 'sent');
create index follow_ups_due_idx on public.follow_ups (due_at) where status = 'pending';

create table public.prayer_logs (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references public.users (id) on delete cascade,
  prayer_request_id uuid references public.prayer_requests (id) on delete set null,
  prayed_at         timestamptz not null default now(),
  source            text not null check (source in ('command', 'nudge', 'request', 'follow_up', 'miniapp'))
);
create index prayer_logs_user_time_idx on public.prayer_logs (user_id, prayed_at desc);

-- One row per scheduled send. The unique key is what makes the scheduler idempotent.
create table public.notifications (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references public.users (id) on delete cascade,
  kind                text not null check (kind in ('nudge', 'weekly_digest')),
  period_key          text not null,     -- local date for nudges, ISO week for digests
  telegram_message_id bigint,
  sent_at             timestamptz not null default now(),
  unique (user_id, kind, period_key)
);

-- Telegram re-delivers an update if the webhook is slow; we process each update_id once.
create table public.processed_updates (
  update_id   bigint primary key,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access: only Edge Functions (service_role) touch data. RLS on, no policies.
-- ---------------------------------------------------------------------------

alter table public.users             enable row level security;
alter table public.prayer_requests   enable row level security;
alter table public.follow_ups        enable row level security;
alter table public.prayer_logs       enable row level security;
alter table public.notifications     enable row level security;
alter table public.processed_updates enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- When a follow-up created now, N days out, should fire: that local date at the user's reminder
-- time (20:00 if they haven't picked one), so follow-ups never land at 3am.
create function public.follow_up_due_at(p_user_id uuid, p_days int)
returns timestamptz
language sql stable
set search_path = ''
as $$
  select (((now() at time zone u.timezone)::date + p_days) + coalesce(u.reminder_time, time '20:00'))
         at time zone u.timezone
  from public.users u
  where u.id = p_user_id;
$$;

-- Claims today's nudge for every user whose reminder time passed within the last hour, who
-- hasn't already logged a prayer today. Claiming = inserting the notifications row, so two
-- overlapping scheduler runs can never both send the same nudge.
create function public.claim_due_nudges(p_limit int default 200)
returns table (notification_id bigint, user_id uuid, telegram_user_id bigint, first_name text)
language sql
set search_path = ''
as $$
  with local as (
    select u.id, u.timezone, u.reminder_time, (now() at time zone u.timezone) as local_now
    from public.users u
    where u.reminder_time is not null
      and u.nudges_enabled
      and u.blocked_at is null
      and u.privacy_accepted_at is not null
  ), due as (
    select l.id, l.local_now::date::text as period_key
    from local l
    where l.local_now >= l.local_now::date + l.reminder_time
      and l.local_now <  l.local_now::date + l.reminder_time + interval '1 hour'
      and not exists (
        select 1 from public.prayer_logs p
        where p.user_id = l.id
          and p.prayed_at >= (l.local_now::date)::timestamp at time zone l.timezone
      )
    limit p_limit
  ), claimed as (
    insert into public.notifications (user_id, kind, period_key)
    select d.id, 'nudge', d.period_key from due d
    on conflict (user_id, kind, period_key) do nothing
    returning id, user_id
  )
  select c.id, u.id, u.telegram_user_id, u.first_name
  from claimed c join public.users u on u.id = c.user_id;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Cron
-- ---------------------------------------------------------------------------

-- Every 5 minutes, POST to scheduler-tick. The URL and shared secret are per-environment and live
-- in Vault (see docs/SETUP.md). Until both secrets exist the job selects no rows and does nothing.
select cron.schedule(
  'scheduler-tick',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := url.decrypted_secret,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scheduler-secret', secret.decrypted_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  from vault.decrypted_secrets url, vault.decrypted_secrets secret
  where url.name = 'scheduler_url' and secret.name = 'scheduler_secret';
  $$
);

select cron.schedule(
  'prune-processed-updates',
  '17 3 * * *',
  $$ delete from public.processed_updates where received_at < now() - interval '3 days' $$
);
