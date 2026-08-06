import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  DEFAULT_WEEK_TYPE,
  WEEK_TYPE_OPTIONS,
  getWeekTypeLabel,
  getWeeklyPrograms,
  loadWeeklyProgramsFromSupabase,
  saveWeeklyProgramToSupabase,
  saveWeeklyPrograms,
} from './data/weeklyPrograms'

const sessionTypeOptions = [
  'ZONE 2',
  'INTERVAL',
  'INDOOR ZONE 2',
  'STRENGTH',
]

function cloneData(value) {
  return JSON.parse(
    JSON.stringify(value),
  )
}

function parseDateKey(dateKey) {
  return new Date(
    `${dateKey}T00:00:00`,
  )
}

function formatDateKey(date) {
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

function addDays(
  dateKey,
  amount,
) {
  const date =
    parseDateKey(dateKey)

  date.setDate(
    date.getDate() + amount,
  )

  return formatDateKey(date)
}

function getMondayDateKey(
  date = new Date(),
) {
  const mondayIndex =
    (date.getDay() + 6) % 7

  const monday =
    new Date(date)

  monday.setDate(
    date.getDate() -
      mondayIndex,
  )

  return formatDateKey(monday)
}

function getWeekStartDate(
  week,
) {
  const dates = (
    week.workouts || []
  )
    .map(
      (workout) =>
        workout.date,
    )
    .filter(Boolean)
    .sort()

  return dates[0] || ''
}

function getIsoWeekId(
  dateKey,
) {
  const localDate =
    parseDateKey(dateKey)

  const date = new Date(
    Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
    ),
  )

  const dayNumber =
    (date.getUTCDay() + 6) %
    7

  date.setUTCDate(
    date.getUTCDate() -
      dayNumber +
      3,
  )

  const firstThursday =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        0,
        4,
      ),
    )

  const firstDayNumber =
    (
      firstThursday.getUTCDay() +
      6
    ) % 7

  firstThursday.setUTCDate(
    firstThursday.getUTCDate() -
      firstDayNumber +
      3,
  )

  const weekNumber =
    1 +
    Math.round(
      (
        date.getTime() -
        firstThursday.getTime()
      ) / 604800000,
    )

  return `${
    date.getUTCFullYear()
  }-W${String(
    weekNumber,
  ).padStart(2, '0')}`
}

function getWeekLabel(
  dateKey,
) {
  const date =
    parseDateKey(dateKey)

  const month =
    date.getMonth() + 1

  const weekOfMonth =
    Math.ceil(
      date.getDate() / 7,
    )

  return `${month}월 ${weekOfMonth}주차`
}

function createSections() {
  return [
    {
      title: 'WARM UP',
      items: [''],
    },

    {
      title: 'MAIN',
      items: [''],
    },

    {
      title: 'COOL DOWN',
      items: [''],
    },
  ]
}

function createWorkout({
  date,
  category,
  sessionType,
  title,
}) {
  return {
    date,
    category,
    sessionType,
    title,

    subtitle: '',
    description: '',
    targetRpe: '',

    sections:
      createSections(),
  }
}

function createDefaultWeek(
  startDate,
) {
  return {
    weekId:
      getIsoWeekId(startDate),

    label:
      getWeekLabel(startDate),

    weekType:
      DEFAULT_WEEK_TYPE,

    published: false,

    workouts: [
      createWorkout({
        date: startDate,
        category: 'RUN',
        sessionType:
          'ZONE 2',
        title:
          'Zone 2 Running',
      }),

      createWorkout({
        date: startDate,
        category: 'BUILD',
        sessionType:
          'STRENGTH',
        title:
          'Strength A',
      }),

      createWorkout({
        date:
          addDays(
            startDate,
            1,
          ),

        category: 'RUN',

        sessionType:
          'INTERVAL',

        title:
          'Interval A',
      }),

      createWorkout({
        date:
          addDays(
            startDate,
            2,
          ),

        category: 'RUN',

        sessionType:
          'INDOOR ZONE 2',

        title:
          'Indoor Zone 2',
      }),

      createWorkout({
        date:
          addDays(
            startDate,
            3,
          ),

        category: 'RUN',

        sessionType:
          'INTERVAL',

        title:
          'Interval B',
      }),

      createWorkout({
        date:
          addDays(
            startDate,
            4,
          ),

        category: 'BUILD',

        sessionType:
          'STRENGTH',

        title:
          'Strength B',
      }),
    ],
  }
}

