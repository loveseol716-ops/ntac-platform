import ClassTypeWeekEditor from "./ClassTypeWeekEditor.jsx";
import TimetableEditor from "./TimetableEditor.jsx";
import { blankPrograms, programReady, typeDays } from "./classTypes.js";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { checked, rpc, listWeeks } from "./api.js";
import { weekStart, weekdays, addDays } from "./model.js";
import { Dialog } from "./shared.jsx";
import ProgramFields from "./ProgramFields.jsx";
export default function WeeklyPrograms({
  day,
  onDay,
  coaches,
  exercises,
  templates,
  profile,
  onChange,
}) {
  const [weeks, setWeeks] = useState([]),
    [timetable, setTimetable] = useState(null),
    [edit, setEdit] = useState(null),
    [schedule, setSchedule] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [version, setVersion] = useState(0),
    lock = useRef(false);
  useEffect(() => {
    let live = true;
    Promise.all([
      listWeeks(day),
      checked(supabase.from("group_timetable").select("*").single()),
    ])
      .then(([w, t]) => {
        if (live) {
          setWeeks(w);
          setTimetable(t);
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [day, version]);
  async function act(fn, msg) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      setVersion((v) => v + 1);
      onChange();
      setMessage(typeof msg === "function" ? msg(r) : msg);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const start = weekStart(day);
  return (
    <>
      <div className="g-heading">
        <div>
          <h2>주간 프로그램</h2>
          <p className="g-muted">
            7가지 수업을 한 주의 묶음으로 작성하고, 시간표에 맞춰 공개하세요.
          </p>
        </div>
        <button
          disabled={!timetable}
          onClick={() => {
            setSchedule(structuredClone(timetable));
            setError("");
          }}
        >
          반복 시간표 설정
        </button>
      </div>
      <div className="g-week-nav">
        <button onClick={() => onDay(addDays(start, -7))}>← 이전 주</button>
        <label>
          프로그램 주차
          <input
            type="date"
            value={day}
            onChange={(e) => e.target.value && onDay(e.target.value)}
          />
        </label>
        <button onClick={() => onDay(addDays(start, 7))}>다음 주 →</button>
      </div>
      {error && (
        <p className="g-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="g-success" role="status">
          {message}
        </p>
      )}
      <p>
        {start} 시작 주 · 반복 수업 {timetable?.slots.length || 26}개
        {!timetable?.slots.length ? " (첨부 시간표 기본값)" : ""}
      </p>
      {timetable && !timetable.slots.length && (
        <p className="g-muted">
          첫 공개 때 첨부 시간표를 적용하고 공개한 관리자를 담당 코치로
          지정해요. 다른 코치나 수업 길이를 지정하려면 먼저 반복 시간표를
          설정하세요.
        </p>
      )}
      {!weeks.length && (
        <button
          className="g-primary"
          onClick={() => {
            setError("");
            setEdit({
              week_start: start,
              title: `${start} 주간 프로그램`,
              status: "draft",
              program_mode: "class_type",
              programs: blankPrograms(),
              days: [],
            });
          }}
        >
          + 이번 주 프로그램 만들기
        </button>
      )}
      {weeks.map((w) => (
        <section className="g-panel" key={w.id}>
          <div className="g-heading">
            <h3>{w.title}</h3>
            <span className="g-badge">
              {w.status === "published" ? "멤버 공개 중" : "작성 중"}
            </span>
          </div>
          {w.program_mode === "class_type" ? (
            <div className="g-program-status-grid">
              {w.programs.map((p) => (
                <div key={p.class_type_id}>
                  <strong>{p.title}</strong>
                  <small>
                    {typeDays(p.class_type_id)} ·{" "}
                    {programReady(p) ? "작성됨" : "작성 전"}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p>
              {w.days
                .map((d) => `${weekdays[d.dow - 1]}: ${d.title}`)
                .join(" · ")}
            </p>
          )}
          <div className="g-actions">
            <button
              onClick={() => {
                setError("");
                setEdit(structuredClone(w));
              }}
            >
              프로그램 수정
            </button>
            <button
              disabled={busy}
              onClick={() =>
                act(
                  () =>
                    rpc("group_save_week", {
                      payload: { ...w, status: "published" },
                    }),
                  (r) =>
                    `공개 완료 · 수업 ${r.created}개 생성, ${r.updated}개 반영, 기존 수업 ${r.kept}개 유지${r.conflicts ? ` · 시간 겹침 ${r.conflicts}개 유지` : ""}`,
                )
              }
            >
              공개 · 시간표 반영
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "이 주간 프로그램과 앞으로 시작할 예정 수업을 삭제할까요? 진행·종료한 수업과 기록은 보존돼요.",
                  )
                )
                  act(
                    () =>
                      rpc("group_remove_program", {
                        kind: "week",
                        target_id: w.id,
                        expected_revision: w.revision,
                      }),
                    "주간 프로그램을 삭제했어요. 기존 운동 기록은 보존돼요.",
                  );
              }}
            >
              프로그램 삭제
            </button>
          </div>
        </section>
      ))}
      <section className="g-panel">
        <h3>저장한 템플릿</h3>
        {!templates.length && (
          <p className="g-muted">
            수업 상세에서 템플릿을 저장하면 다시 사용할 수 있어요.
          </p>
        )}
        {templates.map((t) => (
          <div className="g-heading" key={t.id}>
            <span>{t.title}</span>
            {(profile.role !== "coach" || t.created_by === profile.id) && (
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "이 템플릿을 삭제할까요? 이미 만든 수업은 유지돼요.",
                    )
                  )
                    act(
                      () =>
                        rpc("group_remove_program", {
                          kind: "template",
                          target_id: t.id,
                        }),
                      "템플릿을 삭제했어요.",
                    );
                }}
              >
                템플릿 삭제
              </button>
            )}
          </div>
        ))}
      </section>
      {schedule && (
        <TimetableEditor
          current={schedule}
          coaches={coaches}
          profile={profile}
          busy={busy}
          error={error}
          onClose={() => !busy && setSchedule(null)}
          onSave={async (value) => {
            if (
              await act(
                () =>
                  rpc("group_save_timetable", {
                    payload: value.slots,
                    expected_revision: value.revision,
                  }),
                "시간표를 저장했어요. 공개된 주에는 ‘공개 · 시간표 반영’을 눌러 적용하세요.",
              )
            )
              setSchedule(null);
          }}
        />
      )}
      {edit && (
        <WeekEditorSwitch
          key={edit.id || edit.week_start}
          current={edit}
          exercises={exercises}
          templates={templates}
          busy={busy}
          error={error}
          onClose={() => !busy && setEdit(null)}
          onSave={async (payload) => {
            if (
              await act(
                () => rpc("group_save_week", { payload }),
                (r) =>
                  payload.status === "published"
                    ? `멤버에게 공개했어요. 수업 ${r.created}개 생성 · ${r.updated}개 수정 · 등록/시작한 수업 ${r.kept}개 유지${r.conflicts ? ` · 시간 겹침 ${r.conflicts}개 유지` : ""}${r.default_timetable_loaded ? " · 기본 시간표 자동 적용" : ""}`
                    : "주간 프로그램을 임시 저장했어요.",
              )
            )
              setEdit(null);
          }}
        />
      )}
    </>
  );
}
function LegacyWeekEditor({
  current,
  exercises,
  templates,
  busy,
  error,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(current),
    [dow, setDow] = useState(current.days[0]?.dow || 1);
  const d = form.days.find((x) => x.dow === dow),
    set = (key, value) =>
      setForm((f) => ({
        ...f,
        days: f.days.map((x) => (x.dow === dow ? { ...x, [key]: value } : x)),
      }));
  return (
    <Dialog title="주간 프로그램 만들기 · 수정" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...form,
            status: e.nativeEvent.submitter?.value || form.status,
          });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            주간 프로그램 이름
            <input
              required
              maxLength={120}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <p>
            {form.week_start} 시작 주 · 공개하면 멤버에게 보이고 시간표에 맞춰
            수업이 생겨요.
          </p>
          <div className="g-tabs">
            {weekdays.map((name, i) => (
              <button
                className={dow === i + 1 ? "selected" : ""}
                type="button"
                key={name}
                onClick={() => setDow(i + 1)}
              >
                {name}
                {form.days.some((x) => x.dow === i + 1) ? " •" : ""}
              </button>
            ))}
          </div>
          {!d ? (
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  days: [
                    ...form.days,
                    { dow, title: "", description: "", movements: [] },
                  ].sort((a, b) => a.dow - b.dow),
                })
              }
            >
              + {weekdays[dow - 1]}요일 프로그램 추가
            </button>
          ) : (
            <>
              <div className="g-heading">
                <h3>{weekdays[dow - 1]}요일 프로그램</h3>
                <button
                  type="button"
                  disabled={form.days.length === 1}
                  onClick={() =>
                    setForm({
                      ...form,
                      days: form.days.filter((x) => x.dow !== dow),
                    })
                  }
                >
                  이 요일 제거
                </button>
              </div>
              {templates.length > 0 && (
                <label>
                  템플릿 가져오기
                  <select
                    value=""
                    onChange={(e) => {
                      const t = templates.find((x) => x.id === e.target.value);
                      if (t)
                        setForm({
                          ...form,
                          days: form.days.map((x) =>
                            x.dow === dow
                              ? {
                                  dow,
                                  title: t.title,
                                  description: t.description,
                                  movements: t.movements.map((m) => ({
                                    ...m,
                                    id: crypto.randomUUID(),
                                  })),
                                }
                              : x,
                          ),
                        });
                    }}
                  >
                    <option value="">선택</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <ProgramFields form={d} set={set} exercises={exercises} />
            </>
          )}
          {error && (
            <p className="g-error" role="alert">
              {error}
            </p>
          )}
          <p className="g-muted">
            이미 참가 등록되거나 시작한 수업의 프로그램은 고정돼요. 수정 후
            공개하면 나머지 예정 수업에만 반영돼요.
          </p>
          <div className="g-actions">
            {form.status !== "published" && (
              <button value="draft">임시 저장</button>
            )}
            <button className="g-primary" value="published">
              저장 · 멤버 공개 · 캘린더 반영
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

function WeekEditorSwitch(props) {
  return props.current.program_mode === "class_type" ? (
    <ClassTypeWeekEditor {...props} />
  ) : (
    <LegacyWeekEditor {...props} />
  );
}
