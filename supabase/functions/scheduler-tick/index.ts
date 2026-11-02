// Called by Supabase Cron every 5 minutes (see the init migration). Sends whatever is due.
// Authenticated with a shared secret header; deployed with verify_jwt = false.

import { Api } from "grammy";
import { createDb } from "../_shared/db.ts";
import { requireEnv, secretsMatch } from "../_shared/env.ts";
import { sendDueNudges } from "./nudges.ts";

const db = createDb();
const api = new Api(requireEnv("BOT_TOKEN"));
const secret = requireEnv("SCHEDULER_SECRET");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!secretsMatch(req.headers.get("x-scheduler-secret"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const nudges = await sendDueNudges(db, api);
  // Follow-ups and weekly digests are added here as they're built.
  return Response.json({ nudges });
});
