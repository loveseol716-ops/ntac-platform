import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  canUseTraining,
  getAllTrainingEvents,
  getDateKey,
  getWeekRange,
  isTrainingAssignment,
  trainingSchedule,
} from '../data/trainingSchedule'

const weekdays = [
  '월',
  '화',
  '수',
  '목',
  '금',
  '토',
  '일',
]

function loadCalendarRecords() {
  try {
    const savedRecords = localStorage.getItem(
      'ntac-calendar-workout-records',
    )

    return savedRecords
      ? JSON.parse(savedRecords)
      : {}
  } catch {
    return {}
  }
}

function createDateKey(
  year,
  monthIndex,
  day,
) {
  const month = String(
    monthIndex + 1,
  ).padStart(2, '0')

  const date = String(day).padStart(
    2,
    '0',
  )

  return `${year}-${month}-${date}`
}

function getMonthKey(date) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(2, '0'),
  ].join('-')
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}.${date.getDate()}`
}

function TrainingPage({
  settings,
  access,
  openProgram,
}) {
  const today = new Date()
  const todayKey = getDateKey(today)

  const [
    displayMonth,
    setDisplayMonth,
  ] = useState(
    () =>
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      ),
  )

  const [selectedDate, setSelectedDate] =
    useState(todayKey)

  const calendarRecords =
    loadCalendarRecords()

  const displayYear =
    displayMonth.getFullYear()

  const displayMonthIndex =
    displayMonth.getMonth()

  const displayMonthKey =
    getMonthKey(displayMonth)

  const allEvents = useMemo(
    () => getAllTrainingEvents(),
    [],
  )

  useEffect(() => {
    const selectedDateIsVisible =
      selectedDate.startsWith(
        displayMonthKey,
      )

    if (selectedDateIsVisible) {
      return
    }

    if (
      todayKey.startsWith(displayMonthKey)
    ) {
      setSelectedDate(todayKey)
      return
    }

    const firstEventDate = allEvents
      .filter((event) =>
        event.date.startsWith(
          displayMonthKey,
        ),
      )
      .sort((first, second) =>
        first.date.localeCompare(
          second.date,
        ),
      )[0]?.date

    setSelectedDate(
      firstEventDate ||
        createDateKey(
          displayYear,
          displayMonthIndex,
          1,
        ),
    )
  }, [
    allEvents,
    displayMonthIndex,
    displayMonthKey,
    displayYear,
    selectedDate,
    todayKey,
  ])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      displayYear,
      displayMonthIndex,
      1,
    ).getDay()

    const mondayFirstIndex =
      (firstDay + 6) % 7

    const daysInMonth = new Date(
      displayYear,
      displayMonthIndex + 1,
      0,
    ).getDate()

    const days = [
      ...Array(
        mondayFirstIndex,
      ).fill(null),

      ...Array.from(
        {
          length: daysInMonth,
        },
        (_, index) => index + 1,
      ),
    ]

    while (days.length % 7 !== 0) {
      days.push(null)
    }

    return days
  }, [
    displayYear,
    displayMonthIndex,
  ])

  const currentWeek =
    getWeekRange(todayKey)

  const weeklyAssignments =
    allEvents.filter(
      (event) =>
        event.date >=
          currentWeek.startKey &&
        event.date <=
          currentWeek.endKey &&
        isTrainingAssignment(event) &&
        canUseTraining(event, access),
    )

  const weeklyCompletedCount =
    weeklyAssignments.filter(
      (event) =>
        calendarRecords[event.id],
    ).length

  const weeklyTotalCount =
    weeklyAssignments.length

  const weeklyProgressPercent =
    weeklyTotalCount === 0
      ? 0
      : Math.round(
          (weeklyCompletedCount /
            weeklyTotalCount) *
            100,
        )

  const selectedEvents =
    trainingSchedule[selectedDate] || []

  const selectedDateLabel = new Date(
    `${selectedDate}T00:00:00`,
  ).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const movePreviousMonth = () => {
    setDisplayMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() - 1,
          1,
        ),
    )
  }

  const moveNextMonth = () => {
    setDisplayMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          1,
        ),
    )
  }

  const moveToToday = () => {
    const currentDate = new Date()

    setDisplayMonth(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      ),
    )

    setSelectedDate(
      getDateKey(currentDate),
    )
  }

  return (
    <section className="sub-page training-calendar-page">
      <div className="page-heading">
        <p>TRAINING CALENDAR</p>

        <h2>트레이닝 캘린더</h2>

        <span>
          {settings.membership} 일정에 맞춰
          훈련하세요.
        </span>
      </div>

      <section className="training-calendar-summary">
        <div>
          <span>이번 주 진행률</span>

          <strong>
            {weeklyCompletedCount}
            {' / '}
            {weeklyTotalCount}
          </strong>

          <p className="weekly-date-range">
            {formatMonthDay(
              currentWeek.start,
            )}
            {' – '}
            {formatMonthDay(
              currentWeek.end,
            )}
          </p>
        </div>

        <div className="calendar-progress-area">
          <strong>
            {weeklyProgressPercent}%
          </strong>

          <div className="calendar-progress-track">
            <div
              className="calendar-progress-value"
              style={{
                width: `${weeklyProgressPercent}%`,
              }}
            />
          </div>
        </div>
      </section>

      <section className="calendar-month-card">
        <div className="calendar-month-head">
          <div>
            <p>
              {displayMonth.toLocaleDateString(
                'en-US',
                {
                  month: 'long',
                },
              ).toUpperCase()}
            </p>

            <h3>
              {displayYear}년{' '}
              {displayMonthIndex + 1}월
            </h3>
          </div>

          <div className="calendar-month-navigation">
            <button
              type="button"
              onClick={movePreviousMonth}
              aria-label="이전 달"
            >
              ‹
            </button>

            <button
              className="calendar-today-button"
              type="button"
              onClick={moveToToday}
            >
              오늘
            </button>

            <button
              type="button"
              onClick={moveNextMonth}
              aria-label="다음 달"
            >
              ›
            </button>
          </div>
        </div>

        <div className="calendar-legend">
          <span>
            <i className="calendar-legend-dot run" />
            RUN
          </span>

          <span>
            <i className="calendar-legend-dot build" />
            BUILD
          </span>

          <span>
            <i className="calendar-legend-dot recovery" />
            RECOVERY
          </span>

          <span>
            <i className="calendar-legend-dot completed" />
            완료
          </span>
        </div>

        <div className="calendar-weekdays">
          {weekdays.map((weekday) => (
            <span key={weekday}>
              {weekday}
            </span>
          ))}
        </div>

        <div className="training-calendar-grid">
          {calendarDays.map(
            (day, index) => {
              if (!day) {
                return (
                  <div
                    className="training-calendar-day empty"
                    key={`${displayMonthKey}-empty-${index}`}
                  />
                )
              }

              const dateKey =
                createDateKey(
                  displayYear,
                  displayMonthIndex,
                  day,
                )

              const events =
                trainingSchedule[dateKey] ||
                []

              const availableAssignments =
                events.filter(
                  (event) =>
                    isTrainingAssignment(
                      event,
                    ) &&
                    canUseTraining(
                      event,
                      access,
                    ),
                )

              const isCompleted =
                availableAssignments.length >
                  0 &&
                availableAssignments.every(
                  (event) =>
                    calendarRecords[
                      event.id
                    ],
                )

              const isSelected =
                selectedDate === dateKey

              const isToday =
                todayKey === dateKey

              return (
                <button
                  type="button"
                  className={[
                    'training-calendar-day',
                    isSelected
                      ? 'selected'
                      : '',
                    isToday ? 'today' : '',
                    events.length > 0
                      ? 'has-event'
                      : '',
                    isCompleted
                      ? 'completed'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={dateKey}
                  onClick={() =>
                    setSelectedDate(
                      dateKey,
                    )
                  }
                >
                  <span className="calendar-date-number">
                    {day}
                  </span>

                  <div className="calendar-event-dots">
                    {events
                      .slice(0, 3)
                      .map((event) => (
                        <i
                          className={[
                            'calendar-event-dot',
                            event.type.toLowerCase(),
                            calendarRecords[
                              event.id
                            ]
                              ? 'completed'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          key={event.id}
                        />
                      ))}
                  </div>

                  {isCompleted && (
                    <span className="calendar-complete-mark">
                      ✓
                    </span>
                  )}
                </button>
              )
            },
          )}
        </div>
      </section>

      <section className="selected-training-section">
        <div className="selected-training-head">
          <div>
            <p>SELECTED DATE</p>
            <h3>{selectedDateLabel}</h3>
          </div>

          <span>
            {selectedEvents.length > 0
              ? `${selectedEvents.length}개 일정`
              : '회복일'}
          </span>
        </div>

        <div className="selected-training-list">
          {selectedEvents.length > 0 ? (
            selectedEvents.map(
              (event) => {
                const available =
                  canUseTraining(
                    event,
                    access,
                  )

                const record =
                  calendarRecords[event.id]

                return (
                  <article
                    className={[
                      'calendar-program-card',
                      !available
                        ? 'locked'
                        : '',
                      record
                        ? 'completed'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={event.id}
                  >
                    <div className="calendar-program-top">
                      <span
                        className={`calendar-program-type ${event.type.toLowerCase()}`}
                      >
                        {event.type}
                      </span>

                      {record ? (
                        <span className="calendar-done-badge">
                          완료
                        </span>
                      ) : (
                        !available && (
                          <span className="calendar-lock-badge">
                            이용 불가
                          </span>
                        )
                      )}
                    </div>

                    <h4>{event.title}</h4>

                    <p>
                      {event.description}
                    </p>

                    <div className="calendar-program-target">
                      {event.target}
                    </div>

                    {event.programId ? (
                      <button
                        className="calendar-detail-button"
                        type="button"
                        disabled={!available}
                        onClick={() =>
                          openProgram(
                            event.programId,
                            event.sessionId,
                            event.id,
                            selectedDate,
                          )
                        }
                      >
                        {available
                          ? record
                            ? '완료 기록 확인'
                            : '운동 내용 보기'
                          : '현재 상품에 포함되지 않음'}
                      </button>
                    ) : (
                      <div className="calendar-guide-message">
                        오늘은 별도의 운동 완료 기록이
                        필요하지 않습니다.
                      </div>
                    )}

                    {record && (
                      <p className="calendar-record-time">
                        실제 RPE {record.rpe}
                      </p>
                    )}
                  </article>
                )
              },
            )
          ) : (
            <article className="calendar-rest-card">
              <span>RECOVERY</span>

              <h4>
                예정된 훈련이 없습니다.
              </h4>

              <p>
                몸 상태에 따라 완전 휴식하거나
                가볍게 움직여 주세요.
              </p>
            </article>
          )}
        </div>
      </section>
    </section>
  )
}

export default TrainingPage