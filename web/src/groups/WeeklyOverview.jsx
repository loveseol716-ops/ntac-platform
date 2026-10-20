import { useState } from "react";
import { programsForDay } from "./classTypes.js";
import {
  addDays,
  movementLabel,
  seoulDate,
  weekdays,
  weekStart,
} from "./model.js";
import { Dialog, Program } from "./shared.jsx";

export default function WeeklyOverview({
  day,
  onDay,
  weeks,
  exercises,
  onSchedule,
  loading,
}) {
  const start = weekStart(day);
  const week = weeks.find(
    (w) => w.week_start === start && w.status === "published",
  );
  const [selected, setSelected] = useState(null);
  return (
    <section className="g-week-overview" aria-label="요일별 주간 프로그램">
      <div className="g-calendar-toolbar">
        <div className="g-calendar-period">
          <button
            aria-label="이전 주"
            onClick={() => onDay(addDays(start, -7))}
          >
            ‹
          </button>
          <h2>
            {start.slice(5).replace("-", ".")} –{" "}
            {addDays(start, 6).slice(5).replace("-", ".")}
          </h2>
          <button aria-label="다음 주" onClick={() => onDay(addDays(start, 7))}>
            ›
          </button>
        </div>
        <button onClick={() => onDay(seoulDate())}>이번 주</button>
      </div>
      <p className="g-week-caption">
        {start.slice(0, 4)}년 ·{" "}
        {loading
          ? "프로그램을 불러오고 있어요."
          : week?.title || "공개된 주간 프로그램이 없어요."}
      </p>
      <p className="g-muted">
        요일별 프로그램을 누르면 운동 구성과 세트 수를 볼 수 있어요.
      </p>
      <div className="g-program-week" aria-busy={loading}>
        {weekdays.map((name, i) => {
          const date = addDays(start, i),
            programs = loading ? [] : programsForDay(week, i + 1);
          return (
            <section
              key={date}
              className={`g-program-day ${date === seoulDate() ? "is-today" : ""}`}
            >
              <h3>
                {name}
                <small>
                  {Number(date.slice(5, 7))}.{Number(date.slice(8))}
                </small>
              </h3>
              <div className="g-program-choices">
                {programs.map((p) => (
                  <button
                    key={p.class_type_id || p.dow}
                    onClick={() => setSelected({ program: p, date })}
                  >
                    <strong>{p.title}</strong>
                    <small>
                      {p.movements?.length
                        ? movementLabel(p.movements[0], exercises)
                        : p.description
                            .trim()
                            .split(/\n/)
                            .find((line) => line.trim()) || "프로그램 보기"}
                    </small>
                  </button>
                ))}
                {!programs.length && (
                  <span className="g-program-pending">
                    {loading ? "불러오는 중" : "공개 전"}
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="g-muted g-booking-note">
        참가 등록 후 프로그램이 변경된 수업은 기존 내용이 유지될 수 있어요. 실제
        진행 내용은 해당 수업에서 확인해 주세요.
      </p>
      {selected && (
        <Dialog
          title={`${selected.date} 프로그램`}
          onClose={() => setSelected(null)}
        >
          <Program c={selected.program} exercises={exercises} />
          <button
            className="g-primary g-full"
            onClick={() => {
              onDay(selected.date);
              setSelected(null);
              onSchedule();
            }}
          >
            이 날짜 수업 보기
          </button>
        </Dialog>
      )}
    </section>
  );
}
