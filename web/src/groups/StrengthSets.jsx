import { movementLabel, sourceLabels, nullableNumber, recordUse } from "./model.js";
export default function StrengthSets({
  m,
  result,
  recommendation,
  manager,
  override,
  onResult,
  onOverride,
}) {
  const sets = m.sets.map((_, i) => result?.sets?.[i] || {}),
    recs = recommendation?.sets || [];
  function set(i, key, value) {
    onResult({
      ...result,
      sets: sets.map((s, j) =>
        i === j
          ? { ...s, [key]: key === "dnf" ? value : nullableNumber(value) }
          : s,
      ),
    });
  }
  return (
    <>
      {m.sets.map((target, i) => {
        const r = recs[i],
          actual = sets[i];
        return (
          <div className="g-strength-set" key={i}>
            <div className="g-heading">
              <strong>
                {i + 1}세트 · {target.reps}회 / RIR {target.rir}
              </strong>
              <span>
                {r?.weight != null ? `추천 ${r.weight} ${m.unit}` : "코치 확인"}
              </span>
            </div>
            <small>
              {sourceLabels[r?.source] || "기준 기록이 없어요"}
              {r?.high_effort_adjustment ? " · 이전 수업 RPE 반영" : ""}
            </small>
            <div className="g-fields">
              {[
                ["weight", `실제 중량 (${m.unit})`, 2000],
                ["reps", "실제 반복 수", 1000],
                ["rir", "실제 RIR (선택)", 10],
              ].map(([key, label, max]) => (
                <label key={key}>
                  {label}
                  <input
                    aria-label={`${movementLabel(m)} ${i + 1}세트 ${label}`}
                    type="number"
                    min={0}
                    max={max}
                    step={key === "reps" ? 1 : 0.5}
                    placeholder="미입력"
                    value={actual[key] ?? ""}
                    onChange={(e) => set(i, key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="g-actions">
              {r?.weight != null && (
                <button
                  type="button"
                  onClick={() =>
                    onResult({
                      ...result,
                      sets: sets.map((s, j) =>
                        j === i
                          ? { ...s, weight: r.weight, reps: target.reps }
                          : s,
                      ),
                    })
                  }
                >
                  {i + 1}세트 추천대로 수행
                </button>
              )}
              <label className="g-check">
                <input
                  type="checkbox"
                  checked={!!actual.dnf}
                  onChange={(e) => set(i, "dnf", e.target.checked)}
                />
                미완주
              </label>
            </div>
            {manager && (
              <label>
                코치 추천 조정 · {i + 1}세트 ({m.unit})
                <input
                  type="number"
                  min={0}
                  max={2000}
                  step="any"
                  value={override?.[i] ?? ""}
                  placeholder={r?.weight ?? "코치 확인"}
                  onChange={(e) =>
                    onOverride(
                      m.sets.map((_, j) =>
                        j === i
                          ? nullableNumber(e.target.value)
                          : (override?.[j] ?? recs[j]?.weight ?? null),
                      ),
                    )
                  }
                />
              </label>
            )}
          </div>
        );
      })}
      <p className="g-muted">
        {recordUse(m) === "strength_estimate"
          ? "실제 RIR은 이 동작을 몇 회 더 할 수 있었는지예요. 모르면 비워 두세요. 실제 RIR을 남긴 완료·코치 확정 기록만 근력 추정에 활용해요. 수업 전체 RPE로 대신 계산하지 않아요."
          : "오늘의 수행 기록으로 남겨요. 이 결과와 수업 전체 RPE로 최대근력을 계산하지 않아요. 실제 RIR은 원할 때만 입력하세요."}
      </p>
    </>
  );
}
