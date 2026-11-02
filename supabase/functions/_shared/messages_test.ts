import { assertEquals, assertStringIncludes } from "@std/assert";
import { formatTime, msg, SCRIPTURE } from "./messages.ts";

Deno.test("welcome escapes the user's name for HTML", () => {
  const text = msg.welcome("<b>Tom & Jerry</b>");
  assertStringIncludes(text, "Hi &lt;b&gt;Tom &amp; Jerry&lt;/b&gt;.");
  assertEquals(text.includes("<b>"), false);
});

Deno.test("welcome opens with the verse and its reference", () => {
  const text = msg.welcome("Yang");
  assertEquals(text.startsWith(`<blockquote>${SCRIPTURE.text}`), true);
  assertStringIncludes(text, SCRIPTURE.reference);
});

Deno.test("formatTime uses 12-hour clock", () => {
  assertEquals(formatTime("00:00"), "12:00 am");
  assertEquals(formatTime("07:00:00"), "7:00 am");
  assertEquals(formatTime("12:30"), "12:30 pm");
  assertEquals(formatTime("21:00"), "9:00 pm");
});
