-- Bible study tracking: minutes studied, with an optional note (e.g. what was read). Kept apart from
-- prayer_logs so prayer streaks, the Journey prayer stats and the daily nudge are unaffected.

create table public.study_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  studied_at        timestamptz not null default now(),
  minutes           int  not null check (minutes between 1 and 600),
  note              text check (char_length(note) <= 500),
  source            text not null check (source in ('command', 'miniapp')),
  -- The bot message whose minutes button was tapped. Unique per user, so a double tap logs once.
  prompt_message_id bigint,
  unique (user_id, prompt_message_id)
);
create index study_logs_user_time_idx on public.study_logs (user_id, studied_at desc);

alter table public.study_logs enable row level security;
revoke all on public.study_logs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Streaks: one helper for prayer and Bible study
-- ---------------------------------------------------------------------------

-- Current and best run of consecutive days. The current run still counts if it ended yesterday
-- (today isn't over yet).
create function public.day_streaks(p_days date[], p_today date)
returns table (current_streak int, best_streak int)
language sql immutable
set search_path = ''
as $$
  with days as (
    select distinct d as day from unnest(p_days) d
  ), runs as (
    select max(day) as last_day, count(*)::int as len
    from (select day, day - (row_number() over (order by day))::int as grp from days) x
    group by grp
  )
  select
    coalesce((select r.len from runs r where r.last_day >= p_today - 1 order by r.last_day desc limit 1), 0),
    coalesce((select max(r.len) from runs r), 0);
$$;

create or replace function public.prayer_streaks(p_user_id uuid, p_now timestamptz default now())
returns table (current_streak int, best_streak int)
language sql stable
set search_path = ''
as $$
  select s.current_streak, s.best_streak
  from public.users u,
    public.day_streaks(
      array(select (p.prayed_at at time zone u.timezone)::date from public.prayer_logs p
            where p.user_id = u.id and p.prayed_at <= p_now),
      (p_now at time zone u.timezone)::date
    ) s
  where u.id = p_user_id;
$$;

create function public.study_streaks(p_user_id uuid, p_now timestamptz default now())
returns table (current_streak int, best_streak int)
language sql stable
set search_path = ''
as $$
  select s.current_streak, s.best_streak
  from public.users u,
    public.day_streaks(
      array(select (l.studied_at at time zone u.timezone)::date from public.study_logs l
            where l.user_id = u.id and l.studied_at <= p_now),
      (p_now at time zone u.timezone)::date
    ) s
  where u.id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- Logging, editing and deleting a session
-- ---------------------------------------------------------------------------

-- Returns the new session's id, or null if this bot message was already logged (a double tap).
create function public.log_study(
  p_user_id uuid,
  p_minutes int,
  p_note text,
  p_source text,
  p_prompt_message_id bigint default null
)
returns uuid
language sql
set search_path = ''
as $$
  insert into public.study_logs (user_id, minutes, note, source, prompt_message_id)
  values (p_user_id, p_minutes, nullif(btrim(p_note), ''), p_source, p_prompt_message_id)
  on conflict (user_id, prompt_message_id) do nothing
  returning id;
$$;

-- p_minutes null = unchanged; p_note is always set (null or empty clears it). False if it isn't the
-- user's session.
create function public.update_study_log(p_user_id uuid, p_id uuid, p_minutes int, p_note text)
returns boolean
language sql
set search_path = ''
as $$
  with changed as (
    update public.study_logs
    set minutes = coalesce(p_minutes, minutes), note = nullif(btrim(p_note), '')
    where id = p_id and user_id = p_user_id
    returning 1
  )
  select exists (select 1 from changed);
$$;

create function public.delete_study_log(p_user_id uuid, p_id uuid)
returns boolean
language sql
set search_path = ''
as $$
  with gone as (
    delete from public.study_logs where id = p_id and user_id = p_user_id returning 1
  )
  select exists (select 1 from gone);
$$;

-- ---------------------------------------------------------------------------
-- Journey: Bible study section
-- ---------------------------------------------------------------------------

-- Everything the Journey screen shows about Bible study, as JSON. Dates are the user's local dates.
create function public.study_summary(p_user_id uuid, p_now timestamptz default now(), p_recent int default 10)
returns jsonb
language sql stable
set search_path = ''
as $$
  with u as (
    select u.timezone, (p_now at time zone u.timezone)::date as today,
           date_trunc('week', p_now at time zone u.timezone)::date as week_start
    from public.users u where u.id = p_user_id
  ), logs as (
    select l.id, l.minutes, l.note, l.studied_at, (l.studied_at at time zone u.timezone)::date as day
    from public.study_logs l, u
    where l.user_id = p_user_id and l.studied_at <= p_now
  ), s as (
    select * from public.study_streaks(p_user_id, p_now)
  )
  select jsonb_build_object(
    'days_this_week',    (select count(distinct day) from logs, u where day >= u.week_start),
    'minutes_this_week', (select coalesce(sum(minutes), 0) from logs, u where day >= u.week_start),
    'current_streak',    (select current_streak from s),
    'best_streak',       (select best_streak from s),
    'total_minutes',     (select coalesce(sum(minutes), 0) from logs),
    'total_days',        (select count(distinct day) from logs),
    'this_week', coalesce((
      select jsonb_agg(jsonb_build_object('date', c.day, 'count', c.n) order by c.day)
      from (select day, sum(minutes) as n from logs, u where day >= u.week_start group by day) c
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'minutes', r.minutes, 'note', r.note, 'label', public.format_local(r.studied_at, u.timezone)
      ) order by r.studied_at desc)
      from (select * from logs order by studied_at desc limit p_recent) r, u
    ), '[]'::jsonb)
  )
  from u;
