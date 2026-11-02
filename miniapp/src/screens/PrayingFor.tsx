import { Button, Cell, List, Placeholder, Section } from "@telegram-apps/telegram-ui";
import type { PrayerRequest } from "../api";
import { useMainButton } from "../telegram";
import { times } from "../text";

export function PrayingFor(props: { requests: PrayerRequest[]; onOpen: (id: string) => void; onAdd: () => void }) {
  useMainButton({ text: "Add a prayer request", onClick: props.onAdd });

  if (props.requests.length === 0) {
    return (
      <Placeholder
        header="Nothing here yet"
        description="Add someone or something you're praying for. I'll check in with you about it."
        action={<Button size="m" onClick={props.onAdd}>Add a prayer request</Button>}
      />
    );
  }

  return (
    <List>
      <Section header={`Praying for · ${props.requests.length}`}>
        {props.requests.map((r) => (
          <Cell
            key={r.id}
            multiline
            subtitle={r.details}
            description={`Prayed ${times(r.prayer_count)} · ${nextLabel(r)}`}
            after={<span className="chevron">›</span>}
            onClick={() => props.onOpen(r.id)}
          >
            {r.title}
          </Cell>
        ))}
      </Section>
    </List>
  );
}

export function nextLabel(r: PrayerRequest): string {
  if (r.awaiting_reply) return "check-in waiting for your reply";
  return r.next_check_in ? `next check-in ${r.next_check_in}` : "no check-ins";
}
