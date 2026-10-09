import { periodFor } from "../pt/tracking.js";
export function isoWeek(day) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  first.setUTCDate(first.getUTCDate() + 3 - ((first.getUTCDay() + 6) % 7));
  return `${d.getUTCFullYear()}-W${String(1 + Math.round((d - first) / 604800000)).padStart(2, "0")}`;
}
export function weekForDay(programs, day) {
  return (
    programs.find((w) => w.workouts.some((x) => x.date === day)) ||
    programs.find((w) => w.weekId === isoWeek(day)) ||
    programs.find((w) =>
      w.workouts.some(
        (x) =>
          x.date &&
          periodFor(x.date, "week").first === periodFor(day, "week").first,
      ),
    )
  );
}
export function stableWeek(week) {
  return {
    ...week,
    workouts: (week.workouts || []).map((w, i) => {
      const sessionId =
        w.sessionId ||
        `${week.weekId.toLowerCase()}-${(w.category || "RUN").toLowerCase()}-${i + 1}`;
      return {
        ...w,
        sessionId,
        eventId: w.eventId || `${w.date}-${sessionId}`,
      };
    }),
  };
}
export function newWorkout(date) {
  const sessionId = `ntac-${crypto.randomUUID()}`;
  return {
    date,
    sessionId,
    eventId: `${date}-${sessionId}`,
    category: "RUN",
    sessionType: "ZONE 2",
    title: "",
    subtitle: "",
    description: "",
    targetRpe: "",
    sections: [
      { title: "WARM UP", items: [""] },
      { title: "MAIN", items: [""] },
      { title: "COOL DOWN", items: [""] },
    ],
  };
}
export function newWeek(day, weekType) {
  const { first, last } = periodFor(day, "week");
  return {
    weekId: isoWeek(day),
    label: `${first.slice(5).replace("-", "/")} – ${last.slice(5).replace("-", "/")}`,
    weekType,
    published: false,
    workouts: [],
  };
}
export function shiftedWeek(week) {
  const shift = (day) => {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  };
  const day = shift(week.workouts[0].date);
  return {
    ...newWeek(day, week.weekType),
    workouts: week.workouts.map((w) => {
      const date = shift(w.date),
        sessionId = `ntac-${crypto.randomUUID()}`;
      return { ...w, date, sessionId, eventId: `${date}-${sessionId}` };
    }),
  };
}
