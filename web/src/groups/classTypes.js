// NOLTO's seven weekly programs. The timetable mirrors the supplied October poster.
export const CLASS_TYPES = [
  { id: "gentle_sweat", name: "GENTLE SWEAT", days: [2, 3] },
  { id: "gentle_strength", name: "GENTLE STRENGTH", days: [1, 5] },
  { id: "bomb_sweat", name: "BOMB SWEAT", days: [1, 5] },
  { id: "bomb_strength", name: "BOMB STRENGTH", days: [2, 3] },
  { id: "you_in", name: "YOU IN", days: [4] },
  { id: "nolto_team", name: "NOLTO & TEAM", days: [6] },
  { id: "no_more_weak", name: "NO MORE WEAK", days: [7] },
];
export const POSTER_SLOTS = [
  [1, "07:20", "gentle_strength"],
  [1, "10:00", "bomb_sweat"],
  [1, "12:10", "gentle_strength"],
  [1, "18:20", "gentle_strength"],
  [1, "19:30", "bomb_sweat"],
  [1, "20:40", "gentle_strength"],
  [2, "07:20", "gentle_sweat"],
  [2, "12:10", "gentle_sweat"],
  [2, "18:20", "gentle_sweat"],
  [2, "19:30", "bomb_strength"],
  [2, "20:40", "gentle_sweat"],
  [3, "07:20", "bomb_strength"],
  [3, "10:00", "gentle_sweat"],
  [3, "12:10", "bomb_strength"],
  [3, "18:20", "bomb_strength"],
  [3, "19:30", "gentle_sweat"],
  [3, "20:40", "bomb_strength"],
  [4, "19:30", "you_in"],
  [5, "07:20", "bomb_sweat"],
  [5, "10:00", "gentle_strength"],
  [5, "12:10", "bomb_sweat"],
  [5, "18:20", "bomb_sweat"],
  [5, "19:30", "gentle_strength"],
  [5, "20:40", "bomb_sweat"],
  [6, "10:00", "nolto_team"],
  [7, "10:00", "no_more_weak"],
];
export const classTypeName = (id) =>
  CLASS_TYPES.find((t) => t.id === id)?.name || "";
export const typeDays = (id) =>
  (CLASS_TYPES.find((t) => t.id === id)?.days || [])
    .map((d) => ["월", "화", "수", "목", "금", "토", "일"][d - 1])
    .join(" · ");
export const programReady = (p) =>
  !!(p?.description?.trim() || p?.movements?.length);
// Weekly plans exist even when publication was too late to create a past class.
export const programsForDay = (week, dow) => {
  if (!week || week.status !== "published") return [];
  if (week.program_mode !== "class_type")
    return (week.days || []).filter(
      (p) => Number(p.dow) === dow && programReady(p),
    );
  return (week.programs || []).filter(
    (p) =>
      programReady(p) &&
      CLASS_TYPES.find((t) => t.id === p.class_type_id)?.days.includes(dow),
  );
};
export const blankPrograms = () =>
  CLASS_TYPES.map((t) => ({
    class_type_id: t.id,
    title: t.name,
    description: "",
    movements: [],
  }));
export const defaultTimetable = (coachId) =>
  POSTER_SLOTS.map(([dow, time, class_type_id]) => ({
    id: crypto.randomUUID(),
    dow,
    time,
    class_type_id,
    duration_minutes: class_type_id === "no_more_weak" ? 90 : 50,
    coach_id: coachId,
  }));
