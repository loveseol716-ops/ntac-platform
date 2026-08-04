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
      if (!schedule[workout.date]) {
        schedule[workout.date] = []
      }

      schedule[workout.date].push({
        id: workout.eventId,
        sessionId: workout.sessionId,
        type: workout.category,
        title: workout.title,
        description:
          workout.description ||
          workout.subtitle ||
          '',
        target: workout.target,
        programId: workout.programId,
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
    String(date.getDate()).padStart(
      2,
      '0',
    ),
  ].join('-')
}

export function getWeekRange(dateKey) {
  const date = new Date(
    `${dateKey}T00:00:00`,
  )

  const mondayIndex =
    (date.getDay() + 6) % 7

  const start = new Date(date)

  start.setDate(
    date.getDate() - mondayIndex,
  )

  const end = new Date(start)

  end.setDate(start.getDate() + 6)

  return {
    startKey: getDateKey(start),
    endKey: getDateKey(end),
    start,
    end,
  }
}

export function canUseTraining(
  event,
  access,
) {
  if (event.type === 'RUN') {
    return access.run
  }

  if (event.type === 'BUILD') {
    return access.build
  }

  return true
}

export function isTrainingAssignment(
  event,
) {
  return (
    event.type === 'RUN' ||
    event.type === 'BUILD'
  )
}

export function getAllTrainingEvents() {
  return Object.entries(
    trainingSchedule,
  ).flatMap(([date, events]) =>
    events.map((event) => ({
      ...event,
      date,
    })),
  )
}

export function getTodayOrNextTraining(
  access,
) {
  const todayKey = getDateKey()

  return (
    getAllTrainingEvents()
      .filter(
        (event) =>
          event.date >= todayKey &&
          isTrainingAssignment(event) &&
          canUseTraining(event, access),
      )
      .sort((first, second) =>
        first.date.localeCompare(
          second.date,
        ),
      )[0] || null
  )
}