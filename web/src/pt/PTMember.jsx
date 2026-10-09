import { koreaDate, koreaTime } from "./dates.js";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked, loadPT } from "./api.js";
import { today, statusLabels } from "./model.js";
import { Calendar, SimpleLog } from "./Calendar.jsx";
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
    [tab, setTab] = useState("booking"),
    [message, setMessage] = useState("");
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
    if (busy || !choice) return;
    setBusy(true);
    setError("");
    try {
      await checked(supabase.rpc("pt_book_slot", { slot: choice.id }));
      setMessage(
        `${koreaDate(choice.starts_at)} ${koreaTime(choice.starts_at)} 예약이 완료됐어요.`,
      );
      setChoice(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
      setChoice(null);
      setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }
  const sessions = data?.sessions || [],
    completed = sessions.filter((s) => s.status === "completed"),
    scheduled = sessions.filter((s) => s.status === "scheduled"),
    remaining =
      (data?.packages || []).reduce((n, p) => n + p.total_sessions, 0) -
      completed.length,
    available = remaining - scheduled.length,
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
            <small>
              남은 수업 {remaining}회 · 예약 {scheduled.length}회
            </small>
          </section>
          <nav className="sub-tabs detail-tabs" aria-label="PT 메뉴">
            <button
              className={tab === "booking" ? "selected" : ""}
              onClick={() => setTab("booking")}
            >
              수업 예약
            </button>
            <button
              className={tab === "history" ? "selected" : ""}
              onClick={() => setTab("history")}
            >
              운동 일지
            </button>
          </nav>
          {tab === "booking" ? (
            <>
              <Calendar
                value={day}
                onChange={(d) => {
                  setDay(d);
                  setChoice(null);
                }}
                dates={[
                  ...slots.map((s) => koreaDate(s.starts_at)),
                  ...scheduled.map((s) => s.session_date),
                ]}
                label="예약 캘린더"
              />
              <section className="pt-card">
                <h2>{day} 예약</h2>
                {scheduled
                  .filter((s) => s.session_date === day)
                  .map((s) => (
                    <p className="booked-time" key={s.id}>
                      ✓ {s.start_time.slice(0, 5)} 예약 완료
                    </p>
                  ))}
                {!data.member.coach_id ? (
                  <p>담당 코치 배정 후 예약할 수 있어요.</p>
                ) : available <= 0 ? (
                  <p>
                    남은 횟수만큼 예약되어 있어요. 추가 예약은 코치에게 문의해
                    주세요.
                  </p>
                ) : (
                  <>
                    <div className="booking-slots">
                      {slots
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
                    {!slots.some((s) => koreaDate(s.starts_at) === day) && (
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
                          {busy ? "예약 중…" : "이 시간으로 예약"}
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
                  예약 변경·취소는 담당 코치에게 요청해 주세요.
                </p>
              </section>
            </>
          ) : (
            <section className="member-content">
              {!sessions.length && (
                <p className="agenda-empty">아직 수업 기록이 없어요.</p>
              )}
              {sessions.map((s) => (
                <article className="pt-card" key={s.id}>
                  <div className="pt-row pt-between">
                    <h2>
                      {s.session_date} · {s.start_time.slice(0, 5)}
                    </h2>
                    <span className="pt-badge">{statusLabels[s.status]}</span>
                  </div>
                  <SimpleLog session={s} />
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
