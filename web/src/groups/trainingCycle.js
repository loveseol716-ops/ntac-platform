import { addDays, seoulDate } from "./model.js";
import { CLASS_TYPES } from "./classTypes.js";

// Agreed NOLTO 2.0 calendar. This describes the program, never member attendance.
// Keep dates explicit: holiday weeks do not count as completed training weeks.
export const CYCLE_LAUNCH = "2026-10-21";
export const PHASES = {
  ready: { name: "READY", label: "동작과 무게 익히기", description: "동작을 익히고, 이번 블록의 시작 중량을 찾아요." },
  build: { name: "BUILD", label: "반복하며 기본기 쌓기", description: "충분한 반복으로 기본기를 쌓고 다음 단계를 준비해요." },
  load: { name: "LOAD", label: "무게에 적응하기", description: "반복 수를 조금씩 줄이며 더 무거운 중량에 적응해요." },
  reset: { name: "RESET", label: "부담을 낮추고 회복", description: "훈련 부담을 낮추고, 다음 단계를 준비해요." },
  perform: { name: "PERFORM", label: "수행 능력 끌어올리기", description: "쌓아 온 기본기를 바탕으로 수행 능력을 끌어올려요." },
  showtime: { name: "SHOWTIME", label: "성장 확인하기", description: "SWEAT과 STRENGTH를 한 주씩 나누어 성장한 모습을 확인해요." },
  preparation: { name: "PREP", label: "시즌 준비 중", description: "11월 2일부터 8주 프리시즌을 함께 시작해요." },
  transition: { name: "TRANSITION", label: "조정 주간", description: "기술 연습과 회복으로 다음 훈련을 준비해요." },
  unplanned: { name: "NEXT", label: "다음 일정 안내 예정", description: "다음 블록의 일정과 목표를 준비하고 있어요." },
};

const REGULAR_PHASES = ["ready", "build", "build", "build", "load", "load", "reset", "perform", "perform", "perform", "showtime", "showtime"];
export const TRAINING_BLOCKS = [
  { id: "2026-preseason", year: 2026, name: "PRE-SEASON", quarter: null, number: null, start: "2026-11-02", end: "2026-12-27", phases: REGULAR_PHASES.slice(4), pauses: [] },
  { id: "2027-b01", year: 2027, name: "BLOCK 01", quarter: 1, number: 1, start: "2027-01-04", end: "2027-03-28", phases: REGULAR_PHASES, pauses: [] },
  { id: "2027-b02", year: 2027, name: "BLOCK 02", quarter: 2, number: 2, start: "2027-04-05", end: "2027-06-27", phases: REGULAR_PHASES, pauses: [] },
  { id: "2027-b03", year: 2027, name: "BLOCK 03", quarter: 3, number: 3, start: "2027-07-05", end: "2027-10-03", phases: REGULAR_PHASES, pauses: [{ start: "2027-09-13", end: "2027-09-19", label: "추석 조정 주간" }] },
  { id: "2027-b04", year: 2027, name: "BLOCK 04", quarter: 4, number: 4, start: "2027-10-04", end: "2027-12-26", phases: REGULAR_PHASES, pauses: [] },
];

const TRANSITIONS = [
  { start: "2026-12-28", end: "2027-01-03", next: "2027-b01", label: "2027 시즌 준비" },
  { start: "2027-03-29", end: "2027-04-04", next: "2027-b02", label: "다음 블록 준비" },
  { start: "2027-06-28", end: "2027-07-04", next: "2027-b03", label: "다음 블록 준비" },
  { start: "2027-12-27", end: "2028-01-02", next: null, label: "연말 조정 주간" },
];

export function trainingDate(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? seoulDate(parsed) : null;
}

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
export const shortTrainingDate = (day) => `${Number(day.slice(5, 7))}.${Number(day.slice(8, 10))}`;
export const blockLabel = (block) => block ? `${block.year}${block.quarter ? ` · ${block.quarter}분기` : ""} · ${block.name}` : "NOLTO 2.0";

export function trainingWeeks(block) {
  if (!block) return [];
  let date = block.start;
  return block.phases.map((phase, index) => {
    const pause = block.pauses.find((p) => date >= p.start && date <= p.end);
    if (pause) date = addDays(pause.end, 1);
    const week = { number: index + 1, phase, start: date, end: addDays(date, 6) };
    date = addDays(date, 7);
    return week;
  });
}

