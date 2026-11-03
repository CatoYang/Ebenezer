// Mini App endpoints. Every query is scoped to the authenticated user; state changes go through the
// SQL functions, which also check ownership and status.
//
//   GET   /me                        the user's name and settings
//   PATCH /me                        { reminder_time?: "HH:MM", nudges_enabled?, weekly_summary_enabled?, timezone? }
//   GET   /journey                   streaks, totals and a calendar of days prayed
//   GET   /requests                  active requests + names prayed for before (suggestions)
//   POST  /requests                  { title, details?, follow_up_days? }
//   PATCH /requests/:id              { title, details? }
//   POST  /requests/:id/interval     { follow_up_days }        (null = don't check in)
//   POST  /requests/:id/prayed       log "I prayed for this"
//   POST  /requests/:id/answer       { note? }
//   POST  /requests/:id/close        stop praying for it
//   GET   /stones                    answered requests
//   PATCH /stones/:id                { note }
//   POST  /study                     { minutes, note? }       log a Bible study session
//   PATCH /study/:id                 { minutes, note? }
//   POST  /study/:id/delete

import { FOLLOW_UP_DAYS } from "../_shared/callbacks.ts";
import type { Db, UserRow } from "../_shared/db.ts";
import { DETAILS_MAX, TITLE_MAX } from "../_shared/requests.ts";
import { STUDY_NOTE_MAX, validMinutes } from "../_shared/study.ts";

type Result = { status: number; body: unknown };
type Body = Record<string, unknown>;

const ok = (body: unknown = {}): Result => ({ status: 200, body });
const bad = (error: string): Result => ({ status: 400, body: { error } });
const notFound = (): Result => ({ status: 404, body: { error: "not_found" } });

const NOTE_MAX = 1000;
const NAME_SUGGESTIONS = 12;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ---- input validation ----------------------------------------------------------------

/** Trimmed text, null if empty. Single-line fields collapse whitespace; notes keep their line breaks. */
function text(value: unknown, max: number, multiline = false): string | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return "invalid";
  const clean = multiline
    ? value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    : value.replace(/\s+/g, " ").trim();
  if (clean.length > max) return "invalid";
  return clean || null;
}

function days(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined) return null;
  return (FOLLOW_UP_DAYS as readonly unknown[]).includes(value) ? value as number : "invalid";
}

function titleAndDetails(body: Body) {
  const title = text(body.title, TITLE_MAX);
  const details = text(body.details, DETAILS_MAX);
  if (title === null || title === "invalid" || details === "invalid") return null;
  return { title, details };
}

function settings(user: UserRow) {
  return {
    first_name: user.first_name,
    timezone: user.timezone,
    reminder_time: user.reminder_time?.slice(0, 5) ?? null,
    nudges_enabled: user.nudges_enabled,
    weekly_summary_enabled: user.weekly_summary_enabled,
  };
}

// ---- routing -------------------------------------------------------------------------

