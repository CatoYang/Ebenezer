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
 * The parish's contact for questions about personal data, shown in the privacy notice (Singapore's PDPA
 * requires a data protection contact).
 */
export const DATA_CONTACT = "@davidwoon on Telegram or +65 9022 2439";

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

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** 45 → "45 min", 60 → "1 h", 105 → "1 h 45 min". Same as formatMinutes in miniapp/src/text.ts. */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export interface WeeklySummary {
  week_label: string;
  days_prayed: number;
  answered_titles: string[];
  active_requests: number;
  current_streak: number;
  study_days: number;
  study_minutes: number;
}

export interface ListedRequest {
  title: string;
  details: string | null;
  prayer_count: number;
  next_check_in: string | null;
  awaiting_reply: boolean;
}

function reminderSentence(user: Pick<UserRow, "reminder_time" | "nudges_enabled">): string {
  if (!user.reminder_time) return "Choose a reminder time with /settings.";
  const time = formatTime(user.reminder_time);
  return user.nudges_enabled
    ? `I'll remind you to pray daily at ${time}, and check in on your intentions then too.`
    : `I'll check in on your intentions at ${time}. Daily reminders are off.`;
}

/**
 * How to use the bot. The app comes first, because it's the easiest way in; commands are the
 * alternative. Every command in COMMANDS (commands.ts) must appear here; a test checks it.
 */
function guide(hasApp: boolean): string {
  const commands = [
    "/pray — add an intention, e.g. /pray Sarah – surgery on Friday",
    "/list — what you're praying for",
    "/prayed — record that you prayed today",
    "/studied — record Bible study, e.g. /studied 30 John 3",
    "/settings — reminder time, daily reminder, weekly summary",
    hasApp ? "/app — open the app" : "/app — open the app (coming soon)",
    "/help — show this again",
    "/deletemydata — delete everything I've stored",
  ];
  const checkIns = "When I check in about an intention, just tap a button to reply.";
  if (!hasApp) return [`How to use ${APP_NAME}:`, "", ...commands, "", checkIns].join("\n");
  return [
    `The easiest way to use ${APP_NAME} is the app: tap ${label.openApp} below, or Open next to the ` +
    `message box.`,
    "",
    "In the app you can:",
    "• add your intentions: the people and things you're praying for",
    "• mark intentions as answered and keep them as stones of remembrance",
    "• log your Bible study time",
    "• see your journey in prayer and Bible study",
    "• change your reminder time and settings",
    "",
    checkIns,
    "",
    "Prefer typing? These commands work too:",
    ...commands,
  ].join("\n");
}

