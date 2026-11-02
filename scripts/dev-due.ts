// Testing only: makes every pending follow-up due now.
//
//   npm run dev:due         local stack: `npm run bot:dev` sends them within a minute
//   npm run cloud:dev:due   cloud DEV project: Supabase Cron sends them within 5 minutes
//
// Refuses to run against anything except the local stack or the dev project named in .env.dev, so it
// can never touch production.

import { createDb } from "../supabase/functions/_shared/db.ts";
import { requireEnv } from "../supabase/functions/_shared/env.ts";

const url = requireEnv("SUPABASE_URL");
const devRef = Deno.env.get("SUPABASE_PROJECT_REF");
const isLocal = url.startsWith("http://127.0.0.1");
const isCloudDev = !!devRef && url === `https://${devRef}.supabase.co`;
if (!isLocal && !isCloudDev) {
  throw new Error("dev-due only runs against the local stack or the cloud dev project");
}

const { data, error } = await createDb().from("follow_ups")
  .update({ due_at: new Date().toISOString() }).eq("status", "pending").select("id");
if (error) throw error;

const when = isLocal
  ? "bot:dev will send them within a minute"
  : "The cloud scheduler will send them within 5 minutes";
console.log(`${data.length} follow-up(s) now due (${isLocal ? "local" : "cloud dev"}). ${when}.`);
