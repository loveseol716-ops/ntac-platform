import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from '../lib/supabase.js'

function getLocalDateKey(date = new Date()) {
  const timezoneOffset =
    date.getTimezoneOffset() * 60000

  return new Date(
    date.getTime() - timezoneOffset,
  )
    .toISOString()
    .slice(0, 10)
}

function formatEventDate(dateKey) {
  const date = new Date(
    `${dateKey}T00:00:00`,
  )

  return {
    day: String(date.getDate()).padStart(
      2,
      '0',
    ),

    month: date
      .toLocaleString('en-US', {
        month: 'short',
      })
      .toUpperCase(),

    weekday: date.toLocaleDateString(
      'ko-KR',
      {
        weekday: 'long',
      },
    ),
  }
}

function formatTime(timeValue) {
  if (!timeValue) {
    return ''
  }

  return timeValue.slice(0, 5)
}

function formatSchedule(event) {
  const { weekday } =
    formatEventDate(event.event_date)

  const startTime =
    formatTime(event.start_time)

  const endTime =
    formatTime(event.end_time)

  if (startTime && endTime) {
    return `${weekday} ${startTime}–${endTime}`
  }

  if (startTime) {
    return `${weekday} ${startTime}`
  }

  return weekday
}

function getEventStatusLabel(status) {
  if (status === 'completed') {
    return '진행 완료'
  }

  if (status === 'cancelled') {
    return '일정 취소'
  }

  return '참석 신청 중'
}

function isActiveAttendance(status) {
  return (
    status === 'registered' ||
    status === 'attended'
  )
}

