import { supabase } from '../lib/supabase.js'

import {
  DEFAULT_WEEK_TYPE,
  getWeekTypeLabel,
} from './weeklyPrograms.js'

import {
  parseTargetRpe,
} from './memberRecords.js'

export const REPORT_STATUS_OPTIONS = {
  ALIGNED: {
    label: '프로그램 의도 부합',
    tone: 'positive',
  },

  UNDER_TARGET: {
    label: '목표 강도보다 낮음',
    tone: 'warning',
  },

  OVER_TARGET: {
    label: '목표보다 부담 높음',
    tone: 'danger',
  },

  RECOVERY_LOW: {
    label: '회복 상태 확인 필요',
    tone: 'warning',
  },

  COACH_REVIEW: {
    label: '코치 확인 필요',
    tone: 'neutral',
  },
}

const REPORT_SELECT = `
  id,
  user_id,
  week_key,
  week_label,
  week_type,
  start_date,
  end_date,
  planned_sessions,
  completed_sessions,
  expected_rpe_average,
  actual_rpe_average,
  rpe_gap_average,
  checkin_days,
  average_condition,
  average_sleep,
  average_soreness,
  average_stress,
  pain_detected,
  analysis_status,
  analysis_summary,
  analysis_payload,
  coach_comment,
  reviewed_by,
  reviewed_at,
  is_published,
  published_at,
  created_at,
  updated_at
`

function roundNumber(
  value,
  digits = 2,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return null
  }

  const multiplier =
    10 ** digits

  return (
    Math.round(
      Number(value) *
        multiplier,
    ) / multiplier
  )
}

function average(values) {
  const validValues =
    values
      .map(Number)
      .filter(Number.isFinite)

  if (
    validValues.length === 0
  ) {
    return null
  }

  const total =
    validValues.reduce(
      (sum, value) =>
        sum + value,
      0,
    )

  return roundNumber(
    total /
      validValues.length,
  )
}

function getWeekDateRange(
  week,
) {
  const dates = (
    week?.workouts || []
  )
    .map(
      (workout) =>
        workout.date,
    )
    .filter(Boolean)
    .sort()

  const today = new Date()
    .toISOString()
    .slice(0, 10)

  return {
    startDate:
      dates[0] || today,

    endDate:
      dates[
        dates.length - 1
      ] ||
      dates[0] ||
      today,
  }
}

function hasPain(checkin) {
  const pain = String(
    checkin.pain ||
      checkin.pain_level ||
      '',
  )
    .trim()
    .toLowerCase()

  if (!pain) {
    return false
  }

  return ![
    '없음',
    'none',
    'no',
    '0',
    '무',
  ].includes(pain)
}

function normalizeCheckin(row) {
  return {
    id: row.id,

    date:
      row.checkin_date,

    condition:
      Number(
        row.condition_score,
      ),

    sleep:
      Number(
        row.sleep_hours,
      ),

    soreness:
      Number(
        row.soreness_score,
      ),

    stress:
      Number(
        row.stress_score,
      ),

    pain:
      row.pain_level || '',

    painArea:
      row.pain_area || '',

    message:
      row.message || '',
  }
}

function normalizeWorkoutRecord(
  row,
) {
  return {
    id: row.id,

    sessionId:
      row.session_id,

    eventId:
      row.event_id || '',

    date:
      row.workout_date || '',

    title:
      row.title || '',

    type:
      row.workout_type || '',

    actualRpe:
      Number(row.rpe),

    targetRpe:
      row.target_rpe === null ||
      row.target_rpe === undefined
        ? null
        : Number(
            row.target_rpe,
          ),

    targetRpeLabel:
      row.target_rpe_label ||
      '',

    weekId:
      row.week_key || '',

    weekType:
      row.week_type || '',

    completedAt:
      row.completed_at,
  }
}

