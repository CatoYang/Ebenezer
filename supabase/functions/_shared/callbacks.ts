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
  | { kind: "delete"; confirm: boolean };

const ORIGIN_CODE: Record<Origin, string> = { onboarding: "o", settings: "s" };
const CODE_ORIGIN: Record<string, Origin> = { o: "onboarding", s: "settings" };

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
  }
}

const YES_NO: Record<string, boolean> = { y: true, n: false };

export function parse(data: string): Callback | null {
  const [head, a, b] = data.split(":");
  switch (head) {
    case "consent":
      return a in YES_NO ? { kind: "consent", accept: YES_NO[a] } : null;
    case "time": {
      const origin = CODE_ORIGIN[a];
      if (!origin) return null;
      if (b === "p") return { kind: "time_presets", origin };
      if (b === "h") return { kind: "time_hours", origin };
      const m = /^([01]\d|2[0-3])([0-5]\d)$/.exec(b ?? "");
      return m ? { kind: "time_set", origin, time: `${m[1]}:${m[2]}` } : null;
    }
    case "nudges": {
      const origin = CODE_ORIGIN[a];
      return origin && b in YES_NO ? { kind: "nudges", origin, enabled: YES_NO[b] } : null;
    }
    case "settings":
      return a === undefined ? { kind: "settings_home" } : null;
    case "nudge":
      return a in YES_NO ? { kind: "nudge_reply", prayed: YES_NO[a] } : null;
    case "delete":
      return a in YES_NO ? { kind: "delete", confirm: YES_NO[a] } : null;
    default:
      return null;
  }
}
