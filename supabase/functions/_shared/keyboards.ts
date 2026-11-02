import { InlineKeyboard } from "grammy";
import { encode, type FollowUpDays, type Origin } from "./callbacks.ts";
import { label } from "./messages.ts";

const btn = (text: string, cb: Parameters<typeof encode>[0]) => InlineKeyboard.text(text, encode(cb));

export const consentKeyboard = () =>
  InlineKeyboard.from([[
    btn(label.agree, { kind: "consent", accept: true }),
    btn(label.decline, { kind: "consent", accept: false }),
  ]]);

export function timePresetsKeyboard(origin: Origin) {
  const rows = [
    [btn(label.morning, { kind: "time_set", origin, time: "07:00" })],
    [btn(label.midday, { kind: "time_set", origin, time: "12:00" })],
    [btn(label.evening, { kind: "time_set", origin, time: "21:00" })],
    [btn(label.otherTime, { kind: "time_hours", origin })],
  ];
  if (origin === "settings") rows.push([btn(label.back, { kind: "settings_home" })]);
  return InlineKeyboard.from(rows);
}

/** Hourly grid, 5 am to 11 pm, four per row. */
export function timeHoursKeyboard(origin: Origin) {
  const hours = Array.from({ length: 19 }, (_, i) => String(i + 5).padStart(2, "0") + ":00");
  const rows = [];
  for (let i = 0; i < hours.length; i += 4) {
    rows.push(hours.slice(i, i + 4).map((time) => btn(time, { kind: "time_set", origin, time })));
  }
  rows.push([btn(label.back, { kind: "time_presets", origin })]);
  return InlineKeyboard.from(rows);
}

export const nudgePrefKeyboard = () =>
  InlineKeyboard.from([[
    btn(label.nudgesYes, { kind: "nudges", origin: "onboarding", enabled: true }),
    btn(label.nudgesNo, { kind: "nudges", origin: "onboarding", enabled: false }),
  ]]);

export const settingsKeyboard = (user: { nudges_enabled: boolean; weekly_summary_enabled: boolean }) =>
  InlineKeyboard.from([
    [btn(label.changeTime, { kind: "time_presets", origin: "settings" })],
    [
      btn(user.nudges_enabled ? label.nudgesTurnOff : label.nudgesTurnOn, {
        kind: "nudges",
        origin: "settings",
        enabled: !user.nudges_enabled,
      }),
    ],
    [
      btn(user.weekly_summary_enabled ? label.weeklyTurnOff : label.weeklyTurnOn, {
        kind: "weekly_summary",
        enabled: !user.weekly_summary_enabled,
      }),
    ],
  ]);

export const nudgeKeyboard = () =>
  InlineKeyboard.from([[
    btn(label.prayed, { kind: "nudge_reply", prayed: true }),
    btn(label.notYet, { kind: "nudge_reply", prayed: false }),
  ]]);

export const deleteKeyboard = () =>
  InlineKeyboard.from([[
    btn(label.deleteYes, { kind: "delete", confirm: true }),
    btn(label.cancel, { kind: "delete", confirm: false }),
  ]]);

const INTERVAL_LABELS: Record<FollowUpDays, string> = {
  3: label.days3,
  7: label.week1,
  14: label.weeks2,
  30: label.month1,
};

/** "When should I check in?" after adding a request. */
export const intervalKeyboard = (requestId: string) =>
  InlineKeyboard.from([
    ([3, 7] as const).map((days) => btn(INTERVAL_LABELS[days], { kind: "interval", requestId, days })),
    ([14, 30] as const).map((days) => btn(INTERVAL_LABELS[days], { kind: "interval", requestId, days })),
    [btn(label.noCheckIn, { kind: "interval", requestId, days: null })],
  ]);

export const followUpKeyboard = (followUpId: string) =>
  InlineKeyboard.from([
    [
      btn(label.answered, { kind: "follow_up", followUpId, response: "answered" }),
      btn(label.stillPraying, { kind: "follow_up", followUpId, response: "still_praying" }),
    ],
    [
      btn(label.later, { kind: "follow_up", followUpId, response: "later" }),
      btn(label.stop, { kind: "follow_up", followUpId, response: "stop" }),
    ],
  ]);

/** Opens the Mini App inside Telegram. */
export const openAppKeyboard = (url: string) =>
  InlineKeyboard.from([[InlineKeyboard.webApp(label.openApp, url)]]);

export const skipNoteKeyboard = () => InlineKeyboard.from([[btn(label.skip, { kind: "skip_note" })]]);
