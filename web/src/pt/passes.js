import { today } from "./model.js";
export function passUsage(pass, sessions, day = today()) {
  const rows = sessions.filter((s) => s.package_id === pass.id);
  const used = rows.filter((s) => s.status === "completed").length;
  const reserved = rows.filter((s) => s.status === "scheduled").length;
  const remaining = Math.max(0, pass.total_sessions - used);
  const inPeriod =
    pass.starts_on <= day && (!pass.expires_on || pass.expires_on >= day);
  const state =
    used >= pass.total_sessions
      ? "사용 완료"
      : pass.expires_on && pass.expires_on < day
        ? "기간 만료"
        : pass.starts_on > day
          ? "사용 예정"
          : "사용 중";
  return {
    used,
    reserved,
    remaining,
    inPeriod,
    state,
    available: inPeriod ? Math.max(0, remaining - reserved) : 0,
    rows,
  };
}
export function currentBalance(passes, sessions, day = today()) {
  return passes.reduce((n, p) => {
    const u = passUsage(p, sessions, day);
    return n + (u.inPeriod ? u.remaining : 0);
  }, 0);
}
export function orderedPasses(passes) {
  return [...passes].sort(
    (a, b) =>
      (a.purchased_on || a.created_at).localeCompare(
        b.purchased_on || b.created_at,
      ) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
}
export function passLabel(passes, id) {
  const all = orderedPasses(passes),
    index = all.findIndex((p) => p.id === id);
  return index < 0
    ? "횟수권 확인 필요"
    : `${index + 1}번째 · ${all[index].title}`;
}
