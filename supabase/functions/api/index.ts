// JSON API for the Mini App. Deployed with verify_jwt = false: callers authenticate with Telegram's
// signed launch data (`Authorization: tma <initData>`), checked against the bot token on every request.
// The Mini App holds no keys; this function is its only way to the data.

import { createDb, type UserRow } from "../_shared/db.ts";
import { requireEnv } from "../_shared/env.ts";
import { verifyInitData } from "../_shared/telegram_auth.ts";
import { route } from "./routes.ts";

const db = createDb();
const botToken = requireEnv("BOT_TOKEN");

// Auth is a signed header, not a cookie, so any origin may call; the signature is what protects data.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const auth = req.headers.get("authorization");
  const initData = auth?.startsWith("tma ") ? auth.slice(4) : null;
  const verified = await verifyInitData(initData, botToken);
  if (!verified.ok) return json({ error: "unauthorized", reason: verified.reason }, 401);

  const { data: user, error } = await db.from("users").select().eq("telegram_user_id", verified.user.id)
    .maybeSingle();
  if (error) {
    console.error("api user lookup failed:", error.message);
    return json({ error: "server_error" }, 500);
  }
  if (!user?.privacy_accepted_at) return json({ error: "not_onboarded" }, 403);

  // "/functions/v1/api/requests/…" (hosted) or "/api/requests/…" (local) → "/requests/…"
  const path = new URL(req.url).pathname.replace(/^.*?\/api(?=\/|$)/, "") || "/";
  try {
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const result = await route(db, user as UserRow, req.method, path, body);
    return json(result.body, result.status);
  } catch (err) {
    console.error("api request failed:", err instanceof Error ? err.message : err);
    return json({ error: "server_error" }, 500);
  }
});
