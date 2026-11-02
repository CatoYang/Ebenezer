import { GrammyError } from "grammy";
import type { Db } from "./db.ts";

/** Telegram answers 403 when the user has blocked the bot or deleted their account. */
export function isBlockedError(err: unknown): boolean {
  return err instanceof GrammyError && err.error_code === 403;
}

export async function markBlocked(db: Db, telegramUserId: number): Promise<void> {
  const { error } = await db.from("users").update({ blocked_at: new Date().toISOString() })
    .eq("telegram_user_id", telegramUserId);
  if (error) throw error;
}

/**
 * Sends a bot-initiated message (scheduler). Returns the sent message id, or null if the user has
 * blocked the bot, in which case they're marked blocked and skipped by future runs.
 * Other errors are rethrown so the caller can release its claim and retry next tick.
 */
export async function sendOrMarkBlocked(
  db: Db,
  telegramUserId: number,
  send: () => Promise<{ message_id: number }>,
): Promise<number | null> {
  try {
    return (await send()).message_id;
  } catch (err) {
    if (!isBlockedError(err)) throw err;
    await markBlocked(db, telegramUserId);
    return null;
  }
}
