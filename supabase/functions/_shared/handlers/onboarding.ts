// /start, privacy consent, reminder-time picker, and /settings.

import type { Origin } from "../callbacks.ts";
import { type BotContext, editFromButton, saveSettings, updateUser } from "../context.ts";
import {
  consentKeyboard,
  nudgePrefKeyboard,
  settingsKeyboard,
  timeHoursKeyboard,
  timePresetsKeyboard,
} from "../keyboards.ts";
import { msg } from "../messages.ts";

export async function start(ctx: BotContext) {
  if (!ctx.user.privacy_accepted_at) {
    await ctx.reply(msg.welcome(ctx.user.first_name), {
      parse_mode: "HTML",
      reply_markup: consentKeyboard(),
    });
  } else if (!ctx.user.reminder_time) {
    await ctx.reply(msg.askTime, { reply_markup: timePresetsKeyboard("onboarding") });
  } else {
    await ctx.reply(msg.onboardingDone(ctx.user));
  }
}

export async function consent(ctx: BotContext, accept: boolean) {
  if (!accept) {
    const { error } = await ctx.db.from("users").delete().eq("id", ctx.user.id);
    if (error) throw error;
    await editFromButton(ctx, msg.consentDeclined);
    return;
  }
  if (!ctx.user.privacy_accepted_at) await updateUser(ctx, { privacy_accepted_at: new Date().toISOString() });
  await editFromButton(ctx, msg.welcome(ctx.user.first_name), undefined, { html: true });
  await ctx.reply(msg.askTime, { reply_markup: timePresetsKeyboard("onboarding") });
}

export async function showTimePresets(ctx: BotContext, origin: Origin) {
  await editFromButton(ctx, msg.askTime, timePresetsKeyboard(origin));
}

export async function showTimeHours(ctx: BotContext, origin: Origin) {
  await editFromButton(ctx, msg.askHour, timeHoursKeyboard(origin));
}

export async function setTime(ctx: BotContext, origin: Origin, time: string) {
  await saveSettings(ctx, { reminder_time: time });
  if (origin === "onboarding") {
    await editFromButton(ctx, msg.askNudges(time), nudgePrefKeyboard());
  } else {
    await showSettings(ctx);
  }
}

export async function setNudges(ctx: BotContext, origin: Origin, enabled: boolean) {
  await saveSettings(ctx, { nudges_enabled: enabled });
  if (origin === "onboarding") {
    await editFromButton(ctx, msg.onboardingDone(ctx.user));
  } else {
    await showSettings(ctx);
  }
}

export async function settingsCommand(ctx: BotContext) {
  await ctx.reply(msg.settings(ctx.user), { reply_markup: settingsKeyboard(ctx.user) });
}

export async function showSettings(ctx: BotContext) {
  await editFromButton(ctx, msg.settings(ctx.user), settingsKeyboard(ctx.user));
}

export async function setWeeklySummary(ctx: BotContext, enabled: boolean) {
  await saveSettings(ctx, { weekly_summary_enabled: enabled });
  await showSettings(ctx);
}
