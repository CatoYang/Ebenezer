import { List, Section, Textarea } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { api, type PrayerRequest } from "../api";
import { haptic, useBackButton, useMainButton } from "../telegram";
import { LIMITS } from "../text";

export function AnswerRequest(props: { request: PrayerRequest; onDone: () => void; onBack: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useBackButton(props.onBack);
  useMainButton({
    text: "Mark as answered",
    loading: saving,
    onClick: async () => {
      if (saving) return;
      setSaving(true);
      try {
        await api.answer(props.request.id, note.trim() || null);
        haptic.success();
        props.onDone();
      } catch {
        haptic.error();
        setSaving(false);
      }
    },
  });

  return (
    <List>
      <Section
        header={`How was "${props.request.title}" answered?`}
        footer="Optional. A sentence is enough. It becomes one of your stones of remembrance."
      >
        <Textarea
          placeholder="e.g. The surgery went well and she's home."
          value={note}
          maxLength={LIMITS.note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
      </Section>
    </List>
  );
}