export async function route(
  db: Db,
  user: UserRow,
  method: string,
  path: string,
  body: Body,
): Promise<Result> {
  const parts = path.split("/").filter(Boolean);
  const [resource, id, action] = parts;
  if (id !== undefined && !UUID.test(id)) return notFound();

  const call = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, { p_user_id: user.id, ...args });
    if (error) throw error;
    return data;
  };

  // GET /me
  if (method === "GET" && resource === "me" && !id) return ok(settings(user));

  // PATCH /me
  if (method === "PATCH" && resource === "me" && !id) {
    const time = body.reminder_time;
    const tz = body.timezone;
    if (time !== undefined && (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      return bad("invalid_reminder_time");
    }
    if (tz !== undefined && (typeof tz !== "string" || tz.length > 64)) return bad("invalid_timezone");
    for (const key of ["nudges_enabled", "weekly_summary_enabled"]) {
      if (body[key] !== undefined && typeof body[key] !== "boolean") return bad(`invalid_${key}`);
    }
    const { data, error } = await db.rpc("update_user_settings", {
      p_user_id: user.id,
      p_reminder_time: time ?? null,
      p_nudges_enabled: body.nudges_enabled ?? null,
      p_timezone: tz ?? null,
      p_weekly_summary: body.weekly_summary_enabled ?? null,
    });
    if (error?.code === "22023") return bad("invalid_timezone");
    if (error) throw error;
    return ok(settings(data as UserRow));
  }

  // GET /journey
  if (method === "GET" && resource === "journey" && !id) return ok(await call("journey", {}));

  if (resource === "requests") {
    // GET /requests
    if (method === "GET" && !id) {
      const requests = await call("list_active_requests", { p_limit: 200 });
      const { data: titles, error } = await db.from("prayer_requests").select("title")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const seen = new Set<string>();
      const names: string[] = [];
      for (const { title } of titles as { title: string }[]) {
        const key = title.toLowerCase();
        if (!seen.has(key) && names.length < NAME_SUGGESTIONS) {
          seen.add(key);
          names.push(title);
        }
      }
      return ok({ requests, names });
    }

    // POST /requests
    if (method === "POST" && !id) {
      const fields = titleAndDetails(body);
      const interval = days(body.follow_up_days);
      if (!fields || interval === "invalid") return bad("invalid_request");
      const requestId = await call("create_prayer_request", {
        p_title: fields.title,
        p_details: fields.details,
      });
      const [scheduled] = await call("schedule_follow_up", { p_request_id: requestId, p_days: interval });
      return ok({ id: requestId, next_check_in: scheduled?.due_label ?? null });
    }

    if (!id) return notFound();

    // PATCH /requests/:id
    if (method === "PATCH" && !action) {
      const fields = titleAndDetails(body);
      if (!fields) return bad("invalid_request");
      const { data, error } = await db.from("prayer_requests").update(fields)
        .eq("id", id).eq("user_id", user.id).eq("status", "active").select("id");
      if (error) throw error;
      return data.length ? ok() : notFound();
    }

    if (method === "POST") {
      switch (action) {
        case "interval": {
          const interval = days(body.follow_up_days);
          if (interval === "invalid") return bad("invalid_interval");
          const [row] = await call("schedule_follow_up", { p_request_id: id, p_days: interval });
          return row ? ok({ next_check_in: row.due_label }) : notFound();
        }
        case "prayed": {
          const count = await call("log_request_prayer", { p_request_id: id });
          return count === null ? notFound() : ok({ prayer_count: count });
        }
        case "answer": {
          const note = text(body.note, NOTE_MAX, true);
          if (note === "invalid") return bad("invalid_note");
          return (await call("answer_request", { p_request_id: id, p_note: note })) ? ok() : notFound();
        }
        case "close":
          return (await call("close_request", { p_request_id: id })) ? ok() : notFound();
      }
    }
  }

  if (resource === "stones") {
    // GET /stones
    if (method === "GET" && !id) {
      return ok({ stones: await call("list_answered_requests", { p_limit: 200 }) });
    }

    // PATCH /stones/:id
    if (method === "PATCH" && id && !action) {
      const note = text(body.note, NOTE_MAX, true);
      if (note === "invalid") return bad("invalid_note");
      const { data, error } = await db.from("prayer_requests").update({ answer_note: note })
        .eq("id", id).eq("user_id", user.id).eq("status", "answered").select("id");
      if (error) throw error;
      return data.length ? ok() : notFound();
    }
  }

  if (resource === "study") {
    const minutes = validMinutes(body.minutes);
    const note = text(body.note, STUDY_NOTE_MAX);

    // POST /study
    if (method === "POST" && !id) {
      if (minutes === null || note === "invalid") return bad("invalid_study");
      return ok({ id: await call("log_study", { p_minutes: minutes, p_note: note, p_source: "miniapp" }) });
    }

    // PATCH /study/:id
    if (method === "PATCH" && id && !action) {
      if (minutes === null || note === "invalid") return bad("invalid_study");
      return (await call("update_study_log", { p_id: id, p_minutes: minutes, p_note: note }))
        ? ok()
        : notFound();
    }

    // POST /study/:id/delete
    if (method === "POST" && id && action === "delete") {
      return (await call("delete_study_log", { p_id: id })) ? ok() : notFound();
    }
  }

  return notFound();
}