function normalizeReport(row) {
  return {
    id: row.id,

    userId:
      row.user_id,

    weekId:
      row.week_key,

    weekLabel:
      row.week_label,

    weekType:
      row.week_type,

    weekTypeLabel:
      getWeekTypeLabel(
        row.week_type,
      ),

    startDate:
      row.start_date,

    endDate:
      row.end_date,

    plannedSessions:
      Number(
        row.planned_sessions ||
          0,
      ),

    completedSessions:
      Number(
        row.completed_sessions ||
          0,
      ),

    expectedRpeAverage:
      row.expected_rpe_average ===
        null
        ? null
        : Number(
            row.expected_rpe_average,
          ),

    actualRpeAverage:
      row.actual_rpe_average ===
        null
        ? null
        : Number(
            row.actual_rpe_average,
          ),

    rpeGapAverage:
      row.rpe_gap_average ===
        null
        ? null
        : Number(
            row.rpe_gap_average,
          ),

    checkinDays:
      Number(
        row.checkin_days || 0,
      ),

    averageCondition:
      row.average_condition ===
        null
        ? null
        : Number(
            row.average_condition,
          ),

    averageSleep:
      row.average_sleep ===
        null
        ? null
        : Number(
            row.average_sleep,
          ),

    averageSoreness:
      row.average_soreness ===
        null
        ? null
        : Number(
            row.average_soreness,
          ),

    averageStress:
      row.average_stress ===
        null
        ? null
        : Number(
            row.average_stress,
          ),

    painDetected:
      Boolean(
        row.pain_detected,
      ),

    status:
      row.analysis_status,

    statusLabel:
      REPORT_STATUS_OPTIONS[
        row.analysis_status
      ]?.label ||
      '코치 확인 필요',

    summary:
      row.analysis_summary ||
      '',

    payload:
      row.analysis_payload ||
      {},

    coachComment:
      row.coach_comment ||
      '',

    reviewedBy:
      row.reviewed_by,

    reviewedAt:
      row.reviewed_at,

    isPublished:
      Boolean(
        row.is_published,
      ),

    publishedAt:
      row.published_at,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  }
}

function getWorkoutIdentity(
  week,
  workout,
  index,
) {
  const category =
    String(
      workout.category ||
        'TRAINING',
    ).toUpperCase()

  const sessionId =
    workout.sessionId ||
    `${
      week.weekId.toLowerCase()
    }-${
      category.toLowerCase()
    }-${index + 1}`

  const eventId =
    workout.eventId ||
    `${workout.date}-${sessionId}`

  return {
    sessionId,
    eventId,
  }
}

function createSessionAnalysis(
  week,
  workoutRecords,
) {
  const recordByEventId =
    new Map()

  const recordBySessionId =
    new Map()

  workoutRecords.forEach(
    (record) => {
      if (record.eventId) {
        recordByEventId.set(
          record.eventId,
          record,
        )
      }

      if (record.sessionId) {
        recordBySessionId.set(
          record.sessionId,
          record,
        )
      }
    },
  )

  return (
    week.workouts || []
  ).map(
    (
      workout,
      index,
    ) => {
      const {
        sessionId,
        eventId,
      } = getWorkoutIdentity(
        week,
        workout,
        index,
      )

      const record =
        recordByEventId.get(
          eventId,
        ) ||
        recordBySessionId.get(
          sessionId,
        ) ||
        null

      const programmedTargetRpe =
        parseTargetRpe(
          workout.targetRpe,
        )

      const storedTargetRpe =
        record?.targetRpe

      const targetRpe =
        Number.isFinite(
          storedTargetRpe,
        )
          ? storedTargetRpe
          : programmedTargetRpe

      const actualRpe =
        Number.isFinite(
          record?.actualRpe,
        )
          ? record.actualRpe
          : null

      const rpeGap =
        Number.isFinite(
          targetRpe,
        ) &&
        Number.isFinite(
          actualRpe,
        )
          ? roundNumber(
              actualRpe -
                targetRpe,
              1,
            )
          : null

      return {
        sessionId,
        eventId,

        date:
          workout.date || '',

        type:
          workout.category ||
          record?.type ||
          '',

        title:
          workout.title ||
          record?.title ||
          '훈련',

        targetRpe,

        targetRpeLabel:
          workout.targetRpe ||
          record
            ?.targetRpeLabel ||
          '',

        actualRpe,

        rpeGap,

        completed:
          Boolean(record),

        completedAt:
          record?.completedAt ||
          null,
      }
    },
  )
}

function getGapThresholds(
  weekType,
) {
  if (
    weekType === 'DELOAD' ||
    weekType ===
      'CONDITIONING_RECOVERY'
  ) {
    return {
      under: -1.5,
      over: 0.75,
    }
  }

  if (
    weekType === 'TEST' ||
    weekType ===
      'SIMULATION'
  ) {
    return {
      under: -1.25,
      over: 1.25,
    }
  }

  return {
    under: -1,
    over: 1,
  }
}

