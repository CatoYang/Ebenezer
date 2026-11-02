import type { Api } from "grammy";
import type { Db } from "../_shared/db.ts";
import { nudgeKeyboard } from "../_shared/keyboards.ts";
import { msg } from "../_shared/messages.ts";
import { sendOrMarkBlocked } from "../_shared/telegram.ts";

interface ClaimedNudge {
  notification_id: number;
  user_id: string;
  telegram_user_id: number;
  first_name: string | null;
}

/**
 * Claims due nudges (claim_due_nudges inserts the notifications row, so overlapping runs can't
 * double-send), then sends them. A failed send releases the claim so the next tick retries it.
 */
export async function sendDueNudges(db: Db, api: Api) {
  const { data, error } = await db.rpc("claim_due_nudges");
  if (error) throw error;
  const due = (data ?? []) as ClaimedNudge[];

  let sent = 0, blocked = 0, failed = 0;
  for (const n of due) {
    try {
      const messageId = await sendOrMarkBlocked(
        db,
        n.telegram_user_id,
        () => api.sendMessage(n.telegram_user_id, msg.nudge, { reply_markup: nudgeKeyboard() }),
      );
      if (messageId === null) {
        blocked++;
        continue;
      }
      await db.from("notifications").update({ telegram_message_id: messageId }).eq("id", n.notification_id);
      sent++;
    } catch (err) {
      failed++;
      console.error("nudge send failed:", err instanceof Error ? err.message : err);
      await db.from("notifications").delete().eq("id", n.notification_id);
    }
  }
  return { due: due.length, sent, blocked, failed };
}
