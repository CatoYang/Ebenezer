import { assertEquals } from "@std/assert";
// Independent implementation (Node's crypto) to sign test data, so the test doesn't just echo the code.
import { createHmac } from "node:crypto";
import { verifyInitData } from "./telegram_auth.ts";

const TOKEN = "123456:TEST-token";
const NOW = new Date("2026-11-04T10:00:00Z");
const authDate = String(Math.floor(NOW.getTime() / 1000) - 60);
const user = JSON.stringify({ id: 42, first_name: "Yang" });

function sign(fields: Record<string, string>, token = TOKEN): string {
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

Deno.test("accepts correctly signed launch data", async () => {
  const result = await verifyInitData(sign({ auth_date: authDate, query_id: "AAH", user }), TOKEN, NOW);
  assertEquals(result.ok && result.user.id, 42);
});

Deno.test("accepts data that includes a signature field", async () => {
  const data = sign({ auth_date: authDate, signature: "abc_-", user });
  assertEquals((await verifyInitData(data, TOKEN, NOW)).ok, true);
});

Deno.test("rejects tampered data", async () => {
  const data = sign({ auth_date: authDate, user }).replace("%22id%22%3A42", "%22id%22%3A43");
  assertEquals(await verifyInitData(data, TOKEN, NOW), { ok: false, reason: "bad_hash" });
});

Deno.test("rejects data signed with another bot's token", async () => {
  const data = sign({ auth_date: authDate, user }, "999:OTHER");
  assertEquals(await verifyInitData(data, TOKEN, NOW), { ok: false, reason: "bad_hash" });
});

Deno.test("rejects data older than 24 hours", async () => {
  const old = String(Math.floor(NOW.getTime() / 1000) - 25 * 3600);
  assertEquals(await verifyInitData(sign({ auth_date: old, user }), TOKEN, NOW), {
    ok: false,
    reason: "expired",
  });
});

Deno.test("rejects missing data or a missing user", async () => {
  assertEquals(await verifyInitData(null, TOKEN, NOW), { ok: false, reason: "missing" });
  assertEquals(await verifyInitData("auth_date=1", TOKEN, NOW), { ok: false, reason: "missing" });
  assertEquals(await verifyInitData(sign({ auth_date: authDate }), TOKEN, NOW), {
    ok: false,
    reason: "no_user",
  });
});
