import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.ts";

export type Db = SupabaseClient;

/** Service-role client. RLS has no policies, so this is the only way in; never ship it to a client. */
export function createDb(): Db {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface UserRow {
  id: string;
  telegram_user_id: number;
  first_name: string | null;
  language_code: string | null;
  timezone: string;
  reminder_time: string | null; // "HH:MM:SS"
  nudges_enabled: boolean;
  privacy_accepted_at: string | null;
  awaiting: Record<string, unknown> | null;
  blocked_at: string | null;
  created_at: string;
}

/** Postgres unique_violation. */
export const UNIQUE_VIOLATION = "23505";
