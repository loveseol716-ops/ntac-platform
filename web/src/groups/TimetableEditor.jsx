import { useState } from "react";
import { Dialog } from "./shared.jsx";
import { weekdays } from "./model.js";
import { CLASS_TYPES, defaultTimetable } from "./classTypes.js";
export default function TimetableEditor({
  current,
  coaches,
  profile,
  busy,
  error,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
      ...current,
      slots: current.slots.length
        ? structuredClone(current.slots)
        : defaultTimetable(profile.id),
    }),
    [day, setDay] = useState(1);
  const set = (id, key, value) =>
    setForm((f) => ({
      ...f,
      slots: f.slots.map((s) =>
        s.id === id
          ? {
              ...s,
              [key]: value,
              ...(key === "dow" &&
              !CLASS_TYPES.find((t) => t.id === s.class_type_id)?.days.includes(
                value,
              )
                ? { class_type_id: "" }
                : {}),
            }
          : s,
      ),
    }));
  return (
    <Dialog title="수업별 반복 시간표" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
      >
        <fieldset disabled={busy}>
          <p className="g-muted">
            첨부 시간표의 정규 수업 26개를 기본값으로 준비했어요. OPEN GYM·TRACK
            RUN은 이 7개 수업 묶음에 포함하지 않아요.
          </p>
          <p className="g-muted">
            기본 길이: 일반 수업 50분, NO MORE WEAK 90분. 담당 코치와 실제 수업
            길이를 확인해 주세요.
          </p>
          <div className="g-actions">
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "편집 중인 시간표를 첨부 이미지의 기본 시간표로 바꿀까요? 저장하면 다음 프로그램 공개부터 적용돼요.",
                  )
                )
                  setForm({
                    ...form,
                    slots: defaultTimetable(profile.id).map((s) => ({
                      ...s,
                      id:
                        form.slots.find(
                          (x) =>
                            x.dow === s.dow &&
                            x.time === s.time &&
                            x.class_type_id === s.class_type_id,
                        )?.id || s.id,
                    })),
                  });
              }}
            >
              첨부 시간표 불러오기
            </button>
            <label>
              담당 코치 일괄 지정
              <select
                aria-label="담당 코치 일괄 지정"
                value=""
                onChange={(e) =>
                  e.target.value &&
                  setForm({
                    ...form,
                    slots: form.slots.map((s) => ({
                      ...s,
                      coach_id: e.target.value,
                    })),
                  })
                }
              >
                <option value="">코치 선택</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="g-schedule-days" aria-label="시간표 요일 선택">
            {weekdays.map((d, i) => (
              <button
                type="button"
                key={d}
                aria-pressed={day === i + 1}
                className={day === i + 1 ? "selected" : ""}
                onClick={() => setDay(i + 1)}
              >
                {d}
                <small>
                  {form.slots.filter((s) => s.dow === i + 1).length}개
                </small>
              </button>
            ))}
          </div>
          <h3>{weekdays[day - 1]}요일 수업</h3>
          {form.slots
            .filter((s) => s.dow === day)
            .sort((a, b) => a.time.localeCompare(b.time))
            .map((s) => (
              <section className="g-schedule-slot" key={s.id}>
                <div className="g-fields">
                  <label>
                    요일
                    <select
                      value={s.dow}
                      onChange={(e) => set(s.id, "dow", Number(e.target.value))}
                    >
                      {weekdays.map((d, i) => (
                        <option key={d} value={i + 1}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    수업 종류
                    <select
                      required
                      aria-label={`${s.time} 수업 종류`}
                      value={s.class_type_id || ""}
                      onChange={(e) =>
                        set(s.id, "class_type_id", e.target.value)
                      }
                    >
                      <option value="">수업 선택</option>
                      {CLASS_TYPES.filter((t) => t.days.includes(s.dow)).map(
                        (t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
                <div className="g-fields">
                  <label>
                    시작 시간
                    <input
                      type="time"
                      required
                      value={s.time}
                      onChange={(e) => set(s.id, "time", e.target.value)}
                    />
                  </label>
                  <label>
                    수업 시간(분)
                    <input
                      type="number"
                      required
                      min={10}
                      max={240}
                      value={s.duration_minutes}
                      onChange={(e) =>
                        set(s.id, "duration_minutes", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    담당 코치
                    <select
                      required
                      value={s.coach_id}
                      onChange={(e) => set(s.id, "coach_id", e.target.value)}
                    >
                      {coaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      slots: form.slots.filter((x) => x.id !== s.id),
                    })
                  }
                >
                  시간 삭제
                </button>
              </section>
            ))}
          <button
            type="button"
            disabled={form.slots.length >= 100}
            onClick={() =>
              setForm({
                ...form,
                slots: [
                  ...form.slots,
                  {
                    id: crypto.randomUUID(),
                    dow: day,
                    time: "18:00",
                    class_type_id: CLASS_TYPES.find((t) => t.days.includes(day))
                      .id,
                    duration_minutes: 50,
                    coach_id: profile.id,
                  },
                ],
              })
            }
          >
            + 수업 시간 추가
          </button>
          {error && (
            <p className="g-error" role="alert">
              {error}
            </p>
          )}
          <button className="g-primary g-full">시간표 저장</button>
        </fieldset>
      </form>
    </Dialog>
  );
}
