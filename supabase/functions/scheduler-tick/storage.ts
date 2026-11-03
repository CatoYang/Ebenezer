import type { Api } from "grammy";
import type { Db } from "../_shared/db.ts";
import { msg } from "../_shared/messages.ts";

/** Warn when the database reaches this share of its quota. */
export const STORAGE_THRESHOLD = 0.8;
/** The Free plan's database size quota. Set DB_QUOTA_MB to match the plan (e.g. 8000 on Pro). */
const DEFAULT_QUOTA_MB = 500;

/**
 * Sends the maintainer a Telegram warning when the database is at or above 80% of its quota, at most once
 * a day (claim_storage_alert records each day's warning). Below the threshold it sends nothing. Off unless
 * ALERT_TELEGRAM_USER_ID is set. A failed send releases the claim so the next tick retries.
 */
export async function checkStorage(db: Db, api: Api) {
  const to = Number(Deno.env.get("ALERT_TELEGRAM_USER_ID") ?? "");
  if (!Number.isSafeInteger(to) || to <= 0) return { enabled: false };
  const quotaMb = Number(Deno.env.get("DB_QUOTA_MB") || DEFAULT_QUOTA_MB);

  const { data, error } = await db.rpc("claim_storage_alert", {
    p_quota_bytes: Math.round(quotaMb * 1_000_000),
    p_threshold: STORAGE_THRESHOLD,
  });
  if (error) throw error;
  const row = (data as { alert_period: string; used_bytes: number; limit_bytes: number }[] | null)?.[0];
  if (!row) return { enabled: true, warned: false };

  try {
    await api.sendMessage(to, msg.storageAlert(row.used_bytes, row.limit_bytes));
    return { enabled: true, warned: true };
  } catch (err) {
    console.error("storage warning send failed:", err instanceof Error ? err.message : err);
    await db.from("admin_alerts").delete().eq("kind", "storage").eq("period_key", row.alert_period);
    return { enabled: true, warned: false, failed: true };
  }
}
