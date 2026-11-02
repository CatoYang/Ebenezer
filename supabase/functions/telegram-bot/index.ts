// Telegram webhook. Deployed with verify_jwt = false (see supabase/config.toml); requests are
// authenticated by the X-Telegram-Bot-Api-Secret-Token header that grammY checks against WEBHOOK_SECRET.

import { webhookCallback } from "grammy";
import { createBot } from "../_shared/bot.ts";
import { createDb } from "../_shared/db.ts";
import { requireEnv, secretsMatch } from "../_shared/env.ts";

const secret = requireEnv("WEBHOOK_SECRET");
const bot = createBot(requireEnv("BOT_TOKEN"), createDb());
const handleUpdate = webhookCallback(bot, "std/http", { secretToken: secret });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  // grammY checks the secret too, but only after calling getMe; reject strangers before any API call.
  if (!secretsMatch(req.headers.get("x-telegram-bot-api-secret-token"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return await handleUpdate(req);
  } catch (err) {
    // Log the error type only; update payloads can contain prayer content.
    console.error("telegram-bot update failed:", err instanceof Error ? err.message : err);
    return new Response("Error", { status: 500 });
  }
});
