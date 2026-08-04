import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'

const emptyForm = {
  title: '',
  eventDate: '',
  startTime: '12:00',
  endTime: '14:00',
  capacity: '12',
  status: 'scheduled',
  description:
    '놀토짐 오프라인 커뮤니티 클래스',
}

const eventStatusOptions = [
  {
    value: 'scheduled',
    label: '진행 예정',
  },
  {
    value: 'completed',
    label: '진행 완료',
  },
  {
    value: 'cancelled',
    label: '일정 취소',
  },
]

const attendanceStatusOptions = [
  {
    value: 'registered',
    label: '신청',
  },
  {
    value: 'attended',
    label: '참석 완료',
  },
  {
    value: 'cancelled',
    label: '신청 취소',
  },
  {
    value: 'no_show',
    label: '노쇼',
  },
]

function formatDate(dateKey) {
  if (!dateKey) {
    return ''
  }

  return new Date(
    `${dateKey}T00:00:00`,
  ).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatTime(timeValue) {
  return timeValue
    ? timeValue.slice(0, 5)
    : ''
}

function getStatusLabel(status) {
  return (
    eventStatusOptions.find(
      (option) =>
        option.value === status,
    )?.label || status
  )
}

function getAttendanceLabel(status) {
  return (
    attendanceStatusOptions.find(
      (option) =>
        option.value === status,
    )?.label || status
  )
}

function CommunityAdmin() {
  const [events, setEvents] =
    useState([])

  const [attendance, setAttendance] =
    useState([])

  const [profiles, setProfiles] =
    useState([])

  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState('')

  const [form, setForm] =
    useState(emptyForm)

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const selectedEvent =
    events.find(
      (event) =>
        event.id === selectedEventId,
    ) || null

  const selectedAttendance = useMemo(
    () =>
      attendance.filter(
        (record) =>
          record.event_id ===
          selectedEventId,
      ),
    [attendance, selectedEventId],
  )

  const activeCount =
    selectedAttendance.filter(
      (record) =>
        record.attendance_status ===
          'registered' ||
        record.attendance_status ===
          'attended',
    ).length

  const profileMap = useMemo(() => {
    const result = {}

    profiles.forEach((profile) => {
      result[profile.id] = profile
    })

    return result
  }, [profiles])

  const loadData = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const [
        eventResult,
        attendanceResult,
        profileResult,
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
              created_by,
              created_at,
              updated_at
            `,
          )
          .order('event_date', {
            ascending: false,
          })
          .order('start_time', {
            ascending: true,
          }),

        supabase
          .from('community_attendance')
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
          .order('created_at', {
            ascending: true,
          }),

        supabase
          .from('profiles')
          .select(
            `
              id,
              full_name,
              email,
              membership
            `,
          )
          .order('full_name', {
            ascending: true,
          }),
      ])

      if (eventResult.error) {
        throw eventResult.error
      }

      if (attendanceResult.error) {
        throw attendanceResult.error
      }

      if (profileResult.error) {
        throw profileResult.error
      }

      const loadedEvents =
        eventResult.data || []

      setEvents(loadedEvents)

      setAttendance(
        attendanceResult.data || [],
      )

      setProfiles(
        profileResult.data || [],
      )

      setSelectedEventId(
        (currentId) => {
          const exists =
            loadedEvents.some(
              (event) =>
                event.id === currentId,
            )

          return exists
            ? currentId
            : loadedEvents[0]?.id || ''
        },
      )
    } catch (error) {
      console.error(
        '커뮤니티 관리자 조회 실패:',
        error,
      )

      setErrorMessage(
        error.message ||
          '커뮤니티 정보를 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!selectedEvent) {
      return
    }

    setForm({
      title: selectedEvent.title || '',

      eventDate:
        selectedEvent.event_date || '',

      startTime:
        formatTime(
          selectedEvent.start_time,
        ) || '12:00',

      endTime:
        formatTime(
          selectedEvent.end_time,
        ) || '14:00',

      capacity:
        selectedEvent.capacity?.toString() ||
        '',

      status:
        selectedEvent.status ||
        'scheduled',

      description:
        selectedEvent.description || '',
    })
  }, [selectedEvent])

  const updateForm = (
    name,
    value,
  ) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const startNewEvent = () => {
    setSelectedEventId('')
    setForm(emptyForm)
    setErrorMessage('')
  }

  const saveEvent = async (
    event,
  ) => {
    event.preventDefault()

    if (
      !form.title.trim() ||
      !form.eventDate
    ) {
      alert(
        '일정 제목과 날짜를 입력해 주세요.',
      )

      return
    }

    setSaving(true)
    setErrorMessage('')

    try {
      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!userData.user) {
        throw new Error(
          '로그인 정보를 찾을 수 없습니다.',
        )
      }

      const payload = {
        title: form.title.trim(),

        event_date:
          form.eventDate,

        start_time:
          form.startTime || null,

        end_time:
          form.endTime || null,

        capacity:
          form.capacity === ''
            ? null
            : Number(form.capacity),

        status: form.status,

        description:
          form.description.trim() ||
          null,

        updated_at:
          new Date().toISOString(),
      }

      let result

      if (selectedEventId) {
        result = await supabase
          .from('community_events')
          .update(payload)
          .eq(
            'id',
            selectedEventId,
          )
          .select()
          .single()
      } else {
        result = await supabase
          .from('community_events')
          .insert({
            ...payload,
            created_by:
              userData.user.id,
          })
          .select()
          .single()
      }

      if (result.error) {
        throw result.error
      }

      alert(
        selectedEventId
          ? '커뮤니티 일정이 수정되었습니다.'
          : '커뮤니티 일정이 생성되었습니다.',
      )

      await loadData()

      setSelectedEventId(
        result.data.id,
      )
    } catch (error) {
      console.error(
        '커뮤니티 일정 저장 실패:',
        error,
      )

      setErrorMessage(
        error.message ||
          '일정을 저장하지 못했습니다.',
      )

      alert(
        `저장에 실패했습니다.\n${
          error.message ||
          '알 수 없는 오류'
        }`,
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteEvent = async () => {
    if (!selectedEventId) {
      return
    }

    const confirmed = window.confirm(
      '이 일정과 참석 신청 기록을 모두 삭제할까요?',
    )

    if (!confirmed) {
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('community_events')
        .delete()
        .eq(
          'id',
          selectedEventId,
        )

      if (error) {
        throw error
      }

      alert(
        '커뮤니티 일정이 삭제되었습니다.',
      )

      setSelectedEventId('')
      setForm(emptyForm)

      await loadData()
    } catch (error) {
      console.error(
        '커뮤니티 일정 삭제 실패:',
        error,
      )

      alert(
        `삭제에 실패했습니다.\n${
          error.message ||
          '알 수 없는 오류'
        }`,
      )
    } finally {
      setSaving(false)
    }
  }

  const updateAttendanceStatus =
    async (
      attendanceId,
      nextStatus,
    ) => {
      try {
        const checkedInAt =
          nextStatus === 'attended'
            ? new Date().toISOString()
            : null

        const { data, error } =
          await supabase
            .from(
              'community_attendance',
            )
            .update({
              attendance_status:
                nextStatus,

              checked_in_at:
                checkedInAt,

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              'id',
              attendanceId,
            )
            .select()
            .single()

        if (error) {
          throw error
        }

        setAttendance((current) =>
          current.map((record) =>
            record.id === data.id
              ? data
              : record,
          ),
        )
      } catch (error) {
        console.error(
          '참석 상태 변경 실패:',
          error,
        )

        alert(
          `참석 상태 변경에 실패했습니다.\n${
            error.message ||
            '알 수 없는 오류'
          }`,
        )
      }
    }

  return (
    <section
      className="weekly-admin-panel"
      style={{
        marginTop: '18px',
      }}
    >
      <div
        className="weekly-admin-content"
        style={{
          display: 'grid',
          gap: '18px',
        }}
      >
        <div className="admin-form-heading">
          <p>COMMUNITY ADMIN</p>
          <h3>커뮤니티 일정 관리</h3>
        </div>

        {loading && (
          <p>
            커뮤니티 정보를 불러오는
            중입니다.
          </p>
        )}

        {errorMessage && (
          <article className="feature-card locked">
            <span className="locked-badge">
              COMMUNITY ERROR
            </span>

            <p>{errorMessage}</p>
          </article>
        )}

        <div className="weekly-admin-actions">
          <button
            type="button"
            onClick={startNewEvent}
          >
            + 새 일정 만들기
          </button>
        </div>

        {events.length > 0 && (
          <label className="admin-field">
            관리할 일정

            <select
              value={selectedEventId}
              onChange={(event) =>
                setSelectedEventId(
                  event.target.value,
                )
              }
            >
              <option value="">
                새 일정 작성
              </option>

              {events.map((event) => (
                <option
                  key={event.id}
                  value={event.id}
                >
                  {event.event_date}
                  {' · '}
                  {event.title}
                  {' · '}
                  {getStatusLabel(
                    event.status,
                  )}
                </option>
              ))}
            </select>
          </label>
        )}

        <form
          className="admin-product-settings"
          onSubmit={saveEvent}
        >
          <div className="admin-form-heading">
            <p>EVENT SETTINGS</p>

            <h3>
              {selectedEventId
                ? '일정 수정'
                : '새 일정 등록'}
            </h3>
          </div>

          <label className="admin-field">
            일정 제목

            <input
              type="text"
              value={form.title}
              placeholder="예: NTAC Weekly Training"
              onChange={(event) =>
                updateForm(
                  'title',
                  event.target.value,
                )
              }
            />
          </label>

          <label className="admin-field">
            날짜

            <input
              type="date"
              value={form.eventDate}
              onChange={(event) =>
                updateForm(
                  'eventDate',
                  event.target.value,
                )
              }
            />
          </label>

          <div className="weekly-editor-grid">
            <label className="admin-field">
              시작 시간

              <input
                type="time"
                value={form.startTime}
                onChange={(event) =>
                  updateForm(
                    'startTime',
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="admin-field">
              종료 시간

              <input
                type="time"
                value={form.endTime}
                onChange={(event) =>
                  updateForm(
                    'endTime',
                    event.target.value,
                  )
                }
              />
            </label>
          </div>

          <label className="admin-field">
            정원

            <input
              type="number"
              min="1"
              placeholder="비워두면 제한 없음"
              value={form.capacity}
              onChange={(event) =>
                updateForm(
                  'capacity',
                  event.target.value,
                )
              }
            />
          </label>

          <label className="admin-field">
            일정 상태

            <select
              value={form.status}
              onChange={(event) =>
                updateForm(
                  'status',
                  event.target.value,
                )
              }
            >
              {eventStatusOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="admin-field">
            일정 설명

            <textarea
              rows="4"
              value={form.description}
              onChange={(event) =>
                updateForm(
                  'description',
                  event.target.value,
                )
              }
            />
          </label>

          <button
            className="admin-save-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? '저장 중...'
              : selectedEventId
                ? '일정 수정 저장'
                : '새 일정 생성'}
          </button>

          {selectedEventId && (
            <button
              className="weekly-unpublish-button"
              type="button"
              disabled={saving}
              onClick={deleteEvent}
            >
              일정 삭제
            </button>
          )}
        </form>

        {selectedEvent && (
          <section className="coach-dashboard">
            <div className="admin-form-heading">
              <p>ATTENDANCE</p>
              <h3>신청자 관리</h3>
            </div>

            <article className="admin-member-card">
              <div>
                <p>
                  {formatDate(
                    selectedEvent.event_date,
                  )}
                </p>

                <h3>
                  {selectedEvent.title}
                </h3>

                <span>
                  {formatTime(
                    selectedEvent.start_time,
                  )}
                  {'–'}
                  {formatTime(
                    selectedEvent.end_time,
                  )}
                </span>
              </div>

              <div className="admin-coach-info">
                <span>신청 현황</span>

                <strong>
                  {activeCount}
                  {' / '}
                  {selectedEvent.capacity ||
                    '제한 없음'}
                </strong>
              </div>
            </article>

            <div
              style={{
                display: 'grid',
                gap: '10px',
              }}
            >
              {selectedAttendance.length >
              0 ? (
                selectedAttendance.map(
                  (record) => {
                    const profile =
                      profileMap[
                        record.user_id
                      ]

                    return (
                      <article
                        className="dashboard-workout-card"
                        key={record.id}
                      >
                        <div>
                          <span>
                            {profile?.membership ||
                              'NTAC'}
                          </span>

                          <h4>
                            {profile?.full_name ||
                              profile?.email ||
                              '이름 없음'}
                          </h4>

                          <p>
                            {getAttendanceLabel(
                              record.attendance_status,
                            )}
                          </p>
                        </div>

                        <select
                          value={
                            record.attendance_status
                          }
                          onChange={(event) =>
                            updateAttendanceStatus(
                              record.id,
                              event.target
                                .value,
                            )
                          }
                        >
                          {attendanceStatusOptions.map(
                            (option) => (
                              <option
                                key={
                                  option.value
                                }
                                value={
                                  option.value
                                }
                              >
                                {
                                  option.label
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </article>
                    )
                  },
                )
              ) : (
                <div className="dashboard-empty">
                  아직 신청한 멤버가
                  없습니다.
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </section>
  )
}

export default CommunityAdmin