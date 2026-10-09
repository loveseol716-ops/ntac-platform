export function getLocalDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
}
export function formatAccessDate(value) { return value || '—' }
export function getMemberAccessState(profile) {
  const admin = ['owner','admin'].includes(profile?.role)
  const allowed = admin || profile?.ntac_enabled === true
  return {allowed, status: admin ? 'ADMIN' : allowed ? 'MEMBER' : 'PENDING', label: admin ? '관리자' : allowed ? '회원' : '등록 대기', reason: allowed ? '' : '관리자가 이용 프로그램을 지정하면 시작할 수 있습니다.', until:null, needsDate:false}
}
