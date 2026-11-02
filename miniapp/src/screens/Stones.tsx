import { Blockquote, Cell, List, Placeholder, Section, Textarea } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { api, type Stone } from "../api";
import { haptic, useBackButton, useMainButton } from "../telegram";
import { LIMITS, times, VERSE } from "../text";

export function Stones(props: { stones: Stone[]; onOpen: (id: string) => void }) {
  const verse = (
    <Blockquote className="verse">
      “{VERSE.text}” <span className="reference">— {VERSE.reference}</span>
    </Blockquote>
  );

  if (props.stones.length === 0) {
    return (
      <List>
        {verse}
        <Placeholder
          header="Your stones will be kept here"
          description="When a prayer is answered, mark it as answered and it's kept here as a reminder of how God has helped you."
        />
      </List>
    );
  }

  return (
    <List>
      {verse}
      {props.stones.map((s) => (
        <Section
          key={s.id}
          footer={`Answered ${s.answered_label} · prayed ${times(s.prayer_count)} since ${s.since_label}`}
        >
          <Cell multiline subtitle={s.details} onClick={() => props.onOpen(s.id)}>{s.title}</Cell>
          <Cell multiline className="note" onClick={() => props.onOpen(s.id)}>
            {s.answer_note ?? <span className="muted">Add a note about how it was answered</span>}
          </Cell>
        </Section>
      ))}
    </List>
  );
}

export function StoneNote(props: { stone: Stone; onDone: () => void; onBack: () => void }) {
  const [note, setNote] = useState(props.stone.answer_note ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = (note.trim() || null) !== props.stone.answer_note;

  useBackButton(props.onBack);
  useMainButton(
    dirty
      ? {
        text: "Save",
        loading: saving,
        onClick: async () => {
          if (saving) return;
          setSaving(true);
          try {
            await api.editStoneNote(props.stone.id, note.trim() || null);
            haptic.success();
            props.onDone();
          } catch {
            haptic.error();
            setSaving(false);
          }
        },
      }
      : null,
  );

  return (
    <List>
      <Section header={`How "${props.stone.title}" was answered`} footer={`Answered ${props.stone.answered_label}`}>
        <Textarea
          placeholder="A sentence is enough."
          value={note}
          maxLength={LIMITS.note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
      </Section>
    </List>
  );
}
