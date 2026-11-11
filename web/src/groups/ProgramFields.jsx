import { coreExercises, coreMovement, setRpe } from "./coreLifts.js";
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
  showKeyDescription = true,
}) {
  const available = useMemo(() => coreExercises(exercises), [exercises]);
  const coreGoals = useMemo(() => goals.filter((g) => available.some((e) => e.id === g.exercise_id)), [goals, available]);
  const canSeed = !!onChange;
  const form = useMemo(() => canSeed ? previewBlockDefaults(original, coreGoals, available) : original, [original, coreGoals, available, canSeed]);
  const set = (key, value) => onChange ? onChange(editProgram(form, key, value)) : setField(key, value);
  const movement = (id, patch) =>
    set(
      "movements",
      form.movements.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
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
      {showKeyDescription && <label className="g-key-description-field">
        Key Description · 관리자 전용
        <small>수업의 의도, 훈련 목적, 목표 강도와 코칭 포인트를 적어 주세요. 멤버에게는 공개되지 않아요.</small>
        <textarea rows={4} maxLength={4000} value={form.key_description || ""}
          onChange={(e) => set("key_description", e.target.value)}
          placeholder={"예: 하이록스 전 피로를 낮추면서 전환 감각 유지\n목표: RPE 6~7, 후반에도 일정한 페이스\n코칭: 초반 과속을 막고 호흡과 동작 품질 확인"} />
      </label>}
      {form._blockPreview && <div className="g-default-preview">
        <strong>이번 블록의 평가 종목을 미리 불러왔어요.</strong>
        <p>오늘의 프로그램을 입력하거나 아래 내용을 수정하면 적용돼요. 반복 수·RPE은 오늘 수업에 맞춰 확인해 주세요.</p>
        <button type="button" onClick={() => set("movements", form.movements)}>이 종목으로 작성</button>
        <button type="button" onClick={() => set("movements", [])}>오늘은 다른 운동으로 작성</button>
      </div>}
      <div className="g-heading">
        <h3>추천 중량을 받을 핵심 운동</h3>
        <small>{form.movements.length}/20</small>
      </div>
      <p className="g-muted">9종목 · kg · 바벨 포함 총중량으로 고정돼요. 실제 중량·반복 수·운동별 RPE 기록은 다음 추천에 활용해요.</p>
      {!!coreGoals.length && !form._blockPreview && <div className="g-goal-quick-add">
        {coreGoals.filter((g) => !form.movements.some((m) => m.exercise_id === g.exercise_id)).map((g) => {
          const e = available.find((e) => e.id === g.exercise_id);
          return e && <button type="button" key={g.exercise_id} disabled={form.movements.length >= 20}
            onClick={() => set("movements", [...form.movements, coreMovement(newMovement(e))])}>+ {e.name} <small>블록 목표</small></button>;
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
                  movement(m.id, coreMovement({
                    ...m, training_type: "strength",
                    exercise_id: e.target.value,
                    label:
                      exercises.find((x) => x.id === e.target.value)?.name ||
                      "",
                  }))
                }
              >
                <option value="">종목 선택</option>
                {m.exercise_id && !available.some((e) => e.id === m.exercise_id) && <option value={m.exercise_id} disabled>{m.label || m.exercise_id} · 기존 종목</option>}
                {available.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {m.training_type === "strength" && (
            <>
              <p className="g-prescription">
                {m.sets.map((s) => s.reps).join("–")}회 ·{" "}
                {m.sets.every((s) => s.rir === m.sets[0].rir)
                  ? `RPE ${setRpe(m.sets[0])}`
                  : "세트별 RPE"}
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
                    목표 RPE
                    <input
                      aria-label={`운동 ${i + 1} ${j + 1}세트 RPE`}
                      required
                      type="number"
                      min={5}
                      max={10}
                      step={0.5}
                      value={setRpe(s)}
                      onChange={(e) =>
                        movement(m.id, {
                          sets: m.sets.map((x, k) =>
                            k === j ? { ...x, rir: 10 - Number(e.target.value) } : x,
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
              <p className="g-muted">목표 RPE에 맞춰 추천해요. 기준 기록이 없으면 코치가 시작 중량을 확인해요.</p>
            </>
          )}
        </section>
      ))}
      <ExerciseSearch exercises={available} disabled={form.movements.length >= 20}
        label="+ 핵심 운동 추가 · 9종목" onSelect={(e) => set("movements", [...form.movements, coreMovement(newMovement(e))])} />
    </>
  );
}
