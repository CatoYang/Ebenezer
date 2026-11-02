import { Cell, Chip, Input, List, Section, Textarea } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { api } from "../api";
import { haptic, useBackButton, useMainButton } from "../telegram";
import { INTERVALS, LIMITS } from "../text";

export function AddRequest(props: { names: string[]; onDone: () => void; onBack: () => void }) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [days, setDays] = useState<number | null>(7);
  const [saving, setSaving] = useState(false);

  useBackButton(props.onBack);
  useMainButton({
    text: "Add",
    enabled: title.trim().length > 0,
    loading: saving,
    onClick: async () => {
      if (!title.trim() || saving) return;
      setSaving(true);
      try {
        await api.addRequest(title.trim(), details.trim() || null, days);
        haptic.success();
        props.onDone();
      } catch {
        haptic.error();
        setSaving(false);
      }
    },
  });

  const suggestions = props.names.filter((n) => n.toLowerCase().startsWith(title.trim().toLowerCase()) && n !== title)
    .slice(0, 8);

  return (
    <List>
      <Section header="Who or what are you praying for?" footer="A first name or initials is enough.">
        <Input
          placeholder="e.g. Sarah"
          value={title}
          maxLength={LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        {suggestions.length > 0 && (
          <div className="chips">
            {suggestions.map((name) => (
              <Chip key={name} mode="mono" onClick={() => setTitle(name)}>{name}</Chip>
            ))}
          </div>
        )}
        <Textarea
          placeholder="Details (optional), e.g. surgery on Friday"
          value={details}
          maxLength={LIMITS.details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </Section>
      <Section header="When should I check in with you about it?">
        {INTERVALS.map((option) => (
          <Cell
            key={option.label}
            onClick={() => {
              haptic.tap();
              setDays(option.days);
            }}
            after={days === option.days ? <span className="check">✓</span> : null}
          >
            {option.label}
          </Cell>
        ))}
      </Section>
    </List>
  );
}
