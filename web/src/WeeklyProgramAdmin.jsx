import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_WEEK_TYPE,
  WEEK_TYPE_OPTIONS,
  loadWeeklyProgramsFromSupabase,
  saveWeeklyProgramToSupabase,
  saveWeeklyPrograms,
} from "./data/weeklyPrograms";
import { Calendar } from "./pt/Calendar.jsx";
import { today } from "./pt/model.js";
import { periodFor } from "./pt/tracking.js";
import {
  newWeek,
  newWorkout,
  shiftedWeek,
  stableWeek,
  weekForDay,
} from "./programs/model.js";
import "./programs/Programs.css";
const clone = (value) => structuredClone(value);
const dateLabel = (day) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${day}T12:00:00+09:00`));
const sessionTypes = ["ZONE 2", "INTERVAL", "INDOOR ZONE 2", "STRENGTH"];

function Editor({ workout, week, busy, error, onClose, onSave, onDelete }) {
  const dialog = useRef(null);
  const [draft, setDraft] = useState(() => clone(workout));
  const dirty = JSON.stringify(draft) !== JSON.stringify(workout);
  const { first, last } = periodFor(workout.date, "week");
  useEffect(() => {
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    const guard = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const close = () => {
    if (!busy && (!dirty || window.confirm("저장하지 않은 내용을 닫을까요?")))
      onClose();
  };
  const field = (name, value) => setDraft((d) => ({ ...d, [name]: value }));
  return (
    <dialog
      ref={dialog}
      className="manage program-editor-dialog"
      aria-labelledby="program-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header className="program-editor-header">
        <button
          type="button"
          onClick={close}
          disabled={busy}
          aria-label="작성창 닫기"
        >
          ‹
        </button>
        <div>
          <span>{dateLabel(workout.date)}</span>
          <h2 id="program-editor-title">프로그램 작성</h2>
        </div>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <fieldset disabled={busy}>
          <label>
            프로그램 제목
            <input
              autoFocus
              required
              maxLength={120}
              value={draft.title}
              onChange={(e) => field("title", e.target.value)}
              placeholder="예: 800m 인터벌"
            />
          </label>
          <div className="program-form-pair">
            <label>
              분류
              <select
                aria-label="분류"
                value={draft.category}
                onChange={(e) => {
                  field("category", e.target.value);
                  field(
                    "sessionType",
                    e.target.value === "BUILD" ? "STRENGTH" : "ZONE 2",
                  );
                }}
              >
                <option value="RUN">러닝</option>
                <option value="BUILD">근력</option>
              </select>
            </label>
            <label>
              세션 종류
              <select
                aria-label="세션 종류"
                value={draft.sessionType}
                onChange={(e) => field("sessionType", e.target.value)}
              >
                {[
                  ...new Set(
                    [...sessionTypes, draft.sessionType].filter(Boolean),
                  ),
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            목표 RPE
            <input
              value={draft.targetRpe || ""}
              onChange={(e) => field("targetRpe", e.target.value)}
              placeholder="예: 7–8"
            />
          </label>
          {(draft.sections || []).map((section, i) => (
            <label key={i}>
              {section.title}
              <textarea
                aria-label={section.title}
                rows={section.title === "MAIN" ? 6 : 3}
                value={(section.items || []).join("\n")}
                placeholder="운동 내용을 자유롭게 작성하세요"
                onChange={(e) =>
                  field(
                    "sections",
                    draft.sections.map((s, j) =>
                      i === j ? { ...s, items: e.target.value.split("\n") } : s,
                    ),
                  )
                }
              />
            </label>
          ))}
          <details className="program-options">
            <summary>추가 정보</summary>
            <div>
              <label>
                날짜
                <input
                  type="date"
                  required
                  min={first}
                  max={last}
                  value={draft.date}
                  onChange={(e) => field("date", e.target.value)}
                />
              </label>
              <label>
                훈련 목적
                <input
                  value={draft.subtitle || ""}
                  onChange={(e) => field("subtitle", e.target.value)}
                />
              </label>
              <label>
                요약 설명
                <input
                  value={draft.description || ""}
                  onChange={(e) => field("description", e.target.value)}
                />
              </label>
              {onDelete && (
                <button
                  type="button"
                  className="program-delete"
                  onClick={onDelete}
                >
                  프로그램 삭제
                </button>
              )}
            </div>
          </details>
          {week.published && (
            <p className="program-caption">
              공개 중인 주차입니다. 저장하면 회원 화면에도 반영됩니다.
            </p>
          )}
        </fieldset>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <footer className="program-editor-footer">
          <button className="primary" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export default function WeeklyProgramAdmin() {
  const [programs, setPrograms] = useState([]),
    [day, setDay] = useState(today()),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [editor, setEditor] = useState(null),
    [version, setVersion] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    loadWeeklyProgramsFromSupabase()
      .then((data) => {
        if (live) setPrograms(data.map(stableWeek));
      })
      .catch(() => {
        if (live) setError("프로그램을 불러오지 못했어요. 다시 시도해 주세요.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [version]);
  const week = weekForDay(programs, day);
  const workouts = programs.flatMap((w) =>
    w.workouts
      .filter((x) => x.date === day)
      .map((x) => ({ week: w, workout: x })),
  );
  const period = periodFor(day, "week");
  async function persist(value, notice) {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = stableWeek(await saveWeeklyProgramToSupabase(value));
      const next = programs.some((w) => w.weekId === saved.weekId)
        ? programs.map((w) => (w.weekId === saved.weekId ? saved : w))
        : [...programs, saved];
      setPrograms(next);
      try {
        saveWeeklyPrograms(next);
      } catch {
        /* The server save succeeded; browser storage is only a cache. */
      }
      setMessage(notice);
      return saved;
    } catch (e) {
      setError(`저장하지 못했어요. ${e.message || "다시 시도해 주세요."}`);
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function saveWorkout(draft) {
    if (!draft.title.trim()) {
      setError("프로그램 제목을 입력해 주세요.");
      return;
    }
    if (
      periodFor(draft.date, "week").first !==
      periodFor(editor.workout.date, "week").first
    ) {
      setError("선택한 주 안에서 날짜를 변경해 주세요.");
      return;
    }
    const parent = editor.week;
    if (parent.published && !String(draft.targetRpe || "").trim()) {
      setError("공개 프로그램의 목표 RPE를 입력해 주세요.");
      return;
    }
    // Keep original IDs and trainer metadata so existing attendance stays attached.
    const next = {
      ...parent,
      workouts: editor.existing
        ? parent.workouts.map((w) =>
            w.sessionId === draft.sessionId ? draft : w,
          )
        : [...parent.workouts, draft],
    };
    if (await persist(next, "프로그램을 저장했어요.")) {
      setEditor(null);
      setDay(draft.date);
    }
  }
  async function removeWorkout() {
    if (!window.confirm("이 프로그램을 삭제할까요?")) return;
    const next = {
      ...editor.week,
      workouts: editor.week.workouts.filter(
        (w) => w.sessionId !== editor.workout.sessionId,
      ),
    };
    if (!next.workouts.length) next.published = false;
    if (await persist(next, "프로그램을 삭제했어요.")) setEditor(null);
  }
  async function publish() {
    if (!week || busy) return;
    if (!week.published) {
      const invalid = week.workouts.find(
        (w) => !w.title?.trim() || !String(w.targetRpe || "").trim(),
      );
      if (!week.workouts.length) {
        setError("프로그램을 먼저 작성해 주세요.");
        return;
      }
      if (invalid) {
        setError(
          `${dateLabel(invalid.date)} · ${invalid.title || "프로그램"}의 제목과 목표 RPE를 입력해 주세요.`,
        );
        return;
      }
    }
    if (
      !window.confirm(
        week.published
          ? "이 주의 전체 프로그램 공개를 중지할까요?"
          : "이 주의 전체 프로그램을 회원에게 공개할까요?",
      )
    )
      return;
    await persist(
      { ...week, published: !week.published },
      week.published ? "공개를 중지했어요." : "이번 주 프로그램을 공개했어요.",
    );
  }
  async function copyNext() {
    if (!week?.workouts.length) return;
    const copy = shiftedWeek(week);
    if (weekForDay(programs, copy.workouts[0].date)) {
      setError(
        "다음 주에 이미 프로그램이 있어요. 기존 프로그램을 확인해 주세요.",
      );
      return;
    }
    if (await persist(copy, "다음 주에 비공개로 복사했어요."))
      setDay(copy.workouts[0].date);
  }
  return (
    <section
      className="pt simple-pt program-manager"
      aria-label="주간 프로그램 캘린더"
    >
      <div className="program-heading">
        <h2>프로그램</h2>
        <button type="button" onClick={() => setDay(today())}>
          오늘
        </button>
      </div>
      {loading ? (
        <p role="status" className="program-caption">
          프로그램을 불러오고 있어요.
        </p>
      ) : (
        <>
          {error && !editor && (
            <p role="alert" className="error-banner">
              {error}
              <button onClick={() => setVersion((v) => v + 1)}>
                다시 불러오기
              </button>
            </p>
          )}
          {message && (
            <p role="status" className="success-banner">
              {message}
            </p>
          )}
          <div className="program-calendar-layout">
            <Calendar
              value={day}
              onChange={(value) => {
                setDay(value);
                setError("");
                setMessage("");
              }}
              dates={programs.flatMap((w) => w.workouts.map((x) => x.date))}
              label="프로그램 날짜 선택"
              eventLabel="프로그램 있음"
              trainingLegend={false}
            />
            <section className="program-day-panel">
              <header className="program-day-heading">
                <div>
                  <span>선택한 날짜</span>
                  <h3>{dateLabel(day)}</h3>
                </div>
                <button
                  className="pt-primary"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setEditor({
                      week: clone(week || newWeek(day, DEFAULT_WEEK_TYPE)),
                      workout: newWorkout(day),
                      existing: false,
                    });
                  }}
                >
                  프로그램 추가
                </button>
              </header>
              <div className="program-day-list">
                {workouts.length ? (
                  workouts.map(({ week: w, workout }) => (
                    <button
                      key={`${w.weekId}-${workout.sessionId}`}
                      className="program-day-item"
                      onClick={() => {
                        setError("");
                        setEditor({
                          week: clone(w),
                          workout: clone(workout),
                          existing: true,
                        });
                      }}
                    >
                      <span>
                        <small>
                          {workout.category === "BUILD" ? "근력" : "러닝"} ·{" "}
                          {w.published ? "공개 중" : "비공개"}
                        </small>
                        <strong>{workout.title || "제목 없음"}</strong>
                      </span>
                      <span aria-hidden="true">›</span>
                    </button>
                  ))
                ) : (
                  <p className="program-empty">아직 프로그램이 없어요.</p>
                )}
              </div>
              <div className="program-week-summary">
                <div>
                  <strong>
                    {period.first.slice(5).replace("-", "/")} –{" "}
                    {period.last.slice(5).replace("-", "/")}
                  </strong>
                  <span>
                    {week?.workouts.length || 0}개 ·{" "}
                    {week?.published ? "공개 중" : "비공개"}
                  </span>
                </div>
                {!!week?.workouts.length && (
                  <button disabled={busy} onClick={publish}>
                    {week.published ? "공개 중지" : "이번 주 공개"}
                  </button>
                )}
              </div>
              {week && (
                <details className="program-options" key={week.weekId}>
                  <summary>이번 주 설정</summary>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      await persist(
                        {
                          ...week,
                          label: f.get("label").trim(),
                          weekType: f.get("type"),
                        },
                        "주간 설정을 저장했어요.",
                      );
                    }}
                  >
                    <fieldset disabled={busy}>
                      <label>
                        주차 이름
                        <input
                          name="label"
                          required
                          defaultValue={week.label}
                        />
                      </label>
                      <label>
                        주간 유형
                        <select name="type" defaultValue={week.weekType}>
                          {WEEK_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button>설정 저장</button>
                      <button
                        type="button"
                        onClick={copyNext}
                        disabled={!week.workouts.length}
                      >
                        다음 주로 복사
                      </button>
                    </fieldset>
                  </form>
                </details>
              )}
            </section>
          </div>
        </>
      )}
      {editor && (
        <Editor
          workout={editor.workout}
          week={editor.week}
          busy={busy}
          error={error}
          onClose={() => {
            setEditor(null);
            setError("");
          }}
          onSave={saveWorkout}
          onDelete={editor.existing ? removeWorkout : null}
        />
      )}
    </section>
  );
}
