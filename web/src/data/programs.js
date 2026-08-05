import { supabase } from '../lib/supabase.js'

import {
  getPublishedWorkouts,
} from './weeklyPrograms'

const publishedWorkouts =
  getPublishedWorkouts()

function normalizeSections(sections) {
  return Array.isArray(sections)
    ? sections
    : []
}

function normalizeTargets(targets) {
  return Array.isArray(targets)
    ? targets
    : []
}

function createSessions(category) {
  return publishedWorkouts
    .filter(
      (workout) =>
        workout.category === category,
    )
    .map((workout) => ({
      id: workout.sessionId,

      eventId:
        workout.eventId ||
        workout.id ||
        '',

      weekKey:
        workout.weekKey ||
        workout.week_key ||
        '',

      type:
        workout.sessionType ||
        workout.category,

      title: workout.title,

      subtitle:
        workout.subtitle ||
        workout.description,

      targetRpe:
        workout.targetRpe || '',

      targets:
        normalizeTargets(
          workout.targets,
        ),

      sections:
        normalizeSections(
          workout.sections,
        ),
    }))
}

export const programs = {
  run: {
    eyebrow: 'RUN PROGRAM',
    title: '주간 러닝 프로그램',
    description:
      '이번 주 공개된 러닝 프로그램',
    sessions: createSessions('RUN'),
  },

  build: {
    eyebrow: 'BUILD PROGRAM',
    title: '하이록스 보강 프로그램',
    description:
      '이번 주 공개된 하이록스 보강 프로그램',
    sessions: createSessions('BUILD'),
  },
}

let loadedMemberId = ''

let memberOverrideCache = {
  byEventId: {},
  bySessionId: {},
}

function normalizeOverride(row) {
  return {
    overrideId: row.id,

    eventId:
      row.event_id || '',

    sessionId:
      row.session_id || '',

    weekKey:
      row.week_key || '',

    data:
      row.override_data || {},

    coachNote:
      row.coach_note || '',
  }
}

export async function loadMemberProgramOverrides(
  memberId,
) {
  if (!memberId) {
    loadedMemberId = ''

    memberOverrideCache = {
      byEventId: {},
      bySessionId: {},
    }

    return memberOverrideCache
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'member_program_overrides',
    )
    .select(
      `
        id,
        user_id,
        event_id,
        session_id,
        week_key,
        override_data,
        coach_note,
        updated_at
      `,
    )
    .eq(
      'user_id',
      memberId,
    )
    .order('updated_at', {
      ascending: false,
    })

  if (error) {
    console.error(
      '개인 프로그램 조회 실패:',
      error,
    )

    throw error
  }

  const byEventId = {}
  const bySessionId = {}

  ;(data || []).forEach((row) => {
    const override =
      normalizeOverride(row)

    if (
      row.event_id &&
      !byEventId[row.event_id]
    ) {
      byEventId[row.event_id] =
        override
    }

    if (
      row.session_id &&
      !bySessionId[
        row.session_id
      ]
    ) {
      bySessionId[
        row.session_id
      ] = override
    }
  })

  loadedMemberId = memberId

  memberOverrideCache = {
    byEventId,
    bySessionId,
  }

  return memberOverrideCache
}

export function clearMemberProgramOverrides() {
  loadedMemberId = ''

  memberOverrideCache = {
    byEventId: {},
    bySessionId: {},
  }
}

function createLegacyTargets(data) {
  const legacyTargetMap = [
    [
      'targetPace',
      '목표 페이스',
    ],
    [
      'treadmillSpeed',
      '트레드밀 속도',
    ],
    [
      'duration',
      '운동 시간·거리',
    ],
    [
      'repetitions',
      '반복 횟수',
    ],
    [
      'recovery',
      '회복 시간',
    ],
    [
      'targetLoad',
      '목표 중량',
    ],
    [
      'exerciseNote',
      '운동 변경',
    ],
    [
      'volumeNote',
      '볼륨 조정',
    ],
  ]

  return legacyTargetMap
    .filter(
      ([key]) =>
        data[key] !== undefined &&
        data[key] !== null &&
        data[key] !== '',
    )
    .map(([key, label]) => ({
      label,
      value: String(data[key]),
    }))
}

function getOverrideTargets(data) {
  if (Array.isArray(data.targets)) {
    return data.targets
  }

  return createLegacyTargets(data)
}

export function getPersonalizedSession(
  session,
  memberId,
  calendarEventId = '',
) {
  if (
    !memberId ||
    loadedMemberId !== memberId
  ) {
    return {
      ...session,

      targets:
        normalizeTargets(
          session.targets,
        ),

      isPersonalized: false,
    }
  }

  const overrideByEvent =
    calendarEventId
      ? memberOverrideCache
          .byEventId[
            calendarEventId
          ]
      : null

  const overrideBySession =
    memberOverrideCache
      .bySessionId[
        session.id
      ]

  const override =
    overrideByEvent ||
    overrideBySession ||
    null

  if (!override) {
    return {
      ...session,

      targets:
        normalizeTargets(
          session.targets,
        ),

      isPersonalized: false,
    }
  }

  const data =
    override.data || {}

  const personalizedTargets =
    getOverrideTargets(data)

  return {
    ...session,
    ...data,

    title:
      data.title !== undefined
        ? data.title
        : session.title,

    subtitle:
      data.subtitle !== undefined
        ? data.subtitle
        : session.subtitle,

    targetRpe:
      data.targetRpe !== undefined
        ? data.targetRpe
        : session.targetRpe,

    targets:
      personalizedTargets.length > 0
        ? personalizedTargets
        : normalizeTargets(
            session.targets,
          ),

    sections:
      Array.isArray(data.sections)
        ? data.sections
        : normalizeSections(
            session.sections,
          ),

    coachNote:
      override.coachNote ||
      data.coachNote ||
      '',

    isPersonalized: true,

    personalizationMode:
      data.personalizedProgram
        ? 'full-program'
        : 'legacy',
  }
}