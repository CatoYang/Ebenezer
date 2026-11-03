import { Cell, List, Placeholder, Section, Spinner } from "@telegram-apps/telegram-ui";
import { useEffect, useState } from "react";
import { api, type Journey as JourneyData, type StudySession } from "../api";
import { buildCalendar, type CalendarCell } from "../calendar";
import { useMainButton } from "../telegram";
import { formatMinutes } from "../text";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function Journey(props: { onLogStudy: (session?: StudySession) => void }) {
  const [data, setData] = useState<JourneyData | null>(null);
  const [failed, setFailed] = useState(false);

  useMainButton({ text: "Log Bible study", onClick: () => props.onLogStudy() });

  useEffect(() => {
    api.journey().then(setData).catch(() => setFailed(true));
  }, []);

  if (failed) return <Placeholder header="Couldn't load your journey" description="Please try again later." />;
  if (!data) return <div className="center"><Spinner size="l" /></div>;

  const { weeks, monthLabels } = buildCalendar(data.today, data.calendar);
  const study = data.study;
  const studyWeek = buildCalendar(data.today, study.this_week, 1).weeks[0];

  return (
    <List>
      <Section header="Prayer this week" footer={`You've prayed on ${data.days_this_week} of 7 days this week.`}>
        <WeekDots week={weeks[weeks.length - 1]} />
      </Section>

      <Section>
        <Cell after={plural(data.current_streak, "day")}>Current streak</Cell>
        <Cell after={plural(data.best_streak, "day")}>Best streak</Cell>
        <Cell after={data.total_days}>Days prayed</Cell>
        <Cell after={data.total_prayers}>Prayers recorded</Cell>
        <Cell after={data.active_requests}>Praying for</Cell>
        <Cell after={data.answered_requests}>Answered prayers</Cell>
      </Section>

      <Section header="Last 13 weeks" footer="Each square is a day; darker means more prayers recorded.">
        <div className="calendar">
          <div className="calendar-weekdays">
            {WEEKDAYS.map((d, i) => <span key={i}>{i % 2 === 0 ? d : ""}</span>)}
          </div>
          {weeks.map((week, w) => (
            <div key={week[0].date} className="calendar-week">
              <span className="calendar-month">{monthLabels[w] ?? ""}</span>
              {week.map((day) => (
                <span
                  key={day.date}
                  title={`${day.date}: ${day.count}`}
                  className={`calendar-day level-${Math.min(day.count, 3)} ${day.today ? "today" : ""} ${
                    day.future ? "future" : ""
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section
        header="Bible study this week"
        footer={study.minutes_this_week > 0
          ? `You've studied on ${study.days_this_week} of 7 days this week, ${
            formatMinutes(study.minutes_this_week)
          } in all.`
          : "Nothing logged yet this week. Tap Log Bible study below after you've read."}
      >
        <WeekDots week={studyWeek} />
      </Section>

      <Section>
        <Cell after={plural(study.current_streak, "day")}>Current streak</Cell>
        <Cell after={plural(study.best_streak, "day")}>Best streak</Cell>
        <Cell after={study.total_days}>Days studied</Cell>
        <Cell after={formatMinutes(study.total_minutes)}>Total time</Cell>
      </Section>

      {study.recent.length > 0 && (
        <Section header="Recent Bible study" footer="Tap one to change or delete it.">
          {study.recent.map((s) => (
            <Cell
              key={s.id}
              multiline
              subtitle={s.note}
              after={formatMinutes(s.minutes)}
              onClick={() => props.onLogStudy(s)}
            >
              {s.label}
            </Cell>
          ))}
        </Section>
      )}
    </List>
  );
}

function WeekDots(props: { week: CalendarCell[] }) {
  return (
    <div className="week-dots">
      {props.week.map((day, i) => (
        <div key={day.date} className="week-dot">
          <span className={`dot ${day.count ? "filled" : ""} ${day.today ? "today" : ""} ${day.future ? "future" : ""}`} />
          <span className="dot-label">{WEEKDAYS[i]}</span>
        </div>
      ))}
    </div>
  );
}
