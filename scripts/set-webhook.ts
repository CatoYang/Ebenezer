// Points a bot at its deployed telegram-bot function and sets its command menu.
// Run once per environment after deploying, and again if the secret or commands change.
//
//   BOT_TOKEN=… WEBHOOK_SECRET=… PROJECT_REF=… npm run webhook:set

import { Api } from "grammy";
import { COMMANDS } from "../supabase/functions/_shared/bot.ts";
import { requireEnv } from "../supabase/functions/_shared/env.ts";

const api = new Api(requireEnv("BOT_TOKEN"));
const url = `https://${requireEnv("PROJECT_REF")}.supabase.co/functions/v1/telegram-bot`;

await api.setWebhook(url, {
  secret_token: requireEnv("WEBHOOK_SECRET"),
  allowed_updates: ["message", "callback_query", "my_chat_member"],
});
await api.setMyCommands(COMMANDS);

const info = await api.getWebhookInfo();
console.log(`Webhook: ${info.url}`);
console.log(`Pending updates: ${info.pending_update_count}`);
if (info.last_error_message) console.log(`Last error: ${info.last_error_message}`);