function getRecoveryAnalysis(
  checkins,
) {
  const averageCondition =
    average(
      checkins.map(
        (checkin) =>
          checkin.condition,
      ),
    )

  const averageSleep =
    average(
      checkins.map(
        (checkin) =>
          checkin.sleep,
      ),
    )

  const averageSoreness =
    average(
      checkins.map(
        (checkin) =>
          checkin.soreness,
      ),
    )

  const averageStress =
    average(
      checkins.map(
        (checkin) =>
          checkin.stress,
      ),
    )

  const painDetected =
    checkins.some(hasPain)

  const recoverySignals = []

  if (
    averageCondition !== null &&
    averageCondition <= 2.5
  ) {
    recoverySignals.push(
      '평균 컨디션 저하',
    )
  }

  if (
    averageSleep !== null &&
    averageSleep < 6
  ) {
    recoverySignals.push(
      '수면시간 부족',
    )
  }

  if (
    averageSoreness !== null &&
    averageSoreness >= 4
  ) {
    recoverySignals.push(
      '높은 근육통',
    )
  }

  if (
    averageStress !== null &&
    averageStress >= 4
  ) {
    recoverySignals.push(
      '높은 스트레스',
    )
  }

  if (painDetected) {
    recoverySignals.push(
      '통증 기록 확인',
    )
  }

  const recoveryLow =
    painDetected ||
    recoverySignals.length >= 2

  return {
    averageCondition,
    averageSleep,
    averageSoreness,
    averageStress,
    painDetected,
    recoverySignals,
    recoveryLow,
  }
}

function createAnalysisResult({
  week,
  sessionAnalysis,
  recoveryAnalysis,
}) {
  const completedSessions =
    sessionAnalysis.filter(
      (session) =>
        session.completed,
    )

  const sessionsWithRpe =
    completedSessions.filter(
      (session) =>
        Number.isFinite(
          session.actualRpe,
        ) &&
        Number.isFinite(
          session.targetRpe,
        ),
    )

  const expectedRpeAverage =
    average(
      sessionsWithRpe.map(
        (session) =>
          session.targetRpe,
      ),
    )

  const actualRpeAverage =
    average(
      sessionsWithRpe.map(
        (session) =>
          session.actualRpe,
      ),
    )

  const rpeGapAverage =
    average(
      sessionsWithRpe.map(
        (session) =>
          session.rpeGap,
      ),
    )

  const weekType =
    week.weekType ||
    DEFAULT_WEEK_TYPE

  const weekTypeLabel =
    getWeekTypeLabel(
      weekType,
    )

  const thresholds =
    getGapThresholds(
      weekType,
    )

  let status =
    'COACH_REVIEW'

  if (
    sessionsWithRpe.length > 0
  ) {
    if (
      rpeGapAverage >=
      thresholds.over
    ) {
      status =
        'OVER_TARGET'
    } else if (
      recoveryAnalysis.recoveryLow
    ) {
      status =
        'RECOVERY_LOW'
    } else if (
      rpeGapAverage <=
      thresholds.under
    ) {
      status =
        'UNDER_TARGET'
    } else {
      status =
        'ALIGNED'
    }
  }

  const gapText =
    rpeGapAverage === null
      ? ''
      : Math.abs(
          rpeGapAverage,
        ).toFixed(1)

  let summary = ''

  if (
    status ===
    'ALIGNED'
  ) {
    summary =
      `${weekTypeLabel} 주간의 목표 강도와 실제 수행 반응이 대체로 일치했습니다. ` +
      `목표 RPE와 실제 RPE의 평균 차이는 ${gapText}입니다.`
  }

  if (
    status ===
    'UNDER_TARGET'
  ) {
    summary =
      `${weekTypeLabel} 주간의 실제 수행 강도가 목표보다 평균 ${gapText} 낮았습니다. ` +
      '다음 주에는 운동 강도 또는 수행 집중도를 확인할 필요가 있습니다.'
  }

  if (
    status ===
    'OVER_TARGET'
  ) {
    summary =
      `${weekTypeLabel} 주간의 실제 수행 강도가 목표보다 평균 ${gapText} 높았습니다. ` +
      '누적 피로와 회복 상태를 확인한 뒤 다음 프로그램 강도를 결정해야 합니다.'
  }

  if (
    status ===
    'RECOVERY_LOW'
  ) {
    const recoveryText =
      recoveryAnalysis
        .recoverySignals
        .join(', ')

    summary =
      `${weekTypeLabel} 주간의 운동 강도는 목표 범위와 크게 벗어나지 않았지만, ` +
      `회복 지표에서 ${recoveryText} 신호가 확인되었습니다.`
  }

  if (
    status ===
    'COACH_REVIEW'
  ) {
    summary =
      `${weekTypeLabel} 주간을 분석할 운동 완료 기록 또는 목표 RPE 데이터가 충분하지 않습니다. ` +
      '코치가 수행 여부와 기록 누락을 확인해 주세요.'
  }

  return {
    status,
    summary,

    expectedRpeAverage,
    actualRpeAverage,
    rpeGapAverage,

    completedSessions:
      completedSessions.length,

    rpeRecordedSessions:
      sessionsWithRpe.length,

    thresholds,
  }
}

