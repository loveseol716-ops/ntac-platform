import {
  calendarConfig,
  getPublishedWorkouts,
} from './weeklyPrograms'

export const CALENDAR_YEAR =
  calendarConfig.year

export const CALENDAR_MONTH =
  calendarConfig.monthIndex

const publishedWorkouts =
  getPublishedWorkouts()

export const trainingSchedule =
  publishedWorkouts.reduce(
    (schedule, workout) => {
      if (!workout.date) {
        return schedule
      }

      if (!schedule[workout.date]) {
        schedule[workout.date] = []
      }

      schedule[workout.date].push({
        ...workout,

        id: workout.eventId,

        eventId:
          workout.eventId,

        sessionId:
          workout.sessionId,

        type:
          workout.category,

        category:
          workout.category,

        sessionType:
          workout.sessionType ||
          workout.category ||
          'TRAINING',

        title:
          workout.title ||
          '오늘의 훈련',

        subtitle:
          workout.subtitle || '',

        description:
          workout.description ||
          workout.subtitle ||
          '',

        target:
          workout.target ||
          (
            workout.targetRpe
              ? `목표 RPE ${workout.targetRpe}`
              : ''
          ),

        targetRpe:
          workout.targetRpe || '',

        programId:
          workout.programId,

        weekId:
          workout.weekId || '',

        weekLabel:
          workout.weekLabel || '',

        weekType:
          workout.weekType || '',

        weekTypeLabel:
          workout.weekTypeLabel || '',

        sections:
          Array.isArray(
            workout.sections,
          )
            ? workout.sections
            : [],

        runTrainerEnabled:
          Boolean(
            workout.runTrainerEnabled,
          ),

        runTrainerKey:
          workout.runTrainerKey ||
          workout.sessionId ||
          '',

        isPersonalized:
          Boolean(
            workout.isPersonalized,
          ),

        coachNote:
          workout.coachNote || '',
      })

      return schedule
    },
    {},
  )

export function getDateKey(
  date = new Date(),
) {
  return [
    date.getFullYear(),

    String(
      date.getMonth() + 1,
    ).padStart(2, '0'),

    String(
      date.getDate(),
    ).padStart(2, '0'),
  ].join('-')
}

export function getWeekRange(
  dateKey,
) {
  const date = new Date(
    `${dateKey}T00:00:00`,
  )

  const mondayIndex =
    (date.getDay() + 6) % 7

  const start =
    new Date(date)

  start.setDate(
    date.getDate() -
      mondayIndex,
  )

  const end =
    new Date(start)

  end.setDate(
    start.getDate() + 6,
  )

  return {
    startKey:
      getDateKey(start),

    endKey:
      getDateKey(end),

    start,

    end,
  }
}

export function canUseTraining(
  event,
  access,
) {
  if (!event || !access) {
    return false
  }

  if (
    event.type === 'RUN'
  ) {
    return Boolean(
      access.run,
    )
  }

  if (
    event.type === 'BUILD'
  ) {
    return Boolean(
      access.build,
    )
  }

  return true
}

export function isTrainingAssignment(
  event,
) {
  return (
    event?.type === 'RUN' ||
    event?.type === 'BUILD'
  )
}

export function getAllTrainingEvents() {
  return Object.entries(
    trainingSchedule,
  )
    .flatMap(
      ([date, events]) =>
        events.map(
          (event) => ({
            ...event,
            date,
          }),
        ),
    )
    .sort(
      (first, second) => {
        const dateCompare =
          first.date.localeCompare(
            second.date,
          )

        if (dateCompare !== 0) {
          return dateCompare
        }

        return String(
          first.title || '',
        ).localeCompare(
          String(
            second.title || '',
          ),
        )
      },
    )
}

export function getTrainingEventById(
  eventId,
) {
  if (!eventId) {
    return null
  }

  return (
    getAllTrainingEvents().find(
      (event) =>
        event.id === eventId ||
        event.eventId ===
          eventId,
    ) || null
  )
}

export function getTrainingEventsByWeek(
  weekId,
) {
  if (!weekId) {
    return []
  }

  return getAllTrainingEvents().filter(
    (event) =>
      event.weekId === weekId &&
      isTrainingAssignment(
        event,
      ),
  )
}

export function getTodayOrNextTraining(
  access,
) {
  const todayKey =
    getDateKey()

  return (
    getAllTrainingEvents()
      .filter(
        (event) =>
          event.date >=
            todayKey &&
          isTrainingAssignment(
            event,
          ) &&
          canUseTraining(
            event,
            access,
          ),
      )
      .sort(
        (first, second) =>
          first.date.localeCompare(
            second.date,
          ),
      )[0] || null
  )
}