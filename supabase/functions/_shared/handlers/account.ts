// /deletemydata. Deleting the users row cascades to everything they created.

import { type BotContext, editFromButton } from "../context.ts";
import { deleteKeyboard } from "../keyboards.ts";
import { msg } from "../messages.ts";

export async function deleteCommand(ctx: BotContext) {
  await ctx.reply(msg.deleteConfirm, { reply_markup: deleteKeyboard() });
}

export async function deleteReply(ctx: BotContext, confirm: boolean) {
  if (!confirm) {
    await editFromButton(ctx, msg.deleteCancelled);
    return;
  }
  const { error } = await ctx.db.from("users").delete().eq("id", ctx.user.id);
  if (error) throw error;
  await editFromButton(ctx, msg.deleted);
}