export async function loadAthleteReports(
  userId,
) {
  if (!userId) {
    return []
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'weekly_athlete_reports',
    )
    .select(REPORT_SELECT)
    .eq(
      'user_id',
      userId,
    )
    .order(
      'start_date',
      {
        ascending: false,
      },
    )

  if (error) {
    throw error
  }

  return (
    data || []
  ).map(normalizeReport)
}

export async function loadPublishedAthleteReports() {
  const {
    data,
    error,
  } = await supabase
    .from(
      'weekly_athlete_reports',
    )
    .select(REPORT_SELECT)
    .eq(
      'is_published',
      true,
    )
    .order(
      'start_date',
      {
        ascending: false,
      },
    )

  if (error) {
    throw error
  }

  return (
    data || []
  ).map(normalizeReport)
}

export async function loadAthleteReportSource(
  userId,
  week,
) {
  if (!userId) {
    throw new Error(
      '분석할 멤버가 선택되지 않았습니다.',
    )
  }

  if (!week?.weekId) {
    throw new Error(
      '분석할 주차가 선택되지 않았습니다.',
    )
  }

  const {
    startDate,
    endDate,
  } = getWeekDateRange(week)

  const [
    checkinResult,
    workoutResult,
  ] = await Promise.all([
    supabase
      .from('daily_checkins')
      .select(
        `
          id,
          checkin_date,
          condition_score,
          sleep_hours,
          soreness_score,
          stress_score,
          pain_level,
          pain_area,
          message
        `,
      )
      .eq(
        'user_id',
        userId,
      )
      .gte(
        'checkin_date',
        startDate,
      )
      .lte(
        'checkin_date',
        endDate,
      )
      .order(
        'checkin_date',
        {
          ascending: true,
        },
      ),

    supabase
      .from('workout_records')
      .select(
        `
          id,
          session_id,
          event_id,
          workout_date,
          title,
          workout_type,
          rpe,
          target_rpe,
          target_rpe_label,
          week_key,
          week_type,
          completed_at
        `,
      )
      .eq(
        'user_id',
        userId,
      )
      .eq(
        'week_key',
        week.weekId,
      )
      .order(
        'completed_at',
        {
          ascending: true,
        },
      ),
  ])

  if (checkinResult.error) {
    throw checkinResult.error
  }

  if (workoutResult.error) {
    throw workoutResult.error
  }

  return {
    startDate,
    endDate,

    checkins: (
      checkinResult.data || []
    ).map(normalizeCheckin),

    workoutRecords: (
      workoutResult.data || []
    ).map(
      normalizeWorkoutRecord,
    ),
  }
}

