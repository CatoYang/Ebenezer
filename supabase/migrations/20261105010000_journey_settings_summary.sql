-- Journey stats, a shared settings update (bot + Mini App), and the Monday weekly summary.

alter table public.users add column weekly_summary_enabled boolean not null default true;

-- Updates any subset of a user's settings (null = unchanged). If the reminder time or timezone changes,
-- pending follow-ups keep their local date but move to the new time; one that would then be in the past
-- moves to the next day. Raises 22023 for an unknown timezone. Returns the updated user.
create function public.update_user_settings(
  p_user_id        uuid,
  p_reminder_time  time    default null,
  p_nudges_enabled boolean default null,
  p_timezone       text    default null,
  p_weekly_summary boolean default null
)
returns public.users
language plpgsql
set search_path = ''
as $$
declare
  v_old public.users;
  v_new public.users;
begin
  select * into v_old from public.users u where u.id = p_user_id for update;
  if not found then return null; end if;

  if p_timezone is not null and not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = p_timezone) then
    raise exception 'invalid timezone: %', p_timezone using errcode = '22023';
  end if;

  update public.users u set
    reminder_time          = coalesce(p_reminder_time, u.reminder_time),
    nudges_enabled         = coalesce(p_nudges_enabled, u.nudges_enabled),
    timezone               = coalesce(p_timezone, u.timezone),
    weekly_summary_enabled = coalesce(p_weekly_summary, u.weekly_summary_enabled)
  where u.id = p_user_id
  returning * into v_new;

  if v_new.reminder_time is distinct from v_old.reminder_time or v_new.timezone <> v_old.timezone then
    update public.follow_ups f
    set due_at = ((f.due_at at time zone v_old.timezone)::date + coalesce(v_new.reminder_time, time '20:00'))
                 at time zone v_new.timezone
    from public.prayer_requests r
    where r.id = f.prayer_request_id and r.user_id = p_user_id and f.status = 'pending';

    update public.follow_ups f
    set due_at = f.due_at + interval '1 day'
    from public.prayer_requests r
    where r.id = f.prayer_request_id and r.user_id = p_user_id and f.status = 'pending' and f.due_at < now();
  end if;

  return v_new;
end;
$$;

-- Consecutive local days with at least one prayer. The current streak still counts if the last prayer
-- day was yesterday (today isn't over yet).
create function public.prayer_streaks(p_user_id uuid, p_now timestamptz default now())
returns table (current_streak int, best_streak int)
language sql stable
set search_path = ''
as $$
  with u as (
    select u.timezone, (p_now at time zone u.timezone)::date as today from public.users u where u.id = p_user_id
  ), days as (
    select distinct (p.prayed_at at time zone u.timezone)::date as day
    from public.prayer_logs p, u
    where p.user_id = p_user_id and p.prayed_at <= p_now
  ), runs as (
    select max(day) as last_day, count(*)::int as len
    from (select day, day - (row_number() over (order by day))::int as grp from days) x
    group by grp
  )
  select
    coalesce((select r.len from runs r, u where r.last_day >= u.today - 1 order by r.last_day desc limit 1), 0),
    coalesce((select max(r.len) from runs r), 0);
$$;

-- Everything the Journey screen shows, as one JSON object. Dates are the user's local dates.
create function public.journey(p_user_id uuid, p_days int default 91)
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
    ), '[]'::jsonb)
  )
  from u;
$$;

-- Claims last week's summary for users whose local time is Monday at or after their reminder time
-- (08:00 if none). Only people actually using the bot (an active request, or a prayer in the last 4
-- weeks) who joined before this week. One per user per week via notifications' unique key.
-- p_now exists for tests.
create function public.claim_due_weekly_summaries(p_limit int default 200, p_now timestamptz default now())
returns table (
  notification_id  bigint,
  telegram_user_id bigint,
  week_label       text,
  days_prayed      int,
  answered_titles  text[],
  active_requests  int,
  current_streak   int
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
        or exists (select 1 from public.prayer_logs p where p.user_id = l.id and p.prayed_at > p_now - interval '28 days'))
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
    (select s.current_streak from public.prayer_streaks(c.user_id, p_now) s)
  from claimed c
  join due d on d.id = c.user_id
  join public.users u on u.id = c.user_id;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
