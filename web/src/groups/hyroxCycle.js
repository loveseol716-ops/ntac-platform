// Coach-supplied periodization. 2026-10-19 is week 9; these are training
// guidelines, not authored workouts or automatic prescriptions for members.
export const HYROX_STAGES = [
  {
    number: 1, start: 1, end: 4, phase: "build",
    title: "기초 작업량과 움직임 품질",
    description: "기술과 기본 볼륨, 유산소 기반을 쌓아요. 3주 증가 후 4주차에 조절해요.",
    classes: {
      gentle_strength: { goal: "전신 기술과 기본 볼륨", prescription: "메인 패턴 3~4세트 × 6~8회 · RPE 6~7", focus: "힌지와 수평 푸시·풀 중심. 느린 하강, 정지와 단측 운동을 활용해요." },
      gentle_sweat: { goal: "유산소 기반과 페이스 조절", prescription: "25~35분 연속 작업 또는 긴 인터벌", focus: "대화 가능한 수준부터 시작해요. 에르그·러닝·캐리를 활용하고 편심성 부하는 제한해요." },
      bomb_strength: { goal: "스쿼트 중심 전신 스트렝스", prescription: "메인 패턴 4세트 × 5~6회 · RPE 7~8", focus: "고강도 메트콘을 뒤에 추가하지 않아요." },
      bomb_sweat: { goal: "반복 가능한 출력", prescription: "2~4분 작업 · 총 고강도 작업시간 12~18분", focus: "속도보다 반복 가능한 출력이 우선이에요. 런지·월볼·버피를 한 세션에 몰지 않아요." },
    },
  },
  {
    number: 2, start: 5, end: 8, phase: "load",
    title: "최대근력과 역치 향상",
    description: "중고강도 근력과 역치 인터벌에 적응해요. 3주 증가 후 8주차에 조절해요.",
    classes: {
      gentle_strength: { goal: "메인 리프트를 보완하는 근력", prescription: "3~4세트 × 5~8회", focus: "단측 하체·후면사슬·상체 푸시·풀. Bomb Strength와 같은 부위를 다시 강하게 누르지 않아요." },
      gentle_sweat: { goal: "유산소 기반 유지와 회복", prescription: "30~40분 · RPE 5~6", focus: "존2를 유지해요. 역치 세션 다음 날에는 회복성 에르그를 우선해요." },
      bomb_strength: { goal: "메인 리프트의 중고강도 노출", prescription: "4~5세트 × 3~6회 · RPE 7.5~8.5", focus: "스쿼트·힌지·프레스를 반복하고 보조 운동은 2~3종목으로 제한해요." },
      bomb_sweat: { goal: "역치 능력과 페이스 유지", prescription: "3~6분 인터벌 · 총 작업시간 18~24분", focus: "후반에도 출력 저하가 과도하지 않도록 조절해요. 핵심 에르그 또는 러닝을 반복해요." },
    },
  },
  {
    number: 3, start: 9, end: 12, phase: "perform",
    title: "혼합 근지구력과 종목 연결",
    description: "근력을 유지하며 에르그·런·캐리·런지·월볼을 연결해요. 12주차에는 볼륨을 낮추고 성과를 확인해요.",
    classes: {
      gentle_strength: { goal: "안정성과 근력 보강", prescription: "3세트 × 5~8회", focus: "단측 안정성·후면사슬·상체 보강. 근육통을 크게 남기지 않도록 조절해요." },
      gentle_sweat: { goal: "회복성 유산소와 페이스 연습", prescription: "회복성 유산소 · 페이스·전환 드릴", focus: "강한 피로를 만들지 않고 호흡과 종목 전환 기술을 정리해요." },
      bomb_strength: { goal: "근력 유지", prescription: "3~4세트 × 3~5회 · RPE 7~8", focus: "볼륨보다 중량 감각과 동작 속도를 유지해요." },
      bomb_sweat: { goal: "혼합 종목 수행과 후반 페이스 유지", prescription: "4~8분 혼합 블록 · 에르그 또는 런 이후 스테이션", focus: "포타임·타깃 라운드·점진적 거리 증가를 활용해요. 초반 출력보다 후반 수행 저하를 살펴봐요." },
    },
  },
];

export const HYROX_WEEK_PLANS = [
  { phase: "ready", title: "동작 기준과 기준 기록 확인", load: "RPE 6~7 · 최대 기록보다 안전한 시작 기록", saturday: "팀 유산소와 전환 연습" },
  { phase: "build", title: "총 반복 또는 작업시간 증가", load: "1주 대비 약 5~10% 증가 · 한 요소만 조정", saturday: "작업시간 또는 거리 증가" },
  { phase: "build", title: "블록 내 최고 작업량", load: "RPE 7~8 · 실패 반복 없음", saturday: "70~80% 강도의 미니 시뮬레이션" },
  { phase: "reset", title: "기초 블록 조절주", load: "총 볼륨 30~40% 감소", saturday: "기술 중심 팀 세션 또는 회복성 수업" },
  { phase: "load", title: "강도 증가 적응", load: "RPE 7~8", saturday: "팀 역치 작업" },
  { phase: "load", title: "세트 또는 중량 증가", load: "전주 대비 한 요소만 증가", saturday: "에르그와 캐리·스테이션 결합" },
  { phase: "load", title: "블록 내 최고 강도", load: "RPE 8~8.5 · 그라인딩 금지", saturday: "75~85% 미니 시뮬레이션" },
  { phase: "reset", title: "근력·역치 블록 조절주", load: "총 볼륨 35~45% 감소", saturday: "회복성 팀 세션" },
  { phase: "perform", title: "혼합 종목 연결 시작", load: "RPE 7~8 · 초반 과속 없이 목표 페이스 유지", saturday: "팀별 페이스 연습" },
  { phase: "perform", title: "작업 밀도와 전환 빈도 증가", load: "휴식 또는 전환시간 조절 · 한 요소만 증가", saturday: "분할 시뮬레이션" },
  { phase: "rehearsal", title: "리허설 및 최고 특이성", load: "주간 고강도의 최고점은 한 번만", saturday: "80~90% 리허설" },
  { phase: "taper", title: "테이퍼와 성과 확인", load: "총 볼륨 40~50% 감소 · 11월 15일까지 대회 준비", saturday: "반복 가능한 벤치마크 또는 이벤트 · 대회 일정에 맞춰 조정", note: "11주차에 완전한 최대 시뮬레이션을 했다면 이번 주에는 최대 테스트를 겹치지 않아요." },
];

export const HYROX_CYCLE = {
  id: "2026-hyrox", year: 2026, name: "HYROX PREP", quarter: null, number: null,
  start: "2026-08-24", end: "2026-11-15", pauses: [],
  phases: HYROX_WEEK_PLANS.map((week) => week.phase),
  stages: HYROX_STAGES, weekPlans: HYROX_WEEK_PLANS,
};

export const HYROX_RULES = [
  "일반 회원의 Bomb 노출은 기본 주 2회예요. 토요일 시뮬레이션도 1회로 계산해요.",
  "하지 고충격·고편심성 수업은 가능하면 48시간 분리하고, 볼륨·강도·밀도 중 하나만 올려요.",
  "컨디션 저하나 심한 근육통이 있으면 당일 볼륨을 20~30% 줄이고 RPE 7 이하로 조절해요.",
  "날카로운 통증·저림·힘 빠짐·어지러움·호흡 이상이 있으면 해당 운동을 멈추고 코치에게 알려 주세요.",
];
