import { useEffect, useState } from "react";

export const sessionStartsAt = (session) =>
  new Date(`${session.session_date}T${session.start_time}+09:00`).getTime();

// Re-evaluate completion eligibility when a class starts, without a page reload.
export function useSessionClock(sessions) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer;
    function refresh() {
      clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      const next = (sessions || [])
        .filter((s) => s.status === "scheduled")
        .map(sessionStartsAt)
        .filter((start) => start > current)
        .sort((a, b) => a - b)[0];
      if (next) {
        timer = setTimeout(refresh, Math.min(next - current + 50, 2147483647));
      }
    }
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [sessions]);
  return now;
}
