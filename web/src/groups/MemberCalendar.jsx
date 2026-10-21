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
import { Fragment } from "react";
import { TrainingContext } from "./TrainingJourney.jsx";
import { positionLabel, trainingPosition } from "./trainingCycle.js";

export default function MemberCalendar({
  day,
  onDay,
  view,
  onView,
  classes,
  records = [],
  onSelect,
  onPrograms,
  loading,
  minDay,
  admin = false,
  onCreate,
}) {
  const today = seoulDate();
  const start = weekStart(day);
  const selectedClasses = classes.filter(
    (c) => seoulDate(c.starts_at) === day && (!minDay || day >= minDay),
  );
  const previousEnd = view === "month" ? shiftMonth(day, 0) : start;
  const move = (n) => {
    const target = view === "month" ? shiftMonth(day, n) : addDays(day, n * 7);
    onDay(minDay && target < minDay ? minDay : target);
  };
  return (
    <section className="g-member-calendar" aria-label="수업 캘린더">
      <div className="g-calendar-toolbar">
        <div className="g-calendar-period">
          <button
            aria-label={view === "month" ? "이전 달" : "이전 주"}
            onClick={() => move(-1)}
            disabled={!!minDay && previousEnd <= minDay}
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
          {admin && (
            <label className="g-calendar-jump">
              날짜 이동
              <input
                type="date"
                value={day}
                onChange={(e) => e.target.value && onDay(e.target.value)}
              />
            </label>
          )}
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
            const hidden = !!minDay && date < minDay;
            const cycle = i % 7 === 0 ? trainingPosition(addDays(date, 6)) : null;
            const rows = hidden
              ? []
              : classes.filter((c) => seoulDate(c.starts_at) === date);
            return (
              <Fragment key={date}>
              {cycle && cycle.state !== "unplanned" && <div className="g-cycle-calendar-band" data-phase={cycle.phase} aria-label={`${date} 시작 주 · ${positionLabel(cycle)}`}><strong>{positionLabel(cycle)}</strong>{cycle.block?.quarter && <span>{cycle.block.year} · {cycle.block.quarter}분기</span>}</div>}
              <button
                className={`g-month-day ${date.slice(0, 7) !== day.slice(0, 7) ? "outside" : ""} ${date === today ? "is-today" : ""}`}
                data-date={date}
                data-week-end={i % 7 === 6 ? "true" : undefined}
                disabled={hidden}
                aria-pressed={date === day}
                aria-current={date === today ? "date" : undefined}
                aria-label={`${date} ${weekdays[i % 7]}요일${hidden ? " · 공개 기간 이전" : loading ? "" : ` · 수업 ${rows.length}개`}`}
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
              </Fragment>
            );
          })}
        </div>
      </div>
      <div className="g-day-heading">
        <h3>
          {Number(day.slice(5, 7))}월 {Number(day.slice(8))}일 ·{" "}
          {weekdays[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7]}요일
        </h3>
        <div className="g-calendar-day-actions">
          {onPrograms && (
            <button className="g-text-button" onClick={onPrograms}>
              이 주의 프로그램 보기
            </button>
          )}
          {onCreate && (
            <button className="g-primary" onClick={onCreate}>
              + 선택일 수업 만들기
            </button>
          )}
        </div>
      </div>
      <TrainingContext date={day} label="선택한 날짜의 위치" />
      <div className="g-selected-classes" aria-busy={loading}>
        {loading ? (
          <p className="g-muted">수업을 불러오고 있어요.</p>
        ) : selectedClasses.length ? (
          selectedClasses.map((c) => (
            <ClassCard
              key={c.id}
              c={c}
              joined={records.find((r) => r.class_id === c.id)}
              actionLabel={admin ? "수업 관리" : "상세 보기"}
              onClick={() => onSelect(c.id)}
            />
          ))
        ) : (
          <p className="g-empty">이 날짜에는 등록된 수업이 없어요.</p>
        )}
      </div>
      {!admin && (
        <p className="g-muted g-booking-note">
          지난주부터의 공개 프로그램을 볼 수 있어요. 이전 운동 기록은 ‘나의
          기록’에 보관돼요.
          <br />
          예약과 공식 출석은 운톡에서, 운동 시작과 기록은 NTAC에서 진행해요.
        </p>
      )}
    </section>
  );
}
