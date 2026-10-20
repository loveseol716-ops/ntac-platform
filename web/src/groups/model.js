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
        r.weight != null &&
        r.reps === Number(m.target_reps)
      )
        score = r.weight;
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
