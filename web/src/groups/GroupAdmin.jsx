import MemberCalendar from "./MemberCalendar.jsx";
import ProgramArchive from "./ProgramArchive.jsx";
import WeeklyPrograms from "./WeeklyPrograms.jsx";
import StrengthMax from "./StrengthMax.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  checked,
  rpc,
  listClasses,
  listExercises,
  loadDetail,
  saveParticipant,
} from "./api.js";
import {
  seoulDate,
  classTime,
  stateLabels,
  participantLabels,
  levels,
  movementLabel,
  resultText,
  loadLabel,
} from "./model.js";
import {
  Dialog,
  Program,
  RecordEditor,
  RecommendationValue,
} from "./shared.jsx";
import ClassEditor from "./ClassEditor.jsx";
import { timedClass, useClassClock } from "./classClock.js";
import { TrainingContext } from "./TrainingJourney.jsx";
import { trainingClass } from "./trainingCycle.js";
import "./Groups.css";
export default function GroupAdmin({ profile, onManageMembers }) {
  const now = useClassClock();
  const admin = ["owner", "admin"].includes(profile.role),
    lock = useRef(false);
  const [tab, setTab] = useState("classes"),
    [calendarView, setCalendarView] = useState("month"),
    [day, setDay] = useState(seoulDate()),
    [classes, setClasses] = useState([]),
    [exercises, setExercises] = useState([]),
    [templates, setTemplates] = useState([]),
    [directory, setDirectory] = useState([]),
    [detail, setDetail] = useState(null),
    [selected, setSelected] = useState(null),
    [editing, setEditing] = useState(null),
    [record, setRecord] = useState(null),
    [adding, setAdding] = useState(false),
    [choices, setChoices] = useState([]),
    [exception, setException] = useState(false),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(""),
    [version, setVersion] = useState(0),
    [baseline, setBaseline] = useState(null),
    [audit, setAudit] = useState(null),
    [strengthMax, setStrengthMax] = useState(null);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError("");
    Promise.all([
      listClasses(day, "month"),
      listExercises(),
      checked(
        supabase
          .from("group_templates")
          .select("*")
          .is("archived_at", null)
          .order("updated_at", { ascending: false }),
      ),
      admin ? rpc("group_directory") : Promise.resolve([]),
    ])
      .then(([cs, es, ts, ds]) => {
        if (live) {
          setClasses(cs.filter((c) => admin || c.coach_id === profile.id));
          setExercises(es);
          setTemplates(ts);
          setDirectory(ds);
        }
      })
      .catch((e) => live && setLoadError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [day, version, admin, profile.id]);
  const refreshDetail = useCallback(async () => {
    if (selected) setDetail(await loadDetail(selected));
  }, [selected]);
  useEffect(() => {
    let live = true;
    setDetail(null);
    if (!selected) return;
    const refresh = () =>
      loadDetail(selected)
        .then((d) => live && setDetail(d))
        .catch((e) => live && setError(e.message));
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [selected, version]);
  async function act(fn, msg = "저장했어요.") {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await refreshDetail();
      setVersion((v) => v + 1);
      setMessage(msg);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const c = timedClass(detail?.class, now),
    coaches = admin
      ? directory.filter((p) => ["owner", "admin", "coach"].includes(p.role))
      : [profile];
  async function openAdd() {
    setChoices([]);
    setException(false);
    setQuery("");
    setError("");
    try {
      setDirectory(await rpc("group_directory", { cid: selected }));
      setAdding(true);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="groups g-admin">
      <nav className="g-tabs" aria-label="그룹수업 관리 메뉴">
        {[
          ["classes", "수업 운영"],
          ...(admin
            ? [
                ["programs", "주간 프로그램"],
                ["archive", "운동 DB"],
                ["members", "회원 · 기준 중량"],
              ]
            : []),
        ].map(([k, v]) => (
          <button
            key={k}
            className={tab === k ? "selected" : ""}
            onClick={() => {
              setTab(k);
              setSelected(null);
              setError("");
              setMessage("");
            }}
          >
            {v}
          </button>
        ))}
      </nav>
      {(error || loadError) && (
        <p className="g-error" role="alert">
          {error || loadError}
        </p>
      )}
      {message && (
        <p className="g-success" role="status">
          {message}
        </p>
      )}
      {tab === "classes" && (
        <>
          {selected ? (
            <>
              <button className="g-back" onClick={() => setSelected(null)}>
                ← 수업 목록
              </button>
              {c && (
                <>
                  <header className="g-class-header">
                    <div>
                      <p className="g-kicker">
                        {seoulDate(c.starts_at)} · {classTime(c.starts_at)}
                      </p>
                      <h2>{c.title}</h2>
                      <span className={`g-badge ${c.status}`}>
                        {stateLabels[c.status]}
                      </span>
                    </div>
                    <details className="g-class-options">
                      <summary>수업 관리</summary>
                      <div className="g-actions">
                        {!detail.participants.length &&
                          !["live", "ended", "cancelled"].includes(
                            c.status,
                          ) && (
                            <button onClick={() => setEditing(c)}>
                              프로그램 수정
                            </button>
                          )}
                        <button
                          onClick={() =>
                            setEditing({
                              ...c,
                              id: undefined,
                              revision: undefined,
                              date: day,
                              status: "draft",
                            })
                          }
                        >
                          새 수업으로 복제
                        </button>
                        <button
                          disabled={busy}
                          onClick={async () => {
                            if (
                              confirm(
                                "이 수업 프로그램을 목록에서 삭제할까요? 기존 운동 기록은 보존돼요.",
                              )
                            ) {
                              if (
                                await act(
                                  () =>
                                    rpc("group_remove_program", {
                                      kind: "class",
                                      target_id: c.id,
                                      expected_revision: c.revision,
                                    }),
                                  "수업 프로그램을 삭제했어요.",
                                )
                              )
                                setSelected(null);
                            }
                          }}
                        >
                          프로그램 삭제
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            act(
                              () => rpc("group_save_template", { payload: c }),
                              "템플릿을 저장했어요. 주간 프로그램 → 저장한 템플릿에서 확인하고 불러올 수 있어요.",
                            )
                          }
                        >
                          템플릿 저장
                        </button>
                        {!["ended", "cancelled"].includes(c.status) && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  "이 수업을 취소할까요? 기존 기록은 보관돼요.",
                                )
                              )
                                act(
                                  () =>
                                    rpc("group_set_class_status", {
                                      cid: c.id,
                                      next_status: "cancelled",
                                      expected_revision: c.revision,
                                    }),
                                  "수업을 취소했어요.",
                                );
                            }}
                          >
                            수업 취소
                          </button>
                        )}
                      </div>
                    </details>
                  </header>
                  {c.status === "draft" ? (
                    <div className="g-actions g-state-actions">
                      <button
                        className="g-primary"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              rpc("group_set_class_status", {
                                cid: c.id,
                                next_status: "published",
                                expected_revision: c.revision,
                              }),
                            "프로그램을 공개했어요. 시간표에 따라 자동으로 진행돼요.",
                          )
                        }
                      >
                        프로그램 공개
                      </button>
                    </div>
                  ) : (
                    c.status !== "cancelled" && (
                      <p className="g-auto-flow">
                        수업 참여 → 추천 중량 확인 → 수업 후 기록
                      </p>
                    )
                  )}
                  <div className="g-admin-columns">
                    <div>
                      <TrainingContext
                        date={c.starts_at}
                        classType={trainingClass(c)}
                        label="이 수업의 위치"
                      />
                      <Program c={c} exercises={exercises} />
                    </div>
                    <section className="g-panel g-admin-roster">
                      <div className="g-heading">
                        <h3>
                          참가자{" "}
                          <span className="g-muted">
                            {
                              detail.participants.filter(
                                (p) =>
                                  !["left", "cancelled"].includes(p.status),
                              ).length
                            }
                          </span>
                        </h3>
                        {["open", "live"].includes(c.status) &&
                          !c.archived_at && (
                            <button className="g-primary" onClick={openAdd}>
                              멤버 입장
                            </button>
                          )}
                      </div>
                      <p className="g-muted">
                        {c.status === "ended"
                          ? "실제로 수행한 중량과 횟수를 기록해 주세요."
                          : "회원별 추천 중량을 확인하고 칠판이나 구두로 안내해 주세요."}
                      </p>
                      {!detail.participants.length && (
                        <p className="g-empty">
                          멤버가 ‘수업 참여’를 누르거나 코치가 ‘멤버 입장’으로
                          추가하면 바로 표시돼요.
                        </p>
                      )}
                      {detail.participants.map((p) => (
                        <article className="g-person" key={p.id}>
                          <div className="g-heading">
                            <div>
                              <strong>{p.name || "회원"}</strong>
                              <small>
                                {levels[p.difficulty]} ·{" "}
                                {participantLabels[p.status]}
                                {p.finalized ? " · 확정" : ""}
                                {p.exception_access ? " · 일회 참가" : ""}
                              </small>
                            </div>
                          </div>
                          {["active", "completed"].includes(p.status) &&
                            c.status !== "ended" &&
                            c.movements
                              .filter((m) => m.kind === "weight")
                              .map((m) => (
                                <div
                                  className="g-coach-recommendation"
                                  key={m.id}
                                >
                                  <div>
                                    <strong>
                                      {movementLabel(m, exercises)}
                                    </strong>
                                    <small>추천 중량 · {loadLabel(m)}</small>
                                  </div>
                                  <RecommendationValue
                                    movement={m}
                                    recommendation={p.recommendations?.[m.id]}
                                    compact
                                  />
                                </div>
                              ))}
                          {c.status === "ended" &&
                            c.movements.map((m) => (
                              <div className="g-person-result" key={m.id}>
                                <span>{movementLabel(m, exercises)}</span>
                                <strong>
                                  {resultText(m, p.results?.[m.id])}
                                </strong>
                              </div>
                            ))}
                          <div className="g-actions">
                            {p.status === "planned" && (
                              <>
                                <button
                                  disabled={
                                    busy || !["open", "live"].includes(c.status)
                                  }
                                  onClick={() =>
                                    act(
                                      () =>
                                        rpc("group_join", {
                                          cid: c.id,
                                          user_ids: [p.user_id],
                                        }),
                                      "멤버가 입장했어요. 추천 중량을 확인해 주세요.",
                                    )
                                  }
                                >
                                  입장시키기
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    act(
                                      () =>
                                        rpc("group_cancel_planned", {
                                          pid: p.id,
                                          expected_revision: p.revision,
                                        }),
                                      "사전 참가를 취소했어요.",
                                    )
                                  }
                                >
                                  참가 예정 취소
                                </button>
                              </>
                            )}
                            {p.session_rpe != null && (
                              <span className="g-badge">
                                수업 RPE {p.session_rpe}/10
                              </span>
                            )}
                            {["active", "completed"].includes(p.status) &&
                              c.status !== "cancelled" && (
                                <>
                                  <button
                                    onClick={() => {
                                      setRecord(p);
                                      setError("");
                                    }}
                                  >
                                    {c.status === "ended"
                                      ? "기록 입력 · 확인"
                                      : "추천 조정"}
                                  </button>
                                  <button
                                    disabled={busy}
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `${p.name}님의 참가를 취소할까요? 기존 기록은 보관돼요.`,
                                        )
                                      )
                                        act(
                                          () =>
                                            saveParticipant(p, {
                                              status: "cancelled",
                                            }),
                                          "참가를 취소했어요.",
                                        );
                                    }}
                                  >
                                    참가 취소
                                  </button>
                                </>
                              )}
                          </div>
                        </article>
                      ))}
                    </section>
                  </div>
                  <div className="g-actions">
                    <button
                      onClick={async () => {
                        try {
                          setAudit(
                            await checked(
                              supabase
                                .from("group_audit")
                                .select("id,action,created_at,detail")
                                .eq("class_id", c.id)
                                .order("created_at", { ascending: false })
                                .limit(30),
                            ),
                          );
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      변경 이력
                    </button>
                    <button
                      onClick={() =>
                        navigator.clipboard
                          .writeText(
                            `${location.origin}${import.meta.env.BASE_URL}?class=${c.id}`,
                          )
                          .then(() =>
                            setMessage("회원용 수업 링크를 복사했어요."),
                          )
                          .catch(() =>
                            setError("링크 복사를 지원하지 않는 브라우저예요."),
                          )
                      }
                    >
                      회원용 수업 링크 복사
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="g-heading">
                <div>
                  <h2>그룹수업 운영</h2>
                  <p className="g-muted">
                    프로그램 준비부터 참가·기록까지 한곳에서.
                  </p>
                </div>
              </div>
              {loading && <p role="status">수업을 불러오고 있어요.</p>}
              <MemberCalendar
                admin
                day={day}
                onDay={setDay}
                view={calendarView}
                onView={setCalendarView}
                classes={classes}
                onSelect={setSelected}
                loading={loading}
                onPrograms={admin ? () => setTab("programs") : undefined}
                onCreate={() => {
                  setEditing({ new: true });
                  setError("");
                }}
              />
            </>
          )}
        </>
      )}
      {tab === "programs" && admin && (
        <WeeklyPrograms
          day={day}
          onDay={setDay}
          coaches={coaches}
          exercises={exercises}
          templates={templates}
          templatesLoading={loading}
          templatesError={loadError}
          profile={profile}
          onChange={() => setVersion((v) => v + 1)}
        />
      )}
      {tab === "archive" && admin && (
        <ProgramArchive
          exercises={exercises}
          onWeek={(date) => {
            setDay(date);
            setTab("programs");
          }}
          onClass={(row) => {
            setDay(seoulDate(row.starts_at));
            setSelected(row.id);
            setTab("classes");
          }}
        />
      )}
      {tab === "members" && (
        <>
          <div className="g-heading">
            <div>
              <h2>그룹 이용 회원</h2>
              <p className="g-muted">
                이용 서비스 배정은 회원 통합 관리에서, 기준 중량과 1RM은 여기서
                관리해요.
              </p>
              {onManageMembers && (
                <button onClick={onManageMembers}>회원 통합 관리로 이동</button>
              )}
            </div>
            <button
              onClick={() => {
                const name = prompt(
                  "새 표준 종목 이름을 입력하세요. 수행 방식이 다르면 별도 종목으로 구분해 주세요.",
                );
                if (name)
                  act(
                    () => rpc("group_add_exercise", { exercise_name: name }),
                    "종목을 추가했어요.",
                  );
              }}
            >
              표준 종목 추가
            </button>
          </div>
          <input
            className="g-search"
            aria-label="그룹 회원 검색"
            placeholder="이름 · 이메일 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="g-member-table">
            {directory
              .filter((p) => p.active)
              .filter((p) =>
                `${p.name} ${p.email}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((p) => (
                <div key={p.id} className="g-member-row">
                  <div>
                    <strong>{p.name || "이름 없음"}</strong>
                    <small>{p.email}</small>
                  </div>
                  <span className={`g-badge ${p.active ? "open" : ""}`}>
                    {p.active ? "이용 중" : "미등록 · 중지"}
                  </span>
                  <button
                    onClick={() => {
                      setBaseline(p);
                      setError("");
                    }}
                  >
                    기준 중량
                  </button>
                  <button
                    onClick={() => {
                      setStrengthMax(p);
                      setError("");
                    }}
                  >
                    1RM 설정
                  </button>
                </div>
              ))}
          </div>
        </>
      )}
      {editing && (
        <ClassEditor
          current={editing.new ? null : editing}
          day={day}
          profile={profile}
          coaches={coaches}
          exercises={exercises}
          templates={templates}
          busy={busy}
          error={error}
          onClose={() => !busy && setEditing(null)}
          onSave={async (payload) => {
            let id;
            if (
              await act(async () => {
                id = await rpc("group_save_class", { payload });
              }, "프로그램을 저장했어요. 공개하면 시간표에 따라 자동으로 진행돼요.")
            ) {
              setEditing(null);
              setDay(seoulDate(payload.starts_at));
              setSelected(id);
            }
          }}
        />
      )}
      {record && c && (
        <RecordEditor
          participant={record}
          c={c}
          exercises={exercises}
          manager
          recommendationOnly={c.status !== "ended"}
          busy={busy}
          error={error}
          onClose={() => !busy && setRecord(null)}
          onSave={async (payload) => {
            if (
              await act(
                () => saveParticipant(record, payload),
                c.status === "ended"
                  ? "운동 기록을 저장했어요."
                  : "추천 중량을 저장했어요.",
              )
            )
              setRecord(null);
          }}
        />
      )}
      {adding && (
        <Dialog title="멤버 입장" onClose={() => !busy && setAdding(false)}>
          <p className="g-muted">
            수업에 참여할 회원을 선택하세요. 입장하면 회원과 코치의 앱에서 추천
            중량을 확인할 수 있어요.
          </p>
          <input
            aria-label="참가자 검색"
            placeholder="이름 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="g-picker">
            {directory
              .filter(
                (p) =>
                  (p.active || admin) &&
                  !detail?.participants.some(
                    (joined) =>
                      joined.user_id === p.id &&
                      ["active", "completed"].includes(joined.status),
                  ) &&
                  `${p.name} ${p.email || ""}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((p) => (
                <label className="g-check" key={p.id}>
                  <input
                    type="checkbox"
                    checked={choices.includes(p.id)}
                    onChange={(e) =>
                      setChoices((prev) =>
                        e.target.checked
                          ? [...prev, p.id]
                          : prev.filter((id) => id !== p.id),
                      )
                    }
                  />
                  <span>
                    {p.name}
                    <small>
                      {p.email || ""} {!p.active ? "· 그룹 미등록" : ""}
                    </small>
                  </span>
                </label>
              ))}
          </div>
          {admin && (
            <label className="g-check">
              <input
                type="checkbox"
                checked={exception}
                onChange={(e) => setException(e.target.checked)}
              />
              그룹 미등록 회원을 이 수업에 한해 허용
            </label>
          )}
          {error && (
            <p className="g-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="g-primary g-full"
            disabled={busy || !choices.length}
            onClick={async () => {
              if (
                await act(
                  () =>
                    rpc("group_join", {
                      cid: c.id,
                      user_ids: choices,
                      allow_exception: exception,
                    }),
                  "선택한 회원을 참가 명단에 반영했어요.",
                )
              )
                setAdding(false);
            }}
          >
            {choices.length}명 입장
          </button>
        </Dialog>
      )}
      {baseline && (
        <Baseline
          member={baseline}
          exercises={exercises}
          busy={busy}
          error={error}
          onClose={() => !busy && setBaseline(null)}
          onSave={async (payload) => {
            if (
              await act(
                () => rpc("group_set_baseline", { payload }),
                "다음 참가부터 사용할 기준 중량을 저장했어요.",
              )
            )
              setBaseline(null);
          }}
        />
      )}
      {strengthMax && (
        <StrengthMax
          member={strengthMax}
          exercises={exercises}
          busy={busy}
          error={error}
          onClose={() => !busy && setStrengthMax(null)}
          onSave={async (payload) => {
            if (
              await act(
                () => rpc("group_set_strength_max", { payload }),
                "1RM을 저장했어요. 다음 운동 시작부터 반영돼요.",
              )
            )
              setStrengthMax(null);
          }}
        />
      )}
      {audit && (
        <Dialog title="최근 변경 이력" onClose={() => setAudit(null)}>
          <div className="g-audit">
            {audit.length ? (
              audit.map((a) => (
                <article key={a.id}>
                  <strong>
                    {{
                      save_program: "프로그램 저장",
                      class_status: "수업 상태 변경",
                      join: "참가 등록",
                      save_record: "기록 · 추천 변경",
                    }[a.action] || a.action}
                  </strong>
                  <p>
                    {seoulDate(a.created_at)} {classTime(a.created_at)}
                  </p>
                  {a.detail?.changes?.reason && (
                    <p>조정 이유: {a.detail.changes.reason}</p>
                  )}
                  {a.detail?.from && (
                    <p>
                      {stateLabels[a.detail.from]} → {stateLabels[a.detail.to]}
                    </p>
                  )}
                </article>
              ))
            ) : (
              <p>변경 이력이 없어요.</p>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}
function Baseline({ member, exercises, busy, error, onSave, onClose }) {
  const [old, setOld] = useState([]);
  useEffect(() => {
    checked(
      supabase.from("group_baselines").select("*").eq("user_id", member.id),
    )
      .then(setOld)
      .catch(() => {});
  }, [member.id]);
  return (
    <Dialog title={`${member.name}님의 기준 중량`} onClose={onClose}>
      <p className="g-muted">
        같은 종목·반복 수·단위·중량 기준·난이도에만 적용돼요. 이미 시작한 수업의
        추천은 바뀌지 않아요.
      </p>
      {old.length > 0 && (
        <details>
          <summary>등록된 기준 {old.length}개</summary>
          {old.map((b, i) => (
            <p key={i}>
              {exercises.find((e) => e.id === b.exercise_id)?.name} ·{" "}
              {b.target_reps}회 · {levels[b.difficulty]} · {b.weight} {b.unit} (
              {b.load_basis === "each" ? "한 손" : "총중량"})
            </p>
          ))}
        </details>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          onSave({ ...f, user_id: member.id });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            종목
            <select name="exercise_id" required>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <div className="g-fields">
            <label>
              목표 반복 수
              <input
                name="target_reps"
                type="number"
                min="1"
                max="1000"
                defaultValue="8"
                required
              />
            </label>
            <label>
              중량
              <input
                name="weight"
                type="number"
                min="0"
                max="2000"
                step="any"
                required
              />
            </label>
            <label>
              단위
              <select name="unit">
                <option>kg</option>
                <option>lb</option>
              </select>
            </label>
          </div>
          <div className="g-fields">
            <label>
              중량 기준
              <select name="load_basis">
                <option value="total">바 포함 총중량</option>
                <option value="each">덤벨 한 손 기준</option>
              </select>
            </label>
            <label>
              난이도
              <select name="difficulty" defaultValue="standard">
                {Object.entries(levels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            기준 설정 근거
            <input
              name="reason"
              required
              maxLength="300"
              placeholder="예: 코치가 8회 수행과 자세 확인"
            />
          </label>
          {error && (
            <p role="alert" className="g-error">
              {error}
            </p>
          )}
          <button className="g-primary g-full">기준 저장</button>
        </fieldset>
      </form>
    </Dialog>
  );
}