function copyWeekToNext(
  week,
  shiftDays = 7,
) {
  const copiedWeek =
    cloneData(week)

  const currentStartDate =
    getWeekStartDate(
      copiedWeek,
    )

  const nextStartDate =
    addDays(
      currentStartDate,
      shiftDays,
    )

  return {
    ...copiedWeek,

    weekId:
      getIsoWeekId(
        nextStartDate,
      ),

    label:
      getWeekLabel(
        nextStartDate,
      ),

    weekType:
      copiedWeek.weekType ||
      DEFAULT_WEEK_TYPE,

    published: false,

    workouts:
      copiedWeek.workouts.map(
        (workout) => {
          const {
            sessionId,
            eventId,
            ...workoutWithoutIds
          } = workout

          return {
            ...workoutWithoutIds,

            date:
              addDays(
                workout.date,
                shiftDays,
              ),
          }
        },
      ),
  }
}

function normalizePrograms(
  programs,
) {
  return programs.map(
    (week) => ({
      ...week,

      weekType:
        week.weekType ||
        DEFAULT_WEEK_TYPE,

      workouts: (
        week.workouts || []
      ).map(
        (
          workout,
          index,
        ) => {
          const category =
            String(
              workout.category ||
                'RUN',
            ).toLowerCase()

          const sessionId =
            workout.sessionId ||
            `${
              week.weekId.toLowerCase()
            }-${category}-${
              index + 1
            }`

          const eventId =
            workout.eventId ||
            `${workout.date}-${sessionId}`

          const sections =
            Array.isArray(
              workout.sections,
            )
              ? workout.sections
              : createSections()

          return {
            ...workout,

            sessionId,
            eventId,

            sections:
              sections.map(
                (section) => ({
                  ...section,

                  items: (
                    section.items ||
                    []
                  ).filter(
                    (item) =>
                      String(item)
                        .trim() !==
                      '',
                  ),
                }),
              ),
          }
        },
      ),
    }),
  )
}

function validateWeek(
  week,
) {
  if (
    !week.weekId?.trim()
  ) {
    return '주차 ID를 입력해 주세요.'
  }

  if (
    !week.label?.trim()
  ) {
    return '주차 이름을 입력해 주세요.'
  }

  if (!week.weekType) {
    return '주간 유형을 선택해 주세요.'
  }

  if (
    !Array.isArray(
      week.workouts,
    ) ||
    week.workouts.length === 0
  ) {
    return '운동을 한 개 이상 작성해 주세요.'
  }

  const invalidWorkout =
    week.workouts.find(
      (workout) =>
        !workout.date ||
        !workout.category ||
        !workout.title?.trim(),
    )

  if (invalidWorkout) {
    return '모든 운동의 날짜, 분류, 제목을 입력해 주세요.'
  }

  const invalidRpe =
    week.workouts.find(
      (workout) =>
        !String(
          workout.targetRpe ||
            '',
        ).trim(),
    )

  if (invalidRpe) {
    return '모든 프로그램의 목표 RPE를 입력해 주세요.'
  }

  return null
}

