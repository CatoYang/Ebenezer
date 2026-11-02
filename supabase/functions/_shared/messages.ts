// All user-facing wording. Handlers never inline message text.

import type { UserRow } from "./db.ts";

/** Display name. The only place it appears in code, so a rename is one line. */
export const APP_NAME = "Ebenezer";

/** The verse the app is named after, shown at the top of the welcome message. */
export const SCRIPTURE = {
  text: "Then Samuel took a stone and set it up between Mizpah and Shen and called its name Ebenezer; " +
    "for he said, “Till now the LORD has helped us.”",
  reference: "1 Samuel 7:12 (ESV)",
};

/**
 * Who to contact about personal data, shown in the privacy notice. Singapore's PDPA requires a Data
 * Protection Officer contact. PLACEHOLDER: replace with the parish DPO's name/email before real users.
 */
export const DATA_CONTACT = "[parish data protection contact — to be added]";

/** Escapes user-supplied text for messages sent with parse_mode "HTML". */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** "21:00" or "21:00:00" → "9:00 pm" */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "Sarah (surgery on Friday)" or just "Sarah". Plain text only (not HTML-escaped). */
export function describeRequest(title: string, details: string | null): string {
  return details ? `${title} (${details})` : title;
}

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

export interface WeeklySummary {
  week_label: string;
  days_prayed: number;
  answered_titles: string[];
  active_requests: number;
  current_streak: number;
}

export interface ListedRequest {
  title: string;
  details: string | null;
  prayer_count: number;
  next_check_in: string | null;
  awaiting_reply: boolean;
}

