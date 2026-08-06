import { supabase } from '../lib/supabase.js'

export const COACH_REQUEST_STATUS = {
  REQUESTED: {
    label: '요청 접수',
  },

  CONTACTED: {
    label: '코치 연락 완료',
  },

  COMPLETED: {
    label: '세션 완료',
  },

  CANCELLED: {
    label: '요청 취소',
  },
}

const REQUEST_SELECT = `
  id,
  member_id,
  coach_name,
  request_month,
  request_message,
  status,
  is_read,
  requested_at,
  contacted_at,
  completed_at,
  updated_at
`

function getCurrentMonthKey(
  date = new Date(),
) {
  return [
    date.getFullYear(),

    String(
      date.getMonth() + 1,
    ).padStart(2, '0'),

    '01',
  ].join('-')
}

function normalizeRequest(row) {
  return {
    id: row.id,

    memberId:
      row.member_id,

    coachName:
      row.coach_name || '미배정',

    requestMonth:
      row.request_month,

    message:
      row.request_message || '',

    status:
      row.status || 'REQUESTED',

    statusLabel:
      COACH_REQUEST_STATUS[
        row.status
      ]?.label || '요청 접수',

    isRead:
      Boolean(row.is_read),

    requestedAt:
      row.requested_at,

    contactedAt:
      row.contacted_at,

    completedAt:
      row.completed_at,

    updatedAt:
      row.updated_at,
  }
}

async function getCurrentUser() {
  const {
    data,
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  if (!data.user) {
    throw new Error(
      '로그인 정보를 찾을 수 없습니다.',
    )
  }

  return data.user
}

export async function loadMyCoachSessionRequests() {
  const user =
    await getCurrentUser()

  const {
    data,
    error,
  } = await supabase
    .from(
      'coach_session_requests',
    )
    .select(REQUEST_SELECT)
    .eq(
      'member_id',
      user.id,
    )
    .order(
      'request_month',
      {
        ascending: false,
      },
    )

  if (error) {
    throw error
  }

  return (
    data || []
  ).map(normalizeRequest)
}

export async function loadCurrentMonthCoachRequest() {
  const user =
    await getCurrentUser()

  const currentMonth =
    getCurrentMonthKey()

  const {
    data,
    error,
  } = await supabase
    .from(
      'coach_session_requests',
    )
    .select(REQUEST_SELECT)
    .eq(
      'member_id',
      user.id,
    )
    .eq(
      'request_month',
      currentMonth,
    )
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
    ? normalizeRequest(data)
    : null
}

export async function createCoachSessionRequest({
  memberId,
  coachName,
  message,
}) {
  const user =
    await getCurrentUser()

  if (
    memberId &&
    memberId !== user.id
  ) {
    throw new Error(
      '본인의 코치 세션만 요청할 수 있습니다.',
    )
  }

  if (
    !coachName ||
    coachName === '미배정'
  ) {
    throw new Error(
      '담당 코치가 배정되지 않았습니다.',
    )
  }

  const currentMonth =
    getCurrentMonthKey()

  const payload = {
    member_id: user.id,

    coach_name:
      coachName.trim(),

    request_month:
      currentMonth,

    request_message:
      message?.trim() || null,

    status:
      'REQUESTED',

    is_read:
      false,
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'coach_session_requests',
    )
    .insert(payload)
    .select(REQUEST_SELECT)
    .single()

  if (error) {
    if (
      error.code === '23505'
    ) {
      throw new Error(
        '이번 달 코치 세션은 이미 요청했습니다.',
      )
    }

    throw error
  }

  return normalizeRequest(data)
}

export async function loadAllCoachSessionRequests() {
  const {
    data,
    error,
  } = await supabase
    .from(
      'coach_session_requests',
    )
    .select(
      `
        ${REQUEST_SELECT},
        profiles!coach_session_requests_member_id_fkey (
          id,
          full_name,
          email,
          membership,
          coach_name
        )
      `,
    )
    .order(
      'requested_at',
      {
        ascending: false,
      },
    )

  if (error) {
    throw error
  }

  return (
    data || []
  ).map((row) => ({
    ...normalizeRequest(row),

    memberName:
      row.profiles?.full_name ||
      row.profiles?.email ||
      '이름 없는 멤버',

    memberEmail:
      row.profiles?.email || '',

    membership:
      row.profiles?.membership || '',
  }))
}

export async function markCoachSessionRequestRead(
  requestId,
) {
  if (!requestId) {
    throw new Error(
      '요청 정보를 찾을 수 없습니다.',
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'coach_session_requests',
    )
    .update({
      is_read: true,
    })
    .eq(
      'id',
      requestId,
    )
    .select(REQUEST_SELECT)
    .single()

  if (error) {
    throw error
  }

  return normalizeRequest(data)
}

export async function updateCoachSessionRequestStatus(
  requestId,
  status,
) {
  if (!requestId) {
    throw new Error(
      '요청 정보를 찾을 수 없습니다.',
    )
  }

  if (
    !COACH_REQUEST_STATUS[
      status
    ]
  ) {
    throw new Error(
      '올바르지 않은 요청 상태입니다.',
    )
  }

  const now =
    new Date().toISOString()

  const payload = {
    status,
    is_read: true,
  }

  if (status === 'CONTACTED') {
    payload.contacted_at = now
  }

  if (status === 'COMPLETED') {
    payload.completed_at = now
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'coach_session_requests',
    )
    .update(payload)
    .eq(
      'id',
      requestId,
    )
    .select(REQUEST_SELECT)
    .single()

  if (error) {
    throw error
  }

  return normalizeRequest(data)
}

export function subscribeToCoachSessionRequests(
  onChange,
) {
  const channel = supabase
    .channel(
      'coach-session-request-alerts',
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table:
          'coach_session_requests',
      },
      (payload) => {
        if (
          typeof onChange ===
          'function'
        ) {
          onChange(payload)
        }
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(
      channel,
    )
  }
}

export {
  getCurrentMonthKey,
}