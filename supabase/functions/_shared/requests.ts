// Parsing what the user types after /pray.

export const TITLE_MAX = 200;
export const DETAILS_MAX = 500;

export type ParsedRequest = { title: string; details: string | null };

/**
 * "Sarah – surgery on Friday" → { title: "Sarah", details: "surgery on Friday" }.
 * Splits on the first spaced dash (-, – or —) or colon. Hyphenated names like "Mary-Anne" aren't split.
 * Returns "empty" or "too_long" instead of a request when the text can't be used.
 */
export function parseRequest(text: string): ParsedRequest | "empty" | "too_long" {
  // Collapse whitespace and drop a dangling separator at either end ("Sarah –", "– surgery").
  const clean = text.replace(/\s+/g, " ").trim().replace(/^[-–—:]\s*|\s*[-–—:]$/g, "").trim();
  if (!clean) return "empty";
  const m = /\s[-–—]\s|:\s/.exec(clean);
  const title = (m ? clean.slice(0, m.index) : clean).trim();
  const details = m ? clean.slice(m.index + m[0].length).trim() || null : null;
  if (title.length > TITLE_MAX || (details?.length ?? 0) > DETAILS_MAX) return "too_long";
  return { title, details };
}
