// Logging prayers: /prayed and replies to the daily nudge.

import { type BotContext, editFromButton } from "../context.ts";
import { msg } from "../messages.ts";

type Source = "command" | "nudge" | "request" | "follow_up" | "miniapp";

export async function logPrayer(ctx: BotContext, source: Source, prayerRequestId?: string) {
  const { error } = await ctx.db.from("prayer_logs").insert({
    user_id: ctx.user.id,
    prayer_request_id: prayerRequestId ?? null,
    source,
  });
  if (error) throw error;
}

export async function prayedCommand(ctx: BotContext) {
  await logPrayer(ctx, "command");
  await ctx.reply(msg.prayedLogged);
}

export async function nudgeReply(ctx: BotContext, prayed: boolean) {
  if (prayed) await logPrayer(ctx, "nudge");
  await editFromButton(ctx, prayed ? msg.nudgePrayed : msg.nudgeNotYet);
}
