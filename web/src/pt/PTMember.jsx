import PassLedger from "./PassLedger.jsx";
import { currentBalance, passUsage, passLabel } from "./passes.js";
import { koreaDate, koreaTime } from "./dates.js";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked, loadPT } from "./api.js";
import { today, statusLabels } from "./model.js";
import { Calendar, SimpleLog } from "./Calendar.jsx";
import { ProgressSummary, TrainingProgress } from "./TrainingProgress.jsx";
import "./PT.css";
import "./Calendar.css";
export default function PTMember({ profile }) {
  const [data, setData] = useState(null),
    [slots, setSlots] = useState([]),
    [day, setDay] = useState(today()),
    [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [choice, setChoice] = useState(null),
    [editing, setEditing] = useState(null),
    [tab, setTab] = useState("booking"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    (async () => {
      const m = await checked(
        supabase
          .from("pt_members")
          .select("*")
          .eq("profile_id", profile.id)
          .maybeSingle(),
      );
      if (!m?.active) {
        if (live) setData({ member: m });
        return;
      }
      const [d, s] = await Promise.all([
        loadPT(m.id),
        checked(supabase.rpc("pt_open_slots", { mid: m.id })),
      ]);
      if (live) {
        setData({ member: m, ...d });
        setSlots(s);
      }
    })().catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [profile.id, version]);
  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1),
      timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  async function book() {
    if (lock.current || !choice) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await checked(
        editing
          ? supabase.rpc("pt_change_booking", {
              sid: editing.id,
              target_slot: choice.id,
            })
          : supabase.rpc("pt_book_slot", { slot: choice.id }),
      );
      setMessage(
        `${koreaDate(choice.starts_at)} ${koreaTime(choice.starts_at)} ${editing ? "예약을 변경했어요" : "예약이 완료됐어요"}.`,
      );
      setChoice(null);
      setEditing(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
      setChoice(null);
      setVersion((v) => v + 1);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function startChange(s) {
    setEditing(s);
    setChoice(null);
    setTab("booking");
    setDay(s.session_date);
    setMessage("");
    setError("");
  }
  async function cancel(s) {
    if (
      lock.current ||
      !window.confirm(
        `${s.session_date} ${s.start_time.slice(0, 5)} 수업을 취소할까요? 횟수는 차감되지 않아요.`,
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await checked(
        supabase.rpc("pt_change_booking", { sid: s.id, target_slot: null }),
      );
      setMessage("예약을 취소했어요. 횟수는 그대로 유지돼요.");
      setEditing(null);
      setChoice(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
      setVersion((v) => v + 1);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const canChange = (s) =>
    new Date(`${s.session_date}T${s.start_time}+09:00`).getTime() >
    Date.now() + 3600000;
  const sessions = data?.sessions || [],
    completed = sessions.filter((s) => s.status === "completed"),
    scheduled = sessions.filter((s) => s.status === "scheduled"),
    remaining = currentBalance(data?.packages || [], sessions),
    available = (data?.packages || []).reduce(
      (n, p) => n + passUsage(p, sessions, day).available,
      0,
    ),
    next = scheduled
      .filter(
        (s) =>
          new Date(`${s.session_date}T${s.start_time}+09:00`).getTime() +
            (s.duration_minutes || 60) * 60000 >
          Date.now(),
      )
      .sort((a, b) =>
        (a.session_date + a.start_time).localeCompare(
          b.session_date + b.start_time,
        ),
      )[0];
  const eligibleSlots = slots.filter((slot) => {
    const date = koreaDate(slot.starts_at);
    return (data?.packages || []).some((p) =>
      editing
        ? p.id === editing.package_id &&
          p.starts_on <= date &&
          (!p.expires_on || p.expires_on >= date)
        : passUsage(p, sessions, date).available > 0,
    );
  });
  return (
    <main className="pt pt-shell simple-pt">
      <header className="member-intro">
        <p>PERSONAL TRAINING</p>
        <h1>{profile.full_name || "회원"}님의 PT</h1>
        <p>담당 코치 · {profile.coach_name || "미배정"}</p>
      </header>
      {error && (
        <p className="pt-error" role="alert">
          {error}
          <button onClick={() => setVersion((v) => v + 1)}>새로고침</button>
        </p>
      )}
      {message && (
        <p className="pt-success" role="status">
          {message}
        </p>
      )}
      {!data ? (
        <p>수업을 불러오는 중…</p>
      ) : !data.member?.active ? (
        <p>관리자의 PT 배정을 기다리고 있어요.</p>
      ) : (
        <>
          <section className="next-session">
            <span>다음 수업</span>
            <strong>
              {next
                ? `${next.session_date} · ${next.start_time.slice(0, 5)}`
                : "아래에서 다음 수업을 예약하세요"}
            </strong>
            <small>남은 수업 {remaining}회</small>
            <button
              onClick={() => {
                setTab("booking");
                setDay(next?.session_date || today());
                setChoice(null);
                setEditing(null);
              }}
            >
              {next ? "예약 일정 보기" : "수업 예약하기"}
            </button>
          </section>
          <nav className="sub-tabs detail-tabs" aria-label="PT 메뉴">
            <button
              className={tab === "booking" ? "selected" : ""}
              aria-pressed={tab === "booking"}
              onClick={() => setTab("booking")}
            >
              수업 예약
            </button>
            <button
              className={tab === "history" ? "selected" : ""}
              aria-pressed={tab === "history"}
              onClick={() => {
                setTab("history");
                setChoice(null);
                setEditing(null);
              }}
            >
              운동 기록
            </button>
            <button
              className={tab === "passes" ? "selected" : ""}
              aria-pressed={tab === "passes"}
              onClick={() => {
                setTab("passes");
                setEditing(null);
                setChoice(null);
              }}
            >
              이용 내역
            </button>
          </nav>
          {tab === "history" && (
            <ProgressSummary
              sessions={sessions}
              month={month}
              onSelect={setDay}
            />
          )}
          {tab === "booking" && editing && (
            <section className="change-booking" role="status">
              <strong>변경할 날짜와 시간을 선택하세요</strong>
              <span>
                기존 예약 · {editing.session_date}{" "}
                {editing.start_time.slice(0, 5)}
              </span>
              <small>새 시간을 확정할 때까지 기존 예약이 유지돼요.</small>
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setChoice(null);
                }}
              >
                변경 그만하기
              </button>
            </section>
          )}
          {tab !== "passes" && (
            <Calendar
              value={day}
              onChange={(d) => {
                setDay(d);
                setChoice(null);
              }}
              onMonthChange={setMonth}
              completedDates={completed.map((s) => s.session_date)}
              scheduledDates={scheduled.map((s) => s.session_date)}
              dates={eligibleSlots.map((s) => koreaDate(s.starts_at))}
              label={tab === "booking" ? "예약 캘린더" : "운동 기록 캘린더"}
            />
          )}
          {tab === "passes" ? (
            <PassLedger packages={data.packages} sessions={sessions} />
          ) : tab === "booking" ? (
            <>
              <section className="pt-card">
                <h2>{day} 예약</h2>
                {scheduled
                  .filter((s) => s.session_date === day)
                  .map((s) => (
                    <div className="booked-time" key={s.id}>
                      <strong>{s.start_time.slice(0, 5)} · 예약 완료</strong>
                      <div className="pt-row">
                        <button
                          disabled={busy || !canChange(s)}
                          onClick={() => startChange(s)}
                        >
                          예약 변경
                        </button>
                        <button
                          disabled={busy || !canChange(s)}
                          onClick={() => cancel(s)}
                        >
                          예약 취소
                        </button>
                      </div>
                      {!canChange(s) && (
                        <small>
                          시작 1시간 이내 변경·취소는 코치에게 문의해 주세요.
                        </small>
                      )}
                    </div>
                  ))}
                {!data.member.coach_id ? (
                  <p>담당 코치 배정 후 예약할 수 있어요.</p>
                ) : available <= 0 && !editing ? (
                  <p>
                    선택한 날짜에 예약 가능한 횟수권이 없거나, 남은 횟수만큼
                    예약되어 있어요. 이용 내역을 확인해 주세요.
                  </p>
                ) : (
                  <>
                    <div className="booking-slots">
                      {eligibleSlots
                        .filter((s) => koreaDate(s.starts_at) === day)
                        .map((s) => (
                          <button
                            key={s.id}
                            aria-pressed={choice?.id === s.id}
                            className={choice?.id === s.id ? "selected" : ""}
                            onClick={() => setChoice(s)}
                          >
                            {koreaTime(s.starts_at)}
                          </button>
                        ))}
                    </div>
                    {!eligibleSlots.some(
                      (s) => koreaDate(s.starts_at) === day,
                    ) && (
                      <p className="pt-muted">
                        열린 시간이 없어요. 다른 날짜를 선택해 주세요.
                      </p>
                    )}
                    {choice && (
                      <div className="booking-confirm">
                        <strong>
                          {koreaTime(choice.starts_at)}–
                          {koreaTime(choice.ends_at)}
                        </strong>
                        <button
                          className="pt-primary"
                          disabled={busy}
                          onClick={book}
                        >
                          {busy
                            ? "처리 중…"
                            : editing
                              ? "이 시간으로 변경"
                              : "이 시간으로 예약"}
                        </button>
                        <small>
                          예약 시 차감되지 않아요. 코치가 운동 완료를 누르면 1회
                          차감돼요.
                        </small>
                      </div>
                    )}
                  </>
                )}
                <p className="pt-muted">
                  시작 1시간 전까지 직접 변경·취소할 수 있어요. 이후에는 담당
                  코치에게 문의해 주세요.
                </p>
              </section>
            </>
          ) : (
            <section className="member-content tracking-content">
              <section className="pt-card day-workouts">
                <h2>{day} 운동</h2>
                {!sessions.some(
                  (s) => s.session_date === day && s.status !== "cancelled",
                ) && (
                  <p className="pt-muted">
                    이 날의 운동 기록이 없어요. ✓ 표시된 날짜를 눌러보세요.
                  </p>
                )}
                {sessions
                  .filter(
                    (s) => s.session_date === day && s.status !== "cancelled",
                  )
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((s) => (
                    <article className="tracked-session" key={s.id}>
                      <div className="pt-row pt-between">
                        <strong>{s.start_time.slice(0, 5)}</strong>
                        <span
                          className={`pt-badge ${s.status === "completed" ? "badge-done" : ""}`}
                        >
                          {s.status === "completed"
                            ? "운동 완료 ✓"
                            : statusLabels[s.status]}
                        </span>
                      </div>
                      <p className="pass-session-label">
                        {passLabel(data.packages, s.package_id)} ·{" "}
                        {s.status === "completed" ? "1회 사용" : "차감 없음"}
                      </p>
                      <details>
                        <summary>운동 내용 보기</summary>
                        <SimpleLog session={s} />
                      </details>
                    </article>
                  ))}
              </section>
              <TrainingProgress
                sessions={sessions}
                month={month}
                onSelect={setDay}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}
