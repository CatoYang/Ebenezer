// Called by Supabase Cron every 5 minutes (see the init migration). Sends whatever is due.
// Authenticated with a shared secret header; deployed with verify_jwt = false.

import { Api } from "grammy";
import { createDb } from "../_shared/db.ts";
import { requireEnv, secretsMatch } from "../_shared/env.ts";
import { sendDueFollowUps } from "./follow_ups.ts";
import { sendDueNudges } from "./nudges.ts";
import { checkStorage } from "./storage.ts";
import { sendDueWeeklySummaries } from "./weekly_summaries.ts";

const db = createDb();
const api = new Api(requireEnv("BOT_TOKEN"));
const secret = requireEnv("SCHEDULER_SECRET");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!secretsMatch(req.headers.get("x-scheduler-secret"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const followUps = await sendDueFollowUps(db, api);
  const weeklySummaries = await sendDueWeeklySummaries(db, api); // before Monday's nudge
  const nudges = await sendDueNudges(db, api);
  // Last, and never allowed to fail the tick: it's for the maintainer, not users.
  const storage = await checkStorage(db, api).catch((err) => {
    console.error("storage check failed:", err instanceof Error ? err.message : err);
    return { error: true };
  });
  return Response.json({ followUps, weeklySummaries, nudges, storage });
});
