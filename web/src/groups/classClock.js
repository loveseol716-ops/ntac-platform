import { useEffect, useState } from "react";

export function classPhase(c, now = Date.now()) {
  if (!c) return "";
  const state = c.stored_status || c.status;
  if (["draft", "cancelled", "ended"].includes(state)) return state;
  const start = new Date(c.starts_at).getTime();
  const end = start + c.duration_minutes * 60000;
  if (now >= end) return "ended";
  if (now >= start) return "live";
  return now >= start - 30 * 60000 ? "open" : "published";
}

export function timedClass(c, now = Date.now()) {
  return (
    c && {
      ...c,
      stored_status: c.stored_status || c.status,
      status: classPhase(c, now),
      ended_at:
        c.ended_at ||
        new Date(
          new Date(c.starts_at).getTime() + c.duration_minutes * 60000,
        ).toISOString(),
    }
  );
}

export function useClassClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return now;
}
