import { InlineKeyboard } from "grammy";
import { encode, type Origin } from "./callbacks.ts";
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

export const settingsKeyboard = (nudgesEnabled: boolean) =>
  InlineKeyboard.from([
    [btn(label.changeTime, { kind: "time_presets", origin: "settings" })],
    [
      btn(nudgesEnabled ? label.nudgesTurnOff : label.nudgesTurnOn, {
        kind: "nudges",
        origin: "settings",
        enabled: !nudgesEnabled,
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
