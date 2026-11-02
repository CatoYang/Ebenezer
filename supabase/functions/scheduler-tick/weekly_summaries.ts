import type { Api } from "grammy";
import type { Db } from "../_shared/db.ts";
import { MINIAPP_URL } from "../_shared/env.ts";
import { openAppKeyboard } from "../_shared/keyboards.ts";
import { msg, type WeeklySummary } from "../_shared/messages.ts";
import { sendOrMarkBlocked } from "../_shared/telegram.ts";

interface ClaimedSummary extends WeeklySummary {
  notification_id: number;
  telegram_user_id: number;
}

/**
 * Claims Monday summaries (claim_due_weekly_summaries inserts the notifications row, so a week is never
 * sent twice) and sends them. A failed send releases the claim so the next tick retries it.
 */
export async function sendDueWeeklySummaries(db: Db, api: Api) {
  const { data, error } = await db.rpc("claim_due_weekly_summaries");
  if (error) throw error;
  const due = (data ?? []) as ClaimedSummary[];

  let sent = 0, blocked = 0, failed = 0;
  for (const s of due) {
    try {
      const messageId = await sendOrMarkBlocked(
        db,
        s.telegram_user_id,
        () =>
          api.sendMessage(s.telegram_user_id, msg.weeklySummary(s), {
            reply_markup: MINIAPP_URL ? openAppKeyboard(MINIAPP_URL) : undefined,
          }),
      );
      if (messageId === null) {
        blocked++;
        continue;
      }
      await db.from("notifications").update({ telegram_message_id: messageId }).eq("id", s.notification_id);
      sent++;
    } catch (err) {
      failed++;
      console.error("weekly summary send failed:", err instanceof Error ? err.message : err);
      await db.from("notifications").delete().eq("id", s.notification_id);
    }
  }
  return { due: due.length, sent, blocked, failed };
}
