import { programReady, typeDays } from "./classTypes.js";
import { addDays, weekStart, weekdays, seoulDate } from "./model.js";
import { ClassCard, Program } from "./shared.jsx";
export default function WeekCalendar({
  day,
  onDay,
  classes,
  records = [],
  onSelect,
  weeks = [],
  exercises = [],
}) {
  const start = weekStart(day);
  return (
    <>
      <div className="g-week-nav">
        <button onClick={() => onDay(addDays(start, -7))} aria-label="이전 주">
          ← 이전 주
        </button>
        <label>
          수업 날짜
          <input
            type="date"
            value={day}
            onChange={(e) => e.target.value && onDay(e.target.value)}
          />
        </label>
        <button onClick={() => onDay(seoulDate())}>이번 주</button>
        <button onClick={() => onDay(addDays(start, 7))} aria-label="다음 주">
          다음 주 →
        </button>
      </div>
      <p className="g-kicker">
        {start} — {addDays(start, 6)}
      </p>
      {weeks
        .filter((w) => w.status === "published")
        .map((w) => (
          <details className="g-panel g-week-program" key={w.id}>
            <summary>{w.title} · 주간 프로그램 펼치기</summary>
            <p className="g-muted">
              변경 전에 참가 등록된 수업은 기존 프로그램을 유지해요. 실제 수업
              내용은 캘린더의 수업을 눌러 확인하세요.
            </p>
            {(w.program_mode === "class_type"
              ? w.programs.filter(programReady)
              : w.days
            ).map((d) => (
              <div key={d.class_type_id || d.dow}>
                <h3>
                  {d.class_type_id
                    ? typeDays(d.class_type_id)
                    : weekdays[d.dow - 1]}
                  요일
                </h3>
                <Program c={d} exercises={exercises} />
              </div>
            ))}
          </details>
        ))}
      <div className="g-week-grid">
        {weekdays.map((name, i) => {
          const date = addDays(start, i),
            rows = classes.filter((c) => seoulDate(c.starts_at) === date);
          return (
            <section
              className={`g-calendar-day ${date === seoulDate() ? "is-today" : ""}`}
              key={date}
            >
              <h3>
                {name}
                <span>{date.slice(5)}</span>
              </h3>
              {rows.map((c) => (
                <ClassCard
                  key={c.id}
                  c={c}
                  joined={records.find((r) => r.class_id === c.id)}
                  onClick={() => onSelect(c.id)}
                />
              ))}
              {!rows.length && <p className="g-muted">수업 없음</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
