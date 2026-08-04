import { supabase } from '../lib/supabase.js'

export const calendarConfig = {
  year: 2026,
  monthIndex: 7,
}

const STORAGE_KEY = 'ntac-weekly-programs'

const defaultWeeklyPrograms = [
  {
    weekId: '2026-W32',
    label: '8월 1주차',
    published: true,

    workouts: [
      {
        date: '2026-08-03',
        category: 'RUN',
        sessionType: 'ZONE 2',

        title: 'Zone 2 Running',
        subtitle: '편안한 강도로 지속하는 유산소 훈련',
        description: 'Zone 2 Running 45분',
        targetRpe: '3–4',

        sections: [
          {
            title: 'WARM UP',
            items: [
              '5분 Easy Jog',
              '20초 Stride + 40초 Easy Jog × 3 Rounds',
            ],
          },
          {
            title: 'MAIN',
            items: [
              'Zone 2 Running 45분',
              '대화가 가능한 강도 유지',
              '속도보다 일정한 호흡과 심박수 유지',
            ],
          },
          {
            title: 'COOL DOWN',
            items: [
              '5분 Easy Jog 또는 Walking',
              '종아리와 고관절 가볍게 스트레칭',
            ],
          },
        ],
      },

      {
        date: '2026-08-03',
        category: 'BUILD',
        sessionType: 'STRENGTH',

        title: 'Lower Body Strength A',
        subtitle: '슬레드 푸시를 위한 하체 근력 보강',
        description: '스쿼트와 슬레드 푸시 중심 하체 훈련',
        targetRpe: '7–8',

        sections: [
          {
            title: 'WARM UP',
            items: [
              'Bike Erg 5분',
              'Bodyweight Squat 10회 × 2 Sets',
              'Walking Lunge 10m × 2 Sets',
            ],
          },
          {
            title: 'MAIN',
            items: [
              'Back Squat 5회 × 4 Sets',
              'Bulgarian Split Squat 8회씩 × 3 Sets',
              'Heavy Sled Push 15m × 5 Sets',
              '세트 사이 90–120초 휴식',
            ],
          },
          {
            title: 'COOL DOWN',
            items: [
              'Easy Walking 3분',
              'Hip Flexor Stretch',
              'Calf Stretch',
            ],
          },
        ],
      },

      {
        date: '2026-08-04',
        category: 'RUN',
        sessionType: 'INTERVAL',

        title: '800m Interval',
        subtitle: '10km 페이스보다 5–10초 빠르게',
        description: '800m × 5 Sets',
        targetRpe: '7–8',

        sections: [
          {
            title: 'WARM UP',
            items: [
              '6분 Easy Jog',
              '20초 Stride + 40초 Easy Recovery × 4 Rounds',
            ],
          },
          {
            title: 'MAIN',
            items: [
              '800m × 5 Sets',
              '10km 페이스보다 5–10초 빠르게',
              '세트 사이 90초 Easy Jog',
              '회복 구간 걷지 않기',
            ],
          },
          {
            title: 'COOL DOWN',
            items: ['5분 Easy Jog'],
          },
        ],
      },

      {
        date: '2026-08-05',
        category: 'RUN',
        sessionType: 'INDOOR ZONE 2',

        title: 'ERG Zone 2 Conditioning',
        subtitle: '에르그 장비를 활용한 저강도 유산소 훈련',
        description: 'Bike·Row·Ski Erg 총 40분',
        targetRpe: '3–4',

        sections: [
          {
            title: 'WARM UP',
            items: [
              'Bike Erg 3분 Easy',
              'Row Erg 3분 Easy',
              'Ski Erg 3분 Easy',
            ],
          },
          {
            title: 'MAIN',
            items: [
              'Bike Erg 12분',
              'Row Erg 12분',
              'Ski Erg 12분',
              '장비 전환 사이 1분 휴식',
              '전 구간 일정한 호흡과 출력 유지',
            ],
          },
          {
            title: 'COOL DOWN',
            items: [
              'Bike Erg 또는 Walking 5분',
              '호흡이 안정될 때까지 천천히 회복',
            ],
          },
        ],
      },

      {
        date: '2026-08-06',
        category: 'RUN',
        sessionType: 'INTERVAL',

        title: 'Threshold Interval',
        subtitle: '지속 가능한 빠른 페이스 적응',
        description: '6분 러닝 × 4 Sets',
        targetRpe: '7–8',

        sections: [
          {
            title: 'WARM UP',
            items: [
              '8분 Easy Jog',
              '20초 Stride + 40초 Easy Recovery × 4 Rounds',
            ],
          },
          {
            title: 'MAIN',
            items: [
              '6분 Running × 4 Sets',
              'Threshold Pace 유지',
              '세트 사이 90초 Easy Jog',
              '첫 세트부터 과도하게 빠르게 시작하지 않기',
            ],
          },
          {
            title: 'COOL DOWN',
            items: ['6분 Easy Jog'],
          },
        ],
      },

      {
        date: '2026-08-07',
        category: 'BUILD',
        sessionType: 'STRENGTH',

        title: 'Posterior Chain Strength B',
        subtitle: '달리기와 슬레드 풀을 위한 후면부 보강',
        description: '데드리프트와 슬레드 풀 중심 근력 훈련',
        targetRpe: '7–8',

        sections: [
          {
            title: 'WARM UP',
            items: [
              'Row Erg 5분',
              'Glute Bridge 12회 × 2 Sets',
              'Single Leg RDL 8회씩 × 2 Sets',
            ],
          },
          {
            title: 'MAIN',
            items: [
              'Deadlift 5회 × 4 Sets',
              'Barbell Hip Thrust 8회 × 3 Sets',
              'Heavy Sled Pull 15m × 5 Sets',
              'Farmer Carry 30m × 4 Sets',
              '세트 사이 90–120초 휴식',
            ],
          },
          {
            title: 'COOL DOWN',
            items: [
              'Easy Walking 3분',
              'Hamstring Stretch',
              'Glute Stretch',
            ],
          },
        ],
      },
    ],
  },
]

