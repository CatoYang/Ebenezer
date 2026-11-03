// Prayer requests and the follow-up loop: /pray, /list, interval buttons, follow-up buttons,
// and the free-text replies they wait for (the request itself, the answered-prayer note).

import type { FollowUpDays, FollowUpResponse } from "../callbacks.ts";
import { type BotContext, editFromButton, updateUser } from "../context.ts";
import type { Awaiting } from "../db.ts";
import { MINIAPP_URL } from "../env.ts";
import { intervalKeyboard, openAppKeyboard, skipNoteKeyboard } from "../keyboards.ts";
import { type ListedRequest, msg } from "../messages.ts";
import { parseRequest } from "../requests.ts";
import { saveStudyNote } from "./study.ts";

const LIST_LIMIT = 30;
const NOTE_MAX = 1000;

export async function prayCommand(ctx: BotContext) {
  const text = typeof ctx.match === "string" ? ctx.match : "";
  if (text.trim()) return addRequest(ctx, text);
  const prompt = await ctx.reply(msg.askRequest, {
    reply_markup: { force_reply: true, input_field_placeholder: msg.requestPlaceholder },
  });
  await updateUser(ctx, { awaiting: { kind: "request_text", prompt_message_id: prompt.message_id } });
}

async function addRequest(ctx: BotContext, text: string) {
  const parsed = parseRequest(text);
  if (parsed === "empty") return void await ctx.reply(msg.askRequest);
  if (parsed === "too_long") return void await ctx.reply(msg.requestTooLong);

  const { data: requestId, error } = await ctx.db.rpc("create_prayer_request", {
    p_user_id: ctx.user.id,
    p_title: parsed.title,
    p_details: parsed.details,
  });
  if (error) throw error;
  await ctx.reply(msg.requestAdded(parsed.title, parsed.details), {
    reply_markup: intervalKeyboard(requestId as string),
  });
}

/** Plain text that isn't a command: the answer to whatever the bot last asked, if anything. */
export async function textMessage(ctx: BotContext) {
  const awaiting = ctx.user.awaiting;
  const text = ctx.message?.text ?? "";
  if (!awaiting) return void await ctx.reply(msg.fallback);

  await updateUser(ctx, { awaiting: null });
  if (awaiting.kind === "request_text") await addRequest(ctx, text);
  else if (awaiting.kind === "study_note") await saveStudyNote(ctx, awaiting, text);
  else await saveAnswerNote(ctx, awaiting, text);
}

async function saveAnswerNote(
  ctx: BotContext,
  awaiting: Extract<Awaiting, { kind: "answer_note" }>,
  text: string,
) {
  const note = text.trim();
  if (note.length > NOTE_MAX) {
    await updateUser(ctx, { awaiting }); // keep waiting for a shorter one
    return void await ctx.reply(msg.answerNoteTooLong);
  }
  const { error } = await ctx.db.from("prayer_requests").update({ answer_note: note })
    .eq("id", awaiting.request_id).eq("user_id", ctx.user.id);
  if (error) throw error;
  // Remove the Skip button from the question. Not worth failing over if the message is gone.
  await ctx.api.editMessageReplyMarkup(ctx.chat!.id, awaiting.prompt_message_id).catch(() => {});
  await ctx.reply(msg.answerNoteSaved);
}

/** "When should I check in?" button. Returns a toast for a stale button. */
export async function intervalChosen(ctx: BotContext, requestId: string, days: FollowUpDays | null) {
  const { data, error } = await ctx.db.rpc("schedule_follow_up", {
    p_user_id: ctx.user.id,
    p_request_id: requestId,
    p_days: days,
  });
  if (error) throw error;
  const row = (data as { title: string; details: string | null; due_label: string | null }[])[0];
  if (!row) {
    await ctx.editMessageReplyMarkup().catch(() => {});
    return msg.requestInactive;
  }
  await editFromButton(
    ctx,
    row.due_label
      ? msg.requestScheduled(row.title, row.details, row.due_label)
      : msg.requestUnscheduled(row.title, row.details),
  );
}

/** Answered / Still praying / Ask me tomorrow / Stop. Returns a toast for a double tap. */
export async function followUpReply(ctx: BotContext, followUpId: string, response: FollowUpResponse) {
  const { data, error } = await ctx.db.rpc("respond_follow_up", {
    p_user_id: ctx.user.id,
    p_follow_up_id: followUpId,
    p_response: response,
  });
  if (error) throw error;
  const row =
    (data as { request_id: string; title: string; details: string | null; next_label: string | null }[])[0];
  if (!row) {
    await ctx.editMessageReplyMarkup().catch(() => {});
    return msg.followUpAlreadyRecorded;
  }

  switch (response) {
    case "answered": {
      await editFromButton(ctx, msg.followUpAnswered(row.title, row.details));
      const prompt = await ctx.reply(msg.askAnswerNote, { reply_markup: skipNoteKeyboard() });
      await updateUser(ctx, {
        awaiting: { kind: "answer_note", request_id: row.request_id, prompt_message_id: prompt.message_id },
      });
      break;
    }
    case "still_praying":
      await editFromButton(ctx, msg.followUpStillPraying(row.title, row.details, row.next_label!));
      break;
    case "later":
      await editFromButton(ctx, msg.followUpLater(row.title, row.details, row.next_label!));
      break;
    case "stop":
      await editFromButton(ctx, msg.followUpStopped(row.title, row.details));
      break;
  }
}

export async function skipNote(ctx: BotContext) {
  if (ctx.user.awaiting?.kind === "answer_note") await updateUser(ctx, { awaiting: null });
  await editFromButton(ctx, msg.answerNoteSkipped);
}

export async function listCommand(ctx: BotContext) {
  const { data, error } = await ctx.db.rpc("list_active_requests", {
    p_user_id: ctx.user.id,
    p_limit: LIST_LIMIT,
  });
  if (error) throw error;
  const rows = data as ListedRequest[];

  const { count, error: countError } = await ctx.db.from("prayer_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.user.id).eq("status", "answered");
  if (countError) throw countError;

  await ctx.reply(msg.list(rows.slice(0, LIST_LIMIT), rows.length > LIST_LIMIT, count ?? 0), {
    reply_markup: MINIAPP_URL ? openAppKeyboard(MINIAPP_URL) : undefined,
  });
}

export async function appCommand(ctx: BotContext) {
  if (!MINIAPP_URL) return void await ctx.reply(msg.appUnavailable);
  await ctx.reply(msg.openApp, { reply_markup: openAppKeyboard(MINIAPP_URL) });
}
