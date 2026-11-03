import { Cell, Input, List, Section, Textarea } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { api, type PrayerRequest } from "../api";
import { confirm, haptic, useBackButton, useMainButton } from "../telegram";
import { INTERVALS, LIMITS, times } from "../text";
import { nextLabel } from "./PrayingFor";

export function RequestDetail(props: {
  request: PrayerRequest;
  onChanged: () => void; // reload the list
  onAnswer: () => void;
  onClosed: () => void;
  onBack: () => void;
}) {
  const r = props.request;
  const [title, setTitle] = useState(r.title);
  const [details, setDetails] = useState(r.details ?? "");
  const [busy, setBusy] = useState(false);

  const dirty = title.trim() !== r.title || (details.trim() || null) !== r.details;

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      haptic.success();
      props.onChanged();
    } catch {
      haptic.error();
    } finally {
      setBusy(false);
    }
  };

  useBackButton(props.onBack);
  useMainButton(
    dirty
      ? {
        text: "Save changes",
        enabled: title.trim().length > 0,
        loading: busy,
        onClick: () => run(() => api.editRequest(r.id, title.trim(), details.trim() || null)),
      }
      : null,
  );

  return (
    <List>
      <Section header="Intention" footer={`Praying since ${r.since_label} · prayed ${times(r.prayer_count)}`}>
        <Input value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea
          placeholder="Details (optional)"
          value={details}
          maxLength={LIMITS.details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </Section>

      <Section>
        <Cell onClick={() => run(() => api.prayed(r.id))} description="Adds to your prayer count">
          I prayed for this
        </Cell>
      </Section>

      <Section header="Check in with me every" footer={nextLabel(r)}>
        {INTERVALS.map((option) => (
          <Cell
            key={option.label}
            onClick={() => option.days !== r.follow_up_days && run(() => api.setInterval(r.id, option.days))}
            after={r.follow_up_days === option.days ? <span className="check">✓</span> : null}
          >
            {option.label}
          </Cell>
        ))}
      </Section>

      <Section>
        <Cell onClick={props.onAnswer}>It was answered</Cell>
        <Cell
          className="destructive"
          onClick={async () => {
            if (await confirm(`Stop praying for "${r.title}"? It won't count as answered.`)) {
              await run(() => api.close(r.id));
              props.onClosed();
            }
          }}
        >
          Stop praying for this
        </Cell>
      </Section>
    </List>
  );
}
