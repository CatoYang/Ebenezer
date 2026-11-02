// Verifies Telegram Mini App launch data (Telegram.WebApp.initData), as described in
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
//   secret_key = HMAC_SHA256(key = "WebAppData", message = bot_token)
//   hash       = hex(HMAC_SHA256(key = secret_key, message = data_check_string))
//
// data_check_string = every field except `hash`, as "key=value", sorted by key, joined by "\n".

export interface TelegramUser {
  id: number;
  first_name?: string;
  language_code?: string;
}

export type InitDataResult =
  | { ok: true; user: TelegramUser; authDate: Date }
  | { ok: false; reason: "missing" | "bad_hash" | "expired" | "no_user" };

/** Launch data older than this is rejected (Telegram recommends checking auth_date). */
export const MAX_AGE_SECONDS = 24 * 60 * 60;

const encoder = new TextEncoder();

async function hmac(key: Uint8Array, message: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    [
      "sign",
    ],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, encoder.encode(message)));
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function dataCheckString(params: URLSearchParams, exclude: string[]): string {
  return [...params.entries()]
    .filter(([key]) => !exclude.includes(key))
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
}

export async function verifyInitData(
  initData: string | null,
  botToken: string,
  now: Date = new Date(),
): Promise<InitDataResult> {
  if (!initData) return { ok: false, reason: "missing" };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "missing" };

  const secretKey = await hmac(encoder.encode("WebAppData"), botToken);
  // Telegram's HMAC covers every field except `hash`. Newer clients also send `signature` (for
  // third-party Ed25519 checks); accept a hash computed with or without it. Both need the bot token.
  let valid = false;
  for (const exclude of [["hash"], ["hash", "signature"]]) {
    const expected = toHex(await hmac(secretKey, dataCheckString(params, exclude)));
    if (constantTimeEqual(expected, hash)) valid = true;
  }
  if (!valid) return { ok: false, reason: "bad_hash" };

  const authDate = new Date(Number(params.get("auth_date")) * 1000);
  if (!(authDate.getTime() > 0) || now.getTime() - authDate.getTime() > MAX_AGE_SECONDS * 1000) {
    return { ok: false, reason: "expired" };
  }

  try {
    const user = JSON.parse(params.get("user") ?? "") as TelegramUser;
    if (typeof user?.id !== "number") return { ok: false, reason: "no_user" };
    return { ok: true, user, authDate };
  } catch {
    return { ok: false, reason: "no_user" };
  }
}
