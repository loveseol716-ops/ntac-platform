import { kinds, recordUse, recordUses } from "./model.js";
import { useMemo } from "react";
import { editProgram, newMovement, previewBlockDefaults } from "./blockGoals.js";
import ExerciseSearch from "./ExerciseSearch.jsx";
const NO_GOALS = [];
export default function ProgramFields({
  form: original,
  set: setField,
  onChange,
  goals = NO_GOALS,
  exercises,
  hideTitle = false,
}) {
  const canSeed = !!onChange;
  const form = useMemo(() => canSeed ? previewBlockDefaults(original, goals, exercises) : original, [original, goals, exercises, canSeed]);
  const set = (key, value) => onChange ? onChange(editProgram(form, key, value)) : setField(key, value);
  const movement = (id, patch) =>
    set(
      "movements",
      form.movements.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  const changeType = (m, type) => {
    const next = { ...m, training_type: type };
    if (type === "strength")
      Object.assign(next, {
        kind: "weight",
        unit: "kg",
        load_basis: "total",
        sets: m.sets || [{ reps: m.target_reps || 8, rir: 3 }],
        load_step: m.load_step || 2.5,
        min_load: m.min_load ?? 20,
      });
    else {
      delete next.sets;
      next.record_use = "log_only";
    }
    set(
      "movements",
      form.movements.map((x) => (x.id === m.id ? next : x)),
    );
  };
  return (
    <>
      {!hideTitle && (
        <>
          <label>
            수업명
            <input
              required
              maxLength={120}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="예: 하체 스트렝스 & 컨디셔닝"
            />
          </label>
        </>
      )}
      <label>
        오늘의 프로그램
        <textarea
          rows={5}
          maxLength={10000}
          value={form.description || ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder={"Warm-up\nMain\nFinisher"}
        />
      </label>
      {form._blockPreview && <div className="g-default-preview">
        <strong>이번 블록의 평가 종목을 미리 불러왔어요.</strong>
        <p>오늘의 프로그램을 입력하거나 아래 내용을 수정하면 적용돼요. 반복 수·RIR은 오늘 수업에 맞춰 확인해 주세요.</p>
        <button type="button" onClick={() => set("movements", form.movements)}>이 종목으로 작성</button>
        <button type="button" onClick={() => set("movements", [])}>오늘은 다른 운동으로 작성</button>
      </div>}
      <div className="g-heading">
        <h3>추천 · 기록할 핵심 운동</h3>
        <small>{form.movements.length}/20</small>
      </div>
      {!!goals.length && !form._blockPreview && <div className="g-goal-quick-add">
        {goals.filter((g) => !form.movements.some((m) => m.exercise_id === g.exercise_id)).map((g) => {
          const e = exercises.find((e) => e.id === g.exercise_id);
          return e && <button type="button" key={g.exercise_id} disabled={form.movements.length >= 20}
            onClick={() => set("movements", [...form.movements, newMovement(e)])}>+ {e.name} <small>블록 목표</small></button>;
        })}
      </div>}
      {form.movements.map((m, i) => (
        <section className="g-record-movement" key={m.id}>
          <div className="g-heading">
            <strong>운동 {i + 1}{m.label ? ` · ${m.label}` : ""}</strong>
            <button
              type="button"
              onClick={() =>
                set(
                  "movements",
                  form.movements.filter((x) => x.id !== m.id),
                )
              }
            >
              삭제
            </button>
          </div>
          <div className="g-fields">
            <label>
              표준 종목
              <select
                required
                value={m.exercise_id}
                onChange={(e) =>
                  movement(m.id, {
                    exercise_id: e.target.value,
                    label:
                      exercises.find((x) => x.id === e.target.value)?.name ||
                      "",
                  })
                }
              >
                <option value="">종목 선택</option>
                {exercises.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              운동 구분
              <select
                value={m.training_type || "legacy"}
                onChange={(e) => changeType(m, e.target.value)}
              >
                {!m.training_type && (
                  <option value="legacy">기존 단일 기록</option>
                )}
                <option value="strength">스트렝스 · 자동 중량 추천</option>
                <option value="conditioning">컨디셔닝</option>
                <option value="other">기타</option>
              </select>
            </label>
            {m.training_type !== "strength" && (
              <label>
                결과 형식
                <select
                  value={m.kind}
                  onChange={(e) =>
                    movement(m.id, {
                      kind: e.target.value,
                      unit: {
                        weight: "kg",
                        time: "s",
                        rounds: "reps",
                        distance: "m",
                        calories: "cal",
                        participation: "reps",
                      }[e.target.value],
                    })
                  }
                >
                  {Object.entries(kinds).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {m.kind === "weight" && (
            <div className="g-fields">
              {m.training_type !== "strength" && (
                <label>
                  목표 반복 수
                  <input
                    required
                    type="number"
                    min={1}
                    max={1000}
                    value={m.target_reps}
                    onChange={(e) =>
                      movement(m.id, { target_reps: Number(e.target.value) })
                    }
                  />
                </label>
              )}
              <label>
                단위
                <select
                  value={m.unit}
                  onChange={(e) => movement(m.id, { unit: e.target.value })}
                >
                  <option>kg</option>
                  <option>lb</option>
                </select>
              </label>
              <label>
                중량 기준
                <select
                  value={m.load_basis}
                  onChange={(e) =>
                    movement(m.id, { load_basis: e.target.value })
                  }
                >
                  <option value="total">바 포함 총중량</option>
                  <option value="each">덤벨 한 손 기준</option>
                </select>
              </label>
            </div>
          )}
          {m.training_type === "strength" && (
            <>
              <label>
                이 기록의 활용
                <select
                  aria-label={`운동 ${i + 1} 기록 활용`}
                  value={recordUse(m)}
                  onChange={(e) => movement(m.id, { record_use: e.target.value })}
                >
                  {Object.entries(recordUses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <p className="g-muted g-record-use-help">
                {recordUse(m) === "strength_estimate"
                  ? "단독 OHP처럼 해당 종목의 능력을 확인할 때 선택해요. 실제 중량·횟수·RIR을 남기고 코치가 확정한 기록을 근력 추정에 활용해요."
                  : "트리플 악셀 같은 연속 동작은 기록용으로 남겨요. 결과는 보관하지만 근력 추정과 다음 자동 추천의 근거로 사용하지 않아요."}
                <span>오늘의 추천 중량을 받는 기능과는 별개예요.</span>
              </p>
              <p className="g-prescription">
                {m.sets.map((s) => s.reps).join("–")}회 ·{" "}
                {m.sets.every((s) => s.rir === m.sets[0].rir)
                  ? `RIR ${m.sets[0].rir}`
                  : "세트별 RIR"}
              </p>
              {m.sets.map((s, j) => (
                <div className="g-set-prescription" key={j}>
                  <b>{j + 1}세트</b>
                  <label>
                    반복 수
                    <input
                      aria-label={`운동 ${i + 1} ${j + 1}세트 반복 수`}
                      required
                      type="number"
                      min={1}
                      max={30}
                      value={s.reps}
                      onChange={(e) =>
                        movement(m.id, {
                          target_reps:
                            j === 0 ? Number(e.target.value) : m.target_reps,
                          sets: m.sets.map((x, k) =>
                            k === j
                              ? { ...x, reps: Number(e.target.value) }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    목표 RIR
                    <input
                      aria-label={`운동 ${i + 1} ${j + 1}세트 RIR`}
                      required
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      value={s.rir}
                      onChange={(e) =>
                        movement(m.id, {
                          sets: m.sets.map((x, k) =>
                            k === j ? { ...x, rir: Number(e.target.value) } : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={m.sets.length === 1}
                    onClick={() =>
                      movement(m.id, { sets: m.sets.filter((_, k) => k !== j) })
                    }
                  >
                    세트 삭제
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={m.sets.length >= 12}
                onClick={() =>
                  movement(m.id, { sets: [...m.sets, { ...m.sets.at(-1) }] })
                }
              >
                + 세트 추가
              </button>
              <div className="g-fields">
                <label>
                  중량 증감 간격 ({m.unit})
                  <input
                    required
                    type="number"
                    min={0.25}
                    max={100}
                    step="any"
                    value={m.load_step}
                    onChange={(e) =>
                      movement(m.id, { load_step: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  사용 가능한 최소 중량 ({m.unit})
                  <input
                    required
                    type="number"
                    min={0}
                    max={2000}
                    step="any"
                    value={m.min_load}
                    onChange={(e) =>
                      movement(m.id, { min_load: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <p className="g-muted">
                RIR 3 = 세트 종료 시 3회 더 할 수 있는 여유. 추천은 중량 간격에
                맞춰 내림하며, 최소 중량보다 낮으면 코치 확인으로 표시해요.
              </p>
            </>
          )}
        </section>
      ))}
      <ExerciseSearch exercises={exercises} disabled={form.movements.length >= 20}
        label="+ 핵심 운동 추가 · 이름으로 검색" onSelect={(e) => set("movements", [...form.movements, newMovement(e)])} />
    </>
  );
}
