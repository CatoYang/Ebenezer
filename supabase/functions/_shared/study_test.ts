import { assertEquals } from "@std/assert";
import { parseStudy, validMinutes } from "./study.ts";

Deno.test("parseStudy: minutes, with or without a unit and a note", () => {
  assertEquals(parseStudy("30"), { minutes: 30, note: null });
  assertEquals(parseStudy("  30   John 3 "), { minutes: 30, note: "John 3" });
  assertEquals(parseStudy("45 min Sunday's readings"), { minutes: 45, note: "Sunday's readings" });
  assertEquals(parseStudy("45min"), { minutes: 45, note: null });
  assertEquals(parseStudy("20 Mark 4"), { minutes: 20, note: "Mark 4" });
  assertEquals(parseStudy("10 minutes of Psalms"), { minutes: 10, note: "of Psalms" });
});

Deno.test("parseStudy: empty, invalid and too long", () => {
  assertEquals(parseStudy("   "), "empty");
  assertEquals(parseStudy("John 3"), "invalid");
  assertEquals(parseStudy("0"), "invalid");
  assertEquals(parseStudy("601"), "invalid");
  assertEquals(parseStudy("1h"), "invalid");
  assertEquals(parseStudy(`30 ${"x".repeat(501)}`), "too_long");
});

Deno.test("validMinutes", () => {
  assertEquals(validMinutes(30), 30);
  assertEquals(validMinutes(600), 600);
  assertEquals(validMinutes(0), null);
  assertEquals(validMinutes(2.5), null);
  assertEquals(validMinutes("30"), null);
});