function cloneData(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeDatabaseRow(row) {
  return {
    weekId: row.week_key,
    label: row.title,
    published: row.status === 'published',
    workouts: Array.isArray(row.program_data)
      ? row.program_data
      : [],
  }
}

function getWeekDateRange(week) {
  const dates = week.workouts
    .map((workout) => workout.date)
    .filter(Boolean)
    .sort()

  const today = new Date()
    .toISOString()
    .slice(0, 10)

  return {
    startDate: dates[0] || today,

    endDate:
      dates[dates.length - 1] ||
      dates[0] ||
      today,
  }
}

export function getWeeklyPrograms() {
  if (typeof window === 'undefined') {
    return cloneData(defaultWeeklyPrograms)
  }

  try {
    const savedPrograms = localStorage.getItem(
      STORAGE_KEY,
    )

    if (!savedPrograms) {
      return cloneData(defaultWeeklyPrograms)
    }

    const parsedPrograms = JSON.parse(
      savedPrograms,
    )

    return Array.isArray(parsedPrograms)
      ? parsedPrograms
      : cloneData(defaultWeeklyPrograms)
  } catch {
    return cloneData(defaultWeeklyPrograms)
  }
}

export function saveWeeklyPrograms(programs) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(programs),
  )
}

export async function loadWeeklyProgramsFromSupabase() {
  const { data, error } = await supabase
    .from('weekly_programs')
    .select(
      'week_key, title, start_date, end_date, status, program_data',
    )
    .order('start_date', {
      ascending: true,
    })

  if (error) {
    throw error
  }

  if (!data || data.length === 0) {
    return getWeeklyPrograms()
  }

  const programs = data.map(
    normalizeDatabaseRow,
  )

  saveWeeklyPrograms(programs)

  return programs
}

export async function saveWeeklyProgramToSupabase(
  week,
) {
  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw userError
  }

  if (!userData.user) {
    throw new Error(
      '로그인 사용자 정보를 찾을 수 없습니다.',
    )
  }

  const { startDate, endDate } =
    getWeekDateRange(week)

  const payload = {
    week_key: week.weekId,
    title: week.label,
    start_date: startDate,
    end_date: endDate,

    status: week.published
      ? 'published'
      : 'draft',

    program_data: week.workouts,
    created_by: userData.user.id,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('weekly_programs')
    .upsert(payload, {
      onConflict: 'week_key',
    })
    .select(
      'week_key, title, start_date, end_date, status, program_data',
    )
    .single()

  if (error) {
    throw error
  }

  return normalizeDatabaseRow(data)
}

export function resetWeeklyPrograms() {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.removeItem(STORAGE_KEY)
}

export const weeklyPrograms =
  getWeeklyPrograms()

export function getPublishedWorkouts() {
  return getWeeklyPrograms()
    .filter((week) => week.published)
    .flatMap((week) =>
      week.workouts.map((workout, index) => {
        const category =
          workout.category.toUpperCase()

        const generatedSessionId =
          `${week.weekId.toLowerCase()}-${category.toLowerCase()}-${index + 1}`

        const sessionId =
          workout.sessionId ||
          generatedSessionId

        const eventId =
          workout.eventId ||
          `${workout.date}-${sessionId}`

        const programId =
          category === 'RUN'
            ? 'run'
            : category === 'BUILD'
              ? 'build'
              : null

        return {
          ...workout,
          category,
          weekId: week.weekId,
          weekLabel: week.label,
          sessionId,
          eventId,
          programId,

          target:
            workout.target ||
            (workout.targetRpe
              ? `목표 RPE ${workout.targetRpe}`
              : ''),
        }
      }),
    )
    .sort((first, second) =>
      first.date.localeCompare(second.date),
    )
}