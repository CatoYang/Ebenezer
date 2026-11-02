import { AppRoot, Placeholder, Spinner, Tabbar } from "@telegram-apps/telegram-ui";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type PrayerRequest, type Stone } from "./api";
import { AddRequest } from "./screens/AddRequest";
import { AnswerRequest } from "./screens/AnswerRequest";
import { Journey } from "./screens/Journey";
import { PrayingFor } from "./screens/PrayingFor";
import { RequestDetail } from "./screens/RequestDetail";
import { Settings } from "./screens/Settings";
import { StoneNote, Stones } from "./screens/Stones";
import { inTelegram, platform, tg } from "./telegram";

type Tab = "praying" | "stones" | "journey" | "settings";

const TABS: { id: Tab; text: string; icon: string }[] = [
  { id: "praying", text: "Praying for", icon: "✦" },
  { id: "stones", text: "Stones", icon: "◆" },
  { id: "journey", text: "Journey", icon: "▦" },
  { id: "settings", text: "Settings", icon: "⚙" },
];
type Screen =
  | { name: "list" }
  | { name: "add" }
  | { name: "request"; id: string }
  | { name: "answer"; id: string }
  | { name: "stone"; id: string };

type Status = "loading" | "ready" | "not_in_telegram" | "not_onboarded" | "error";

export function App() {
  const [appearance, setAppearance] = useState(tg?.colorScheme ?? "light");
  const [status, setStatus] = useState<Status>(inTelegram ? "loading" : "not_in_telegram");
  const [tab, setTab] = useState<Tab>("praying");
  const [screen, setScreen] = useState<Screen>({ name: "list" });
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [stones, setStones] = useState<Stone[]>([]);

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([api.requests(), api.stones()]);
      setRequests(r.requests);
      setNames(r.names);
      setStones(s.stones);
      setStatus("ready");
    } catch (err) {
      setStatus(err instanceof ApiError && err.code === "not_onboarded" ? "not_onboarded" : "error");
    }
  }, []);

  useEffect(() => {
    const app = tg;
    if (!app) return;
    app.ready();
    app.expand();
    const onTheme = () => setAppearance(app.colorScheme);
    app.onEvent("themeChanged", onTheme);
    return () => app.offEvent("themeChanged", onTheme);
  }, []);

  useEffect(() => {
    if (inTelegram) load();
  }, [load]);

  const toList = () => setScreen({ name: "list" });
  const findRequest = (id: string) => requests.find((r) => r.id === id);
  const findStone = (id: string) => stones.find((s) => s.id === id);

  let content: JSX.Element;
  if (status !== "ready") {
    content = <StatusMessage status={status} onRetry={load} />;
  } else if (screen.name === "add") {
    content = <AddRequest names={names} onBack={toList} onDone={() => load().then(toList)} />;
  } else if (screen.name === "request" && findRequest(screen.id)) {
    const id = screen.id;
    content = (
      <RequestDetail
        key={id}
        request={findRequest(id)!}
        onBack={toList}
        onChanged={load}
        onAnswer={() => setScreen({ name: "answer", id })}
        onClosed={toList}
      />
    );
  } else if (screen.name === "answer" && findRequest(screen.id)) {
    content = (
      <AnswerRequest
        request={findRequest(screen.id)!}
        onBack={() => setScreen({ name: "request", id: screen.id })}
        onDone={() =>
          load().then(() => {
            setTab("stones");
            toList();
          })}
      />
    );
  } else if (screen.name === "stone" && findStone(screen.id)) {
    content = <StoneNote stone={findStone(screen.id)!} onBack={toList} onDone={() => load().then(toList)} />;
  } else if (tab === "praying") {
    content = (
      <PrayingFor
        requests={requests}
        onOpen={(id) => setScreen({ name: "request", id })}
        onAdd={() => setScreen({ name: "add" })}
      />
    );
  } else if (tab === "stones") {
    content = <Stones stones={stones} onOpen={(id) => setScreen({ name: "stone", id })} />;
  } else if (tab === "journey") {
    content = <Journey />;
  } else {
    content = <Settings />;
  }

  const showTabs = status === "ready" && screen.name === "list";

  return (
    <AppRoot appearance={appearance} platform={platform()}>
      <main className={showTabs ? "with-tabbar" : undefined}>{content}</main>
      {showTabs && (
        <Tabbar>
          {TABS.map((t) => (
            <Tabbar.Item key={t.id} text={t.text} selected={tab === t.id} onClick={() => setTab(t.id)}>
              <span className="tab-icon">{t.icon}</span>
            </Tabbar.Item>
          ))}
        </Tabbar>
      )}
    </AppRoot>
  );
}

function StatusMessage(props: { status: Status; onRetry: () => void }) {
  switch (props.status) {
    case "loading":
      return <div className="center"><Spinner size="l" /></div>;
    case "not_in_telegram":
      return <Placeholder header="Open this in Telegram" description="Ebenezer opens from its bot in Telegram." />;
    case "not_onboarded":
      return (
        <Placeholder
          header="Welcome"
          description="Open the chat with the bot and tap Start first, then come back here."
        />
      );
    default:
      return (
        <Placeholder
          header="Something went wrong"
          description="Couldn't load your prayers. Check your connection and try again."
          action={<button className="link-button" onClick={props.onRetry}>Try again</button>}
        />
      );
  }
}
