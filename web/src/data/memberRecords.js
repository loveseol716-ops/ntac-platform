import { supabase } from '../lib/supabase.js'

function getLocalDateKey(
  date = new Date(),
) {
  const timezoneOffset =
    date.getTimezoneOffset() * 60000

  return new Date(
    date.getTime() - timezoneOffset,
  )
    .toISOString()
    .slice(0, 10)
}

function formatKoreanDate(
  dateKey,
) {
  if (!dateKey) {
    return ''
  }

  return new Date(
    `${dateKey}T00:00:00`,
  ).toLocaleDateString('ko-KR')
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
      '로그인 사용자 정보를 찾을 수 없습니다.',
    )
  }

  return data.user
}

export function parseTargetRpe(
  value,
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  if (
    typeof value === 'number'
  ) {
    if (
      Number.isFinite(value) &&
      value >= 1 &&
      value <= 10
    ) {
      return Number(
        value.toFixed(1),
      )
    }

    return null
  }

  const normalizedValue =
    String(value)
      .replace(/,/g, '.')
      .replace(/[–—~]/g, '-')
      .trim()

  const numberMatches =
    normalizedValue.match(
      /\d+(?:\.\d+)?/g,
    )

  if (
    !numberMatches ||
    numberMatches.length === 0
  ) {
    return null
  }

  const numbers =
    numberMatches
      .map(Number)
      .filter(
        (number) =>
          Number.isFinite(number) &&
          number >= 1 &&
          number <= 10,
      )

  if (numbers.length === 0) {
    return null
  }

  if (numbers.length === 1) {
    return Number(
      numbers[0].toFixed(1),
    )
  }

  const firstValue =
    numbers[0]

  const secondValue =
    numbers[1]

  return Number(
    (
      (
        firstValue +
        secondValue
      ) / 2
    ).toFixed(1),
  )
}

function normalizeCheckin(row) {
  return {
    id: row.id,

    memberId:
      row.user_id,

    dateKey:
      row.checkin_date,

    date:
      formatKoreanDate(
        row.checkin_date,
      ),

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
      row.pain_level,

    painArea:
      row.pain_area || '',

    message:
      row.message || '',

    completedAt:
      row.updated_at ||
      row.created_at,
  }
}

function normalizeWorkoutRecord(
  row,
) {
  return {
    id: row.id,

    recordKey:
      row.record_key,

    sessionId:
      row.session_id,

    eventId:
      row.event_id || null,

    date:
      row.workout_date || null,

    title:
      row.title || '',

    type:
      row.workout_type || '',

    rpe:
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

    rpeGap:
      row.target_rpe === null ||
      row.target_rpe === undefined
        ? null
        : Number(
            (
              Number(row.rpe) -
              Number(
                row.target_rpe,
              )
            ).toFixed(1),
          ),

    completedAt:
      row.completed_at,
  }
}

export async function loadTodayCheckin() {
  const user =
    await getCurrentUser()

  const todayKey =
    getLocalDateKey()

  const {
    data,
    error,
  } = await supabase
    .from('daily_checkins')
    .select(
      `
        id,
        user_id,
        checkin_date,
        condition_score,
        sleep_hours,
        soreness_score,
        stress_score,
        pain_level,
        pain_area,
        message,
        created_at,
        updated_at
      `,
    )
    .eq(
      'user_id',
      user.id,
    )
    .eq(
      'checkin_date',
      todayKey,
    )
    .limit(1)

  if (error) {
    throw error
  }

  if (
    !data ||
    data.length === 0
  ) {
    return null
  }

  return normalizeCheckin(
    data[0],
  )
}

export async function saveDailyCheckin(
  form,
) {
  const user =
    await getCurrentUser()

  const todayKey =
    getLocalDateKey()

  const now =
    new Date().toISOString()

  const payload = {
    user_id:
      user.id,

    checkin_date:
      todayKey,

    condition_score:
      Number(
        form.condition,
      ),

    sleep_hours:
      Number(
        form.sleep,
      ),

    soreness_score:
      Number(
        form.soreness,
      ),

    stress_score:
      Number(
        form.stress,
      ),

    pain_level:
      form.pain,

    pain_area:
      form.pain === '없음'
        ? null
        : form.painArea
            .trim(),

    message:
      form.message
        .trim() || null,

    updated_at:
      now,
  }

  const {
    data,
    error,
  } = await supabase
    .from('daily_checkins')
    .upsert(payload, {
      onConflict:
        'user_id,checkin_date',
    })
    .select(
      `
        id,
        user_id,
        checkin_date,
        condition_score,
        sleep_hours,
        soreness_score,
        stress_score,
        pain_level,
        pain_area,
        message,
        created_at,
        updated_at
      `,
    )
    .single()

  if (error) {
    throw error
  }

  return normalizeCheckin(
    data,
  )
}

export async function loadWorkoutRecords() {
  const user =
    await getCurrentUser()

  const {
    data,
    error,
  } = await supabase
    .from('workout_records')
    .select(
      `
        id,
        record_key,
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
      user.id,
    )
    .order(
      'completed_at',
      {
        ascending: false,
      },
    )

  if (error) {
    throw error
  }

  const workoutRecords = {}

  const calendarWorkoutRecords = {}

  ;(data || []).forEach(
    (row) => {
      const record =
        normalizeWorkoutRecord(
          row,
        )

      workoutRecords[
        record.sessionId
      ] = record

      if (record.eventId) {
        calendarWorkoutRecords[
          record.eventId
        ] = record
      }
    },
  )

  return {
    workoutRecords,
    calendarWorkoutRecords,
  }
}

export async function saveWorkoutRecord(
  sessionId,
  rpe,
  calendarInfo = {},
) {
  const user =
    await getCurrentUser()

  const completedAt =
    new Date().toISOString()

  const eventId =
    calendarInfo.calendarEventId ||
    calendarInfo.eventId ||
    null

  const recordKey =
    eventId || sessionId

  const targetRpeLabel =
    calendarInfo.targetRpeLabel ||
    calendarInfo.targetRpe ||
    ''

  const targetRpe =
    parseTargetRpe(
      calendarInfo.targetRpeValue ??
      targetRpeLabel,
    )

  const weekId =
    calendarInfo.weekId ||
    calendarInfo.weekKey ||
    null

  const weekType =
    calendarInfo.weekType ||
    null

  const payload = {
    user_id:
      user.id,

    record_key:
      recordKey,

    session_id:
      sessionId,

    event_id:
      eventId,

    workout_date:
      calendarInfo.workoutDate ||
      calendarInfo.date ||
      null,

    title:
      calendarInfo.title ||
      null,

    workout_type:
      calendarInfo.type ||
      calendarInfo.workoutType ||
      null,

    rpe:
      Number(rpe),

    target_rpe:
      targetRpe,

    target_rpe_label:
      targetRpeLabel
        ? String(
            targetRpeLabel,
          )
        : null,

    week_key:
      weekId,

    week_type:
      weekType,

    completed_at:
      completedAt,

    updated_at:
      completedAt,
  }

  const {
    data,
    error,
  } = await supabase
    .from('workout_records')
    .upsert(payload, {
      onConflict:
        'user_id,record_key',
    })
    .select(
      `
        id,
        record_key,
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
    .single()

  if (error) {
    throw error
  }

  return normalizeWorkoutRecord(
    data,
  )
}

export {
  getLocalDateKey,
}