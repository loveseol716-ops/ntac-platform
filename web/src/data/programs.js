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

/*
 * RUN 카테고리이면서
 * INTERVAL 세션인지 확인한다.
 */
function isRunIntervalWorkout(
  workout,
) {
  const category = String(
    workout.category || '',
  ).toUpperCase()

  const sessionType = String(
    workout.sessionType ||
      workout.type ||
      '',
  ).toUpperCase()

  return (
    category === 'RUN' &&
    (
      workout.runTrainerEnabled ===
        true ||
      sessionType.includes(
        'INTERVAL',
      )
    )
  )
}

/*
 * 기존 Supabase 프로그램에
 * runTrainerKey가 저장되어 있지 않아도
 * 프로그램 제목과 설명으로 연결한다.
 */
function resolveRunTrainerKey(
  workout,
) {
  const explicitKey = String(
    workout.runTrainerKey || '',
  ).trim()

  if (explicitKey) {
    return explicitKey
  }

  const title = String(
    workout.title || '',
  ).toLowerCase()

  const subtitle = String(
    workout.subtitle || '',
  ).toLowerCase()

  const description = String(
    workout.description || '',
  ).toLowerCase()

  const sessionType = String(
    workout.sessionType ||
      workout.type ||
      '',
  ).toLowerCase()

  const workoutText = [
    title,
    subtitle,
    description,
    sessionType,
  ].join(' ')

  /*
   * 800m Interval
   */
  if (
    workoutText.includes('800m') &&
    workoutText.includes(
      'interval',
    )
  ) {
    return '2026-w32-run-800m'
  }

  /*
   * 6분 Threshold Interval
   */
  if (
    workoutText.includes(
      'threshold',
    ) ||
    workoutText.includes('6분')
  ) {
    return (
      '2026-w32-run-threshold-6min'
    )
  }

  return ''
}

function createSessions(category) {
  const normalizedCategory =
    String(category).toUpperCase()

  return publishedWorkouts
    .filter(
      (workout) =>
        String(
          workout.category || '',
        ).toUpperCase() ===
        normalizedCategory,
    )
    .map((workout) => {
      const runTrainerKey =
        resolveRunTrainerKey(
          workout,
        )

      const runTrainerEnabled =
        isRunIntervalWorkout(
          workout,
        ) &&
        Boolean(
          runTrainerKey,
        )

      return {
        id:
          workout.sessionId,

        eventId:
          workout.eventId ||
          workout.id ||
          '',

        weekKey:
          workout.weekKey ||
          workout.week_key ||
          workout.weekId ||
          '',

        type:
          workout.sessionType ||
          workout.category,

        title:
          workout.title,

        subtitle:
          workout.subtitle ||
          workout.description,

        targetRpe:
          workout.targetRpe ||
          '',

        targets:
          normalizeTargets(
            workout.targets,
          ),

        sections:
          normalizeSections(
            workout.sections,
          ),

        runTrainerEnabled,

        runTrainerKey,
      }
    })
}

export const programs = {
  run: {
    eyebrow: 'RUN PROGRAM',

    title:
      '주간 러닝 프로그램',

    description:
      '이번 주 공개된 러닝 프로그램',

    sessions:
      createSessions('RUN'),
  },

  build: {
    eyebrow: 'BUILD PROGRAM',

    title:
      '하이록스 보강 프로그램',

    description:
      '이번 주 공개된 하이록스 보강 프로그램',

    sessions:
      createSessions('BUILD'),
  },
}

let loadedMemberId = ''

let memberOverrideCache = {
  byEventId: {},
  bySessionId: {},
}

function normalizeOverride(row) {
  return {
    overrideId:
      row.id,

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
    .order(
      'updated_at',
      {
        ascending: false,
      },
    )

  if (error) {
    console.error(
      '개인 프로그램 조회 실패:',
      error,
    )

    throw error
  }

  const byEventId = {}
  const bySessionId = {}

  ;(data || []).forEach(
    (row) => {
      const override =
        normalizeOverride(row)

      if (
        row.event_id &&
        !byEventId[
          row.event_id
        ]
      ) {
        byEventId[
          row.event_id
        ] = override
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
    },
  )

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
    .map(
      ([key, label]) => ({
        label,
        value:
          String(data[key]),
      }),
    )
}

function getOverrideTargets(data) {
  if (
    Array.isArray(
      data.targets,
    )
  ) {
    return data.targets
  }

  return createLegacyTargets(
    data,
  )
}

export function getPersonalizedSession(
  session,
  memberId,
  calendarEventId = '',
) {
  if (
    !memberId ||
    loadedMemberId !==
      memberId
  ) {
    return {
      ...session,

      targets:
        normalizeTargets(
          session.targets,
        ),

      isPersonalized:
        false,
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

      isPersonalized:
        false,
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
      data.subtitle !==
      undefined
        ? data.subtitle
        : session.subtitle,

    targetRpe:
      data.targetRpe !==
      undefined
        ? data.targetRpe
        : session.targetRpe,

    targets:
      personalizedTargets
        .length > 0
        ? personalizedTargets
        : normalizeTargets(
            session.targets,
          ),

    sections:
      Array.isArray(
        data.sections,
      )
        ? data.sections
        : normalizeSections(
            session.sections,
          ),

    /*
     * 개인 프로그램이 적용돼도
     * 런트레이너 연결 정보는 유지한다.
     */
    runTrainerEnabled:
      session.runTrainerEnabled,

    runTrainerKey:
      session.runTrainerKey,

    coachNote:
      override.coachNote ||
      data.coachNote ||
      '',

    isPersonalized:
      true,

    personalizationMode:
      data.personalizedProgram
        ? 'full-program'
        : 'legacy',
  }
}