function WeeklyProgramAdmin() {
  const initialPrograms =
    getWeeklyPrograms()

  const [
    isOpen,
    setIsOpen,
  ] = useState(false)

  const [
    programs,
    setPrograms,
  ] = useState(
    initialPrograms,
  )

  const [
    selectedWeekId,
    setSelectedWeekId,
  ] = useState(
    initialPrograms[
      initialPrograms.length - 1
    ]?.weekId || '',
  )

  const [
    databaseLoading,
    setDatabaseLoading,
  ] = useState(true)

  const [
    databaseSaving,
    setDatabaseSaving,
  ] = useState(false)

  const [
    databaseMessage,
    setDatabaseMessage,
  ] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadPrograms =
      async () => {
        try {
          const remotePrograms =
            await loadWeeklyProgramsFromSupabase()

          if (!isMounted) {
            return
          }

          const normalizedPrograms =
            remotePrograms.map(
              (week) => ({
                ...week,

                weekType:
                  week.weekType ||
                  DEFAULT_WEEK_TYPE,
              }),
            )

          setPrograms(
            normalizedPrograms,
          )

          setSelectedWeekId(
            (
              currentWeekId,
            ) => {
              const currentWeekStillExists =
                normalizedPrograms.some(
                  (week) =>
                    week.weekId ===
                    currentWeekId,
                )

              if (
                currentWeekStillExists
              ) {
                return currentWeekId
              }

              return (
                normalizedPrograms[
                  normalizedPrograms.length -
                    1
                ]?.weekId || ''
              )
            },
          )

          setDatabaseMessage(
            'Supabase 최신 데이터를 불러왔습니다.',
          )
        } catch (error) {
          console.error(
            '주간 프로그램 불러오기 실패:',
            error,
          )

          setDatabaseMessage(
            'Supabase 불러오기에 실패해 기존 저장 데이터를 사용합니다.',
          )
        } finally {
          if (isMounted) {
            setDatabaseLoading(
              false,
            )
          }
        }
      }

    loadPrograms()

    return () => {
      isMounted = false
    }
  }, [])

  const sortedPrograms =
    useMemo(
      () =>
        [...programs].sort(
          (
            first,
            second,
          ) =>
            getWeekStartDate(
              first,
            ).localeCompare(
              getWeekStartDate(
                second,
              ),
            ),
        ),

      [programs],
    )

  const selectedWeek =
    programs.find(
      (week) =>
        week.weekId ===
        selectedWeekId,
    ) || null

  const updateSelectedWeek = (
    updater,
  ) => {
    setPrograms((current) =>
      current.map((week) => {
        if (
          week.weekId !==
          selectedWeekId
        ) {
          return week
        }

        return typeof updater ===
          'function'
          ? updater(week)
          : {
              ...week,
              ...updater,
            }
      }),
    )
  }

  const updateWorkout = (
    workoutIndex,
    name,
    value,
  ) => {
    updateSelectedWeek(
      (week) => ({
        ...week,

        workouts:
          week.workouts.map(
            (
              workout,
              index,
            ) =>
              index ===
              workoutIndex
                ? {
                    ...workout,
                    [name]:
                      value,
                  }
                : workout,
          ),
      }),
    )
  }

  const updateSection = (
    workoutIndex,
    sectionIndex,
    value,
  ) => {
    updateSelectedWeek(
      (week) => ({
        ...week,

        workouts:
          week.workouts.map(
            (
              workout,
              currentWorkoutIndex,
            ) => {
              if (
                currentWorkoutIndex !==
                workoutIndex
              ) {
                return workout
              }

              return {
                ...workout,

                sections:
                  workout.sections.map(
                    (
                      section,
                      currentSectionIndex,
                    ) =>
                      currentSectionIndex ===
                      sectionIndex
                        ? {
                            ...section,

                            items:
                              value.split(
                                '\n',
                              ),
                          }
                        : section,
                  ),
              }
            },
          ),
      }),
    )
  }

  const addWorkout = () => {
    if (!selectedWeek) {
      return
    }

    const startDate =
      getWeekStartDate(
        selectedWeek,
      ) ||
      getMondayDateKey()

    updateSelectedWeek(
      (week) => ({
        ...week,

        workouts: [
          ...week.workouts,

          createWorkout({
            date: startDate,

            category:
              'RUN',

            sessionType:
              'ZONE 2',

            title:
              '새 프로그램',
          }),
        ],
      }),
    )
  }

  const removeWorkout = (
    workoutIndex,
  ) => {
    const confirmed =
      window.confirm(
        '이 프로그램을 삭제할까요?',
      )

    if (!confirmed) {
      return
    }

    updateSelectedWeek(
      (week) => ({
        ...week,

        workouts:
          week.workouts.filter(
            (
              _,
              index,
            ) =>
              index !==
              workoutIndex,
          ),
      }),
    )
  }

  const createNextWeek = () => {
    let nextWeek

    if (selectedWeek) {
      let shiftDays = 7

      do {
        nextWeek =
          copyWeekToNext(
            selectedWeek,
            shiftDays,
          )

        shiftDays += 7
      } while (
        programs.some(
          (week) =>
            week.weekId ===
            nextWeek.weekId,
        )
      )
    } else {
      nextWeek =
        createDefaultWeek(
          getMondayDateKey(),
        )
    }

    setPrograms(
      (current) => [
        ...current,
        nextWeek,
      ],
    )

    setSelectedWeekId(
      nextWeek.weekId,
    )

    setIsOpen(true)
  }

  const createBlankWeek = () => {
    const latestWeek =
      sortedPrograms[
        sortedPrograms.length - 1
      ]

    const startDate =
      latestWeek
        ? addDays(
            getWeekStartDate(
              latestWeek,
            ),
            7,
          )
        : getMondayDateKey()

    let nextStartDate =
      startDate

    let weekId =
      getIsoWeekId(
        nextStartDate,
      )

    while (
      programs.some(
        (week) =>
          week.weekId ===
          weekId,
      )
    ) {
      nextStartDate =
        addDays(
          nextStartDate,
          7,
        )

      weekId =
        getIsoWeekId(
          nextStartDate,
        )
    }

    const newWeek =
      createDefaultWeek(
        nextStartDate,
      )

    setPrograms(
      (current) => [
        ...current,
        newWeek,
      ],
    )

    setSelectedWeekId(
      newWeek.weekId,
    )

    setIsOpen(true)
  }

  const persistSelectedWeek =
    async (published) => {
      if (!selectedWeek) {
        return null
      }

      const updatedPrograms =
        normalizePrograms(
          programs.map(
            (week) =>
              week.weekId ===
              selectedWeekId
                ? {
                    ...week,
                    published,

                    weekType:
                      week.weekType ||
                      DEFAULT_WEEK_TYPE,
                  }
                : week,
          ),
        )

      const weekToSave =
        updatedPrograms.find(
          (week) =>
            week.weekId ===
            selectedWeekId,
        )

      if (!weekToSave) {
        return null
      }

      setDatabaseSaving(true)

      setDatabaseMessage(
        'Supabase에 저장 중입니다...',
      )

      try {
        const savedWeek =
          await saveWeeklyProgramToSupabase(
            weekToSave,
          )

        const syncedPrograms =
          updatedPrograms.map(
            (week) =>
              week.weekId ===
              savedWeek.weekId
                ? savedWeek
                : week,
          )

        setPrograms(
          syncedPrograms,
        )

        saveWeeklyPrograms(
          syncedPrograms,
        )

        setDatabaseMessage(
          'Supabase 저장이 완료되었습니다.',
        )

        return syncedPrograms
      } catch (error) {
        console.error(
          '주간 프로그램 저장 실패:',
          error,
        )

        setDatabaseMessage(
          'Supabase 저장에 실패했습니다.',
        )

        alert(
          `저장에 실패했습니다.\n${
            error.message ||
            '알 수 없는 오류'
          }`,
        )

        return null
      } finally {
        setDatabaseSaving(
          false,
        )
      }
    }

  const saveDraft =
    async () => {
      if (
        !selectedWeek ||
        databaseSaving
      ) {
        return
      }

      const validationMessage =
        validateWeek(
          selectedWeek,
        )

      if (
        validationMessage
      ) {
        alert(
          validationMessage,
        )

        return
      }

      const savedPrograms =
        await persistSelectedWeek(
          false,
        )

      if (!savedPrograms) {
        return
      }

      alert(
        '주간 프로그램이 Supabase에 임시저장되었습니다.',
      )
    }

  const publishWeek =
    async () => {
      if (
        !selectedWeek ||
        databaseSaving
      ) {
        return
      }

      const validationMessage =
        validateWeek(
          selectedWeek,
        )

      if (
        validationMessage
      ) {
        alert(
          validationMessage,
        )

        return
      }

      const confirmed =
        window.confirm(
          `${selectedWeek.label} 프로그램을 멤버에게 공개할까요?\n\n주간 유형: ${getWeekTypeLabel(
            selectedWeek.weekType,
          )}`,
        )

      if (!confirmed) {
        return
      }

      const savedPrograms =
        await persistSelectedWeek(
          true,
        )

      if (!savedPrograms) {
        return
      }

      alert(
        '프로그램이 Supabase에 저장되고 공개되었습니다.',
      )

      window.location.reload()
    }

  const stopPublishing =
    async () => {
      if (
        !selectedWeek ||
        databaseSaving
      ) {
        return
      }

      const confirmed =
        window.confirm(
          `${selectedWeek.label} 공개를 중지할까요?`,
        )

      if (!confirmed) {
        return
      }

      const savedPrograms =
        await persistSelectedWeek(
          false,
        )

      if (!savedPrograms) {
        return
      }

      alert(
        'Supabase에서 프로그램 공개가 중지되었습니다.',
      )

      window.location.reload()
    }

  return (
    <section className="weekly-admin-panel">
      <button
        className="weekly-admin-toggle"
        type="button"
        onClick={() =>
          setIsOpen(
            (current) =>
              !current,
          )
        }
      >
        <div>
          <span>
            WEEKLY PROGRAM
          </span>

          <strong>
            주간 프로그램 관리
          </strong>
        </div>

        <b>
          {isOpen
            ? '닫기'
            : '열기'}
        </b>
      </button>

      {isOpen && (
        <div className="weekly-admin-content">
          <div className="weekly-admin-actions">
            <button
              type="button"
              onClick={
                createNextWeek
              }
            >
              다음 주 복사 생성
            </button>

            <button
              type="button"
              onClick={
                createBlankWeek
              }
            >
              빈 주차 생성
            </button>
          </div>

          <p
            style={{
              margin:
                '4px 0 16px',

              fontSize:
                '12px',

              fontWeight:
                '700',

              color:
                databaseLoading
                  ? '#6b7280'
                  : '#0b6b4f',
            }}
          >
            {databaseLoading
              ? 'Supabase에서 프로그램을 불러오는 중...'
              : databaseMessage}
          </p>

          {programs.length >
            0 && (
            <label className="admin-field">
              관리할 주차

              <select
                value={
                  selectedWeekId
                }
                onChange={(
                  event,
                ) =>
                  setSelectedWeekId(
                    event.target
                      .value,
                  )
                }
              >
                {sortedPrograms.map(
                  (week) => (
                    <option
                      key={
                        week.weekId
                      }
                      value={
                        week.weekId
                      }
                    >
                      {week.label}
                      {' · '}
                      {getWeekTypeLabel(
                        week.weekType,
                      )}

                      {week.published
                        ? ' · 공개 중'
                        : ' · 비공개'}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}

          {selectedWeek && (
            <>
              <div className="weekly-status-card">
                <div>
                  <span>
                    현재 상태
                  </span>

                  <strong>
                    {selectedWeek.published
                      ? '멤버에게 공개 중'
                      : '임시저장 또는 작성 중'}
                  </strong>

                  <p
                    style={{
                      margin:
                        '6px 0 0',

                      color:
                        '#607069',

                      fontSize:
                        '12px',

                      fontWeight:
                        '700',
                    }}
                  >
                    주간 유형:{' '}
                    {getWeekTypeLabel(
                      selectedWeek.weekType,
                    )}
                  </p>
                </div>

                <b
                  className={
                    selectedWeek.published
                      ? 'published'
                      : ''
                  }
                >
                  {selectedWeek.published
                    ? 'PUBLISHED'
                    : 'DRAFT'}
                </b>
              </div>

              <div className="weekly-meta-grid">
                <label className="admin-field">
                  주차 ID

                  <input
                    type="text"
                    value={
                      selectedWeek.weekId
                    }
                    readOnly
                  />
                </label>

                <label className="admin-field">
                  주차 이름

                  <input
                    type="text"
                    value={
                      selectedWeek.label
                    }
                    onChange={(
                      event,
                    ) =>
                      updateSelectedWeek(
                        {
                          label:
                            event.target
                              .value,
                        },
                      )
                    }
                  />
                </label>

                <label className="admin-field">
                  주간 유형

                  <select
                    value={
                      selectedWeek.weekType ||
                      DEFAULT_WEEK_TYPE
                    }
                    onChange={(
                      event,
                    ) =>
                      updateSelectedWeek(
                        {
                          weekType:
                            event.target
                              .value,
                        },
                      )
                    }
                  >
                    {WEEK_TYPE_OPTIONS.map(
                      (
                        option,
                      ) => (
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

                  <small
                    style={{
                      marginTop:
                        '6px',

                      color:
                        '#74817c',

                      fontSize:
                        '11px',

                      lineHeight:
                        '1.45',
                    }}
                  >
                    AI 주간 리포트가
                    프로그램의 피로도
                    의도를 판단할 때
                    기준으로 사용합니다.
                  </small>
                </label>
              </div>

              <div className="weekly-workout-list">
                {selectedWeek.workouts.map(
                  (
                    workout,
                    workoutIndex,
                  ) => (
                    <article
                      className="weekly-workout-editor"
                      key={
                        workout.sessionId ||
                        `${workout.date}-${workoutIndex}`
                      }
                    >
                      <div className="weekly-workout-editor-head">
                        <div>
                          <span>
                            PROGRAM{' '}
                            {workoutIndex +
                              1}
                          </span>

                          <h4>
                            {workout.title ||
                              '새 프로그램'}
                          </h4>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeWorkout(
                              workoutIndex,
                            )
                          }
                        >
                          삭제
                        </button>
                      </div>

                      <div className="weekly-editor-grid">
                        <label className="admin-field">
                          날짜

                          <input
                            type="date"
                            value={
                              workout.date
                            }
                            onChange={(
                              event,
                            ) =>
                              updateWorkout(
                                workoutIndex,
                                'date',
                                event
                                  .target
                                  .value,
                              )
                            }
                          />
                        </label>

                        <label className="admin-field">
                          분류

                          <select
                            value={
                              workout.category
                            }
                            onChange={(
                              event,
                            ) =>
                              updateWorkout(
                                workoutIndex,
                                'category',
                                event
                                  .target
                                  .value,
                              )
                            }
                          >
                            <option value="RUN">
                              RUN
                            </option>

                            <option value="BUILD">
                              BUILD
                            </option>
                          </select>
                        </label>
                      </div>

                      <label className="admin-field">
                        세션 종류

                        <select
                          value={
                            workout.sessionType
                          }
                          onChange={(
                            event,
                          ) =>
                            updateWorkout(
                              workoutIndex,
                              'sessionType',
                              event.target
                                .value,
                            )
                          }
                        >
                          {sessionTypeOptions.map(
                            (
                              option,
                            ) => (
                              <option
                                key={
                                  option
                                }
                                value={
                                  option
                                }
                              >
                                {
                                  option
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label className="admin-field">
                        프로그램 제목

                        <input
                          type="text"
                          value={
                            workout.title
                          }
                          onChange={(
                            event,
                          ) =>
                            updateWorkout(
                              workoutIndex,
                              'title',
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <label className="admin-field">
                        훈련 목적

                        <input
                          type="text"
                          placeholder="예: 역치 페이스 적응"
                          value={
                            workout.subtitle
                          }
                          onChange={(
                            event,
                          ) =>
                            updateWorkout(
                              workoutIndex,
                              'subtitle',
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <label className="admin-field">
                        요약 설명

                        <input
                          type="text"
                          placeholder="예: 800m × 6 Sets"
                          value={
                            workout.description
                          }
                          onChange={(
                            event,
                          ) =>
                            updateWorkout(
                              workoutIndex,
                              'description',
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <label className="admin-field">
                        목표 RPE

                        <input
                          type="text"
                          placeholder="예: 7–8"
                          value={
                            workout.targetRpe
                          }
                          onChange={(
                            event,
                          ) =>
                            updateWorkout(
                              workoutIndex,
                              'targetRpe',
                              event.target
                                .value,
                            )
                          }
                        />

                        <small
                          style={{
                            marginTop:
                              '6px',

                            color:
                              '#74817c',

                            fontSize:
                              '11px',
                          }}
                        >
                          범위로 입력하면
                          주간 리포트에서는
                          중간값으로
                          계산됩니다. 예:
                          7–8 → 7.5
                        </small>
                      </label>

                      {workout.sections.map(
                        (
                          section,
                          sectionIndex,
                        ) => (
                          <label
                            className="admin-field weekly-section-field"
                            key={
                              section.title
                            }
                          >
                            {
                              section.title
                            }

                            <textarea
                              rows={
                                section.title ===
                                'MAIN'
                                  ? 7
                                  : 4
                              }
                              placeholder="한 줄에 한 항목씩 작성하세요."
                              value={section.items.join(
                                '\n',
                              )}
                              onChange={(
                                event,
                              ) =>
                                updateSection(
                                  workoutIndex,
                                  sectionIndex,
                                  event.target
                                    .value,
                                )
                              }
                            />
                          </label>
                        ),
                      )}
                    </article>
                  ),
                )}
              </div>

              <button
                className="weekly-add-workout"
                type="button"
                onClick={addWorkout}
              >
                + 프로그램 추가
              </button>

              <div className="weekly-save-actions">
                <button
                  className="weekly-draft-button"
                  type="button"
                  onClick={saveDraft}
                  disabled={
                    databaseSaving
                  }
                >
                  {databaseSaving
                    ? '저장 중...'
                    : '임시저장'}
                </button>

                <button
                  className="weekly-publish-button"
                  type="button"
                  onClick={
                    publishWeek
                  }
                  disabled={
                    databaseSaving
                  }
                >
                  {databaseSaving
                    ? '저장 중...'
                    : '멤버에게 공개'}
                </button>
              </div>

              {selectedWeek.published && (
                <button
                  className="weekly-unpublish-button"
                  type="button"
                  onClick={
                    stopPublishing
                  }
                  disabled={
                    databaseSaving
                  }
                >
                  {databaseSaving
                    ? '저장 중...'
                    : '공개 중지'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

export default WeeklyProgramAdmin