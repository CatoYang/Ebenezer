// Bible study: /studied, the minutes buttons, and the optional note that follows.

import { type BotContext, editFromButton, updateUser } from "../context.ts";
import type { Awaiting } from "../db.ts";
import { studyMinutesKeyboard, studySkipKeyboard } from "../keyboards.ts";
import { msg } from "../messages.ts";
import { parseStudy, STUDY_NOTE_MAX } from "../study.ts";

/** Returns the session id, or null if this bot message was already logged (a double tap). */
async function logStudy(
  ctx: BotContext,
  minutes: number,
  note: string | null,
  promptMessageId: number | null,
) {
  const { data, error } = await ctx.db.rpc("log_study", {
    p_user_id: ctx.user.id,
    p_minutes: minutes,
    p_note: note,
    p_source: "command",
    p_prompt_message_id: promptMessageId,
  });
  if (error) throw error;
  return data as string | null;
}

async function askForNote(ctx: BotContext, studyId: string, promptMessageId: number) {
  await updateUser(ctx, {
    awaiting: { kind: "study_note", study_id: studyId, prompt_message_id: promptMessageId },
  });
}

/** /studied → minutes buttons. /studied 30 [note] logs straight away. */
export async function studiedCommand(ctx: BotContext) {
  const parsed = parseStudy(typeof ctx.match === "string" ? ctx.match : "");
  if (parsed === "empty") return void await ctx.reply(msg.askStudy, { reply_markup: studyMinutesKeyboard() });
  if (parsed === "invalid") return void await ctx.reply(msg.studyInvalid);
  if (parsed === "too_long") return void await ctx.reply(msg.studyNoteTooLong);

  const id = (await logStudy(ctx, parsed.minutes, parsed.note, null))!;
  if (parsed.note) return void await ctx.reply(msg.studyLogged(parsed.minutes, parsed.note));
  const prompt = await ctx.reply(msg.askStudyNote(parsed.minutes), {
    reply_markup: studySkipKeyboard(parsed.minutes),
  });
  await askForNote(ctx, id, prompt.message_id);
}

/** A minutes button. Returns a toast for a double tap. */
export async function studyMinutesChosen(ctx: BotContext, minutes: number) {
  const messageId = ctx.callbackQuery!.message!.message_id;
  const id = await logStudy(ctx, minutes, null, messageId);
  if (!id) {
    await ctx.editMessageReplyMarkup().catch(() => {});
    return msg.studyAlreadyLogged;
  }
  await editFromButton(ctx, msg.askStudyNote(minutes), studySkipKeyboard(minutes));
  await askForNote(ctx, id, messageId);
}

export async function studySkip(ctx: BotContext, minutes: number) {
  const awaiting = ctx.user.awaiting;
  if (
    awaiting?.kind === "study_note" && awaiting.prompt_message_id === ctx.callbackQuery?.message?.message_id
  ) {
    await updateUser(ctx, { awaiting: null });
  }
  await editFromButton(ctx, msg.studyLogged(minutes, null));
}

/** The free-text reply to "What did you read?". */
export async function saveStudyNote(
  ctx: BotContext,
  awaiting: Extract<Awaiting, { kind: "study_note" }>,
  text: string,
) {
  const note = text.replace(/\s+/g, " ").trim();
  if (note.length > STUDY_NOTE_MAX) {
    await updateUser(ctx, { awaiting }); // keep waiting for a shorter one
    return void await ctx.reply(msg.studyNoteTooLong);
  }
  const { error } = await ctx.db.rpc("update_study_log", {
    p_user_id: ctx.user.id,
    p_id: awaiting.study_id,
    p_minutes: null,
    p_note: note,
  });
  if (error) throw error;
  // Remove the Skip button from the question. Not worth failing over if the message is gone.
  await ctx.api.editMessageReplyMarkup(ctx.chat!.id, awaiting.prompt_message_id).catch(() => {});
  await ctx.reply(msg.studyNoteSaved);
}
