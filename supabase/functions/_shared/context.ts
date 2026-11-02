import { type Context, GrammyError } from "grammy";
import type { InlineKeyboard } from "grammy";
import type { Db, UserRow } from "./db.ts";

export type BotContext = Context & { db: Db; user: UserRow };

/**
 * Edits the message a button was tapped on. Ignores Telegram's "message is not modified".
 * Pass `html: true` for messages whose wording is HTML (see messages.ts).
 */
export async function editFromButton(
  ctx: BotContext,
  text: string,
  keyboard?: InlineKeyboard,
  opts: { html?: boolean } = {},
) {
  try {
    await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: opts.html ? "HTML" : undefined });
  } catch (err) {
    if (err instanceof GrammyError && err.description.includes("message is not modified")) return;
    throw err;
  }
}

/** Changes settings via update_user_settings, which also moves pending follow-ups to a new time. */
export async function saveSettings(
  ctx: BotContext,
  settings: { reminder_time?: string; nudges_enabled?: boolean; weekly_summary_enabled?: boolean },
): Promise<UserRow> {
  const { data, error } = await ctx.db.rpc("update_user_settings", {
    p_user_id: ctx.user.id,
    p_reminder_time: settings.reminder_time ?? null,
    p_nudges_enabled: settings.nudges_enabled ?? null,
    p_weekly_summary: settings.weekly_summary_enabled ?? null,
  });
  if (error) throw error;
  ctx.user = data as UserRow;
  return ctx.user;
}

export async function updateUser(ctx: BotContext, patch: Partial<UserRow>): Promise<UserRow> {
  const { data, error } = await ctx.db.from("users").update(patch).eq("id", ctx.user.id).select().single();
  if (error) throw error;
  ctx.user = data as UserRow;
  return ctx.user;
}
