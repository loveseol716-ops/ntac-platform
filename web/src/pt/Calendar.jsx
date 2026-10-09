import { useEffect, useState } from "react";
import { today } from "./model.js";
export function Calendar({
  value,
  onChange,
  dates = [],
  label = "수업 캘린더",
}) {
  const [month, setMonth] = useState((value || today()).slice(0, 7));
  useEffect(() => {
    if (value) setMonth(value.slice(0, 7));
  }, [value]);
  const [y, m] = month.split("-").map(Number),
    first = new Date(y, m - 1, 1).getDay(),
    last = new Date(y, m, 0).getDate();
  function move(n) {
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return (
    <section className="pt-calendar" aria-label={label}>
      <div className="pt-row pt-between">
        <button type="button" onClick={() => move(-1)} aria-label="이전 달">
          ‹
        </button>
        <h2>
          {y}년 {m}월
        </h2>
        <button type="button" onClick={() => move(1)} aria-label="다음 달">
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <span className="weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <span key={`empty${i}`} />
        ))}
        {Array.from({ length: last }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button
              type="button"
              key={date}
              aria-label={date}
              aria-pressed={value === date}
              className={`${value === date ? "selected" : ""} ${date === today() ? "is-today" : ""}`}
              onClick={() => onChange(date)}
            >
              {i + 1}
              <i className={dates.includes(date) ? "has-event" : ""} />
            </button>
          );
        })}
      </div>
      <p className="pt-muted calendar-hint">
        ● 일정이 있는 날 · 한국 시간 기준
      </p>
    </section>
  );
}
export function SimpleLog({ session }) {
  return (
    <div className="simple-log">
      {[
        ["warm_up", "Warm-up"],
        ["main", "Main"],
        ["notes", "특이사항"],
      ].map(([key, label]) =>
        session[key] ? (
          <div key={key}>
            <h3>{label}</h3>
            <pre>{session[key]}</pre>
          </div>
        ) : null,
      )}
      {!session.warm_up && !session.main && !session.notes && (
        <p className="pt-muted">수업 후 운동 일지가 여기에 표시돼요.</p>
      )}
    </div>
  );
}
