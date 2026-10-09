import { koreaDate, koreaTime } from "./dates.js";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked } from "./api.js";
import { today, statusLabels } from "./model.js";
import { Calendar } from "./Calendar.jsx";
import AvailabilityEditor from "./AvailabilityEditor.jsx";
import "./PT.css";
import "./Calendar.css";
export default function CoachCalendar({
  profile,
  coaches,
  sessions,
  members,
  profiles,
  onSelect,
}) {
  const [day, setDay] = useState(today()),
    [coach, setCoach] = useState(profile.id),
    [slots, setSlots] = useState([]),
    [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [adding, setAdding] = useState(false);
  const admin = ["owner", "admin"].includes(profile.role);
  useEffect(() => {
    let live = true;
    checked(
      supabase
        .from("pt_slots")
        .select("*")
        .eq("coach_id", coach)
        .order("starts_at"),
    )
      .then((v) => live && setSlots(v))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [coach, version]);
  const own = sessions.filter(
      (s) =>
        (s.coach_id || members.find((m) => m.id === s.member_id)?.coach_id) ===
        coach,
    ),
    next = own
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
      )[0];
  const name = (s) =>
    profiles.find(
      (p) => p.id === members.find((m) => m.id === s?.member_id)?.profile_id,
    )?.full_name || "회원";
  async function act(fn) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setVersion((v) => v + 1);
      setMessage("예약 가능 시간을 저장했어요.");
    } catch (e) {
      setError(
        e.code === "23P01"
          ? "이미 열어둔 시간과 겹쳐요. 다른 범위를 선택해 주세요."
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pt simple-pt coach-calendar">
      <div className="pt-row pt-between">
        <h2>수업 캘린더</h2>
        {admin && (
          <label className="coach-picker">
            <span className="sr-only">캘린더 코치</span>
            <select value={coach} onChange={(e) => setCoach(e.target.value)}>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name || c.email}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <section className="next-session">
        <span>다음 수업</span>
        <strong>
          {next
            ? `${next.start_time.slice(0, 5)} · ${name(next)}`
            : "예약된 수업이 없어요"}
        </strong>
        {next && (
          <>
            <small>{next.session_date}</small>
            <button onClick={() => onSelect(next.member_id, next.session_date)}>
              수업 열기
            </button>
          </>
        )}
      </section>
      {error && (
        <p className="pt-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="pt-success">
          {message}
        </p>
      )}
      <div className="calendar-layout">
        <Calendar
          value={day}
          onChange={(d) => {
            setDay(d);
            setAdding(false);
          }}
          completedDates={own
            .filter((s) => s.status === "completed")
            .map((s) => s.session_date)}
          scheduledDates={own
            .filter((s) => s.status === "scheduled")
            .map((s) => s.session_date)}
          dates={[
            ...slots
              .filter((s) => s.is_open)
              .map((s) => koreaDate(s.starts_at)),
          ]}
        />
        <section className="day-agenda">
          <div className="pt-row pt-between">
            <h3>{day} 수업</h3>
            <button onClick={() => setAdding(!adding)}>수업 추가</button>
          </div>
          {adding && (
            <div className="pt-card">
              <label>
                회원 선택
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onSelect(e.target.value, day, true);
                  }}
                >
                  <option value="" disabled>
                    수업을 추가할 회원
                  </option>
                  {members
                    .filter((m) => m.active && m.coach_id === coach)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {profiles.find((p) => p.id === m.profile_id)
                          ?.full_name || "회원"}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          )}
          {own
            .filter((s) => s.session_date === day && s.status !== "cancelled")
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map((s) => (
              <button
                className="calendar-session"
                key={s.id}
                onClick={() => onSelect(s.member_id, day)}
              >
                <strong>{s.start_time.slice(0, 5)}</strong>
                <span>{name(s)}</span>
                <small>{statusLabels[s.status]}</small>
                <span>→</span>
              </button>
            ))}
          {!own.some(
            (s) => s.session_date === day && s.status !== "cancelled",
          ) && <p className="agenda-empty">예약된 수업이 없어요.</p>}
          <AvailabilityEditor
            key={coach}
            coach={coach}
            day={day}
            onApplied={() => setVersion((v) => v + 1)}
          />
          <div className="slot-settings">
            <h3>이 날짜에 열린 시간</h3>

            {slots
              .filter((s) => s.is_open && koreaDate(s.starts_at) === day)
              .map((s) => (
                <div key={s.id}>
                  <span>
                    {koreaTime(s.starts_at)}–{koreaTime(s.ends_at)}
                  </span>
                  <button
                    disabled={busy || new Date(s.ends_at) < new Date()}
                    onClick={() =>
                      act(() =>
                        checked(
                          supabase
                            .from("pt_slots")
                            .update({ is_open: !s.is_open })
                            .eq("id", s.id),
                        ),
                      )
                    }
                  >
                    {s.is_open ? "닫기" : "다시 열기"}
                  </button>
                </div>
              ))}
          </div>
        </section>
      </div>
    </section>
  );
}