export const msg = {
  /** HTML: send with parse_mode "HTML". */
  welcome: (name: string | null) =>
    `<blockquote>${SCRIPTURE.text}\n— ${SCRIPTURE.reference}</blockquote>\n\n` +
    `Hi${name ? ` ${escapeHtml(name)}` : ""}. I'm ${APP_NAME}. Like Samuel's stone, I'm here to help you ` +
    `remember: what you've prayed for, how God has answered, and to keep praying.\n\n` +
    `What I store: your Telegram name and ID, the prayer requests you send me, and when you pray. ` +
    `Only you can see them. Nothing is shared with anyone else.\n\n` +
    `For the people you pray for, please use a first name or initials.\n\n` +
    `You can delete everything at any time with /deletemydata. ` +
    `Questions about your data? Contact ${escapeHtml(DATA_CONTACT)}.\n\n` +
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
    `\n\n/pray — add something to pray for, e.g. /pray Sarah – surgery on Friday\n` +
    `/list — what you're praying for\n/prayed — record that you prayed\n` +
    `/settings — change your reminder time\n/deletemydata — delete everything I've stored`,

  settings: (
    user: Pick<UserRow, "reminder_time" | "nudges_enabled" | "weekly_summary_enabled" | "timezone">,
  ) =>
    `Your settings\n\n` +
    `Reminder time: ${user.reminder_time ? formatTime(user.reminder_time) : "not set"} (${user.timezone})\n` +
    `Daily reminder: ${user.nudges_enabled ? "on" : "off"}\n` +
    `Weekly summary: ${user.weekly_summary_enabled ? "on, Mondays at your reminder time" : "off"}\n\n` +
    `To change your timezone, use the app (/app).`,

  weeklySummary: (s: WeeklySummary) => {
    const lines = [`Your week, ${s.week_label}`, ""];
    if (s.days_prayed === 0) {
      lines.push("Last week was quiet. A moment of prayer today is a good place to start again.");
    } else {
      lines.push(
        `You prayed on ${s.days_prayed} of 7 days.` +
          (s.current_streak > 1 ? ` Current streak: ${s.current_streak} days.` : ""),
      );
    }
    if (s.answered_titles.length > 0) {
      lines.push("", `Answered: ${s.answered_titles.join(", ")}. Thanks be to God!`);
    }
    if (s.active_requests > 0) {
      lines.push(
        "",
        `Still praying for ${s.active_requests} ${s.active_requests === 1 ? "request" : "requests"}.`,
      );
    }
    return lines.join("\n");
  },

  nudge: "Have you had a moment to pray today?",
  nudgePrayed: "Have you had a moment to pray today?\n\nYes. Logged for today.",
  nudgeNotYet: "Have you had a moment to pray today?\n\nNo worries. Send /prayed when you do.",
  prayedLogged: "Logged. Thanks for taking the time to pray today.",

  askRequest:
    "Who or what are you praying for?\n\nYou can add details after a dash, e.g. Sarah – surgery on Friday",
  requestPlaceholder: "Sarah – surgery on Friday",
  requestTooLong:
    "That's a bit long. Please keep it under 200 characters for the name and 500 for the details.",
  requestAdded: (title: string, details: string | null) =>
    `Added: ${describeRequest(title, details)}.\n\nWhen should I check in with you about it?`,
  requestScheduled: (title: string, details: string | null, dueLabel: string) =>
    `Added: ${describeRequest(title, details)}.\n\nI'll check in with you on ${dueLabel}.`,
  requestUnscheduled: (title: string, details: string | null) =>
    `Added: ${describeRequest(title, details)}.\n\nI won't check in on this one. You'll find it in /list.`,
  requestInactive: "That prayer request is no longer active.",

  followUp: (title: string, details: string | null, since: string, prayerCount: number) =>
    `Checking in on ${describeRequest(title, details)}.\n\n` +
    `You've prayed for this ${times(prayerCount)} since ${since}. How is it going?`,
  followUpAnswered: (title: string, details: string | null) =>
    `${describeRequest(title, details)}\n\nAnswered. Thanks be to God!`,
  followUpStillPraying: (title: string, details: string | null, nextLabel: string) =>
    `${describeRequest(title, details)}\n\nStill praying. I'll check in again on ${nextLabel}.`,
  followUpLater: (title: string, details: string | null, nextLabel: string) =>
    `${describeRequest(title, details)}\n\nOk, I'll ask again on ${nextLabel}.`,
  followUpStopped: (title: string, details: string | null) =>
    `${describeRequest(title, details)}\n\nI've stopped following up on this one.`,
  followUpAlreadyRecorded: "Already recorded.",

  askAnswerNote:
    "Would you like to write down how it was answered? A sentence is enough. It becomes one of your stones " +
    "of remembrance.",
  answerNoteSaved: "Saved. Till now the LORD has helped us.",
  answerNoteSkipped: "No problem.",
  answerNoteTooLong: "That's a bit long. Please keep it under 1,000 characters.",

  list: (requests: ListedRequest[], hasMore: boolean, answeredCount: number) => {
    if (requests.length === 0) {
      return "You're not praying for anything here yet. Add something with /pray, e.g. /pray Sarah – surgery on Friday" +
        (answeredCount > 0 ? `\n\nAnswered prayers so far: ${answeredCount}` : "");
    }
    const lines = requests.map((r, i) => {
      const next = r.awaiting_reply
        ? "waiting for your reply"
        : r.next_check_in
        ? `next check-in ${r.next_check_in}`
        : "no check-ins";
      return `${i + 1}. ${
        describeRequest(truncate(r.title, 60), r.details && truncate(r.details, 80))
      }\n    Prayed ${times(r.prayer_count)} · ${next}`;
    });
    return `What you're praying for\n\n${lines.join("\n\n")}` +
      (hasMore ? "\n\n…and more" : "") +
      `\n\nAnswered prayers so far: ${answeredCount}`;
  },

  openApp: `Open the app to see and manage what you're praying for, and to look back on answered prayers.`,
  appUnavailable: "The app isn't available yet. For now, use /list and /pray.",

  deleteConfirm:
    "This permanently deletes your prayer requests, prayer history and settings. It can't be undone.",
  deleted: "Done. Everything I stored about you has been deleted. Send /start if you'd like to begin again.",
  deleteCancelled: "Cancelled. Nothing was deleted.",

  fallback: "I didn't catch that. To add something to pray for, send /pray followed by it, e.g. " +
    "/pray Sarah – surgery on Friday",
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
  weeklyTurnOn: "Turn weekly summary on",
  weeklyTurnOff: "Turn weekly summary off",
  prayed: "Yes, I prayed",
  notYet: "Not yet",
  days3: "3 days",
  week1: "1 week",
  weeks2: "2 weeks",
  month1: "1 month",
  noCheckIn: "Don't check in",
  answered: "Answered",
  stillPraying: "Still praying",
  later: "Ask me tomorrow",
  stop: "Stop following up",
  skip: "Skip",
  openApp: `Open ${APP_NAME}`,
  deleteYes: "Delete everything",
  cancel: "Cancel",
} as const;
