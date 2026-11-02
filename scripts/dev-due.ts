// Local testing only: makes every pending follow-up due now, so `npm run bot:dev` sends them within a
// minute instead of days from now.
//
//   npm run dev:due

import { createDb } from "../supabase/functions/_shared/db.ts";
import { requireEnv } from "../supabase/functions/_shared/env.ts";

if (!requireEnv("SUPABASE_URL").startsWith("http://127.0.0.1")) {
  throw new Error("dev-due only runs against the local Supabase stack");
}

const { data, error } = await createDb().from("follow_ups")
  .update({ due_at: new Date().toISOString() }).eq("status", "pending").select("id");
if (error) throw error;
console.log(`${data.length} follow-up(s) now due. bot:dev will send them within a minute.`);
