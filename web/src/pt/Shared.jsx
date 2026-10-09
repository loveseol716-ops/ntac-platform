import { assessmentSeries, packageUsage, statusLabels } from "./model.js";
export function Packages({ packages, sessions }) {
  return (
    <section className="pt-card">
      <h2>PT 이용권</h2>
      {!packages.length && (
        <p className="pt-muted">등록된 이용권이 없습니다.</p>
      )}
      {packages.map((p) => {
        const u = packageUsage(p, sessions);
        return (
          <div className="pt-history" key={p.id}>
            <strong>{p.title}</strong>
            <p>
              <span className="pt-stat">{u.remaining}</span>회 남음 · {u.used}/
              {p.total_sessions}회 사용
            </p>
            <p className="pt-muted">등록일 · {p.starts_on}</p>
          </div>
        );
      })}
    </section>
  );
}
export function Assessments({ rows }) {
  return (
    <section className="pt-card">
      <h2>나의 변화</h2>
      <p className="pt-muted">
        검사명·측정 조건·단위·좌우가 같은 기록끼리 비교합니다. 숫자 변화가 곧
        개선을 뜻하지는 않습니다.
      </p>
      {!rows.length && <p>아직 평가 기록이 없습니다.</p>}
      {assessmentSeries(rows).map((series) => {
        const first = series[0],
          last = series.at(-1);
        const delta = Math.round((last.value - first.value) * 100) / 100;
        return (
          <div className="pt-history" key={first.id}>
            <h3>
              {last.metric} {last.side !== "해당 없음" ? `· ${last.side}` : ""}
            </h3>
            <p>
              {first.value} →{" "}
              <strong>
                {last.value} {last.unit}
              </strong>
              {series.length > 1 && ` (${delta > 0 ? "+" : ""}${delta})`}
            </p>
            <p className="pt-muted">
              {first.assessed_on} → {last.assessed_on} ·{" "}
              {last.conditions || "별도 조건 없음"}
            </p>
            <details>
              <summary>전체 측정 기록 ({series.length})</summary>
              {series.map((r) => (
                <p key={r.id}>
                  {r.assessed_on} · {r.value} {r.unit}
                </p>
              ))}
            </details>
          </div>
        );
      })}
    </section>
  );
}
export function SessionSummary({ session }) {
  return (
    <article className="pt-card">
      <div className="pt-row pt-between">
        <span className="pt-muted">
          {session.session_date} · {session.start_time.slice(0, 5)}
        </span>
        <span className="pt-badge">{statusLabels[session.status]}</span>
      </div>
      <h3>{session.title}</h3>
      {session.session_rpe != null && (
        <p>수업 힘든 정도 {session.session_rpe}/10</p>
      )}
      {session.feedback && (
        <>
          <strong>코치 피드백</strong>
          <pre>{session.feedback}</pre>
        </>
      )}
      {session.homework && (
        <>
          <strong>다음 수업 전 할 일</strong>
          <pre>{session.homework}</pre>
        </>
      )}
      <details>
        <summary>운동과 수행 기록</summary>
        {session.workout.map((w, i) => (
          <div key={i} className="pt-exercise">
            <span className="pt-muted">{w.block}</span>
            <h3>{w.name}</h3>
            <p>{w.target}</p>
            <p className="pt-muted">{w.condition}</p>
            {w.sets?.some(Boolean) && (
              <p>
                {w.sets
                  .map((v, j) => (v ? `${j + 1}세트: ${v}` : null))
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            )}
          </div>
        ))}
      </details>
    </article>
  );
}
