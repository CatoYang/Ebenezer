-- Prayer requests and the follow-up loop. Every state change is one SQL call so double taps,
-- retries and overlapping scheduler runs can't leave a request half-updated.

-- A request may have no follow-up (the user chose "Don't check in", or hasn't chosen yet).
alter table public.prayer_requests alter column follow_up_days drop not null;
alter table public.prayer_requests
  add constraint prayer_requests_title_length   check (char_length(title) between 1 and 200),
  add constraint prayer_requests_details_length check (details is null or char_length(details) <= 500),
  add constraint prayer_requests_note_length    check (answer_note is null or char_length(answer_note) <= 1000);

-- Functions created later must not be callable by the public API roles either.
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

-- "Sat 10 Nov, 9:00 pm" in the given timezone.
create function public.format_local(p_ts timestamptz, p_tz text)
returns text
language sql stable
set search_path = ''
as $$
  select to_char(p_ts at time zone p_tz, 'Dy FMDD Mon, FMHH12:MI am');
$$;

-- Saves a new active request and logs a prayer for it (adding it is praying for it).
create function public.create_prayer_request(p_user_id uuid, p_title text, p_details text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.prayer_requests (user_id, title, details)
  values (p_user_id, p_title, p_details)
  returning id into v_id;

  insert into public.prayer_logs (user_id, prayer_request_id, source)
  values (p_user_id, v_id, 'request');

  return v_id;
end;
$$;

-- Sets how often to follow up on a request (null = don't) and (re)schedules its next follow-up.
-- Returns no rows if the request isn't the user's or isn't active.
create function public.schedule_follow_up(p_user_id uuid, p_request_id uuid, p_days int)
returns table (title text, details text, due_label text)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_req record;
  v_due timestamptz;
begin
  select r.id, r.title, r.details, u.timezone into v_req
  from public.prayer_requests r join public.users u on u.id = r.user_id
  where r.id = p_request_id and r.user_id = p_user_id and r.status = 'active'
  for update of r;
  if not found then return; end if;

  update public.follow_ups f set status = 'cancelled'
  where f.prayer_request_id = p_request_id and f.status in ('pending', 'sent');

  update public.prayer_requests r set follow_up_days = p_days where r.id = p_request_id;

  if p_days is not null then
    v_due := public.follow_up_due_at(p_user_id, p_days);
    insert into public.follow_ups (prayer_request_id, due_at) values (p_request_id, v_due);
  end if;

  return query select v_req.title, v_req.details,
    case when v_due is null then null else public.format_local(v_due, v_req.timezone) end;
end;
$$;

-- Claims due follow-ups (pending → sent) for sending. SKIP LOCKED lets overlapping scheduler runs
-- split the work instead of both sending the same follow-up.
create function public.claim_due_follow_ups(p_limit int default 200)
returns table (
  follow_up_id     uuid,
  telegram_user_id bigint,
  title            text,
  details          text,
  since_label      text,
  prayer_count     bigint
)
language sql
set search_path = ''
as $$
  with due as (
    select f.id
    from public.follow_ups f
    join public.prayer_requests r on r.id = f.prayer_request_id
    join public.users u on u.id = r.user_id
    where f.status = 'pending'
      and f.due_at <= now()
      and r.status = 'active'
      and u.blocked_at is null
      and u.privacy_accepted_at is not null
    order by f.due_at
    limit p_limit
    for update of f skip locked
  ), claimed as (
    update public.follow_ups f set status = 'sent', sent_at = now()
    from due where f.id = due.id
    returning f.id, f.prayer_request_id
  )
  select c.id, u.telegram_user_id, r.title, r.details,
         to_char(r.created_at at time zone u.timezone, 'FMDD Mon'),
         (select count(*) from public.prayer_logs p where p.prayer_request_id = r.id)
  from claimed c
  join public.prayer_requests r on r.id = c.prayer_request_id
  join public.users u on u.id = r.user_id;
$$;

-- Records the user's answer to a sent follow-up and applies it:
--   answered → request answered · stop → request closed
--   still_praying → log a prayer, schedule the next follow-up at the same interval
--   later → schedule the next follow-up tomorrow
-- Returns no rows if the follow-up isn't the user's or was already answered (double tap).
create function public.respond_follow_up(p_user_id uuid, p_follow_up_id uuid, p_response text)
returns table (request_id uuid, title text, details text, next_label text)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v record;
  v_due timestamptz;
begin
  select f.id, f.prayer_request_id, r.title, r.details, r.follow_up_days, u.timezone into v
  from public.follow_ups f
  join public.prayer_requests r on r.id = f.prayer_request_id
  join public.users u on u.id = r.user_id
  where f.id = p_follow_up_id and r.user_id = p_user_id and f.status = 'sent' and r.status = 'active'
  for update of f, r;
  if not found then return; end if;

  update public.follow_ups f
  set status = 'responded', response = p_response, responded_at = now()
  where f.id = v.id;

  case p_response
    when 'answered' then
      update public.prayer_requests r set status = 'answered', answered_at = now() where r.id = v.prayer_request_id;
    when 'stop' then
      update public.prayer_requests r set status = 'closed', closed_at = now() where r.id = v.prayer_request_id;
    when 'still_praying' then
      insert into public.prayer_logs (user_id, prayer_request_id, source)
      values (p_user_id, v.prayer_request_id, 'follow_up');
      v_due := public.follow_up_due_at(p_user_id, coalesce(v.follow_up_days, 7));
    when 'later' then
      v_due := public.follow_up_due_at(p_user_id, 1);
    else
      raise exception 'unknown follow-up response: %', p_response;
  end case;

  if v_due is not null then
    insert into public.follow_ups (prayer_request_id, due_at) values (v.prayer_request_id, v_due);
  end if;

  return query select v.prayer_request_id, v.title, v.details,
    case when v_due is null then null else public.format_local(v_due, v.timezone) end;
end;
$$;

-- Active requests for /list, oldest first. Returns up to p_limit + 1 rows so the caller can say "and more".
create function public.list_active_requests(p_user_id uuid, p_limit int default 30)
returns table (title text, details text, prayer_count bigint, next_check_in text, awaiting_reply boolean)
language sql stable
set search_path = ''
as $$
  select r.title, r.details,
    (select count(*) from public.prayer_logs p where p.prayer_request_id = r.id),
    (select public.format_local(f.due_at, u.timezone) from public.follow_ups f
       where f.prayer_request_id = r.id and f.status = 'pending' order by f.due_at limit 1),
    exists (select 1 from public.follow_ups f where f.prayer_request_id = r.id and f.status = 'sent')
  from public.prayer_requests r
  join public.users u on u.id = r.user_id
  where r.user_id = p_user_id and r.status = 'active'
  order by r.created_at
  limit p_limit + 1;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