export function trainingPosition(value = new Date()) {
  const day = trainingDate(value);
  if (!day || day < CYCLE_LAUNCH) return null;
  const block = TRAINING_BLOCKS.find((b) => day >= b.start && day <= b.end);
  if (block) {
    const weeks = trainingWeeks(block);
    const pause = block.pauses.find((p) => day >= p.start && day <= p.end);
    if (pause) return { day, state: "paused", phase: "transition", label: pause.label, block, week: null, total: weeks.length, next: weeks.find((w) => w.start > day) };
    const week = weeks.find((w) => day >= w.start && day <= w.end);
    return { day, state: "active", phase: week.phase, label: PHASES[week.phase].label, block, week: week.number, total: weeks.length, weekStart: week.start, weekEnd: week.end, assessment: week.phase === "showtime" ? (week.number === weeks.length ? "strength" : "sweat") : null };
  }
  if (day < TRAINING_BLOCKS[0].start) return { day, state: "preparation", phase: "preparation", label: PHASES.preparation.label, block: null, week: null, nextBlock: TRAINING_BLOCKS[0], daysUntilStart: daysBetween(day, TRAINING_BLOCKS[0].start) };
  const transition = TRANSITIONS.find((p) => day >= p.start && day <= p.end);
  if (transition) return { day, state: "transition", phase: "transition", label: transition.label, block: null, week: null, nextBlock: TRAINING_BLOCKS.find((b) => b.id === transition.next) || null };
  return { day, state: "unplanned", phase: "unplanned", label: PHASES.unplanned.label, block: null, week: null };
}

export function positionLabel(position) {
  if (!position) return "";
  if (position.state === "active") return `${position.block.name} · ${position.week}/${position.total}주차 · ${PHASES[position.phase].name}`;
  return position.block ? `${position.block.name} · ${position.label}` : position.label;
}

// A stored class type wins. Legacy titles are matched only to known class names.
export function trainingClass(program) {
  if (CLASS_TYPES.some((c) => c.id === program?.class_type_id)) return program.class_type_id;
  const title = String(program?.title || "").toUpperCase().replace(/[_\s]+/g, " ").trim();
  return CLASS_TYPES.find((c) => title === c.name || title.startsWith(`${c.name} ·`) || title.startsWith(`${c.name} -`))?.id || null;
}

export const JOURNEY_CLASSES = ["gentle_strength", "bomb_strength", "gentle_sweat", "bomb_sweat"];

export function classDirection(position, type) {
  if (!position || !JOURNEY_CLASSES.includes(type)) return null;
  const gentle = type.startsWith("gentle"), strength = type.endsWith("strength");
  // The preseason's specific upper/lower focus and assessment lifts are not yet agreed.
  const quarter = position.block?.quarter || position.nextBlock?.quarter;
  const part = strength && quarter ? ((quarter % 2 === 1) === gentle ? "UPPER" : "LOWER") : null;
  const goal = strength
    ? part === "UPPER"
      ? (gentle ? "상체로 밀고 당기는 힘을 균형 있게 기릅니다." : "상체의 최대근력을 높이고 힘을 내는 능력을 기릅니다.")
      : part === "LOWER"
        ? (gentle ? "스쿼트와 힌지 동작으로 하체의 힘을 균형 있게 기릅니다." : "하체의 최대근력을 높이고 힘을 내는 능력을 기릅니다.")
        : (gentle ? "반복 수행의 기본기를 쌓고, 점차 무거운 중량에 적응합니다." : "충분히 회복하며 훈련해 최대근력과 파워의 기반을 기릅니다.")
    : gentle ? "긴 호흡으로 꾸준히 움직이는 지구력을 기릅니다." : "강한 운동 구간에서 높은 출력을 내는 능력을 기릅니다.";
  let focus;
  if (position.state === "preparation") focus = "11월 2일부터 LOAD → RESET → PERFORM → SHOWTIME 흐름을 함께 경험해요.";
  else if (["paused", "transition"].includes(position.state)) focus = "훈련 부담을 조절하며 회복하고, 다음 훈련을 준비해요.";
  else if (position.state === "unplanned") focus = "다음 블록의 일정과 목표가 정해지면 안내할게요.";
  else if (position.assessment) {
    const ownAssessment = position.assessment === (strength ? "strength" : "sweat");
    focus = ownAssessment
      ? `${strength ? "STRENGTH" : "SWEAT"} 평가 주간이에요. 코치가 안내하는 종목과 기준으로 성장을 확인해요.`
      : `${position.assessment === "sweat" ? "SWEAT" : "STRENGTH"} 평가 주간이에요. 이 수업은 평가 일정에 맞춰 부담을 조절해요.`;
  } else if (strength) focus = PHASES[position.phase].description;
  else if (position.phase === "reset") focus = "운동의 부담을 낮춰 회복하고, 다음 훈련을 준비해요.";
  else focus = gentle ? "일정한 호흡과 페이스로 반복 수행을 이어가요." : "강한 운동 구간과 회복을 구분하며 높은 출력을 연습해요.";
  return { name: CLASS_TYPES.find((c) => c.id === type).name, part, goal, focus,
    assessment: strength ? `${gentle ? "3RM 또는 5RM" : "1RM 또는 2RM"} · 평가 종목과 횟수는 확정 후 안내해요.` : "평가 종목과 방식은 확정 후 안내해요." };
}
