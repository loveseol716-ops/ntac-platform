import ClassTypeWeekEditor from "./ClassTypeWeekEditor.jsx";
import TimetableEditor from "./TimetableEditor.jsx";
import { blankPrograms, programReady, typeDays } from "./classTypes.js";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { checked, rpc, listWeeks } from "./api.js";
import { weekStart, weekdays, addDays, programVisibleFrom } from "./model.js";
import { Dialog, Program } from "./shared.jsx";
import ProgramFields from "./ProgramFields.jsx";
import TemplatePicker from "./TemplatePicker.jsx";
import AuthoringContext from "./AuthoringContext.jsx";
import BlockGoalsEditor from "./BlockGoalsEditor.jsx";
import useBlockGoals from "./useBlockGoals.js";
import { cleanProgram, goalsForDate } from "./blockGoals.js";
import { trainingClass } from "./trainingCycle.js";
export default function WeeklyPrograms({
  day,
  onDay,
  coaches,
  exercises,
  templates,
  templatesLoading = false,
  templatesError = "",
  profile,
  onChange,
}) {
  const blockGoals = useBlockGoals();
  const [goalSettings, setGoalSettings] = useState(false);
  const templateLibrary = useRef(null);
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
    <div className="g-weekly-programs">
      <div className="g-heading">
        <div>
          <h2>주간 프로그램</h2>
          <p className="g-muted">
            7가지 수업을 한 주의 묶음으로 작성하고, 시간표에 맞춰 공개하세요.
          </p>
        </div>
        <div className="g-actions">
        <button onClick={() => { templateLibrary.current?.scrollIntoView({ behavior: "smooth", block: "start" }); templateLibrary.current?.focus({ preventScroll: true }); }}>저장한 템플릿{!templatesLoading && !templatesError ? ` (${templates.length})` : ""}</button>
        <button disabled={blockGoals.loading || !!blockGoals.error} onClick={() => { setError(""); setGoalSettings(true); }}>블록 목표 설정</button>
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
      <p className="g-week-range">
        {start} – {addDays(start, 6)} · 반복 수업 {timetable?.slots.length || 26}개
        {!timetable?.slots.length ? " (첨부 시간표 기본값)" : ""}
      </p>
      <AuthoringContext date={start} week />
      {blockGoals.error && <p className="g-error" role="alert">블록 목표를 불러오지 못했어요. <button onClick={blockGoals.refresh}>다시 불러오기</button></p>}
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
          disabled={blockGoals.loading}
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
              {w.status === "published"
                ? w.week_start < programVisibleFrom()
                  ? "멤버 공개 종료 · 관리자 보관"
                  : "멤버 공개 중"
                : "작성 중"}
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
              disabled={blockGoals.loading}
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
                    w.week_start < programVisibleFrom()
                      ? "관리자 보관본을 저장했어요. 멤버 공개 기간은 변경되지 않아요."
                      : `공개 완료 · 수업 ${r.created}개 생성, ${r.updated}개 반영, 기존 수업 ${r.kept}개 유지${r.conflicts ? ` · 시간 겹침 ${r.conflicts}개 유지` : ""}`,
                )
              }
            >
              {w.week_start < programVisibleFrom()
                ? "관리자 보관본 저장"
                : "공개 · 시간표 반영"}
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
      <section className="g-panel g-template-library" ref={templateLibrary} tabIndex={-1} aria-label="저장한 템플릿 목록">
        <div className="g-heading">
          <h3>저장한 템플릿</h3>
          {!templatesLoading && !templatesError && <span className="g-badge">{templates.length}개</span>}
        </div>
        <p className="g-muted">주차와 관계없이 보관돼요. 주간 프로그램 작성창에서 수업을 선택한 뒤 ‘저장한 템플릿 불러오기’로 적용하세요.</p>
        {templatesLoading ? <p className="g-muted" role="status">템플릿을 불러오는 중이에요…</p> : templatesError ? (
          <p className="g-error" role="alert">템플릿 목록을 불러오지 못했어요. <button onClick={onChange}>다시 불러오기</button></p>
        ) : !templates.length && (
          <p className="g-muted">
            아직 저장한 템플릿이 없어요. 수업 운영 → 수업 선택 → ‘템플릿 저장’을 눌러 주세요. 주간 프로그램의 ‘임시 저장’은 해당 주에만 저장돼요.
          </p>
        )}
        {!templatesLoading && !templatesError && templates.map((t) => (
          <div className="g-template-item" key={t.id}>
            <details className="g-template-preview">
              <summary><strong>{t.title}</strong><small>내용 보기 · 핵심 운동 {t.movements.length}개</small></summary>
              <Program c={t} exercises={exercises} />
            </details>
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
      {goalSettings && <BlockGoalsEditor date={day} rows={blockGoals.rows} exercises={exercises} busy={busy} error={error}
        onClose={() => { if (!busy) { setGoalSettings(false); blockGoals.refresh(); } }}
        onSave={async (payload) => {
          if (await act(() => rpc("group_save_block_goals", { payload }), "블록 목표를 저장했어요. 새 프로그램에서 평가 종목을 바로 불러와요.")) {
            setGoalSettings(false); blockGoals.refresh();
          }
        }} />}
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
          blockGoals={blockGoals.rows}
          exercises={exercises}
          templates={templates}
          templatesLoading={templatesLoading}
          templatesError={templatesError}
          busy={busy}
          error={error}
          onClose={() => !busy && setEdit(null)}
          onSave={async (payload) => {
            if (
              await act(
                () => rpc("group_save_week", { payload }),
                (r) =>
                  payload.status === "published"
                    ? payload.week_start < programVisibleFrom()
                      ? "관리자 보관본을 저장했어요. 멤버 공개 기간은 변경되지 않아요."
                      : `멤버에게 공개했어요. 수업 ${r.created}개 생성 · ${r.updated}개 수정 · 등록/시작한 수업 ${r.kept}개 유지${r.conflicts ? ` · 시간 겹침 ${r.conflicts}개 유지` : ""}${r.default_timetable_loaded ? " · 기본 시간표 자동 적용" : ""}`
                    : "주간 프로그램을 임시 저장했어요.",
              )
            )
              setEdit(null);
          }}
        />
      )}
    </div>
  );
}
function LegacyWeekEditor({
  current,
  blockGoals = [],
  exercises,
  templates,
  templatesLoading,
  templatesError,
  busy,
  error,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(current),
    [dow, setDow] = useState(current.days[0]?.dow || 1);
  const d = form.days.find((x) => x.dow === dow),
    set = (value) =>
      setForm((f) => ({
        ...f,
        days: f.days.map((x) => (x.dow === dow ? value : x)),
      }));
  return (
    <Dialog title="주간 프로그램 만들기 · 수정" onClose={onClose}>
      <form
        className="g-week-editor"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...form,
            days: form.days.map(cleanProgram),
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
              <TemplatePicker key={dow} templates={templates} loading={templatesLoading} error={templatesError} hasContent={programReady(d)}
                onApply={(t) => set({ ...d, title: t.title, description: t.description, movements: t.movements, _blockDefaultsHandled: true })} />
              <AuthoringContext date={addDays(form.week_start, dow - 1)} classType={trainingClass(d)} goals={goalsForDate(blockGoals, addDays(form.week_start, dow - 1), trainingClass(d))} exercises={exercises} />
              <ProgramFields form={d} onChange={set} goals={goalsForDate(blockGoals, addDays(form.week_start, dow - 1), trainingClass(d))} exercises={exercises} />
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
              {form.week_start < programVisibleFrom()
                ? "관리자 보관본 저장"
                : "저장 · 멤버 공개 · 캘린더 반영"}
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
