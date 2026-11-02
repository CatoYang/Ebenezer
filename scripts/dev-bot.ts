// Runs the bot locally with long polling against the local Supabase stack. No webhook or tunnel needed.
// Use the DEV bot token only: this deletes the bot's webhook while it runs.
//
//   npm run bot:dev     (see package.json; requires `npm run db:start` first)

import { COMMANDS, createBot } from "../supabase/functions/_shared/bot.ts";
import { createDb } from "../supabase/functions/_shared/db.ts";
import { requireEnv } from "../supabase/functions/_shared/env.ts";

if (!requireEnv("SUPABASE_URL").startsWith("http://127.0.0.1")) {
  throw new Error("dev-bot only runs against the local Supabase stack");
}

const bot = createBot(requireEnv("BOT_TOKEN"), createDb());
bot.catch((err) => console.error("update failed:", err.error));

await bot.api.deleteWebhook();
await bot.api.setMyCommands(COMMANDS);
await bot.start({
  allowed_updates: ["message", "callback_query", "my_chat_member"],
  onStart: (me) => console.log(`Polling as @${me.username}. Ctrl+C to stop.`),
});
