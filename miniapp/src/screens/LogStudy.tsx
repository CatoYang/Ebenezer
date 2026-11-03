import { Cell, Chip, Input, List, Section, Textarea } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { api, type StudySession } from "../api";
import { confirm, haptic, useBackButton, useMainButton } from "../telegram";
import { formatMinutes, LIMITS, STUDY_PRESETS } from "../text";

/** Log a Bible study session, or edit / delete one (when `session` is given). */
export function LogStudy(props: { session?: StudySession; onDone: () => void; onBack: () => void }) {
  const s = props.session;
  const [minutes, setMinutes] = useState(s ? String(s.minutes) : "");
  const [note, setNote] = useState(s?.note ?? "");
  const [busy, setBusy] = useState(false);

  const n = Number(minutes);
  const valid = /^\d+$/.test(minutes) && n >= 1 && n <= LIMITS.studyMinutes;

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      haptic.success();
      props.onDone();
    } catch {
      haptic.error();
      setBusy(false);
    }
  };

  useBackButton(props.onBack);
  useMainButton({
    text: s ? "Save" : "Log Bible study",
    enabled: valid,
    loading: busy,
    onClick: () => {
      if (!valid) return;
      const text = note.trim() || null;
      run(() => (s ? api.editStudy(s.id, n, text) : api.logStudy(n, text)));
    },
  });

  return (
    <List>
      <Section header="How long did you study the Bible?" footer={s ? `Logged ${s.label}` : "In minutes."}>
        <div className="chips">
          {STUDY_PRESETS.map((p) => (
            <Chip
              key={p}
              mode={n === p ? "elevated" : "mono"}
              before={n === p ? <span className="check">✓</span> : undefined}
              onClick={() => {
                haptic.tap();
                setMinutes(String(p));
              }}
            >
              {formatMinutes(p)}
            </Chip>
          ))}
        </div>
        <Input
          type="number"
          inputMode="numeric"
          placeholder="Or type the minutes, e.g. 25"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))}
        />
      </Section>

      <Section header="What did you read?" footer="Optional. A short note is enough.">
        <Textarea
          placeholder="e.g. John 3, or Sunday's readings"
          value={note}
          maxLength={LIMITS.studyNote}
          onChange={(e) => setNote(e.target.value)}
        />
      </Section>

      {s && (
        <Section>
          <Cell
            className="destructive"
            onClick={async () => {
              if (await confirm("Delete this Bible study session?")) await run(() => api.deleteStudy(s.id));
            }}
          >
            Delete this session
          </Cell>
        </Section>
      )}
    </List>
  );
}
