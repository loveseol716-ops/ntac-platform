import StrengthSets from "./StrengthSets.jsx";
import { classPhase } from "./classClock.js";
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
  prescriptionText,
  recordUse,
  recordUses,
} from "./model.js";
export function RecordUseBadge({ movement }) {
  if (movement.kind !== "weight") return null;
  const use = recordUse(movement);
  return (
    <span className="g-record-use" data-use={use}>
      {recordUses[use]}
    </span>
  );
}
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
export function ClassCard({ c, onClick, joined, actionLabel = "상세 보기" }) {
  const phase = classPhase(c);
  return (
    <button className="g-class-card" onClick={onClick}>
      <span className="g-time">
        <time className="g-clock" dateTime={c.starts_at}>
          {classTime(c.starts_at)}
        </time>
        <small>{c.duration_minutes}분</small>
      </span>
      <span className="g-class-content">
        <span className={`g-badge ${phase}`}>{stateLabels[phase]}</span>
        <strong>{c.title}</strong>
        <small>
          {joined
            ? participantLabels[joined.status]
            : c.movements.length
              ? `${c.movements.length}가지 핵심 운동`
              : "오늘의 프로그램"}
        </small>
      </span>
      <span className="g-card-action">{actionLabel}</span>
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
              <RecordUseBadge movement={m} />
              <p>
                {kinds[m.kind]}
                {m.kind === "weight" &&
                  ` · ${prescriptionText(m)} · ${loadLabel(m)} (${m.unit})`}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
export function RecommendationValue({
  movement: m,
  recommendation: r,
  compact = false,
}) {
  if (m.training_type !== "strength")
    return (
      <b className="g-recommended-weight">
        {r?.weight != null ? `${r.weight} ${m.unit}` : "코치 확인"}
      </b>
    );
  return (
    <span className={`g-recommended-sets${compact ? " g-compact-sets" : ""}`}>
      {m.sets.map((target, i) => (
        <span key={i}>
          {!compact && <small>{i + 1}세트</small>}
          <b>
            {compact && `${i + 1}세트 · `}
            {r?.sets?.[i]?.weight != null
              ? `${r.sets[i].weight} ${m.unit}`
              : "코치 확인"}
          </b>
          {!compact && (
            <small>
              {target.reps}회 · RIR {target.rir}
            </small>
          )}
        </span>
      ))}
    </span>
  );
}
export function Recommendations({ participant: p, c, exercises }) {
  if (!c.movements.some((m) => m.kind === "weight")) return null;
  return (
    <section className="g-panel">
      <div className="g-heading">
        <h3>추천 중량</h3>
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
                  {prescriptionText(m)} · {loadLabel(m)}
                </small>
              </div>
              <div>
                <RecommendationValue movement={m} recommendation={r} />
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
  recommendationOnly = false,
  busy,
  error,
  onSave,
  onClose,
}) {
  const [results, setResults] = useState(p.results || {}),
    [note, setNote] = useState(p.note || ""),
    [rpe, setRpe] = useState(p.session_rpe ?? ""),
    [validation, setValidation] = useState(""),
    [difficulty, setDifficulty] = useState(p.difficulty),
    [overrides, setOverrides] = useState({}),
    [reason, setReason] = useState("");
  const set = (mid, key, value) =>
    setResults((prev) => ({
      ...prev,
      [mid]: { ...prev[mid], [key]: nullableNumber(value) },
    }));
  const save = (status, finalized = p.finalized) => {
    if (manager && recommendationOnly) {
      const payload = { difficulty };
      if (Object.keys(overrides).length) {
        payload.recommendations = overrides;
        payload.reason = reason;
      }
      onSave(payload);
      return;
    }
    if (status === "completed" && c.recording_version >= 2 && rpe === "") {
      setValidation("마지막으로 수업 전체 RPE를 선택해 주세요.");
      return;
    }
    const payload = { results, note, status, session_rpe: nullableNumber(rpe) };
    setValidation("");
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
    <Dialog
      title={`${p.name || "나의"} ${recommendationOnly ? "추천 중량" : "운동 기록"}`}
      onClose={onClose}
    >
      <fieldset disabled={busy}>
        {error && (
          <p className="g-error" role="alert">
            {error}
          </p>
        )}
        <p className="g-muted">
          {recommendationOnly
            ? "오늘 상태에 맞춰 추천 중량을 조정하세요. 실제 운동 기록은 수업 후 입력해요."
            : "실제로 수행한 값만 입력하세요. 세트 기록은 비워둘 수 있고, 운동 완료 시 마지막 RPE를 확인해요."}
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
        {c.movements
          .filter((m) => !recommendationOnly || m.kind === "weight")
          .map((m) => (
            <section className="g-record-movement" key={m.id}>
              <h3>{movementLabel(m, exercises)}</h3>
              <RecordUseBadge movement={m} />
              {m.training_type === "strength" ? (
                <StrengthSets
                  m={m}
                  result={results[m.id]}
                  recommendation={p.recommendations?.[m.id]}
                  manager={manager}
                  recommendationOnly={recommendationOnly}
                  override={overrides[m.id]}
                  onResult={(value) =>
                    setResults((prev) => ({ ...prev, [m.id]: value }))
                  }
                  onOverride={(value) =>
                    setOverrides((prev) => ({ ...prev, [m.id]: value }))
                  }
                />
              ) : (
                <>
                  {m.kind === "weight" && (
                    <>
                      <small>
                        {loadLabel(m)} · 목표 {m.target_reps}회
                      </small>
                      {!recommendationOnly &&
                        p.recommendations?.[m.id]?.weight != null && (
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
                            추천대로 수행했어요 (
                            {p.recommendations[m.id].weight} {m.unit})
                          </button>
                        )}
                    </>
                  )}
                  {!recommendationOnly && (
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
                            step={
                              ["reps", "rounds"].includes(key) ? "1" : "any"
                            }
                            placeholder="미입력"
                            value={results[m.id]?.[key] ?? ""}
                            onChange={(e) => set(m.id, key, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  {!recommendationOnly && m.kind !== "participation" && (
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
                        placeholder={
                          p.recommendations?.[m.id]?.weight ?? "코치 확인"
                        }
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
                </>
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
        {!recommendationOnly && (
          <>
            <section className="g-panel">
              <h3>마지막 체크 · 수업 전체 RPE</h3>
              <p className="g-muted">
                오늘 수업 전체가 얼마나 힘들었나요? 0 = 휴식, 5 = 힘듦, 7 = 매우
                힘듦, 10 = 최대 노력. 세트별 RIR과는 별도예요.
              </p>
              <label>
                수업 전체 RPE
                <select
                  aria-label="수업 전체 RPE"
                  value={rpe}
                  onChange={(e) => {
                    setRpe(e.target.value);
                    setValidation("");
                  }}
                >
                  <option value="">선택하세요</option>
                  {Array.from({ length: 11 }, (_, i) => (
                    <option key={i} value={i}>
                      {i} / 10
                    </option>
                  ))}
                </select>
              </label>
              {validation && (
                <p role="alert" className="g-error">
                  {validation}
                </p>
              )}
            </section>
            <label>
              오늘 메모
              <textarea
                maxLength="1000"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </>
        )}
        <div className="g-actions">
          {recommendationOnly ? (
            <button className="g-primary" onClick={() => save(p.status)}>
              추천 저장
            </button>
          ) : (
            <>
              <button onClick={() => save(p.status)}>임시 저장</button>
              <button className="g-primary" onClick={() => save("completed")}>
                기록 저장 · 완료
              </button>
              {manager && (
                <button onClick={() => save("completed", true)}>
                  완료 · 기록 확정
                </button>
              )}
              {manager && p.finalized && (
                <button onClick={() => save(p.status, false)}>확정 해제</button>
              )}
            </>
          )}
        </div>
      </fieldset>
    </Dialog>
  );
}
