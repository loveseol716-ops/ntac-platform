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

export function getCurrentMonthKey(
  date = new Date(),
) {
  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, '0')

  return `${year}-${month}-01`
}

function normalizeRequest(row) {
  const status =
    row?.status ||
    'REQUESTED'

  return {
    id:
      row?.id || '',

    memberId:
      row?.member_id || '',

    coachName:
      row?.coach_name ||
      '미배정',

    requestMonth:
      row?.request_month || '',

    message:
      row?.request_message || '',

    status,

    statusLabel:
      COACH_REQUEST_STATUS[
        status
      ]?.label ||
      '요청 접수',

    isRead:
      Boolean(
        row?.is_read,
      ),

    requestedAt:
      row?.requested_at ||
      null,

    contactedAt:
      row?.contacted_at ||
      null,

    completedAt:
      row?.completed_at ||
      null,

    updatedAt:
      row?.updated_at ||
      null,
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

  if (!data?.user) {
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
    .select(
      REQUEST_SELECT,
    )
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

  const rows =
    Array.isArray(data)
      ? data
      : []

  return rows.map(
    normalizeRequest,
  )
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
    .select(
      REQUEST_SELECT,
    )
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

  const normalizedCoachName =
    String(
      coachName || '',
    ).trim()

  if (
    !normalizedCoachName ||
    normalizedCoachName ===
      '미배정'
  ) {
    throw new Error(
      '담당 코치가 배정되지 않았습니다.',
    )
  }

  const requestMessage =
    String(
      message || '',
    ).trim()

  const {
    data,
    error,
  } = await supabase
    .from(
      'coach_session_requests',
    )
    .insert({
      member_id:
        user.id,

      coach_name:
        normalizedCoachName,

      request_month:
        getCurrentMonthKey(),

      request_message:
        requestMessage ||
        null,

      status:
        'REQUESTED',

      is_read:
        false,
    })
    .select(
      REQUEST_SELECT,
    )
    .single()

  if (error) {
    if (
      error.code ===
      '23505'
    ) {
      throw new Error(
        '이번 달 코치 세션은 이미 요청했습니다.',
      )
    }

    throw error
  }

  return normalizeRequest(
    data,
  )
}

export async function loadAllCoachSessionRequests() {
  const {
    data: requestRows,
    error: requestError,
  } = await supabase
    .from(
      'coach_session_requests',
    )
    .select(
      REQUEST_SELECT,
    )
    .order(
      'requested_at',
      {
        ascending: false,
      },
    )

  if (requestError) {
    throw requestError
  }

  const safeRequestRows =
    Array.isArray(
      requestRows,
    )
      ? requestRows
      : []

  const memberIds = [
    ...new Set(
      safeRequestRows
        .map(
          (row) =>
            row.member_id,
        )
        .filter(Boolean),
    ),
  ]

  let profilesById =
    new Map()

  if (
    memberIds.length > 0
  ) {
    const {
      data: profileRows,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select(
        `
          id,
          full_name,
          email,
          membership,
          coach_name
        `,
      )
      .in(
        'id',
        memberIds,
      )

    if (profileError) {
      throw profileError
    }

    const safeProfileRows =
      Array.isArray(
        profileRows,
      )
        ? profileRows
        : []

    profilesById =
      new Map(
        safeProfileRows.map(
          (profile) => [
            profile.id,
            profile,
          ],
        ),
      )
  }

  return safeRequestRows.map(
    (row) => {
      const profile =
        profilesById.get(
          row.member_id,
        ) || null

      return {
        ...normalizeRequest(
          row,
        ),

        memberName:
          profile?.full_name ||
          profile?.email ||
          '이름 없는 멤버',

        memberEmail:
          profile?.email ||
          '',

        membership:
          profile?.membership ||
          '',
      }
    },
  )
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
    .select(
      REQUEST_SELECT,
    )
    .single()

  if (error) {
    throw error
  }

  return normalizeRequest(
    data,
  )
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

  if (
    status ===
    'CONTACTED'
  ) {
    payload.contacted_at =
      now
  }

  if (
    status ===
    'COMPLETED'
  ) {
    payload.completed_at =
      now
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
    .select(
      REQUEST_SELECT,
    )
    .single()

  if (error) {
    throw error
  }

  return normalizeRequest(
    data,
  )
}

export function subscribeToCoachSessionRequests(
  onChange,
  channelKey = 'default',
) {
  const safeChannelKey =
    String(channelKey)
      .replace(
        /[^a-zA-Z0-9-_]/g,
        '-',
      )

  const randomKey =
    Math.random()
      .toString(36)
      .slice(2, 8)

  const channelName = [
    'coach-session-requests',
    safeChannelKey,
    Date.now(),
    randomKey,
  ].join('-')

  const channel =
    supabase
      .channel(
        channelName,
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
            onChange(
              payload,
            )
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