import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.ts";

export type Db = SupabaseClient;

/** Service-role client. RLS has no policies, so this is the only way in; never ship it to a client. */
export function createDb(): Db {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The one free-text reply the bot is waiting for (users.awaiting). Cleared by the next command. */
export type Awaiting =
  | { kind: "request_text"; prompt_message_id: number }
  | { kind: "answer_note"; request_id: string; prompt_message_id: number };

export interface UserRow {
  id: string;
  telegram_user_id: number;
  first_name: string | null;
  language_code: string | null;
  timezone: string;
  reminder_time: string | null; // "HH:MM:SS"
  nudges_enabled: boolean;
  weekly_summary_enabled: boolean;
  privacy_accepted_at: string | null;
  awaiting: Awaiting | null;
  blocked_at: string | null;
  created_at: string;
}

/** Postgres unique_violation. */
export const UNIQUE_VIOLATION = "23505";