function CommunityPage({
  settings,
  access,
}) {
  const [events, setEvents] =
    useState([])

  const [
    attendanceByEvent,
    setAttendanceByEvent,
  ] = useState({})

  const [userId, setUserId] =
    useState('')

  const [loading, setLoading] =
    useState(true)

  const [
    savingEventId,
    setSavingEventId,
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const todayKey = getLocalDateKey()
  const currentMonthKey =
    todayKey.slice(0, 7)

  useEffect(() => {
    if (!access.community) {
      setLoading(false)
      return undefined
    }

    let isMounted = true

    const loadCommunityData =
      async () => {
        setLoading(true)
        setErrorMessage('')

        try {
          const {
            data: userData,
            error: userError,
          } =
            await supabase.auth.getUser()

          if (userError) {
            throw userError
          }

          if (!userData.user) {
            throw new Error(
              '로그인 사용자 정보를 찾을 수 없습니다.',
            )
          }

          const monthStart =
            `${currentMonthKey}-01`

          const [
            eventResult,
            attendanceResult,
          ] = await Promise.all([
            supabase
              .from('community_events')
              .select(
                `
                  id,
                  title,
                  event_date,
                  start_time,
                  end_time,
                  status,
                  capacity,
                  description,
                  created_at,
                  updated_at
                `,
              )
              .gte(
                'event_date',
                monthStart,
              )
              .order('event_date', {
                ascending: true,
              })
              .order('start_time', {
                ascending: true,
              }),

            supabase
              .from(
                'community_attendance',
              )
              .select(
                `
                  id,
                  event_id,
                  user_id,
                  attendance_status,
                  checked_in_at,
                  created_at,
                  updated_at
                `,
              )
              .eq(
                'user_id',
                userData.user.id,
              ),
          ])

          if (eventResult.error) {
            throw eventResult.error
          }

          if (
            attendanceResult.error
          ) {
            throw attendanceResult.error
          }

          if (!isMounted) {
            return
          }

          const attendanceMap = {}

          ;(
            attendanceResult.data || []
          ).forEach((attendance) => {
            attendanceMap[
              attendance.event_id
            ] = attendance
          })

          setUserId(userData.user.id)

          setEvents(
            eventResult.data || [],
          )

          setAttendanceByEvent(
            attendanceMap,
          )
        } catch (error) {
          console.error(
            '커뮤니티 데이터 조회 실패:',
            error,
          )

          if (isMounted) {
            setErrorMessage(
              error.message ||
                '커뮤니티 정보를 불러오지 못했습니다.',
            )
          }
        } finally {
          if (isMounted) {
            setLoading(false)
          }
        }
      }

    loadCommunityData()

    return () => {
      isMounted = false
    }
  }, [
    access.community,
    currentMonthKey,
  ])

  const upcomingEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.event_date >= todayKey &&
          event.status === 'scheduled',
      ),
    [events, todayKey],
  )

  const monthlyEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.event_date.startsWith(
            currentMonthKey,
          ) &&
          event.status !== 'cancelled',
      ),
    [events, currentMonthKey],
  )

  const monthlyAttendanceCount =
    monthlyEvents.filter((event) => {
      const attendance =
        attendanceByEvent[event.id]

      return isActiveAttendance(
        attendance?.attendance_status,
      )
    }).length

  const registerAttendance = async (
    eventId,
  ) => {
    if (!userId || savingEventId) {
      return
    }

    setSavingEventId(eventId)
    setErrorMessage('')

    try {
      const now =
        new Date().toISOString()

      const { data, error } =
        await supabase
          .from(
            'community_attendance',
          )
          .upsert(
            {
              event_id: eventId,
              user_id: userId,

              attendance_status:
                'registered',

              checked_in_at: null,
              updated_at: now,
            },
            {
              onConflict:
                'event_id,user_id',
            },
          )
          .select(
            `
              id,
              event_id,
              user_id,
              attendance_status,
              checked_in_at,
              created_at,
              updated_at
            `,
          )
          .single()

      if (error) {
        throw error
      }

      setAttendanceByEvent(
        (current) => ({
          ...current,
          [eventId]: data,
        }),
      )

      alert(
        '커뮤니티 참석 신청이 완료되었습니다.',
      )
    } catch (error) {
      console.error(
        '커뮤니티 참석 신청 실패:',
        error,
      )

      setErrorMessage(
        error.message ||
          '참석 신청에 실패했습니다.',
      )

      alert(
        `참석 신청에 실패했습니다.\n${
          error.message ||
          '알 수 없는 오류'
        }`,
      )
    } finally {
      setSavingEventId('')
    }
  }

  const cancelAttendance = async (
    eventId,
  ) => {
    if (!userId || savingEventId) {
      return
    }

    const confirmed = window.confirm(
      '커뮤니티 참석 신청을 취소할까요?',
    )

    if (!confirmed) {
      return
    }

    setSavingEventId(eventId)
    setErrorMessage('')

    try {
      const { data, error } =
        await supabase
          .from(
            'community_attendance',
          )
          .update({
            attendance_status:
              'cancelled',

            checked_in_at: null,

            updated_at:
              new Date().toISOString(),
          })
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .select(
            `
              id,
              event_id,
              user_id,
              attendance_status,
              checked_in_at,
              created_at,
              updated_at
            `,
          )
          .single()

      if (error) {
        throw error
      }

      setAttendanceByEvent(
        (current) => ({
          ...current,
          [eventId]: data,
        }),
      )

      alert(
        '커뮤니티 참석 신청이 취소되었습니다.',
      )
    } catch (error) {
      console.error(
        '커뮤니티 참석 취소 실패:',
        error,
      )

      setErrorMessage(
        error.message ||
          '참석 취소에 실패했습니다.',
      )

      alert(
        `참석 취소에 실패했습니다.\n${
          error.message ||
          '알 수 없는 오류'
        }`,
      )
    } finally {
      setSavingEventId('')
    }
  }

  if (!access.community) {
    return (
      <section className="sub-page">
        <div className="page-heading">
          <p>NTAC COMMUNITY</p>
          <h2>토요일 커뮤니티</h2>

          <span>
            현재 상품에서는 이용할 수
            없습니다.
          </span>
        </div>

        <article className="feature-card locked">
          <span className="locked-badge">
            이용 불가
          </span>

          <h3>
            커뮤니티 참석권이
            필요합니다.
          </h3>

          <p>
            현재 이용 상품은{' '}
            {settings.membership}입니다.
          </p>

          <button disabled>
            상품에 포함되지 않음
          </button>
        </article>
      </section>
    )
  }

  return (
    <section className="sub-page">
      <div className="page-heading">
        <p>NTAC COMMUNITY</p>
        <h2>토요일 커뮤니티</h2>

        <span>
          함께 훈련하고 서로의 성장을
          확인합니다.
        </span>
      </div>

      {loading && (
        <article className="feature-card">
          <h3>
            커뮤니티 일정을 불러오는
            중입니다.
          </h3>

          <p>
            잠시만 기다려 주세요.
          </p>
        </article>
      )}

      {errorMessage && (
        <article className="feature-card locked">
          <span className="locked-badge">
            COMMUNITY ERROR
          </span>

          <h3>
            커뮤니티 정보를 불러오지
            못했습니다.
          </h3>

          <p>{errorMessage}</p>
        </article>
      )}

      {!loading &&
        upcomingEvents.length === 0 && (
          <article className="feature-card locked">
            <span className="locked-badge">
              예정된 일정 없음
            </span>

            <h3>
              등록된 커뮤니티 일정이
              없습니다.
            </h3>

            <p>
              새로운 일정이 등록되면 이
              화면에서 확인할 수 있습니다.
            </p>
          </article>
        )}

      <div
        style={{
          display: 'grid',
          gap: '18px',
        }}
      >
        {upcomingEvents.map(
          (event) => {
            const date =
              formatEventDate(
                event.event_date,
              )

            const attendance =
              attendanceByEvent[event.id]

            const isRegistered =
              isActiveAttendance(
                attendance
                  ?.attendance_status,
              )

            const isSaving =
              savingEventId === event.id

            return (
              <div
                key={event.id}
                style={{
                  display: 'grid',
                  gap: '10px',
                }}
              >
                <article className="community-card">
                  <div className="date-box">
                    <strong>
                      {date.day}
                    </strong>

                    <span>
                      {date.month}
                    </span>
                  </div>

                  <div className="community-info">
                    <p>
                      {formatSchedule(
                        event,
                      )}
                    </p>

                    <h3>
                      {event.title}
                    </h3>

                    <span>
                      {event.description ||
                        '놀토짐 오프라인 커뮤니티 클래스'}
                    </span>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginTop: '10px',
                      }}
                    >
                      <small>
                        {event.capacity
                          ? `정원 ${event.capacity}명`
                          : '정원 제한 없음'}
                      </small>

                      <small>
                        {getEventStatusLabel(
                          event.status,
                        )}
                      </small>

                      {isRegistered && (
                        <small
                          style={{
                            fontWeight:
                              '800',
                          }}
                        >
                          신청 완료
                        </small>
                      )}
                    </div>
                  </div>
                </article>

                <button
                  className="primary-button"
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    isRegistered
                      ? cancelAttendance(
                          event.id,
                        )
                      : registerAttendance(
                          event.id,
                        )
                  }
                  style={
                    isRegistered
                      ? {
                          background:
                            '#eef2f0',
                          color:
                            '#0b3d2e',
                        }
                      : undefined
                  }
                >
                  {isSaving
                    ? '처리 중...'
                    : isRegistered
                      ? '참석 신청 취소'
                      : '참석 신청하기'}
                </button>
              </div>
            )
          },
        )}
      </div>

      <div className="attendance-card">
        <span>
          이번 달 참석 신청 현황
        </span>

        <strong>
          {monthlyAttendanceCount}
          {' / '}
          {monthlyEvents.length}회
        </strong>
      </div>
    </section>
  )
}

export default CommunityPage