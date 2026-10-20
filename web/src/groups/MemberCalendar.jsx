import {
  addDays,
  calendarDates,
  classTime,
  seoulDate,
  shiftMonth,
  weekdays,
  weekStart,
} from "./model.js";
import { ClassCard } from "./shared.jsx";

export default function MemberCalendar({
  day,
  onDay,
  view,
  onView,
  classes,
  records,
  onSelect,
  onPrograms,
  loading,
}) {
  const today = seoulDate();
  const start = weekStart(day);
  const selectedClasses = classes.filter((c) => seoulDate(c.starts_at) === day);
  const move = (n) =>
    onDay(view === "month" ? shiftMonth(day, n) : addDays(day, n * 7));
  return (
    <section className="g-member-calendar" aria-label="수업 캘린더">
      <div className="g-calendar-toolbar">
        <div className="g-calendar-period">
          <button
            aria-label={view === "month" ? "이전 달" : "이전 주"}
            onClick={() => move(-1)}
          >
            ‹
          </button>
          <h2>
            {view === "month"
              ? `${Number(day.slice(0, 4))}년 ${Number(day.slice(5, 7))}월`
              : `${start.slice(5).replace("-", ".")} – ${addDays(start, 6).slice(5).replace("-", ".")}`}
          </h2>
          <button
            aria-label={view === "month" ? "다음 달" : "다음 주"}
            onClick={() => move(1)}
          >
            ›
          </button>
        </div>
        <div className="g-calendar-options">
          <button onClick={() => onDay(today)}>오늘</button>
          <div className="g-view-toggle" role="group" aria-label="캘린더 보기">
            <button
              aria-pressed={view === "month"}
              onClick={() => onView("month")}
            >
              월간
            </button>
            <button
              aria-pressed={view === "week"}
              onClick={() => onView("week")}
            >
              주간
            </button>
          </div>
        </div>
      </div>
      <div className="g-month-calendar" aria-busy={loading}>
        <div className="g-calendar-weekdays" aria-hidden="true">
          {weekdays.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div className="g-month-grid">
          {calendarDates(day, view).map((date, i) => {
            const rows = classes.filter((c) => seoulDate(c.starts_at) === date);
            return (
              <button
                key={date}
                className={`g-month-day ${date.slice(0, 7) !== day.slice(0, 7) ? "outside" : ""} ${date === today ? "is-today" : ""}`}
                data-date={date}
                aria-pressed={date === day}
                aria-current={date === today ? "date" : undefined}
                aria-label={`${date} ${weekdays[i % 7]}요일${loading ? "" : ` · 수업 ${rows.length}개`}`}
                onClick={() => onDay(date)}
              >
                <span className="g-date-number">{Number(date.slice(-2))}</span>
                {!loading && rows.length > 0 && (
                  <>
                    <span className="g-day-count">{rows.length}개</span>
                    <span className="g-day-events" aria-hidden="true">
                      {rows.slice(0, 2).map((c) => (
                        <span
                          className={
                            c.status === "cancelled" ? "cancelled" : ""
                          }
                          key={c.id}
                        >
                          {classTime(c.starts_at)} {c.title}
                        </span>
                      ))}
                      {rows.length > 2 && <small>+{rows.length - 2}개</small>}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="g-day-heading">
        <h3>
          {Number(day.slice(5, 7))}월 {Number(day.slice(8))}일 ·{" "}
          {weekdays[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7]}요일
        </h3>
        <button className="g-text-button" onClick={onPrograms}>
          이 주의 프로그램 ↗
        </button>
      </div>
      <div className="g-selected-classes" aria-busy={loading}>
        {loading ? (
          <p className="g-muted">수업을 불러오고 있어요.</p>
        ) : selectedClasses.length ? (
          selectedClasses.map((c) => (
            <ClassCard
              key={c.id}
              c={c}
              joined={records.find((r) => r.class_id === c.id)}
              onClick={() => onSelect(c.id)}
            />
          ))
        ) : (
          <p className="g-empty">이 날짜에는 등록된 수업이 없어요.</p>
        )}
      </div>
      <p className="g-muted g-booking-note">
        예약과 공식 출석은 운톡에서, 운동 시작과 기록은 NTAC에서 진행해요.
      </p>
    </section>
  );
}
