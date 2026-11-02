// Runs the bot locally with long polling against the local Supabase stack. No webhook or tunnel needed.
// Also runs the scheduler every minute, standing in for Supabase Cron, so nudges and follow-ups arrive.
// Use the DEV bot token only: this deletes the bot's webhook while it runs.
//
//   npm run bot:dev     (see package.json; requires `npm run db:start` first)

import { COMMANDS, createBot } from "../supabase/functions/_shared/bot.ts";
import { createDb } from "../supabase/functions/_shared/db.ts";
import { requireEnv } from "../supabase/functions/_shared/env.ts";
import { sendDueFollowUps } from "../supabase/functions/scheduler-tick/follow_ups.ts";
import { sendDueNudges } from "../supabase/functions/scheduler-tick/nudges.ts";

if (!requireEnv("SUPABASE_URL").startsWith("http://127.0.0.1")) {
  throw new Error("dev-bot only runs against the local Supabase stack");
}

const db = createDb();
const bot = createBot(requireEnv("BOT_TOKEN"), db);
bot.catch((err) => console.error("update failed:", err.error));

async function tick() {
  try {
    const followUps = await sendDueFollowUps(db, bot.api);
    const nudges = await sendDueNudges(db, bot.api);
    if (followUps.due || nudges.due) console.log("scheduler:", JSON.stringify({ followUps, nudges }));
  } catch (err) {
    console.error("scheduler failed:", err instanceof Error ? err.message : err);
  }
}

await bot.api.deleteWebhook();
await bot.api.setMyCommands(COMMANDS);
setInterval(tick, 60_000);
await bot.start({
  allowed_updates: ["message", "callback_query", "my_chat_member"],
  onStart: (me) => {
    console.log(`Polling as @${me.username}. Scheduler runs every minute. Ctrl+C to stop.`);
    tick();
  },
});