export function analyzeAthleteWeek({
  userId,
  week,
  checkins,
  workoutRecords,
}) {
  const {
    startDate,
    endDate,
  } = getWeekDateRange(week)

  const sessionAnalysis =
    createSessionAnalysis(
      week,
      workoutRecords,
    )

  const recoveryAnalysis =
    getRecoveryAnalysis(
      checkins,
    )

  const analysisResult =
    createAnalysisResult({
      week,
      sessionAnalysis,
      recoveryAnalysis,
    })

  const plannedSessions =
    sessionAnalysis.length

  const completedSessions =
    Math.min(
      analysisResult
        .completedSessions,
      plannedSessions,
    )

  return {
    userId,

    weekId:
      week.weekId,

    weekLabel:
      week.label ||
      week.weekId,

    weekType:
      week.weekType ||
      DEFAULT_WEEK_TYPE,

    startDate,
    endDate,

    plannedSessions,
    completedSessions,

    expectedRpeAverage:
      analysisResult
        .expectedRpeAverage,

    actualRpeAverage:
      analysisResult
        .actualRpeAverage,

    rpeGapAverage:
      analysisResult
        .rpeGapAverage,

    checkinDays:
      checkins.length,

    averageCondition:
      recoveryAnalysis
        .averageCondition,

    averageSleep:
      recoveryAnalysis
        .averageSleep,

    averageSoreness:
      recoveryAnalysis
        .averageSoreness,

    averageStress:
      recoveryAnalysis
        .averageStress,

    painDetected:
      recoveryAnalysis
        .painDetected,

    status:
      analysisResult.status,

    summary:
      analysisResult.summary,

    payload: {
      generatedAt:
        new Date().toISOString(),

      weekTypeLabel:
        getWeekTypeLabel(
          week.weekType,
        ),

      sessionAnalysis,

      recoverySignals:
        recoveryAnalysis
          .recoverySignals,

      rpeRecordedSessions:
        analysisResult
          .rpeRecordedSessions,

      thresholds:
        analysisResult
          .thresholds,
    },
  }
}

export async function saveAthleteReport(
  report,
) {
  const now =
    new Date().toISOString()

  const payload = {
    user_id:
      report.userId,

    week_key:
      report.weekId,

    week_label:
      report.weekLabel,

    week_type:
      report.weekType,

    start_date:
      report.startDate,

    end_date:
      report.endDate,

    planned_sessions:
      report.plannedSessions,

    completed_sessions:
      report.completedSessions,

    expected_rpe_average:
      report.expectedRpeAverage,

    actual_rpe_average:
      report.actualRpeAverage,

    rpe_gap_average:
      report.rpeGapAverage,

    checkin_days:
      report.checkinDays,

    average_condition:
      report.averageCondition,

    average_sleep:
      report.averageSleep,

    average_soreness:
      report.averageSoreness,

    average_stress:
      report.averageStress,

    pain_detected:
      report.painDetected,

    analysis_status:
      report.status,

    analysis_summary:
      report.summary,

    analysis_payload:
      report.payload,

    updated_at: now,
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'weekly_athlete_reports',
    )
    .upsert(payload, {
      onConflict:
        'user_id,week_key',
    })
    .select(REPORT_SELECT)
    .single()

  if (error) {
    throw error
  }

  return normalizeReport(data)
}

export async function generateAthleteReport({
  userId,
  week,
}) {
  const source =
    await loadAthleteReportSource(
      userId,
      week,
    )

  const analysis =
    analyzeAthleteWeek({
      userId,
      week,

      checkins:
        source.checkins,

      workoutRecords:
        source.workoutRecords,
    })

  return saveAthleteReport(
    analysis,
  )
}

export async function reviewAthleteReport({
  reportId,
  coachComment,
  publish = false,
}) {
  if (!reportId) {
    throw new Error(
      '저장할 리포트를 찾을 수 없습니다.',
    )
  }

  const {
    data: userData,
    error: userError,
  } = await supabase.auth
    .getUser()

  if (userError) {
    throw userError
  }

  if (!userData.user) {
    throw new Error(
      '로그인 관리자 정보를 찾을 수 없습니다.',
    )
  }

  const now =
    new Date().toISOString()

  const payload = {
    coach_comment:
      coachComment.trim() ||
      null,

    reviewed_by:
      userData.user.id,

    reviewed_at: now,

    is_published:
      Boolean(publish),

    published_at:
      publish
        ? now
        : null,

    updated_at: now,
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'weekly_athlete_reports',
    )
    .update(payload)
    .eq(
      'id',
      reportId,
    )
    .select(REPORT_SELECT)
    .single()

  if (error) {
    throw error
  }

  return normalizeReport(data)
}

export async function unpublishAthleteReport(
  reportId,
) {
  if (!reportId) {
    throw new Error(
      '리포트를 찾을 수 없습니다.',
    )
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'weekly_athlete_reports',
    )
    .update({
      is_published: false,
      published_at: null,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      'id',
      reportId,
    )
    .select(REPORT_SELECT)
    .single()

  if (error) {
    throw error
  }

  return normalizeReport(data)
}

export function getReportStatusLabel(
  status,
) {
  return (
    REPORT_STATUS_OPTIONS[
      status
    ]?.label ||
    '코치 확인 필요'
  )
}