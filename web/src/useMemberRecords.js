import {
  useEffect,
  useState,
} from 'react'

import {
  loadTodayCheckin,
  loadWorkoutRecords,
  saveDailyCheckin,
  saveWorkoutRecord,
} from './data/memberRecords.js'

function useMemberRecords() {
  const [
    todayCheckin,
    setTodayCheckin,
  ] = useState(null)

  const [
    workoutRecords,
    setWorkoutRecords,
  ] = useState({})

  const [
    calendarWorkoutRecords,
    setCalendarWorkoutRecords,
  ] = useState({})

  const [recordsLoading, setRecordsLoading] =
    useState(true)

  const [
    recordsError,
    setRecordsError,
  ] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadRecords = async () => {
      setRecordsLoading(true)
      setRecordsError('')

      try {
        const [
          checkin,
          workoutData,
        ] = await Promise.all([
          loadTodayCheckin(),
          loadWorkoutRecords(),
        ])

        if (!isMounted) {
          return
        }

        setTodayCheckin(checkin)

        setWorkoutRecords(
          workoutData.workoutRecords,
        )

        setCalendarWorkoutRecords(
          workoutData.calendarWorkoutRecords,
        )
      } catch (error) {
        console.error(
          '멤버 기록 불러오기 실패:',
          error,
        )

        if (isMounted) {
          setRecordsError(
            error.message ||
              '기록을 불러오지 못했습니다.',
          )
        }
      } finally {
        if (isMounted) {
          setRecordsLoading(false)
        }
      }
    }

    loadRecords()

    return () => {
      isMounted = false
    }
  }, [])

  const submitCheckin = async (form) => {
    const savedCheckin =
      await saveDailyCheckin(form)

    setTodayCheckin(savedCheckin)

    return savedCheckin
  }

  const completeWorkout = async (
    sessionId,
    rpe,
    calendarInfo = {},
  ) => {
    const savedRecord =
      await saveWorkoutRecord(
        sessionId,
        rpe,
        calendarInfo,
      )

    setWorkoutRecords((current) => ({
      ...current,

      [savedRecord.sessionId]:
        savedRecord,
    }))

    if (savedRecord.eventId) {
      setCalendarWorkoutRecords(
        (current) => ({
          ...current,

          [savedRecord.eventId]:
            savedRecord,
        }),
      )
    }

    return savedRecord
  }

  return {
    todayCheckin,
    workoutRecords,
    calendarWorkoutRecords,
    recordsLoading,
    recordsError,
    submitCheckin,
    completeWorkout,
  }
}

export default useMemberRecords