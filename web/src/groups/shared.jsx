import { useEffect, useRef, useState } from "react";
import {
  levels,
  kinds,
  sourceLabels,
  movementLabel,
  loadLabel,
  nullableNumber,
  participantLabels,
  stateLabels,
  classTime,
} from "./model.js";
export function Dialog({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="group-dialog groups"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="g-heading">
        <h2>{title}</h2>
        <button type="button" onClick={onClose} aria-label="닫기">
          닫기
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ClassCard({ c, onClick, joined }) {
  return (
    <button className="g-class-card" onClick={onClick}>
      <span className="g-time">
        {classTime(c.starts_at)}
        <small>{c.duration_minutes}분</small>
      </span>
      <span>
        <span className={`g-badge ${c.status}`}>{stateLabels[c.status]}</span>
        <strong>{c.title}</strong>
        <small>
          {joined
            ? participantLabels[joined.status]
            : c.movements.length
              ? `${c.movements.length}가지 핵심 운동`
              : "오늘의 프로그램"}
        </small>
      </span>
      <span aria-hidden="true">↗</span>
    </button>
  );
}
export function Program({ c, exercises }) {
  return (
    <section className="g-panel">
      <p className="g-kicker">TODAY’S PROGRAM</p>
      <h2>{c.title}</h2>
      <p className="g-program-text">
        {c.description || "코치의 안내에 따라 운동해 주세요."}
      </p>
      <div className="g-movements">
        {c.movements.map((m, i) => (
          <article key={m.id}>
            <span className="g-index">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <strong>{movementLabel(m, exercises)}</strong>
              <p>
                {kinds[m.kind]}
                {m.kind === "weight" &&
                  ` · ${m.target_reps}회 · ${loadLabel(m)} (${m.unit})`}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
export function Recommendations({ participant: p, c, exercises }) {
  return (
    <section className="g-panel">
      <div className="g-heading">
        <h3>오늘의 추천</h3>
        <span className="g-badge">{levels[p.difficulty]}</span>
      </div>
      {c.movements
        .filter((m) => m.kind === "weight")
        .map((m) => {
          const r = p.recommendations?.[m.id];
          return (
            <div className="g-recommendation" key={m.id}>
              <div>
                <strong>{movementLabel(m, exercises)}</strong>
                <small>
                  {m.target_reps}회 · {loadLabel(m)}
                </small>
              </div>
              <div>
                <b>
                  {r?.weight != null ? `${r.weight} ${m.unit}` : "코치 확인"}
                </b>
                <small>{sourceLabels[r?.source] || "기준 기록이 없어요"}</small>
              </div>
            </div>
          );
        })}
      <p className="g-muted">
        추천은 출발점이에요. 오늘 상태와 자세를 확인하고 코치와 조정해 주세요.
      </p>
    </section>
  );
}
export function RecordEditor({
  participant: p,
  c,
  exercises,
  manager,
  busy,
  error,
  onSave,
  onClose,
}) {
  const [results, setResults] = useState(p.results || {}),
    [note, setNote] = useState(p.note || ""),
    [difficulty, setDifficulty] = useState(p.difficulty),
    [overrides, setOverrides] = useState({}),
    [reason, setReason] = useState("");
  const set = (mid, key, value) =>
    setResults((prev) => ({
      ...prev,
      [mid]: { ...prev[mid], [key]: nullableNumber(value) },
    }));
  const save = (status, finalized = p.finalized) => {
    const payload = { results, note, status };
    if (manager) {
      payload.difficulty = difficulty;
      payload.finalized = finalized;
      if (Object.keys(overrides).length) {
        payload.recommendations = overrides;
        payload.reason = reason;
      }
    }
    onSave(payload);
  };
  return (
    <Dialog title={`${p.name || "나의"} 운동 기록`} onClose={onClose}>
      <fieldset disabled={busy}>
        {error && (
          <p className="g-error" role="alert">
            {error}
          </p>
        )}
        <p className="g-muted">
          실제로 수행한 값만 입력하세요. 기록 없이 운동 완료도 가능해요.
        </p>
        {manager && (
          <label>
            난이도
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {Object.entries(levels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        {c.movements.map((m) => (
          <section className="g-record-movement" key={m.id}>
            <h3>{movementLabel(m, exercises)}</h3>
            {m.kind === "weight" && (
              <>
                <small>
                  {loadLabel(m)} · 목표 {m.target_reps}회
                </small>
                {p.recommendations?.[m.id]?.weight != null && (
                  <button
                    type="button"
                    className="g-text-button"
                    onClick={() =>
                      setResults((prev) => ({
                        ...prev,
                        [m.id]: {
                          ...prev[m.id],
                          weight: p.recommendations[m.id].weight,
                          reps: Number(m.target_reps),
                        },
                      }))
                    }
                  >
                    추천대로 수행했어요 ({p.recommendations[m.id].weight}{" "}
                    {m.unit})
                  </button>
                )}
              </>
            )}
            <div className="g-fields">
              {(m.kind === "weight"
                ? [
                    ["weight", m.unit],
                    ["reps", "실제 반복 수"],
                  ]
                : m.kind === "time"
                  ? [["seconds", "소요 시간(초)"]]
                  : m.kind === "rounds"
                    ? [
                        ["rounds", "완료 라운드"],
                        ["reps", "추가 반복 수"],
                      ]
                    : m.kind === "distance"
                      ? [["distance", "거리(m)"]]
                      : m.kind === "calories"
                        ? [["calories", "칼로리(cal)"]]
                        : []
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    aria-label={`${movementLabel(m, exercises)} ${label}`}
                    type="number"
                    min="0"
                    max="1000000"
                    step={["reps", "rounds"].includes(key) ? "1" : "any"}
                    placeholder="미입력"
                    value={results[m.id]?.[key] ?? ""}
                    onChange={(e) => set(m.id, key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            {m.kind !== "participation" && (
              <label className="g-check">
                <input
                  type="checkbox"
                  checked={!!results[m.id]?.dnf}
                  onChange={(e) =>
                    setResults((prev) => ({
                      ...prev,
                      [m.id]: { ...prev[m.id], dnf: e.target.checked },
                    }))
                  }
                />
                미완주
              </label>
            )}
            {manager && m.kind === "weight" && (
              <label>
                코치 추천 조정 ({m.unit})
                <input
                  type="number"
                  min="0"
                  max="2000"
                  step="any"
                  placeholder={p.recommendations?.[m.id]?.weight ?? "코치 확인"}
                  value={overrides[m.id] ?? ""}
                  onChange={(e) =>
                    setOverrides((prev) => {
                      const n = { ...prev };
                      if (e.target.value === "") delete n[m.id];
                      else n[m.id] = Number(e.target.value);
                      return n;
                    })
                  }
                />
              </label>
            )}
          </section>
        ))}
        {Object.keys(overrides).length > 0 && (
          <label>
            추천 조정 이유
            <input
              maxLength="300"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        <label>
          오늘 메모
          <textarea
            maxLength="1000"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="g-actions">
          <button onClick={() => save(p.status)}>기록 저장</button>
          <button className="g-primary" onClick={() => save("completed")}>
            운동 완료
          </button>
          {manager && (
            <button onClick={() => save("completed", true)}>
              완료 · 기록 확정
            </button>
          )}
          {manager && p.finalized && (
            <button onClick={() => save(p.status, false)}>확정 해제</button>
          )}
        </div>
      </fieldset>
    </Dialog>
  );
}
