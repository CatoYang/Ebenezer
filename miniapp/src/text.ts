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

export const LIMITS = { title: 200, details: 500, note: 1000 };
