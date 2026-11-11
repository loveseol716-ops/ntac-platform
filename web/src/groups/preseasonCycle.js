// Agreed six-week pilot. Calendar guidance does not publish weekly programs.
export const PRESEASON_ASSESSMENTS = [
  { id: "endurance", week: 5, classType: "gentle_sweat", title: "카디오 인듀런스", format: "SkiErg 2,000m TT / RowErg 2,000m TT", protocol: "각 종목 2,000m 완주 시간을 측정해요. 두 종목은 별도 수업일에 나누어 측정하는 운영안이에요. 세부 날짜는 공개 프로그램에서 확인해 주세요.", record: "종목별 완주 시간 · 평균 500m 페이스 · 평균 출력" },
  { id: "power", week: 5, classType: "bomb_sweat", title: "카디오 파워", format: "3 Rounds · 4min ON / 8min OFF", movements: ["Bike 20/16cal", "Burpee 30회", "Wall Ball 20회 · 20/14lb"], protocol: "매 라운드 Bike부터 순서대로 수행해요. 운동 4분 후 휴식 8분. 4분 내 완료하면 완료 시간을, 미완료하면 도달 지점과 반복 수를 확인해요.", record: "라운드별 완료 시간 또는 완료 반복 수 · 라운드 간 수행 변화" },
  { id: "lifting", week: 6, classType: "gentle_strength", title: "리프팅", format: "Back Squat 5RM / BB Hang Power Clean 1RM", protocol: "워밍업 후 중량을 단계적으로 올려요. 백스쿼트는 기준을 지켜 5회 완수한 최고 중량, 행 파워클린은 1회 성공한 최고 중량을 측정해요.", record: "종목별 최고 유효 중량 · 동작 기준 충족 여부" },
  { id: "metcon", week: 6, classType: "bomb_strength", title: "메트콘", format: "3 Rounds · Cap 10min", movements: ["Dual DB C&J 6회 · 20/12.5kg", "Box Jump Over 12회 · 24/20인치", "T2B 12회", "KB Deadlift 6회 · 32/24kg"], protocol: "위 순서로 3라운드 수행해요. 10분 안에 완주하거나, 타임캡까지 완료한 반복 수를 확인해요. 총 108회예요.", record: "완주 시간 또는 완료 반복 수 / 108회 · 사용 중량 · 스케일" },
];

const rows = [
  ["동작과 시작 중량 설정", "8~10회 · RPE 6~7", "평가 동작을 익히고 개인별 스케일과 시작 중량을 설정해요.", "보통", "보통"],
  ["작업량과 기본기 축적", "6~8회 · RPE 7", "목표 반복을 안정적으로 완수하며 기술과 페이스를 다져요.", "증가", "높음"],
  ["중량과 수행 능력 발전", "4~6회 · RPE 7~8", "동작 기준을 지키며 중량에 적응해요. 중량·반복·세트·밀도를 한꺼번에 올리지 않아요.", "높음", "보통"],
  ["반복량 유지 · RPE 낮추기", "3주차 세트·반복 유지 · RPE 6~7", "세트·반복 수는 그대로 두고 중량을 낮춰 노력 수준을 조절해요. 카디오와 메트콘도 페이스를 조절해요.", "감소", "유지"],
  ["카디오 평가 · 리프팅·메트콘 예열", "준비 훈련은 낮은 볼륨 · RPE 6~7", "Gentle Sweat는 인듀런스, Bomb Sweat는 파워 평가. 리프팅·메트콘은 낮은 볼륨과 강도로 준비해요.", "클래스별", "클래스별"],
  ["리프팅·메트콘 평가 · 카디오 회복", "준비 훈련 최소화 후 평가", "Gentle Strength는 리프팅, Bomb Strength는 메트콘 평가. 카디오는 피로가 남지 않도록 가볍게 진행해요.", "클래스별", "클래스별"],
];
export const PRESEASON_CYCLE = {
  id: "2026-preseason", year: 2026, name: "PRE-SEASON", quarter: null, number: null,
  start: "2026-11-23", end: "2027-01-03", pauses: [],
  phases: ["ready", "build", "load", "reset", "showtime", "showtime"],
  weekPlans: rows.map(([title, load, note, intensity, volume]) => ({ title, load, note, intensity, volume })),
};

export function preseasonDirection(position, type, name) {
  const event = PRESEASON_ASSESSMENTS.find((a) => a.classType === type);
  if (!event) return null;
  const isAssessment = position.week === event.week;
  const strength = type.endsWith("strength");
  const focus = isAssessment ? `${event.title} 평가 주간이에요. ${event.format}`
    : position.week === 5 ? "다음 주 평가를 위해 동작·스케일·전환을 낮은 볼륨과 강도로 예열해요."
    : position.week === 6 ? "평가에 피로가 남지 않도록 가벼운 유산소와 기술 연습으로 진행해요."
    : position.weekPlan.note;
  const prescription = strength
    ? position.week >= 5 ? (isAssessment ? event.format : position.weekPlan.load)
      : type === "gentle_strength" ? `메인 근력 ${position.weekPlan.load} · 클린은 기술·속도 중심으로 별도 구성`
      : `메인 근력 ${position.weekPlan.load} · 메트콘 반복 수에 일괄 적용하지 않아요.`
    : position.week >= 5 ? (isAssessment ? event.format : "가벼운 회복성 운동 · 대사 피로 최소화")
      : type === "gentle_sweat" ? "Ski·Row 지속 페이스 → 목표 페이스 구간 연습" : "Bike·Burpee·Wall Ball 연결 → 라운드 간 출력 유지";
  return { name, part: null, goal: `${event.title} 준비 · ${event.format}`, prescription, focus, assessment: event.format,
    demand: { intensity: isAssessment ? "평가" : position.week >= 5 ? "낮음" : position.weekPlan.intensity,
      volume: isAssessment ? "평가 WOD" : position.week >= 5 ? "낮음" : position.weekPlan.volume } };
}
