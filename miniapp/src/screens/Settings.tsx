import { Cell, List, Placeholder, Section, Spinner, Switch } from "@telegram-apps/telegram-ui";
import { useEffect, useRef, useState } from "react";
import { api, type Settings as SettingsData } from "../api";
import { confirm, haptic, tg } from "../telegram";

const deviceTimezone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
})();

export function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [time, setTime] = useState("");
  const [failed, setFailed] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    api.me().then((s) => {
      setSettings(s);
      setTime(s.reminder_time ?? "");
    }).catch(() => setFailed(true));
    return () => window.clearTimeout(timer.current);
  }, []);

  if (failed) return <Placeholder header="Couldn't load your settings" description="Please try again later." />;
  if (!settings) return <div className="center"><Spinner size="l" /></div>;

  // Optimistic: show the change straight away, put it back if the save fails.
  const save = async (changes: Partial<Omit<SettingsData, "first_name">>) => {
    const previous = settings;
    setSettings({ ...settings, ...changes });
    try {
      const saved = await api.updateSettings(changes);
      setSettings(saved);
      setTime(saved.reminder_time ?? "");
      haptic.success();
    } catch {
      setSettings(previous);
      setTime(previous.reminder_time ?? "");
      haptic.error();
      tg?.showAlert("Couldn't save that change. Please try again.");
    }
  };

  // Time pickers can fire several changes while scrolling; save once the value settles.
  const onTimeChange = (value: string) => {
    setTime(value);
    window.clearTimeout(timer.current);
    if (/^\d{2}:\d{2}$/.test(value) && value !== settings.reminder_time) {
      timer.current = window.setTimeout(() => save({ reminder_time: value }), 800);
    }
  };

  return (
    <List>
      <Section
        header="Reminders"
        footer="Check-ins on your intentions arrive at your reminder time too. The daily reminder is skipped on days you've already prayed."
      >
        <Cell
          after={
            <input
              className="time-input"
              type="time"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
            />
          }
        >
          Reminder time
        </Cell>
        <Cell
          Component="label"
          after={
            <Switch
              checked={settings.nudges_enabled}
              onChange={(e) => save({ nudges_enabled: e.target.checked })}
            />
          }
        >
          Daily reminder
        </Cell>
        <Cell
          Component="label"
          description="Mondays, at your reminder time"
          after={
            <Switch
              checked={settings.weekly_summary_enabled}
              onChange={(e) => save({ weekly_summary_enabled: e.target.checked })}
            />
          }
        >
          Weekly summary
        </Cell>
      </Section>

      <Section header="Timezone" footer="Reminders and your journey follow this timezone.">
        <Cell after={settings.timezone.replace(/_/g, " ")}>Timezone</Cell>
        {deviceTimezone && deviceTimezone !== settings.timezone && (
          <Cell
            description={deviceTimezone.replace(/_/g, " ")}
            onClick={async () => {
              if (await confirm(`Switch your timezone to ${deviceTimezone}?`)) save({ timezone: deviceTimezone });
            }}
          >
            Use this device's timezone
          </Cell>
        )}
      </Section>

      <Section footer="To delete everything stored about you, send /deletemydata to the bot." />
    </List>
  );
}
