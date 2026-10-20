import WeekCalendar from "./WeekCalendar.jsx";
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
} from "./model.js";
import {
  ClassCard,
  Program,
  Recommendations,
  RecordEditor,
} from "./shared.jsx";
import "./Groups.css";
export default function GroupMember({ profile }) {
  const [tab, setTab] = useState("today"),
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
  const [nickname, setNickname] = useState(""),
    [visible, setVisible] = useState(false),
    lock = useRef(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    Promise.all([
      listClasses(day),
      listExercises(),
      history(profile.id),
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
          setNickname(ctx.member?.nickname || "");
          setVisible(!!ctx.member?.show_on_tv);
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
      Promise.all([listClasses(day), history(profile.id), listWeeks(day)])
        .then(([cs, rs, ws]) => {
          if (live) {
            setClasses(cs);
            setWeeks(ws);
            setRecords(rs);
          }
        })
        .catch((e) => live && setError(e.message));
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
        .catch((e) => live && setError(e.message));
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
  const c = detail?.class,
    p = detail?.participants.find((p) => p.user_id === profile.id),
    stats = groupStats(records);
  const canEdit =
    p &&
    !p.finalized &&
    ["open", "live", "ended"].includes(c?.status) &&
    (!c?.ended_at || Date.now() < new Date(c.ended_at).getTime() + 86400000) &&
    ["active", "completed"].includes(p.status);
  return (
    <main className="groups g-member">
      <header className="g-hero">
        <p className="g-kicker">GROUP TRAINING</p>
        <h1>{profile.full_name?.split(" ")[0] || "회원"}님의 오늘 운동</h1>
        <p>함께 운동하고, 나의 성장을 기록하세요.</p>
        <div className="g-summary">
          <span>
            <b>{stats.sessions}</b> 완료한 수업
          </span>
          <span>
            <b>{stats.days}</b> 운동한 날
          </span>
        </div>
      </header>
      <nav className="g-tabs" aria-label="그룹수업 메뉴">
        {[
          ["today", "오늘 · 일정"],
          ["history", "나의 기록"],
          ["settings", "TV 표시"],
        ].map(([k, v]) => (
          <button
            key={k}
            className={tab === k ? "selected" : ""}
            onClick={() => {
              setTab(k);
              setSelected(null);
              setEditing(null);
              setError("");
            }}
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
      {loading && (
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
              <Program c={c} exercises={exercises} />
              {p && (
                <>
                  <Recommendations
                    participant={p}
                    c={c}
                    exercises={exercises}
                  />
                  <section className="g-panel">
                    <div className="g-heading">
                      <h3>나의 기록</h3>
                      <span className="g-badge">
                        {participantLabels[p.status]}
                      </span>
                    </div>
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
                        참가 예정이에요. 당일 접수가 열리면 오늘 운동 시작을
                        눌러 주세요.
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
                        {p.status === "active" && (
                          <button disabled={busy} onClick={() => setEditing(p)}>
                            운동 마무리 · RPE
                          </button>
                        )}
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
                        "오늘 운동을 시작했어요.",
                      )
                    }
                  >
                    오늘 운동 시작
                  </button>
                )}
              {!p &&
                (!membership?.active ||
                  !["open", "live"].includes(c.status)) && (
                  <p className="g-empty">
                    {!membership?.active
                      ? "그룹 이용 권한을 코치에게 확인해 주세요."
                      : "코치가 당일 참가 접수를 열면 운동을 시작할 수 있어요."}
                  </p>
                )}
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
          <h2>이번 주 프로그램 · 수업</h2>
          <p className="g-muted">
            예약과 공식 출석은 운톡에서, 운동 프로그램과 기록은 여기에서
            확인해요.
          </p>
          <WeekCalendar
            day={day}
            onDay={setDay}
            classes={classes}
            records={records}
            onSelect={setSelected}
            weeks={weeks}
            exercises={exercises}
          />
        </>
      ) : tab === "history" ? (
        <>
          <h2>나의 운동 기록</h2>
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
                onClick={() => setSelected(r.class_id)}
              />
            ))}
        </>
      ) : (
        <section className="g-panel">
          <h2>TV에 표시할 이름</h2>
          <p className="g-muted">
            동의한 회원의 별명·추천·운동 결과만 체육관 TV에 표시돼요. 공개하지
            않아도 개인 기록은 남아요.
          </p>
          <label>
            별명
            <input
              maxLength="30"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="운동할 때 불릴 이름"
            />
          </label>
          <label className="g-check">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
            />
            체육관 TV에 내 별명과 운동 결과 표시
          </label>
          <button
            className="g-primary"
            disabled={busy || !membership}
            onClick={() =>
              act(
                () =>
                  rpc("group_set_privacy", { display_name: nickname, visible }),
                "TV 표시 설정을 저장했어요.",
              )
            }
          >
            설정 저장
          </button>
        </section>
      )}
    </main>
  );
}
