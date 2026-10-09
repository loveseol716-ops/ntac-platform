export function dateKey(date) {
  return date.toISOString().slice(0, 10);
}
export function periodFor(day, mode) {
  const d = new Date(`${day}T12:00:00Z`);
  if (mode === "day") return { first: day, last: day };
  if (mode === "week") {
    const first = new Date(d);
    first.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const last = new Date(first);
    last.setUTCDate(first.getUTCDate() + 6);
    return { first: dateKey(first), last: dateKey(last) };
  }
  return {
    first: dateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))),
    last: dateKey(
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)),
    ),
  };
}
export function trackingStats(sessions, month) {
  const completed = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) =>
      (b.session_date + b.start_time).localeCompare(
        a.session_date + a.start_time,
      ),
    );
  const [y, m] = month.split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, i) => {
    const key = dateKey(new Date(Date.UTC(y, m - 6 + i, 1))).slice(0, 7);
    return {
      key,
      count: completed.filter((s) => s.session_date.startsWith(key)).length,
    };
  });
  const current = completed.filter((s) => s.session_date.startsWith(month));
  return {
    completed,
    latest: completed[0],
    total: completed.length,
    current: current.length,
    days: new Set(current.map((s) => s.session_date)).size,
    months,
  };
}
