// Builds the Journey calendar grid: one column per week (Monday at the top), ending with the current
// week. Dates are the user's local dates as "YYYY-MM-DD" strings from the api; all arithmetic is done in
// UTC so the device's own timezone can't shift a day.

export interface CalendarDay {
  date: string;
  count: number;
}

export interface CalendarCell {
  date: string;
  count: number;
  today: boolean;
  future: boolean;
}

export interface Calendar {
  weeks: CalendarCell[][]; // each inner array is Mon..Sun
  monthLabels: (string | null)[]; // one per week: the month of its Monday when that changes, else null
}

const DAY = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parse = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const format = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function buildCalendar(today: string, days: CalendarDay[], weekCount = 13): Calendar {
  const counts = new Map(days.map((d) => [d.date, d.count]));
  const todayMs = parse(today);
  const mondayIndex = (new Date(todayMs).getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  const start = todayMs - (mondayIndex + 7 * (weekCount - 1)) * DAY;

  const weeks: CalendarCell[][] = [];
  const monthLabels: (string | null)[] = [];
  for (let w = 0; w < weekCount; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const ms = start + (w * 7 + d) * DAY;
      const date = format(ms);
      week.push({ date, count: counts.get(date) ?? 0, today: ms === todayMs, future: ms > todayMs });
    }
    const month = new Date(start + w * 7 * DAY).getUTCMonth();
    const previous = w > 0 ? new Date(start + (w - 1) * 7 * DAY).getUTCMonth() : -1;
    weeks.push(week);
    monthLabels.push(month !== previous ? MONTHS[month] : null);
  }
  return { weeks, monthLabels };
}
