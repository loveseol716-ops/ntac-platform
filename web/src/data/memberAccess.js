function getLocalDateKey(date = new Date()) {
  const timezoneOffset =
    date.getTimezoneOffset() * 60000

  return new Date(
    date.getTime() - timezoneOffset,
  )
    .toISOString()
    .slice(0, 10)
}

function isDateActive(dateKey, todayKey) {
  if (!dateKey) {
    return false
  }

  return String(dateKey) >= String(todayKey)
}

export function formatAccessDate(dateKey) {
  if (!dateKey) {
    return '-'
  }

  return new Date(
    `${dateKey}T00:00:00`,
  ).toLocaleDateString('ko-KR')
}

export function getMemberAccessState(
  profile,
  today = new Date(),
) {
  const todayKey =
    getLocalDateKey(today)

  const role =
    profile?.role || 'member'

  if (
    role === 'admin' ||
    role === 'owner'
  ) {
    return {
      allowed: true,
      status: 'ADMIN',
      label: '관리자',
      reason: '관리자 계정',
      until: null,
      needsDate: false,
    }
  }

  const membershipStatus =
    profile?.membership_status ||
    'active'

  if (membershipStatus === 'paused') {
    return {
      allowed: false,
      status: 'PAUSED',
      label: '일시정지',
      reason: '멤버십이 일시정지 상태입니다.',
      until: null,
      needsDate: false,
    }
  }

  if (membershipStatus === 'expired') {
    return {
      allowed: false,
      status: 'EXPIRED',
      label: '이용 종료',
      reason: '멤버십이 만료 상태입니다.',
      until: null,
      needsDate: false,
    }
  }

  const paidUntil =
    profile?.paid_until || null

  const trialEndsAt =
    profile?.trial_ends_at || null

  const overrideUntil =
    profile?.access_override_until ||
    null

  if (
    isDateActive(
      overrideUntil,
      todayKey,
    )
  ) {
    return {
      allowed: true,
      status: 'OVERRIDE',
      label: '임시 연장',
      reason: '관리자 임시 이용 기간',
      until: overrideUntil,
      needsDate: false,
    }
  }

  if (
    isDateActive(
      trialEndsAt,
      todayKey,
    )
  ) {
    return {
      allowed: true,
      status: 'TRIAL',
      label: '체험 중',
      reason: '무료 체험 이용 기간',
      until: trialEndsAt,
      needsDate: false,
    }
  }

  if (
    isDateActive(
      paidUntil,
      todayKey,
    )
  ) {
    return {
      allowed: true,
      status: 'PAID',
      label: '정상 이용',
      reason: '결제 완료 이용 기간',
      until: paidUntil,
      needsDate: false,
    }
  }

  const hasAnyAccessDate =
    Boolean(
      paidUntil ||
        trialEndsAt ||
        overrideUntil,
    )

  // 기존 멤버 전환 기간용 안전장치입니다.
  // 날짜가 한 번도 입력되지 않은 기존 active 멤버는
  // 즉시 잠그지 않고 관리자 대시보드에서 '기간 미설정'으로 표시합니다.
  if (!hasAnyAccessDate) {
    return {
      allowed: true,
      status: 'LEGACY',
      label: '기간 미설정',
      reason:
        '기존 멤버입니다. 관리자에서 이용 종료일을 설정해 주세요.',
      until: null,
      needsDate: true,
    }
  }

  return {
    allowed: false,
    status: 'EXPIRED',
    label: '결제 필요',
    reason:
      '이용 기간이 종료되었습니다.',
    until:
      paidUntil ||
      trialEndsAt ||
      overrideUntil ||
      null,
    needsDate: false,
  }
}

export { getLocalDateKey }
