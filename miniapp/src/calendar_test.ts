// Run with `npm run test:unit` (Deno). Excluded from the app's own type check.
import { assertEquals } from "@std/assert";
import { buildCalendar } from "./calendar.ts";

Deno.test("calendar ends with the current week, Monday first", () => {
  // Tue 3 Nov 2026
  const { weeks } = buildCalendar("2026-11-03", [], 2);
  assertEquals(weeks.length, 2);
  assertEquals(weeks[1][0].date, "2026-11-02"); // Monday of this week
  assertEquals(weeks[1][1].today, true);
  assertEquals(weeks[1][2].future, true);
  assertEquals(weeks[0][0].date, "2026-10-26");
});

Deno.test("calendar fills counts and labels each month once, by its Mondays", () => {
  const { weeks, monthLabels } = buildCalendar("2026-11-03", [{ date: "2026-10-31", count: 2 }], 2);
  assertEquals(weeks[0][5], { date: "2026-10-31", count: 2, today: false, future: false });
  assertEquals(monthLabels, ["Oct", "Nov"]); // weeks starting Mon 26 Oct and Mon 2 Nov
});

Deno.test("a 13-week calendar labels only month changes", () => {
  const { weeks, monthLabels } = buildCalendar("2026-11-03", [], 13);
  assertEquals(weeks.length, 13);
  assertEquals(weeks[0][0].date, "2026-08-10");
  assertEquals(monthLabels.filter(Boolean), ["Aug", "Sep", "Oct", "Nov"]);
});
