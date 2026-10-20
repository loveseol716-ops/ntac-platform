import { useState } from "react";
import { Dialog } from "./shared.jsx";
import { kinds, seoulDate, classTime } from "./model.js";
export default function ClassEditor({
  current,
  day,
  profile,
  coaches,
  exercises,
  templates,
  busy,
  error,
  onSave,
  onClose,
}) {
  const [form, setForm] = useState(
    current
      ? {
          ...current,
          date: seoulDate(current.starts_at),
          time: classTime(current.starts_at),
        }
      : {
          title: "",
          date: day,
          time: "18:00",
          duration_minutes: 50,
          coach_id: profile.id,
          description: "",
          movements: [],
        },
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const movement = (id, patch) =>
    set(
      "movements",
      form.movements.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  return (
    <Dialog
      title={current ? "수업 프로그램 수정" : "그룹수업 만들기"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...form,
            starts_at: new Date(
              `${form.date}T${form.time}:00+09:00`,
            ).toISOString(),
          });
        }}
      >
        <fieldset disabled={busy}>
          {error && (
            <p className="g-error" role="alert">
              {error}
            </p>
          )}
          {!current && templates.length > 0 && (
            <label>
              저장한 프로그램 가져오기
              <select
                defaultValue=""
                onChange={(e) => {
                  const t = templates.find((t) => t.id === e.target.value);
                  if (t)
                    setForm((f) => ({
                      ...f,
                      title: t.title,
                      description: t.description,
                      movements: t.movements.map((m) => ({
                        ...m,
                        id: crypto.randomUUID(),
                      })),
                    }));
                }}
              >
                <option value="">직접 작성</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            수업명
            <input
              required
              maxLength="120"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="예: 하체 스트렝스 & 컨디셔닝"
            />
          </label>
          <div className="g-fields">
            <label>
              날짜
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </label>
            <label>
              시작 시간
              <input
                required
                type="time"
                value={form.time}
                onChange={(e) => set("time", e.target.value)}
              />
            </label>
            <label>
              수업 시간(분)
              <input
                required
                type="number"
                min="10"
                max="240"
                value={form.duration_minutes}
                onChange={(e) =>
                  set("duration_minutes", Number(e.target.value))
                }
              />
            </label>
          </div>
          <label>
            담당 코치
            <select
              value={form.coach_id}
              onChange={(e) => set("coach_id", e.target.value)}
            >
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            오늘의 프로그램
            <textarea
              rows="6"
              maxLength="10000"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={"Warm-up\nMain\nFinisher"}
            />
          </label>
          <div className="g-heading">
            <h3>추천 · 기록할 핵심 운동</h3>
            <small>{form.movements.length}/20</small>
          </div>
          {form.movements.map((m, i) => (
            <section className="g-record-movement" key={m.id}>
              <div className="g-heading">
                <strong>운동 {i + 1}</strong>
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
                    onChange={(e) => {
                      const ex = exercises.find((x) => x.id === e.target.value);
                      movement(m.id, {
                        exercise_id: e.target.value,
                        label: ex.name,
                      });
                    }}
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
              </div>
              {m.kind === "weight" && (
                <div className="g-fields">
                  <label>
                    목표 반복 수
                    <input
                      required
                      type="number"
                      min="1"
                      max="1000"
                      value={m.target_reps}
                      onChange={(e) =>
                        movement(m.id, { target_reps: Number(e.target.value) })
                      }
                    />
                  </label>
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
            </section>
          ))}
          <button
            type="button"
            disabled={form.movements.length >= 20}
            onClick={() =>
              set("movements", [
                ...form.movements,
                {
                  id: crypto.randomUUID(),
                  exercise_id: "",
                  label: "",
                  kind: "weight",
                  target_reps: 8,
                  unit: "kg",
                  load_basis: "total",
                },
              ])
            }
          >
            + 핵심 운동 추가
          </button>
          <p className="g-muted">
            참가자가 생기면 프로그램이 고정돼요. 다른 조건의 운동은 새 종목으로
            구분해 주세요.
          </p>
          <button type="submit" className="g-primary g-full">
            {busy ? "저장 중…" : "프로그램 저장"}
          </button>
        </fieldset>
      </form>
    </Dialog>
  );
}
