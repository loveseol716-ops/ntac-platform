import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked, loadPT } from "./api.js";
import { today, statusLabels } from "./model.js";
import { Calendar, SimpleLog } from "./Calendar.jsx";
import PassLedger from "./PassLedger.jsx";
import { currentBalance, passLabel } from "./passes.js";
import "./PT.css";
import "./Calendar.css";
export default function PTAdmin({
  initialMemberId,
  isAdmin = true,
  initialDate = today(),
  startNew = false,
}) {
  const [data, setData] = useState(null),
    [person, setPerson] = useState(null),
    [day, setDay] = useState(initialDate),
    [draft, setDraft] = useState(
      startNew
        ? {
            id: crypto.randomUUID(),
            member_id: initialMemberId,
            session_date: initialDate,
            start_time: "10:00",
            warm_up: "",
            main: "",
            notes: "",
          }
        : null,
    ),
    [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    (async () => {
      const m = await checked(
        supabase
          .from("pt_members")
          .select("*")
          .eq("id", initialMemberId)
          .single(),
      );
      const [p, d] = await Promise.all([
        checked(
          supabase
            .from("profiles")
            .select("id,full_name")
            .eq("id", m.profile_id)
            .single(),
        ),
        loadPT(m.id),
      ]);
      if (live) {
        setData(d);
        setPerson(p);
      }
    })().catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [initialMemberId, version]);
  async function act(fn, msg = "저장했어요.") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
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
  function edit(s) {
    setDraft(
      s
        ? { ...s }
        : {
            id: crypto.randomUUID(),
            member_id: initialMemberId,
            session_date: day,
            start_time: "10:00",
            warm_up: "",
            main: "",
            notes: "",
          },
    );
    setError("");
  }
  function changeDay(d) {
    if (draft && !window.confirm("작성 중인 내용을 닫고 날짜를 변경할까요?"))
      return;
    setDraft(null);
    setDay(d);
  }
  async function status(s, value) {
    if (
      value === "cancelled" &&
      !window.confirm("이 수업을 취소할까요? 횟수는 차감되지 않습니다.")
    )
      return;
    if (
      value === "scheduled" &&
      !window.confirm("완료를 취소하고 1회를 복구할까요?")
    )
      return;
    await act(
      () =>
        checked(
          supabase.rpc("pt_set_session_status", {
            sid: s.id,
            new_status: value,
          }),
        ),
      value === "completed"
        ? "운동 완료! 1회 차감했어요."
        : value === "scheduled"
          ? "완료를 취소하고 1회를 복구했어요."
          : "수업을 취소했어요.",
    );
  }
  const next = data?.sessions
      .filter(
        (s) =>
          s.status === "scheduled" &&
          new Date(`${s.session_date}T${s.start_time}+09:00`).getTime() +
            (s.duration_minutes || 60) * 60000 >
            Date.now(),
      )
      .sort((a, b) =>
        (a.session_date + a.start_time).localeCompare(
          b.session_date + b.start_time,
        ),
      )[0],
    remaining = currentBalance(data?.packages || [], data?.sessions || []);
  return (
    <section className="pt simple-pt">
      <header className="pt-row pt-between">
        <div>
          <p className="pt-eyebrow">PERSONAL TRAINING</p>
          <h1>{person?.full_name || "회원"}님의 PT</h1>
        </div>
        <strong className="balance-pill">{remaining}회 남음</strong>
      </header>
      {error && (
        <p role="alert" className="pt-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="pt-success">
          {message}
        </p>
      )}
      {!data ? (
        <p>수업을 불러오는 중…</p>
      ) : (
        <>
          <section className="next-session">
            <span>다음 수업</span>
            <strong>
              {next
                ? `${next.session_date} · ${next.start_time.slice(0, 5)}`
                : "아직 예약된 수업이 없어요"}
            </strong>
            {next && (
              <button onClick={() => changeDay(next.session_date)}>
                일정 보기
              </button>
            )}
          </section>
          <div className="calendar-layout">
            <Calendar
              value={day}
              onChange={changeDay}
              completedDates={data.sessions
                .filter((s) => s.status === "completed")
                .map((s) => s.session_date)}
              scheduledDates={data.sessions
                .filter((s) => s.status === "scheduled")
                .map((s) => s.session_date)}
            />
            <section className="day-agenda">
              <div className="pt-row pt-between">
                <h2>{day.slice(5).replace("-", "월 ")}일</h2>
                <button
                  className="pt-primary"
                  disabled={busy || !!draft}
                  onClick={() => edit()}
                >
                  수업 추가
                </button>
              </div>
              {draft ? (
                <form
                  className="pt-card log-editor"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await act(() =>
                        checked(
                          supabase.rpc("pt_save_simple_session", {
                            payload: draft,
                          }),
                        ),
                      )
                    )
                      setDraft(null);
                  }}
                >
                  <h2>
                    {data.sessions.some((s) => s.id === draft.id)
                      ? "운동 일지"
                      : "수업 추가"}
                  </h2>
                  {!data.sessions.some((s) => s.id === draft.id) && (
                    <label>
                      수업 시간
                      <input
                        type="time"
                        required
                        value={draft.start_time}
                        onChange={(e) =>
                          setDraft({ ...draft, start_time: e.target.value })
                        }
                      />
                      <small>수업은 60분으로 등록돼요.</small>
                    </label>
                  )}
                  {[
                    [
                      "warm_up",
                      "Warm-up",
                      "워밍업 내용을 자유롭게 작성하세요.",
                    ],
                    ["main", "Main", "오늘 진행할 운동을 자유롭게 작성하세요."],
                    [
                      "notes",
                      "특이사항",
                      "컨디션이나 기억할 사항을 적어주세요.",
                    ],
                  ].map(([k, l, p]) => (
                    <label key={k}>
                      {l}
                      <textarea
                        rows={k === "main" ? 6 : 3}
                        placeholder={p}
                        value={draft[k] || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, [k]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <p className="pt-muted">
                    수업 전·후 언제든 작성할 수 있어요. 모든 내용은 선택사항이며
                    회원에게도 보여요.
                  </p>
                  <div className="pt-row">
                    <button className="pt-primary" disabled={busy}>
                      저장
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDraft(null)}
                    >
                      닫기
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {!data.sessions.some((s) => s.session_date === day) && (
                    <div className="agenda-empty">
                      등록된 수업이 없어요.
                      <br />
                      수업 추가를 누르거나 회원의 예약을 기다려주세요.
                    </div>
                  )}
                  {data.sessions
                    .filter((s) => s.session_date === day)
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((s) => (
                      <article className="pt-card" key={s.id}>
                        <div className="pt-row pt-between">
                          <h3>
                            {s.start_time.slice(0, 5)} · {person?.full_name}
                          </h3>
                          <span className="pt-badge">
                            {statusLabels[s.status]}
                          </span>
                        </div>
                        <p className="pass-session-label">
                          {passLabel(data.packages, s.package_id)} ·{" "}
                          {s.status === "completed" ? "1회 사용" : "차감 없음"}
                        </p>
                        <SimpleLog session={s} />
                        {s.status === "scheduled" && (
                          <p className="pt-muted">
                            일지 없이도 운동 완료를 누를 수 있어요.
                          </p>
                        )}
                        <div className="pt-row session-actions">
                          <button disabled={busy} onClick={() => edit(s)}>
                            일지 작성
                          </button>
                          {s.status === "scheduled" && (
                            <>
                              <button
                                className="pt-primary"
                                disabled={
                                  busy ||
                                  new Date(
                                    `${s.session_date}T${s.start_time}+09:00`,
                                  ) > new Date()
                                }
                                onClick={() => status(s, "completed")}
                              >
                                운동 완료
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => status(s, "cancelled")}
                              >
                                예약 취소
                              </button>
                            </>
                          )}
                          {s.status === "completed" && (
                            <button
                              disabled={busy}
                              onClick={() => status(s, "scheduled")}
                            >
                              완료 취소
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                </>
              )}
            </section>
          </div>
          <PassLedger
            packages={data.packages}
            sessions={data.sessions}
            memberId={initialMemberId}
            editable={isAdmin}
            onSaved={() => {
              setVersion((v) => v + 1);
              setMessage("횟수권을 저장했어요.");
            }}
          />
        </>
      )}
    </section>
  );
}
