-- Functions behind the Mini App's api: manage a request directly (without waiting for a follow-up)
-- and list answered prayers ("stones"). Same rules as before: one call per state change, guarded by
-- user id and status.

-- Adds id, interval and start date so the Mini App can show and manage each request. The return
-- type changes, so the function is dropped and recreated (the bot's /list ignores the new columns).
drop function public.list_active_requests(uuid, int);
create function public.list_active_requests(p_user_id uuid, p_limit int default 30)
returns table (
  id             uuid,
  title          text,
  details        text,
  follow_up_days int,
  since_label    text,
  prayer_count   bigint,
  next_check_in  text,
  awaiting_reply boolean
)
language sql stable
set search_path = ''
as $$
  select r.id, r.title, r.details, r.follow_up_days,
    to_char(r.created_at at time zone u.timezone, 'FMDD Mon YYYY'),
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

-- Answered prayers, newest first.
create function public.list_answered_requests(p_user_id uuid, p_limit int default 100)
returns table (
  id             uuid,
  title          text,
  details        text,
  answer_note    text,
  answered_label text,
  since_label    text,
  prayer_count   bigint
)
language sql stable
set search_path = ''
as $$
  select r.id, r.title, r.details, r.answer_note,
    to_char(r.answered_at at time zone u.timezone, 'FMDD Mon YYYY'),
    to_char(r.created_at at time zone u.timezone, 'FMDD Mon YYYY'),
    (select count(*) from public.prayer_logs p where p.prayer_request_id = r.id)
  from public.prayer_requests r
  join public.users u on u.id = r.user_id
  where r.user_id = p_user_id and r.status = 'answered'
  order by r.answered_at desc
  limit p_limit;
$$;

-- Logs "I prayed for this" against an active request. Returns the new prayer count, or null if the
-- request isn't the user's or isn't active.
create function public.log_request_prayer(p_user_id uuid, p_request_id uuid)
returns bigint
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.prayer_requests r
    where r.id = p_request_id and r.user_id = p_user_id and r.status = 'active'
  ) then
    return null;
  end if;

  insert into public.prayer_logs (user_id, prayer_request_id, source)
  values (p_user_id, p_request_id, 'miniapp');

  return (select count(*) from public.prayer_logs p where p.prayer_request_id = p_request_id);
end;
$$;

-- Marks an active request answered (with an optional note) and cancels its open follow-up. A follow-up
-- message still in the chat then answers "Already recorded". Returns false if not the user's / not active.
create function public.answer_request(p_user_id uuid, p_request_id uuid, p_note text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.prayer_requests r
  set status = 'answered', answered_at = now(), answer_note = nullif(btrim(p_note), '')
  where r.id = p_request_id and r.user_id = p_user_id and r.status = 'active';
  if not found then return false; end if;

  update public.follow_ups f set status = 'cancelled'
  where f.prayer_request_id = p_request_id and f.status in ('pending', 'sent');
  return true;
end;
$$;

-- Stops praying for an active request (closed, not answered) and cancels its open follow-up.
create function public.close_request(p_user_id uuid, p_request_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.prayer_requests r
  set status = 'closed', closed_at = now()
  where r.id = p_request_id and r.user_id = p_user_id and r.status = 'active';
  if not found then return false; end if;

  update public.follow_ups f set status = 'cancelled'
  where f.prayer_request_id = p_request_id and f.status in ('pending', 'sent');
  return true;
end;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
