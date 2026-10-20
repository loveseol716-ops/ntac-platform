export const SERVICES = [
  { id: "pt", label: "PT", description: "개인 수업 예약 · 횟수권 · 운동 일지" },
  {
    id: "ntac",
    label: "NTAC",
    description: "훈련 프로그램 · 평가 · 주간 리포트",
  },
  {
    id: "group",
    label: "그룹수업",
    description: "오늘 운동 · 추천 중량 · 수업 기록",
  },
];
export function memberServiceState(profile, ptMember, groupMember) {
  return {
    ntac: profile.ntac_enabled === true,
    pt: ptMember?.active === true,
    group: groupMember?.active === true,
    ntac_coach_id: profile.assigned_coach_id || null,
    pt_coach_id: ptMember?.coach_id || null,
  };
}
export const serviceLabels = (state) =>
  SERVICES.filter((s) => state[s.id]).map((s) => s.label);
