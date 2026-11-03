// Bible study: limits and parsing "/studied 30 John 3". Kept free of grammY so tests can import it.

export const STUDY_MINUTES_MAX = 600;
export const STUDY_NOTE_MAX = 500;

/** The minutes offered as buttons after /studied. */
export const STUDY_MINUTES = [15, 30, 45, 60, 90, 120] as const;
export type StudyMinutes = typeof STUDY_MINUTES[number];

export interface ParsedStudy {
  minutes: number;
  note: string | null;
}

/** "30", "30 John 3", "45 min Sunday's readings". The minutes come first; the rest is the note. */
export function parseStudy(text: string): ParsedStudy | "empty" | "invalid" | "too_long" {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "empty";
  const m = /^(\d{1,3})\s*(?:minutes|mins|min|m)?(?:\s+(.+))?$/i.exec(clean);
  if (!m) return "invalid";
  const minutes = Number(m[1]);
  if (minutes < 1 || minutes > STUDY_MINUTES_MAX) return "invalid";
  const note = m[2]?.trim() || null;
  if (note && note.length > STUDY_NOTE_MAX) return "too_long";
  return { minutes, note };
}

/** Whole minutes from a callback or form, or null. */
export function validMinutes(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= STUDY_MINUTES_MAX
    ? value
    : null;
}
