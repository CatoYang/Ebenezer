// Inline-button callback data. Telegram limits it to 64 bytes, so actions are short strings.
// Every button the bot sends is built here and every tap is parsed here, so the two can't drift.

/** Where a time picker was opened from, so we know what to show after a time is chosen. */
export type Origin = "onboarding" | "settings";

export type Callback =
  | { kind: "consent"; accept: boolean }
  | { kind: "time_presets"; origin: Origin }
  | { kind: "time_hours"; origin: Origin }
  | { kind: "time_set"; origin: Origin; time: string } // "HH:MM"
  | { kind: "nudges"; origin: Origin; enabled: boolean }
  | { kind: "settings_home" }
  | { kind: "nudge_reply"; prayed: boolean }
  | { kind: "delete"; confirm: boolean }
  | { kind: "interval"; requestId: string; days: FollowUpDays | null } // null = don't check in
  | { kind: "follow_up"; followUpId: string; response: FollowUpResponse }
  | { kind: "skip_note" };

/** Follow-up intervals offered as buttons. */
export const FOLLOW_UP_DAYS = [3, 7, 14, 30] as const;
export type FollowUpDays = typeof FOLLOW_UP_DAYS[number];

/** Matches the `response` values accepted by the respond_follow_up SQL function. */
export type FollowUpResponse = "answered" | "still_praying" | "later" | "stop";
const RESPONSE_CODE: Record<FollowUpResponse, string> = {
  answered: "a",
  still_praying: "s",
  later: "l",
  stop: "x",
};
const CODE_RESPONSE: Record<string, FollowUpResponse> = {
  a: "answered",
  s: "still_praying",
  l: "later",
  x: "stop",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ORIGIN_CODE: Record<Origin, string> = { onboarding: "o", settings: "s" };
const CODE_ORIGIN: Record<string, Origin> = { o: "onboarding", s: "settings" };
const originOf = (code: string | undefined) => (has(CODE_ORIGIN, code) ? CODE_ORIGIN[code] : undefined);

export function encode(cb: Callback): string {
  switch (cb.kind) {
    case "consent":
      return `consent:${cb.accept ? "y" : "n"}`;
    case "time_presets":
      return `time:${ORIGIN_CODE[cb.origin]}:p`;
    case "time_hours":
      return `time:${ORIGIN_CODE[cb.origin]}:h`;
    case "time_set":
      return `time:${ORIGIN_CODE[cb.origin]}:${cb.time.replace(":", "")}`;
    case "nudges":
      return `nudges:${ORIGIN_CODE[cb.origin]}:${cb.enabled ? "y" : "n"}`;
    case "settings_home":
      return "settings";
    case "nudge_reply":
      return `nudge:${cb.prayed ? "y" : "n"}`;
    case "delete":
      return `delete:${cb.confirm ? "y" : "n"}`;
    case "interval":
      return `iv:${cb.requestId}:${cb.days ?? 0}`;
    case "follow_up":
      return `fu:${cb.followUpId}:${RESPONSE_CODE[cb.response]}`;
    case "skip_note":
      return "note:skip";
  }
}

const YES_NO: Record<string, boolean> = { y: true, n: false };
const has = (map: object, key: string | undefined): key is string =>
  key !== undefined && Object.hasOwn(map, key);

export function parse(data: string): Callback | null {
  const [head, a, b] = data.split(":");
  switch (head) {
    case "consent":
      return has(YES_NO, a) ? { kind: "consent", accept: YES_NO[a] } : null;
    case "time": {
      const origin = originOf(a);
      if (!origin) return null;
      if (b === "p") return { kind: "time_presets", origin };
      if (b === "h") return { kind: "time_hours", origin };
      const m = /^([01]\d|2[0-3])([0-5]\d)$/.exec(b ?? "");
      return m ? { kind: "time_set", origin, time: `${m[1]}:${m[2]}` } : null;
    }
    case "nudges": {
      const origin = originOf(a);
      return origin && has(YES_NO, b) ? { kind: "nudges", origin, enabled: YES_NO[b] } : null;
    }
    case "settings":
      return a === undefined ? { kind: "settings_home" } : null;
    case "nudge":
      return has(YES_NO, a) ? { kind: "nudge_reply", prayed: YES_NO[a] } : null;
    case "delete":
      return has(YES_NO, a) ? { kind: "delete", confirm: YES_NO[a] } : null;
    case "iv": {
      if (!UUID.test(a ?? "")) return null;
      const days = Number(b);
      if (days === 0 && b === "0") return { kind: "interval", requestId: a, days: null };
      return (FOLLOW_UP_DAYS as readonly number[]).includes(days) && String(days) === b
        ? { kind: "interval", requestId: a, days: days as FollowUpDays }
        : null;
    }
    case "fu":
      return UUID.test(a ?? "") && has(CODE_RESPONSE, b)
        ? { kind: "follow_up", followUpId: a, response: CODE_RESPONSE[b] }
        : null;
    case "note":
      return a === "skip" ? { kind: "skip_note" } : null;
    default:
      return null;
  }
}
