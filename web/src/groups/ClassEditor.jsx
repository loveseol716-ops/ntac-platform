import ProgramFields from "./ProgramFields.jsx";
import { useState } from "react";
import { Dialog } from "./shared.jsx";
import { seoulDate, classTime } from "./model.js";
import AuthoringContext from "./AuthoringContext.jsx";
import useBlockGoals from "./useBlockGoals.js";
import { cleanProgram, editProgram, goalsForDate } from "./blockGoals.js";
import { CLASS_TYPES } from "./classTypes.js";
import { trainingClass } from "./trainingCycle.js";
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
          class_type_id: trainingClass(current) || "",
          date: seoulDate(current.starts_at),
          time: classTime(current.starts_at),
        }
      : {
          title: "GENTLE STRENGTH",
          class_type_id: "gentle_strength",
          date: day,
          time: "18:00",
          duration_minutes: 50,
          coach_id: profile.id,
          description: "",
          movements: [],
        },
  );
  const blockGoals = useBlockGoals();
  const goals = goalsForDate(blockGoals.rows, form.date, trainingClass(form));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog
      title={current ? "수업 프로그램 수정" : "그룹수업 만들기"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Only explicitly selected exercises belong to this class.
          const draft = form;
          onSave({
            ...cleanProgram(editProgram(draft, "movements", draft.movements)),
            recording_version: 2,
            starts_at: new Date(
              `${form.date}T${form.time}:00+09:00`,
            ).toISOString(),
          });
        }}
      >
        <fieldset disabled={busy || blockGoals.loading}>
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
                      description: t.description,
                      ...(t.key_description !== undefined ? { key_description: t.key_description } : {}),
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
          <label>수업 종류
            <select required value={form.class_type_id || ""} onChange={(e) => setForm((f) => ({ ...f, class_type_id: e.target.value, title: CLASS_TYPES.find((t) => t.id === e.target.value)?.name || "" }))}>
              <option value="" disabled>수업 종류 선택</option>
              {CLASS_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <AuthoringContext date={form.date} classType={trainingClass(form)} goals={goals} exercises={exercises} loading={blockGoals.loading} error={blockGoals.error} />
          {blockGoals.error && <button type="button" onClick={blockGoals.refresh}>블록 목표 다시 불러오기</button>}
          <ProgramFields date={form.date} classType={form.class_type_id} form={form} onChange={setForm} goals={goals} exercises={exercises} showKeyDescription={["owner", "admin"].includes(profile.role)} />
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
