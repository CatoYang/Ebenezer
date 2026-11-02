import type { Api } from "grammy";
import type { Db } from "../_shared/db.ts";
import { followUpKeyboard } from "../_shared/keyboards.ts";
import { msg } from "../_shared/messages.ts";
import { sendOrMarkBlocked } from "../_shared/telegram.ts";

interface ClaimedFollowUp {
  follow_up_id: string;
  telegram_user_id: number;
  title: string;
  details: string | null;
  since_label: string;
  prayer_count: number;
}

/**
 * Claims due follow-ups (claim_due_follow_ups moves them pending → sent with SKIP LOCKED), then sends
 * them. If a send fails, the follow-up goes back to pending so the next tick retries it; a user who
 * blocked the bot is marked blocked and skipped until they come back.
 */
export async function sendDueFollowUps(db: Db, api: Api) {
  const { data, error } = await db.rpc("claim_due_follow_ups");
  if (error) throw error;
  const due = (data ?? []) as ClaimedFollowUp[];

  let sent = 0, blocked = 0, failed = 0;
  for (const f of due) {
    try {
      const messageId = await sendOrMarkBlocked(
        db,
        f.telegram_user_id,
        () =>
          api.sendMessage(
            f.telegram_user_id,
            msg.followUp(f.title, f.details, f.since_label, f.prayer_count),
            {
              reply_markup: followUpKeyboard(f.follow_up_id),
            },
          ),
      );
      if (messageId === null) {
        blocked++;
        await release(db, f.follow_up_id);
        continue;
      }
      await db.from("follow_ups").update({ telegram_message_id: messageId }).eq("id", f.follow_up_id);
      sent++;
    } catch (err) {
      failed++;
      console.error("follow-up send failed:", err instanceof Error ? err.message : err);
      await release(db, f.follow_up_id);
    }
  }
  return { due: due.length, sent, blocked, failed };
}

async function release(db: Db, followUpId: string) {
  await db.from("follow_ups").update({ status: "pending", sent_at: null }).eq("id", followUpId).eq(
    "status",
    "sent",
  );
}
