import { useEffect, useState } from "react";
import { today } from "./model.js";
export function Calendar({
  value,
  onChange,
  dates = [],
  completedDates = [],
  scheduledDates = [],
  onMonthChange,
  label = "수업 캘린더",
  eventLabel = "예약 가능 시간 있음",
  trainingLegend = true,
}) {
  const [month, setMonth] = useState((value || today()).slice(0, 7));
  useEffect(() => {
    if (value) setMonth(value.slice(0, 7));
  }, [value]);
  useEffect(() => {
    onMonthChange?.(month);
  }, [month, onMonthChange]);
  const [y, m] = month.split("-").map(Number),
    first = new Date(y, m - 1, 1).getDay(),
    last = new Date(y, m, 0).getDate();
  function move(n) {
    const d = new Date(y, m - 1 + n, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setMonth(next);
    onChange(next === today().slice(0, 7) ? today() : `${next}-01`);
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
          const done = completedDates.filter((d) => d === date).length,
            booked = scheduledDates.filter((d) => d === date).length;
          return (
            <button
              type="button"
              key={date}
              aria-label={date}
              title={
                [
                  done ? `운동 완료 ${done}회` : null,
                  booked ? `예약 ${booked}회` : null,
                  dates.includes(date) ? eventLabel : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "일정 없음"
              }
              aria-pressed={value === date}
              className={`${value === date ? "selected" : ""} ${date === today() ? "is-today" : ""} ${done ? "day-completed" : ""}`}
              onClick={() => onChange(date)}
            >
              {i + 1}
              <span className="day-marks">
                {done > 0 && (
                  <span
                    className="done-mark"
                    aria-label={`운동 완료 ${done}회`}
                  >
                    ✓
                  </span>
                )}
                {booked > 0 && (
                  <span className="booked-mark" aria-label={`예약 ${booked}회`}>
                    ●
                  </span>
                )}
                {!done && !booked && (
                  <i className={dates.includes(date) ? "has-event" : ""} />
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="pt-muted calendar-hint">
        {trainingLegend ? (
          <>
            <span>✓ 운동 완료</span>
            <span className="booked-legend">● 예약</span>
            <span>· 예약 가능</span>
            <span>한국 시간</span>
          </>
        ) : (
          <span>● {eventLabel}</span>
        )}
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
        <p className="pt-muted">
          아직 작성된 운동 내용이 없어요. 코치가 수업 전·후에 추가할 수 있어요.
        </p>
      )}
    </div>
  );
}
