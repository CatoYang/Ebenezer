// Builds the bot. Used by the telegram-bot webhook in production and scripts/dev-bot.ts locally.

import { Bot } from "grammy";
import { parse } from "./callbacks.ts";
import type { BotContext } from "./context.ts";
import { type Db, UNIQUE_VIOLATION, type UserRow } from "./db.ts";
import { deleteCommand, deleteReply } from "./handlers/account.ts";
import {
  consent,
  setNudges,
  setTime,
  settingsCommand,
  showSettings,
  showTimeHours,
  showTimePresets,
  start,
} from "./handlers/onboarding.ts";
import { nudgeReply, prayedCommand } from "./handlers/prayer.ts";
import { msg } from "./messages.ts";

export const COMMANDS = [
  { command: "prayed", description: "Record that you prayed" },
  { command: "settings", description: "Reminder time and daily reminder" },
  { command: "deletemydata", description: "Delete everything stored about you" },
];

export function createBot(token: string, db: Db): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // 1. Process each update once. Telegram re-delivers if we're slow; if a handler fails we release
  //    the id and rethrow, so the webhook returns 500 and Telegram retries.
  bot.use(async (ctx, next) => {
    const updateId = ctx.update.update_id;
    const { error } = await db.from("processed_updates").insert({ update_id: updateId });
    if (error?.code === UNIQUE_VIOLATION) return;
    if (error) throw error;
    try {
      await next();
    } catch (err) {
      await db.from("processed_updates").delete().eq("update_id", updateId);
      throw err;
    }
  });

  // 2. Private chats only for now.
  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.type !== "private") return;
    if (!ctx.from || ctx.from.is_bot) return;
    await next();
  });

  // 3. Load (or create) the user. Any update from them means they haven't blocked us.
  bot.use(async (ctx, next) => {
    const from = ctx.from!;
    const { data, error } = await db.from("users").upsert({
      telegram_user_id: from.id,
      first_name: from.first_name,
      language_code: from.language_code ?? null,
      blocked_at: null,
    }, { onConflict: "telegram_user_id" }).select().single();
    if (error) throw error;
    ctx.db = db;
    ctx.user = data as UserRow;
    await next();
  });

  // Telegram tells us when the user blocks or unblocks the bot.
  bot.on("my_chat_member", async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    const blocked = status === "kicked" || status === "left";
    const { error } = await db.from("users")
      .update({ blocked_at: blocked ? new Date().toISOString() : null }).eq("id", ctx.user.id);
    if (error) throw error;
  });

  bot.command("start", start);

  // Everything below needs privacy consent, except the consent buttons themselves.
  bot.use(async (ctx, next) => {
    if (ctx.user.privacy_accepted_at) return next();
    const cb = ctx.callbackQuery?.data ? parse(ctx.callbackQuery.data) : null;
    if (cb?.kind === "consent") return next();
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: msg.needsStart, show_alert: true });
    else await ctx.reply(msg.needsStart);
  });

  bot.command("settings", settingsCommand);
  bot.command("prayed", prayedCommand);
  bot.command("deletemydata", deleteCommand);

  bot.on("callback_query:data", async (ctx) => {
    const cb = parse(ctx.callbackQuery.data);
    if (!cb) {
      await ctx.answerCallbackQuery({ text: msg.staleButton });
      return;
    }
    switch (cb.kind) {
      case "consent":
        await consent(ctx, cb.accept);
        break;
      case "time_presets":
        await showTimePresets(ctx, cb.origin);
        break;
      case "time_hours":
        await showTimeHours(ctx, cb.origin);
        break;
      case "time_set":
        await setTime(ctx, cb.origin, cb.time);
        break;
      case "nudges":
        await setNudges(ctx, cb.origin, cb.enabled);
        break;
      case "settings_home":
        await showSettings(ctx);
        break;
      case "nudge_reply":
        await nudgeReply(ctx, cb.prayed);
        break;
      case "delete":
        await deleteReply(ctx, cb.confirm);
        break;
    }
    await ctx.answerCallbackQuery();
  });

  bot.on("message", (ctx) => ctx.reply(msg.fallback));

  return bot;
}
