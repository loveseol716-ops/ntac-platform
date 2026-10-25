import { timedClass, useClassClock } from "./classClock.js";
import MemberCalendar from "./MemberCalendar.jsx";
import WeeklyOverview from "./WeeklyOverview.jsx";
import HistoryRecord from "./HistoryRecord.jsx";
import TrainingJourney, {
  TrainingContext,
  TrainingPositionBar,
} from "./TrainingJourney.jsx";
import { trainingClass } from "./trainingCycle.js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  rpc,
  listClasses,
  listExercises,
  loadDetail,
  saveParticipant,
  history,
  listWeeks,
} from "./api.js";
import {
  seoulDate,
  classTime,
  stateLabels,
  participantLabels,
  resultText,
  movementLabel,
  groupStats,
  programVisibleFrom,
} from "./model.js";
import {
  ClassCard,
  Program,
  Recommendations,
  RecordEditor,
} from "./shared.jsx";
import "./Groups.css";
export default function GroupMember({ profile }) {
  const now = useClassClock();
  const [tab, setTab] = useState("today"),
    [minDay, setMinDay] = useState(programVisibleFrom()),
    [historyRecord, setHistoryRecord] = useState(null),
    [view, setView] = useState("month"),
    [day, setDay] = useState(seoulDate()),
    [classes, setClasses] = useState([]),
    [exercises, setExercises] = useState([]),
    [records, setRecords] = useState([]),
    [membership, setMembership] = useState(null),
    [weeks, setWeeks] = useState([]);
  const [selected, setSelected] = useState(
      new URLSearchParams(location.search).get("class"),
    ),
    [detail, setDetail] = useState(null),
    [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    if (day < minDay) setDay(minDay);
  }, [day, minDay]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    Promise.all([
      listClasses(day, "month"),
      listExercises(),
      history(),
      rpc("group_bootstrap"),
      listWeeks(day),
    ])
      .then(([cs, es, rs, ctx, ws]) => {
        if (live) {
          setClasses(cs);
          setWeeks(ws);
          setExercises(es);
          setRecords(rs);
          setMembership(ctx.member);
          setMinDay(ctx.program_visible_from || programVisibleFrom());
        }
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [day, profile.id, version]);
  useEffect(() => {
    let live = true;
    const refresh = () =>
      Promise.all([
        listClasses(day, "month"),
        history(),
        listWeeks(day),
        rpc("group_bootstrap"),
      ])
        .then(([cs, rs, ws, ctx]) => {
          if (live) {
            setClasses(cs);
            setWeeks(ws);
            setRecords(rs);
            setMinDay(ctx.program_visible_from || programVisibleFrom());
          }
        })
        .catch((e) => {
          if (live) {
            setDetail(null);
            setError(e.message);
          }
        });
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [day, profile.id]);
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
        .catch((e) => {
          if (live) {
            setDetail(null);
            setError(e.message);
          }
        });
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [selected, version]);
  async function act(fn, msg) {
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
    p = detail?.participants.find((p) => p.user_id === profile.id),
    stats = groupStats(records);
  const canEdit =
    p &&
    !p.finalized &&
    c?.status === "ended" &&
    (!c?.ended_at || now < new Date(c.ended_at).getTime() + 86400000) &&
    ["active", "completed"].includes(p.status);
  const openTab = (next) => {
    setTab(next);
    setSelected(null);
    setEditing(null);
    setError("");
    setMessage("");
  };
  return (
    <main className="groups g-member" aria-label="그룹수업">
      {!selected && (tab === "today" || (tab === "programs" && weeks.some((w) => w.status === "published"))) && (
        <TrainingPositionBar date={tab === "programs" ? day : undefined} onOpen={() => openTab("journey")} />
      )}
      <nav className="g-tabs g-member-tabs" aria-label="그룹수업 메뉴">
        {[
          ["today", "수업 캘린더"],
          ["programs", "주간 프로그램"],
          ["history", "나의 기록"],
          ["journey", "트레이닝 여정"],
        ].map(([k, v]) => (
          <button
            key={k}
            className={tab === k ? "selected" : ""}
            aria-current={tab === k ? "page" : undefined}
            onClick={() => openTab(k)}
          >
            {v}
          </button>
        ))}
      </nav>
      {error && (
        <div className="g-error" role="alert">
          {error}
          <button onClick={() => setVersion((v) => v + 1)}>
            다시 불러오기
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="g-success">
          {message}
        </p>
      )}
      {historyRecord && (
        <HistoryRecord
          record={historyRecord}
          onClose={() => setHistoryRecord(null)}
        />
      )}
      {loading && selected && (
        <p className="g-muted" role="status">
          수업을 불러오고 있어요.
        </p>
      )}
      {selected ? (
        <>
          <button
            className="g-back"
            onClick={() => {
              setSelected(null);
              setEditing(null);
            }}
          >
            ← 목록으로
          </button>
          {c && (
            <>
              <div className="g-heading">
                <p>
                  {seoulDate(c.starts_at)} · {classTime(c.starts_at)}
                </p>
                <span className={`g-badge ${c.status}`}>
                  {stateLabels[c.status]}
                </span>
              </div>
              <h2 className="g-member-class-title">{c.title}</h2>
              {(!p || ["planned", "left", "cancelled"].includes(p.status)) &&
                ["open", "live"].includes(c.status) &&
                (membership?.active ||
                  (p?.status === "planned" && p.exception_access)) && (
                  <button
                    className="g-primary g-full"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => rpc("group_join", { cid: c.id }),
                        "수업에 참여했어요. 추천 중량을 확인해 주세요.",
                      )
                    }
                  >
                    수업 참여
                  </button>
                )}
              {!p &&
                (!membership?.active ||
                  !["open", "live"].includes(c.status)) && (
                  <p className="g-empty">
                    {!membership?.active
                      ? "그룹 이용 권한을 코치에게 확인해 주세요."
                      : "수업 시작 30분 전부터 종료 시간까지 참여할 수 있어요."}
                  </p>
                )}
              {p && c.status === "ended" && (
                <>
                  <section className="g-panel">
                    <div className="g-heading">
                      <h3>수업 후 기록</h3>
                      <span className="g-badge">
                        {p.status === "active"
                          ? "기록 대기"
                          : participantLabels[p.status]}
                      </span>
                    </div>
                    <p className="g-muted">
                      실제로 수행한 중량과 횟수를 남겨 주세요. 종료 후
                      24시간까지 수정할 수 있어요.
                    </p>
                    {c.movements.map((m) => (
                      <div key={m.id} className="g-recommendation">
                        <span>{movementLabel(m, exercises)}</span>
                        <strong>{resultText(m, p.results?.[m.id])}</strong>
                      </div>
                    ))}
                    {p.session_rpe != null && (
                      <p>
                        수업 전체 RPE <strong>{p.session_rpe}/10</strong>
                      </p>
                    )}
                    {p.status === "planned" && (
                      <p className="g-muted">
                        입장하지 않은 수업이에요. 참여했다면 코치에게 확인해
                        주세요.
                      </p>
                    )}
                    {p.finalized && (
                      <p className="g-muted">코치가 확정한 기록이에요.</p>
                    )}
                    {canEdit && (
                      <div className="g-actions">
                        <button
                          className="g-primary"
                          onClick={() => setEditing(p)}
                        >
                          기록 입력
                        </button>
                      </div>
                    )}
                    {p.status === "active" && c.status !== "cancelled" && (
                      <button
                        className="g-text-button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              "완료하지 않고 운동을 중단할까요? 입력한 기록은 보관돼요.",
                            )
                          )
                            act(
                              () => saveParticipant(p, { status: "left" }),
                              "중도 종료로 기록했어요.",
                            );
                        }}
                      >
                        중도 종료
                      </button>
                    )}
                  </section>
                </>
              )}
              {p &&
                ["active", "completed"].includes(p.status) &&
                c.status !== "cancelled" && (
                  <>
                    <Recommendations
                      participant={p}
                      c={c}
                      exercises={exercises}
                    />
                    {["open", "live"].includes(c.status) && (
                      <p className="g-auto-flow">
                        추천 중량을 확인하고 운동하세요. 기록은 수업 종료 후
                        입력해 주세요.
                      </p>
                    )}
                  </>
                )}
              <TrainingContext
                date={c.starts_at}
                classType={trainingClass(c)}
                label="이 수업의 위치"
              />
              <Program c={c} exercises={exercises} />
              {editing && p && (
                <RecordEditor
                  participant={editing}
                  c={c}
                  exercises={exercises}
                  busy={busy}
                  error={error}
                  onClose={() => !busy && setEditing(null)}
                  onSave={async (payload) => {
                    if (
                      await act(
                        () => saveParticipant(editing, payload),
                        "운동 기록을 저장했어요.",
                      )
                    )
                      setEditing(null);
                  }}
                />
              )}
            </>
          )}
        </>
      ) : tab === "today" ? (
        <>
          <MemberCalendar
            day={day}
            onDay={setDay}
            view={view}
            onView={setView}
            classes={classes}
            records={records}
            onSelect={setSelected}
            onPrograms={() => setTab("programs")}
            loading={loading}
            minDay={minDay}
          />
        </>
      ) : tab === "programs" ? (
        <WeeklyOverview
          key={day}
          day={day}
          onDay={setDay}
          weeks={weeks}
          exercises={exercises}
          onSchedule={() => setTab("today")}
          loading={loading}
          minDay={minDay}
        />
      ) : tab === "history" ? (
        <>
          <h2>나의 운동 기록</h2>
          <div className="g-summary">
            <span>
              <b>{stats.sessions}</b> 완료한 수업
            </span>
            <span>
              <b>{stats.days}</b> 운동한 날
            </span>
          </div>
          <p className="g-muted">
            최근 200개 참가 기록 · 운동 완료한 수업만 횟수에 포함돼요.
          </p>
          {!records.length && (
            <div className="g-empty">
              첫 수업을 시작하면 여기에 기록이 쌓여요.
            </div>
          )}
          {records
            .filter((r) => r.group_classes)
            .map((r) => (
              <ClassCard
                key={r.id}
                c={r.group_classes}
                joined={r}
                actionLabel="기록 보기"
                onClick={() =>
                  r.group_classes.program_hidden ||
                  seoulDate(r.group_classes.starts_at) < minDay
                    ? setHistoryRecord(r)
                    : setSelected(r.class_id)
                }
              />
            ))}
        </>
      ) : (
        <TrainingJourney />
      )}
    </main>
  );
}