export const msg = {
  /** HTML: send with parse_mode "HTML". */
  welcome: (name: string | null) =>
    `<blockquote>${SCRIPTURE.text}\n— ${SCRIPTURE.reference}</blockquote>\n\n` +
    `Hi${name ? ` ${escapeHtml(name)}` : ""}. I'm ${APP_NAME}. Like Samuel's stone, I'm here to help you ` +
    `remember: what you've prayed for, how God has answered, and to keep praying.\n\n` +
    `What I store: your Telegram name and ID, the intentions you add, when you pray, and your Bible ` +
    `study times and notes. ` +
    `Only you can see them. Nothing is shared with anyone else.\n\n` +
    `For the people you pray for, please use a first name or initials.\n\n` +
    `You can delete everything at any time with /deletemydata. ` +
    `Questions about your data? Contact the parish: ${escapeHtml(DATA_CONTACT)}.\n\n` +
    `Is that ok?`,
  consentDeclined:
    "No problem. I've deleted the little I had (your Telegram name and ID). Send /start if you change your mind.",
  needsStart: "Please tap /start first so I can set you up.",

  askTime: "What time of day suits you for reminders? I'll check in on your intentions then too.",
  askHour: "Pick a time:",
  askNudges: (time: string) =>
    `Got it: ${formatTime(time)}.\n\nWould you also like a short daily reminder to pray at that time?`,
  onboardingDone: (user: Pick<UserRow, "reminder_time" | "nudges_enabled">, hasApp: boolean) =>
    `You're all set. ${reminderSentence(user)}\n\n${guide(hasApp)}`,
  welcomeBack: (user: Pick<UserRow, "first_name" | "reminder_time" | "nudges_enabled">, hasApp: boolean) =>
    `Welcome back${user.first_name ? `, ${user.first_name}` : ""}. ${reminderSentence(user)}\n\n${
      guide(hasApp)
    }`,
  help: (hasApp: boolean) => guide(hasApp),

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
    if (s.days_prayed === 0 && s.study_minutes === 0) {
      lines.push("Last week was quiet. A moment of prayer today is a good place to start again.");
    } else if (s.days_prayed > 0) {
      lines.push(
        `You prayed on ${s.days_prayed} of 7 days.` +
          (s.current_streak > 1 ? ` Current streak: ${s.current_streak} days.` : ""),
      );
    }
    if (s.study_minutes > 0) {
      if (s.days_prayed > 0) lines.push("");
      lines.push(`Bible study: ${days(s.study_days)}, ${formatMinutes(s.study_minutes)}.`);
    }
    if (s.answered_titles.length > 0) {
      lines.push("", `Answered: ${s.answered_titles.join(", ")}. Thanks be to God!`);
    }
    if (s.active_requests > 0) {
      lines.push(
        "",
        `Still on your list: ${s.active_requests} ${s.active_requests === 1 ? "intention" : "intentions"}.`,
      );
    }
    return lines.join("\n");
  },

  nudge: "Have you had a moment to pray today?",
  nudgePrayed: "Have you had a moment to pray today?\n\nYes. Logged for today.",
  nudgeNotYet: "Have you had a moment to pray today?\n\nNo worries. Send /prayed when you do.",
  prayedLogged: "Logged. Thanks for taking the time to pray today.",

  askStudy:
    "How long did you study the Bible today?\n\nFor another length, send /studied and the minutes, e.g. /studied 25",
  askStudyNote: (minutes: number) =>
    `Logged ${formatMinutes(minutes)} of Bible study today.\n\n` +
    `What did you read? A short note is enough, e.g. John 3 or Sunday's readings.`,
  studyLogged: (minutes: number, note: string | null) =>
    `Logged ${formatMinutes(minutes)} of Bible study today${note ? `: ${note}` : ""}.`,
  studyNoteSaved: "Saved.",
  studyNoteTooLong: "That's a bit long. Please keep the note under 500 characters.",
  studyInvalid: "Send the minutes first, then an optional note, e.g. /studied 30 John 3. Or send just " +
    "/studied to pick a length.",
  studyAlreadyLogged: "Already recorded.",

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
  requestInactive: "That intention is no longer active.",

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
    "This permanently deletes your intentions, your prayer and Bible study history, and your settings. " +
    "It can't be undone.",
  deleted: "Done. Everything I stored about you has been deleted. Send /start if you'd like to begin again.",
  deleteCancelled: "Cancelled. Nothing was deleted.",

  fallback: "I didn't catch that. To add an intention, open the app or send /pray followed by it, e.g. " +
    "/pray Sarah – surgery on Friday. Send /help to see everything I can do.",
  staleButton: "That button has expired.",

  /** To the maintainer (ALERT_TELEGRAM_USER_ID), not to users. Sizes in bytes; MB = 1,000,000 bytes. */
  storageAlert: (usedBytes: number, quotaBytes: number) =>
    `Storage warning: ${APP_NAME}'s database is using ${Math.round(usedBytes / 1e6)} MB, ` +
    `${Math.round((usedBytes / quotaBytes) * 100)}% of its ${Math.round(quotaBytes / 1e6)} MB quota.\n\n` +
    `See "Storage warning" in docs/MAINTENANCE.md for what to do. I'll remind you once a day while it stays ` +
    `above 80%.`,
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
  min15: "15 min",
  min30: "30 min",
  min45: "45 min",
  hour1: "1 hour",
  hour1half: "1½ hours",
  hours2: "2 hours",
  openApp: `Open ${APP_NAME}`,
  deleteYes: "Delete everything",
  cancel: "Cancel",
} as const;
