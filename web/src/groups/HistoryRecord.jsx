import { Dialog, RecordUseBadge } from "./shared.jsx";
import {
  classTime,
  seoulDate,
  resultText,
  levels,
  participantLabels,
} from "./model.js";

// Only the member's actual results and movement names, never an expired program.
export default function HistoryRecord({ record, onClose }) {
  const c = record.group_classes;
  return (
    <Dialog title="나의 운동 기록" onClose={onClose}>
      <p className="g-muted">
        {seoulDate(c.starts_at)} · {classTime(c.starts_at)}
      </p>
      <h3>{c.title}</h3>
      <p>
        {participantLabels[record.status]} · {levels[record.difficulty]}
      </p>
      <p className="g-muted">프로그램 공개 기간이 지나 개인 기록만 표시해요.</p>
      {c.movements.map((m) => {
        const r = record.results?.[m.id];
        return (
          <section className="g-record-movement" key={m.id}>
            <h3>{m.label || m.exercise_id}</h3>
            <RecordUseBadge movement={m} />
            {r?.sets ? (
              r.sets.map((s, i) => (
                <p key={i}>
                  {i + 1}세트 ·{" "}
                  {s.dnf
                    ? "미완주"
                    : s.weight != null && s.reps != null
                      ? `${s.weight} ${m.unit} × ${s.reps}회${s.rir != null ? ` · 실제 RIR ${s.rir}` : ""}`
                      : "기록 없음"}
                </p>
              ))
            ) : (
              <p>{resultText(m, r)}</p>
            )}
          </section>
        );
      })}
      {!c.movements.length && (
        <p className="g-muted">입력한 운동별 기록이 없어요.</p>
      )}
      {record.session_rpe != null && (
        <p>
          수업 전체 RPE <strong>{record.session_rpe}/10</strong>
        </p>
      )}
      {record.note && <p className="g-program-text">{record.note}</p>}
    </Dialog>
  );
}
