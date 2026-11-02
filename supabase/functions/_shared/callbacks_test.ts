import { assertEquals } from "@std/assert";
import { type Callback, encode, parse } from "./callbacks.ts";

const ID = "0b9f2f4e-8a1c-4d2e-9f00-123456789abc";

const ALL: Callback[] = [
  { kind: "consent", accept: true },
  { kind: "consent", accept: false },
  { kind: "time_presets", origin: "onboarding" },
  { kind: "time_hours", origin: "settings" },
  { kind: "time_set", origin: "onboarding", time: "07:00" },
  { kind: "time_set", origin: "settings", time: "23:30" },
  { kind: "nudges", origin: "onboarding", enabled: true },
  { kind: "nudges", origin: "settings", enabled: false },
  { kind: "settings_home" },
  { kind: "nudge_reply", prayed: true },
  { kind: "nudge_reply", prayed: false },
  { kind: "delete", confirm: true },
  { kind: "delete", confirm: false },
  { kind: "interval", requestId: ID, days: 3 },
  { kind: "interval", requestId: ID, days: 30 },
  { kind: "interval", requestId: ID, days: null },
  { kind: "follow_up", followUpId: ID, response: "answered" },
  { kind: "follow_up", followUpId: ID, response: "still_praying" },
  { kind: "follow_up", followUpId: ID, response: "later" },
  { kind: "follow_up", followUpId: ID, response: "stop" },
  { kind: "skip_note" },
];

Deno.test("every callback round-trips and fits Telegram's 64-byte limit", () => {
  for (const cb of ALL) {
    const data = encode(cb);
    assertEquals(parse(data), cb, data);
    assertEquals(new TextEncoder().encode(data).length <= 64, true, data);
  }
});

Deno.test("malformed or stale callback data parses to null", () => {
  for (
    const data of [
      "",
      "nope",
      "consent",
      "consent:x",
      "time:z:p",
      "time:o:2400",
      "time:o:0760",
      "settings:x",
      "consent:toString",
      "time:constructor:p",
      "iv:not-a-uuid:7",
      `iv:${ID}:5`,
      `iv:${ID}:07`,
      `fu:${ID}:z`,
      `fu:${ID}:constructor`,
      "note:x",
    ]
  ) {
    assertEquals(parse(data), null, data);
  }
});
