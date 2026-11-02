import { assertEquals, assertStringIncludes } from "@std/assert";
import { DATA_CONTACT, escapeHtml, formatTime, msg, SCRIPTURE } from "./messages.ts";

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

Deno.test("welcome names the data protection contact", () => {
  assertStringIncludes(msg.welcome("Yang"), `Contact ${escapeHtml(DATA_CONTACT)}.`);
});

Deno.test("weekly summary: active week", () => {
  const text = msg.weeklySummary({
    week_label: "2 Nov – 8 Nov",
    days_prayed: 5,
    answered_titles: ["Sarah", "Dad"],
    active_requests: 1,
    current_streak: 3,
  });
  assertEquals(
    text,
    "Your week, 2 Nov – 8 Nov\n\nYou prayed on 5 of 7 days. Current streak: 3 days.\n\n" +
      "Answered: Sarah, Dad. Thanks be to God!\n\nStill praying for 1 request.",
  );
});

Deno.test("weekly summary: quiet week is gentle and skips empty lines", () => {
  const text = msg.weeklySummary({
    week_label: "2 Nov – 8 Nov",
    days_prayed: 0,
    answered_titles: [],
    active_requests: 0,
    current_streak: 0,
  });
  assertEquals(
    text,
    "Your week, 2 Nov – 8 Nov\n\nLast week was quiet. A moment of prayer today is a good place to start again.",
  );
});
