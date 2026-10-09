import { trackingStats } from "./tracking.js";
import { SimpleLog } from "./Calendar.jsx";
export function ProgressSummary({ sessions, month, onSelect }) {
  const stats = trackingStats(sessions, month);
  return (
    <>
      <section className="tracking-stats" aria-label="운동 통계">
        <div>
          <span>{Number(month.slice(5))}월 운동</span>
          <strong>
            {stats.current}
            <small>회</small>
          </strong>
        </div>
        <div>
          <span>{Number(month.slice(5))}월 운동한 날</span>
          <strong>
            {stats.days}
            <small>일</small>
          </strong>
        </div>
        <div>
          <span>누적 운동</span>
          <strong>
            {stats.total}
            <small>회</small>
          </strong>
        </div>
      </section>
      <button
        className="last-workout"
        onClick={() => stats.latest && onSelect(stats.latest.session_date)}
        disabled={!stats.latest}
      >
        <span>최근 운동</span>
        <strong>
          {stats.latest
            ? `${stats.latest.session_date} · ${stats.latest.start_time.slice(0, 5)}`
            : "첫 운동을 기다리고 있어요"}
        </strong>
        {stats.latest && <span>기록 보기 →</span>}
      </button>
    </>
  );
}
export function TrainingProgress({ sessions, month, onSelect }) {
  const stats = trackingStats(sessions, month),
    max = Math.max(1, ...stats.months.map((m) => m.count)),
    rows = stats.completed.filter((s) => s.session_date.startsWith(month));
  return (
    <>
      <section className="pt-card">
        <h2>월별 운동 횟수</h2>
        <p className="pt-muted">
          {stats.months[0].key} ~ {month} · 완료한 수업 기준
        </p>
        <div
          className="workout-chart"
          role="img"
          aria-label={stats.months
            .map((m) => `${m.key} ${m.count}회`)
            .join(", ")}
        >
          {stats.months.map((m) => (
            <div className="chart-column" key={m.key}>
              <strong>{m.count}회</strong>
              <div className="bar-track">
                <div
                  className={m.key === month ? "bar current" : "bar"}
                  style={{ height: `${(m.count / max) * 100}%` }}
                />
              </div>
              <span>{Number(m.key.slice(5))}월</span>
            </div>
          ))}
        </div>
        {!stats.months.some((m) => m.count) && (
          <p className="pt-muted">수업을 완료하면 운동 기록이 쌓여요.</p>
        )}
      </section>
      <details className="pt-card monthly-history">
        <summary>
          {month.replace("-", "년 ")}월 전체 운동 기록 · {rows.length}회
        </summary>
        {!rows.length && (
          <p className="pt-muted">이 달에 완료한 수업이 없어요.</p>
        )}
        {rows.map((s) => (
          <div className="month-history-row" key={s.id}>
            <button onClick={() => onSelect(s.session_date)}>
              <strong>
                {s.session_date.slice(5).replace("-", " / ")} ·{" "}
                {s.start_time.slice(0, 5)}
              </strong>
              <span>운동 완료 ✓</span>
            </button>
            <details>
              <summary>운동 내용</summary>
              <SimpleLog session={s} />
            </details>
          </div>
        ))}
      </details>
    </>
  );
}
