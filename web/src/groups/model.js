export const stateLabels = {
  draft: "작성 중",
  published: "공개됨",
  open: "참가 가능",
  live: "진행 중",
  ended: "종료",
  cancelled: "취소",
};
export const levels = {
  foundation: "기초",
  standard: "기본",
  advanced: "도전",
};
export const participantLabels = {
  planned: "참가 예정",
  active: "참여 중",
  completed: "운동 완료",
  left: "중도 종료",
  cancelled: "참가 취소",
};
export const kinds = {
  weight: "중량 · 반복",
  time: "시간",
  rounds: "라운드 · 반복",
  distance: "거리",
  calories: "칼로리",
  participation: "참여",
};
export const sourceLabels = {
  one_rm: "등록된 1RM 기반 추정",
  recent_set: "최근 동일 세트 기록",
  estimated_history: "최근 수행·RIR 기반 추정",
  recent_result: "최근 동일 조건 기록",
  coach_baseline: "코치 기준 중량",
  coach_override: "코치 조정",
  coach_required: "코치 확인 필요",
  program: "프로그램 기준",
};
export const seoulDate = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const classTime = (value) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
export const dateRange = (day) => [
  new Date(`${day}T00:00:00+09:00`).toISOString(),
  new Date(
    new Date(`${day}T00:00:00+09:00`).getTime() + 86400000,
  ).toISOString(),
];
export const nullableNumber = (value) =>
  value === "" || value == null ? null : Number(value);
export const movementLabel = (m, exercises = []) =>
  m.label ||
  exercises.find((e) => e.id === m.exercise_id)?.name ||
  m.exercise_id;
export const loadLabel = (m) =>
  m.load_basis === "each" ? "한 손 기준" : "총중량";
export function resultText(m, r) {
  if (!r) return "기록 대기";
  if (r.dnf) return "미완주";
  if (m.training_type === "strength") {
    const sets = r.sets || [];
    const done = sets.filter(
      (s) => !s.dnf && s.weight != null && s.reps != null,
    );
    return done.length
      ? `${done.length}/${m.sets.length}세트 · ${done.map((s) => `${s.weight}×${s.reps}`).join(" / ")} ${m.unit}`
      : "기록 대기";
  }
  if (m.kind === "weight")
    return r.weight != null && r.reps != null
      ? `${r.weight} ${m.unit} × ${r.reps}회`
      : "기록 대기";
  if (m.kind === "time")
    return r.seconds != null ? `${r.seconds}초` : "기록 대기";
  if (m.kind === "rounds")
    return r.rounds != null ? `${r.rounds}R + ${r.reps ?? 0}회` : "기록 대기";
  if (m.kind === "distance")
    return r.distance != null ? `${r.distance} m` : "기록 대기";
  if (m.kind === "calories")
    return r.calories != null ? `${r.calories} cal` : "기록 대기";
  return "참여";
}
// Rank only finalized, completed records with the same class/program, movement,
// difficulty and scoring conditions. The rest remain visible without a rank.
export function resultRows(participants, m) {
  if (!m) return participants.map((p) => ({ ...p, rank: null }));
  const rows = participants.map((p) => {
    const r = p.results?.[m.id];
    let score = null;
    if (p.status === "completed" && p.finalized && r && !r.dnf) {
      if (
        m.kind === "weight" &&
        m.training_type !== "strength" &&
        r.weight != null &&
        r.reps === Number(m.target_reps)
      )
        score = r.weight;
      if (
        m.training_type === "strength" &&
        r.sets?.length === m.sets.length &&
        r.sets.every(
          (s, i) => !s.dnf && s.weight != null && s.reps === m.sets[i].reps,
        )
      )
        score = r.sets.reduce((total, s) => total + s.weight * s.reps, 0);
      if (m.kind === "time" && r.seconds != null && r.seconds > 0)
        score = -r.seconds;
      if (m.kind === "distance" && r.distance != null) score = r.distance;
      if (m.kind === "calories" && r.calories != null) score = r.calories;
      // AMRAP ordering is lexicographic: a round always outranks extra reps.
      if (m.kind === "rounds" && r.rounds != null && r.reps != null)
        score = [r.rounds, r.reps];
    }
    return { ...p, score, rank: null };
  });
  const compare = (a, b) =>
    Array.isArray(a.score)
      ? b.score[0] - a.score[0] || b.score[1] - a.score[1]
      : b.score - a.score;
  Object.keys(levels).forEach((level) => {
    const group = rows
      .filter((r) => r.difficulty === level && r.score != null)
      .sort(compare);
    group.forEach((r, i) => {
      r.rank = i && compare(r, group[i - 1]) === 0 ? group[i - 1].rank : i + 1;
    });
  });
  return rows.sort(
    (a, b) =>
      a.difficulty.localeCompare(b.difficulty) ||
      (a.rank ?? Infinity) - (b.rank ?? Infinity),
  );
}
export function groupStats(rows) {
  const completed = rows.filter(
    (r) => r.status === "completed" && r.group_classes?.status !== "cancelled",
  );
  return {
    sessions: completed.length,
    days: new Set(completed.map((r) => seoulDate(r.group_classes.starts_at)))
      .size,
  };
}

export const addDays = (day, n) =>
  new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000)
    .toISOString()
    .slice(0, 10);
export const weekStart = (day) =>
  addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
export const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
export const programVisibleFrom = (today = seoulDate()) =>
  addDays(weekStart(today), -7);
export const shiftMonth = (day, amount) => {
  const d = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + amount);
  return d.toISOString().slice(0, 10);
};
// Monday-first calendar; end is exclusive and includes the final visible week.
export function calendarRange(day, view = "month") {
  if (view === "week") return [weekStart(day), addDays(weekStart(day), 7)];
  const first = `${day.slice(0, 7)}-01`;
  const last = addDays(shiftMonth(first, 1), -1);
  return [weekStart(first), addDays(weekStart(last), 7)];
}
export function calendarDates(day, view = "month") {
  const [start, end] = calendarRange(day, view);
  const dates = [];
  for (let date = start; date < end; date = addDays(date, 1)) dates.push(date);
  return dates;
}
export const prescriptionText = (m) =>
  m.training_type === "strength"
    ? `${m.sets.map((s) => s.reps).join("–")}회 · RIR ${m.sets.map((s) => s.rir).every((v) => v === m.sets[0].rir) ? m.sets[0].rir : m.sets.map((s) => s.rir).join(" / ")}`
    : `${m.target_reps}회`;
