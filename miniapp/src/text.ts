// Shared wording. Keep in step with the bot's messages.ts where the same words appear.

export const INTERVALS: { days: number | null; label: string }[] = [
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
  { days: null, label: "Don't check in" },
];

export const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** Same verse and translation as SCRIPTURE in supabase/functions/_shared/messages.ts. */
export const VERSE = { text: "Till now the LORD has helped us.", reference: "1 Samuel 7:12 (ESV)" };

export const LIMITS = { title: 200, details: 500, note: 1000, studyNote: 500, studyMinutes: 600 };

/** Quick picks on the Log Bible study screen. */
export const STUDY_PRESETS = [15, 30, 45, 60, 90, 120];

/** 45 → "45 min", 60 → "1 h", 105 → "1 h 45 min". Same as formatMinutes in messages.ts. */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
