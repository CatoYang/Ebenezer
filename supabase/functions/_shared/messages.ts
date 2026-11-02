// All user-facing wording. Handlers never inline message text.

import type { UserRow } from "./db.ts";

/** Display name. The only place it appears in code, so a rename is one line. */
export const APP_NAME = "Prayer Echo";

/** "21:00" or "21:00:00" → "9:00 pm" */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const msg = {
  welcome: (name: string | null) =>
    `Hi${name ? ` ${name}` : ""}. I'm ${APP_NAME}. I help you keep track of what you're praying ` +
    `for, check back in on it later, and remind you to pray.\n\n` +
    `What I store: your Telegram name and ID, the prayer requests you send me, and when you pray. ` +
    `Only you can see them. Nothing is shared with anyone else.\n\n` +
    `For the people you pray for, please use a first name or initials.\n\n` +
    `You can delete everything at any time with /deletemydata.\n\n` +
    `Is that ok?`,
  consentDeclined:
    "No problem. I've deleted the little I had (your Telegram name and ID). Send /start if you change your mind.",
  needsStart: "Please tap /start first so I can set you up.",

  askTime:
    "What time of day suits you for reminders? Follow-ups on your prayer requests will arrive then too.",
  askHour: "Pick a time:",
  askNudges: (time: string) =>
    `Got it: ${formatTime(time)}.\n\nWould you also like a short daily reminder to pray at that time?`,
  onboardingDone: (user: Pick<UserRow, "reminder_time" | "nudges_enabled">) =>
    `You're all set. ` +
    (user.nudges_enabled && user.reminder_time
      ? `I'll check in daily at ${formatTime(user.reminder_time)}.`
      : "No daily reminders, just follow-ups.") +
    `\n\n/prayed — record that you prayed\n/settings — change your reminder time\n` +
    `/deletemydata — delete everything I've stored`,

  settings: (user: Pick<UserRow, "reminder_time" | "nudges_enabled" | "timezone">) =>
    `Your settings\n\n` +
    `Reminder time: ${user.reminder_time ? formatTime(user.reminder_time) : "not set"} (${user.timezone})\n` +
    `Daily reminder: ${user.nudges_enabled ? "on" : "off"}`,

  nudge: "Have you had a moment to pray today?",
  nudgePrayed: "Have you had a moment to pray today?\n\nYes. Logged for today.",
  nudgeNotYet: "Have you had a moment to pray today?\n\nNo worries. Send /prayed when you do.",
  prayedLogged: "Logged. Thanks for taking the time to pray today.",

  deleteConfirm:
    "This permanently deletes your prayer requests, prayer history and settings. It can't be undone.",
  deleted: "Done. Everything I stored about you has been deleted. Send /start if you'd like to begin again.",
  deleteCancelled: "Cancelled. Nothing was deleted.",

  fallback: "I didn't catch that. Try /prayed or /settings.",
  staleButton: "That button has expired.",
} as const;

export const label = {
  agree: "Agree and continue",
  decline: "No thanks",
  morning: "Morning · 7:00 am",
  midday: "Midday · 12:00 pm",
  evening: "Evening · 9:00 pm",
  otherTime: "Another time…",
  back: "« Back",
  nudgesYes: "Yes, remind me daily",
  nudgesNo: "No, just follow-ups",
  changeTime: "Change time",
  nudgesTurnOn: "Turn daily reminder on",
  nudgesTurnOff: "Turn daily reminder off",
  prayed: "Yes, I prayed",
  notYet: "Not yet",
  deleteYes: "Delete everything",
  cancel: "Cancel",
} as const;