$$;

-- Same as before, plus a 'study' object.
create or replace function public.journey(p_user_id uuid, p_days int default 91)
returns jsonb
language sql stable
set search_path = ''
as $$
  with u as (
    select u.timezone, (now() at time zone u.timezone)::date as today from public.users u where u.id = p_user_id
  ), logs as (
    select (p.prayed_at at time zone u.timezone)::date as day from public.prayer_logs p, u where p.user_id = p_user_id
  ), s as (
    select * from public.prayer_streaks(p_user_id)
  )
  select jsonb_build_object(
    'today',             (select today from u),
    'days_this_week',    (select count(distinct day) from logs, u where day >= date_trunc('week', u.today)::date),
    'current_streak',    (select current_streak from s),
    'best_streak',       (select best_streak from s),
    'total_prayers',     (select count(*) from logs),
    'total_days',        (select count(distinct day) from logs),
    'active_requests',   (select count(*) from public.prayer_requests r where r.user_id = p_user_id and r.status = 'active'),
    'answered_requests', (select count(*) from public.prayer_requests r where r.user_id = p_user_id and r.status = 'answered'),
    'calendar', coalesce((
      select jsonb_agg(jsonb_build_object('date', c.day, 'count', c.n) order by c.day)
      from (select day, count(*) as n from logs, u where day > u.today - p_days group by day) c
    ), '[]'::jsonb),
    'study', public.study_summary(p_user_id)
  )
  from u;
$$;

-- ---------------------------------------------------------------------------
-- Weekly summary: adds Bible study days and minutes, and counts recent study as activity
-- ---------------------------------------------------------------------------

drop function public.claim_due_weekly_summaries(int, timestamptz);

create function public.claim_due_weekly_summaries(p_limit int default 200, p_now timestamptz default now())
returns table (
  notification_id  bigint,
  telegram_user_id bigint,
  week_label       text,
  days_prayed      int,
  answered_titles  text[],
  active_requests  int,
  current_streak   int,
  study_days       int,
  study_minutes    int
)
language sql
set search_path = ''
as $$
  with local as (
    select u.id, u.timezone, u.created_at,
           coalesce(u.reminder_time, time '08:00') as at_time,
           (p_now at time zone u.timezone) as local_now
    from public.users u
    where u.weekly_summary_enabled and u.blocked_at is null and u.privacy_accepted_at is not null
  ), due as (
    select l.id, l.timezone,
           date_trunc('week', l.local_now)::date - 7 as week_start,
           to_char(date_trunc('week', l.local_now)::date - 7, 'IYYY-"W"IW') as period_key
    from local l
    where extract(isodow from l.local_now) = 1
      and l.local_now >= l.local_now::date + l.at_time
      and l.created_at < (date_trunc('week', l.local_now)) at time zone l.timezone
      and (exists (select 1 from public.prayer_requests r where r.user_id = l.id and r.status = 'active')
        or exists (select 1 from public.prayer_logs p where p.user_id = l.id and p.prayed_at > p_now - interval '28 days')
        or exists (select 1 from public.study_logs s where s.user_id = l.id and s.studied_at > p_now - interval '28 days'))
    limit p_limit
  ), claimed as (
    insert into public.notifications (user_id, kind, period_key)
    select d.id, 'weekly_digest', d.period_key from due d
    on conflict (user_id, kind, period_key) do nothing
    returning id, user_id
  )
  select c.id, u.telegram_user_id,
    to_char(d.week_start, 'FMDD Mon') || ' – ' || to_char(d.week_start + 6, 'FMDD Mon'),
    (select count(distinct (p.prayed_at at time zone d.timezone)::date)::int
       from public.prayer_logs p
       where p.user_id = c.user_id
         and p.prayed_at >= d.week_start::timestamp at time zone d.timezone
         and p.prayed_at <  (d.week_start + 7)::timestamp at time zone d.timezone),
    array(select r.title from public.prayer_requests r
          where r.user_id = c.user_id and r.status = 'answered'
            and r.answered_at >= d.week_start::timestamp at time zone d.timezone
            and r.answered_at <  (d.week_start + 7)::timestamp at time zone d.timezone
          order by r.answered_at),
    (select count(*)::int from public.prayer_requests r where r.user_id = c.user_id and r.status = 'active'),
    (select s.current_streak from public.prayer_streaks(c.user_id, p_now) s),
    st.days,
    st.minutes
  from claimed c
  join due d on d.id = c.user_id
  join public.users u on u.id = c.user_id
  cross join lateral (
    select count(distinct (s.studied_at at time zone d.timezone)::date)::int as days,
           coalesce(sum(s.minutes), 0)::int as minutes
    from public.study_logs s
    where s.user_id = c.user_id
      and s.studied_at >= d.week_start::timestamp at time zone d.timezone
      and s.studied_at <  (d.week_start + 7)::timestamp at time zone d.timezone
  ) st;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
