export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const statusLabels = {
  scheduled: "예약",
  completed: "수업 완료",
  cancelled: "취소",
};
export const starterWorkout = [
  {
    block: "Warm-up · AMRAP 6~8min",
    name: "Half Kneeling Ankle Rock",
    target: "8/8",
    condition: "",
    sets: ["", "", "", ""],
  },
  {
    block: "Warm-up",
    name: "Wall Hip Hinge",
    target: "10",
    condition: "",
    sets: ["", "", "", ""],
  },
  {
    block: "Warm-up",
    name: "Incline Plank Shoulder Tap",
    target: "6/6",
    condition: "박스 높이 기록",
    sets: ["", "", "", ""],
  },
  {
    block: "Warm-up",
    name: "BB SQ",
    target: "8",
    condition: "",
    sets: ["", "", "", ""],
  },
  {
    block: "S1 · 3~4R / Cap 20min",
    name: "BB SQ",
    target: "10~12 · RPE 4~5",
    condition: "깊이 기준 / 중량",
    sets: ["", "", "", ""],
  },
  {
    block: "S1",
    name: "Single Leg DL",
    target: "8/8",
    condition: "지지 방식 / DB 한 개 무게",
    sets: ["", "", "", ""],
  },
  {
    block: "S1",
    name: "Side Plank Rotation",
    target: "5/5 · 이후 휴식 60초",
    condition: "무릎 또는 발 지지",
    sets: ["", "", "", ""],
  },
  {
    block: "S2 · EMOM 15min",
    name: "Box Step Up",
    target: "12",
    condition: "20인치 / 총 12회 여부 확인",
    sets: ["", "", "", "", ""],
  },
  {
    block: "S2",
    name: "DB Man Maker",
    target: "4~6",
    condition: "DB 한 개 무게 / 구성 동작",
    sets: ["", "", "", "", ""],
  },
  {
    block: "S2",
    name: "Bike",
    target: "Easy",
    condition: "기구 / 회복 강도",
    sets: ["", "", "", "", ""],
  },
];
export const blankSession = (memberId, packageId = "") => ({
  id: crypto.randomUUID(),
  member_id: memberId,
  package_id: packageId,
  session_date: today(),
  start_time: "10:00",
  title: "초급자 기초 PT",
  status: "scheduled",
  workout: structuredClone(starterWorkout),
  feedback: "",
  homework: "",
  session_rpe: "",
  private_note: "",
});
export function packageUsage(pack, sessions) {
  const used = sessions.filter(
    (s) => s.package_id === pack.id && s.status === "completed",
  ).length;
  return { used, remaining: pack.total_sessions - used };
}
export function assessmentSeries(rows) {
  const groups = new Map();
  for (const row of [...rows].sort(
    (a, b) =>
      a.assessed_on.localeCompare(b.assessed_on) ||
      a.created_at.localeCompare(b.created_at),
  )) {
    const key = JSON.stringify([
      row.metric,
      row.side,
      row.unit,
      row.conditions,
    ]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()];
}
