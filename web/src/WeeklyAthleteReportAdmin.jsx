import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'

import {
  getWeekTypeLabel,
  loadWeeklyProgramsFromSupabase,
} from './data/weeklyPrograms.js'

import {
  generateAthleteReport,
  getReportStatusLabel,
  loadAthleteReports,
  reviewAthleteReport,
  unpublishAthleteReport,
} from './data/weeklyAthleteReports.js'

const statusStyles = {
  ALIGNED: {
    background: '#dff5e9',
    color: '#0b6b4f',
  },

  UNDER_TARGET: {
    background: '#fff4cf',
    color: '#8a6500',
  },

  OVER_TARGET: {
    background: '#ffe4e1',
    color: '#a3362d',
  },

  RECOVERY_LOW: {
    background: '#fff0d8',
    color: '#9a5700',
  },

  COACH_REVIEW: {
    background: '#e9eeeb',
    color: '#4d5d57',
  },
}

const buttonBaseStyle = {
  minHeight: '46px',
  padding: '12px 16px',
  border: 'none',
  borderRadius: '12px',
  fontSize: '13px',
  fontWeight: '800',
  cursor: 'pointer',
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  return new Date(
    `${value}T00:00:00`,
  ).toLocaleDateString(
    'ko-KR',
    {
      month: 'numeric',
      day: 'numeric',
    },
  )
}

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  return new Date(
    value,
  ).toLocaleString(
    'ko-KR',
    {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  )
}

function formatNumber(
  value,
  digits = 1,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      Number(value),
    )
  ) {
    return '-'
  }

  return Number(
    value,
  ).toFixed(digits)
}

function getWeekStartDate(week) {
  const dates = (
    week?.workouts || []
  )
    .map(
      (workout) =>
        workout.date,
    )
    .filter(Boolean)
    .sort()

  return dates[0] || ''
}

function getMemberName(member) {
  return (
    member?.full_name?.trim() ||
    member?.email ||
    '이름 없는 멤버'
  )
}

function sortReports(reports) {
  return [...reports].sort(
    (first, second) =>
      String(
        second.startDate || '',
      ).localeCompare(
        String(
          first.startDate || '',
        ),
      ),
  )
}

function WeeklyAthleteReportAdmin() {
  const [
    members,
    setMembers,
  ] = useState([])

  const [
    programs,
    setPrograms,
  ] = useState([])

  const [
    selectedMemberId,
    setSelectedMemberId,
  ] = useState('')

  const [
    selectedWeekId,
    setSelectedWeekId,
  ] = useState('')

  const [
    reports,
    setReports,
  ] = useState([])

  const [
    coachComment,
    setCoachComment,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    reportsLoading,
    setReportsLoading,
  ] = useState(false)

  const [
    generating,
    setGenerating,
  ] = useState(false)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    statusMessage,
    setStatusMessage,
  ] = useState('')

  const sortedPrograms =
    useMemo(
      () =>
        [...programs].sort(
          (
            first,
            second,
          ) =>
            getWeekStartDate(
              second,
            ).localeCompare(
              getWeekStartDate(
                first,
              ),
            ),
        ),
      [programs],
    )

  const sortedMembers =
    useMemo(
      () =>
        [...members].sort(
          (
            first,
            second,
          ) => {
            const firstAthlete =
              first.membership ===
              'NTAC ATHLETE'
                ? 1
                : 0

            const secondAthlete =
              second.membership ===
              'NTAC ATHLETE'
                ? 1
                : 0

            if (
              firstAthlete !==
              secondAthlete
            ) {
              return (
                secondAthlete -
                firstAthlete
              )
            }

            return getMemberName(
              first,
            ).localeCompare(
              getMemberName(
                second,
              ),
              'ko',
            )
          },
        ),
      [members],
    )

  const selectedMember =
    members.find(
      (member) =>
        member.id ===
        selectedMemberId,
    ) || null

  const selectedWeek =
    programs.find(
      (week) =>
        week.weekId ===
        selectedWeekId,
    ) || null

  const selectedReport =
    reports.find(
      (report) =>
        report.weekId ===
        selectedWeekId,
    ) || null

  const sessionAnalysis =
    Array.isArray(
      selectedReport?.payload
        ?.sessionAnalysis,
    )
      ? selectedReport.payload
          .sessionAnalysis
      : []

  const recoverySignals =
    Array.isArray(
      selectedReport?.payload
        ?.recoverySignals,
    )
      ? selectedReport.payload
          .recoverySignals
      : []

  useEffect(() => {
    let isMounted = true

    const loadInitialData =
      async () => {
        setLoading(true)
        setErrorMessage('')

        try {
          const [
            memberResult,
            weeklyPrograms,
          ] = await Promise.all([
            supabase
              .from('profiles')
              .select(
                `
                  id,
                  email,
                  full_name,
                  membership,
                  membership_status,
                  coach_care,
                  coach_name
                `,
              )
              .eq(
                'role',
                'member',
              )
              .order(
                'full_name',
                {
                  ascending: true,
                },
              ),

            loadWeeklyProgramsFromSupabase(),
          ])

          if (!isMounted) {
            return
          }

          if (
            memberResult.error
          ) {
            throw memberResult.error
          }

          const loadedMembers =
            memberResult.data ||
            []

          const orderedMembers =
            [...loadedMembers].sort(
              (
                first,
                second,
              ) => {
                const firstAthlete =
                  first.membership ===
                  'NTAC ATHLETE'
                    ? 1
                    : 0

                const secondAthlete =
                  second.membership ===
                  'NTAC ATHLETE'
                    ? 1
                    : 0

                return (
                  secondAthlete -
                  firstAthlete
                )
              },
            )

          const orderedPrograms =
            [
              ...(weeklyPrograms ||
                []),
            ].sort(
              (
                first,
                second,
              ) =>
                getWeekStartDate(
                  second,
                ).localeCompare(
                  getWeekStartDate(
                    first,
                  ),
                ),
            )

          setMembers(
            loadedMembers,
          )

          setPrograms(
            weeklyPrograms || [],
          )

          setSelectedMemberId(
            orderedMembers[0]?.id ||
              '',
          )

          setSelectedWeekId(
            orderedPrograms[0]
              ?.weekId || '',
          )
        } catch (error) {
          console.error(
            '주간 리포트 관리자 데이터 조회 실패:',
            error,
          )

          if (isMounted) {
            setErrorMessage(
              error.message ||
                '주간 리포트 데이터를 불러오지 못했습니다.',
            )
          }
        } finally {
          if (isMounted) {
            setLoading(false)
          }
        }
      }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadReports =
      async () => {
        if (
          !selectedMemberId
        ) {
          setReports([])
          setCoachComment('')
          return
        }

        setReportsLoading(true)
        setErrorMessage('')

        try {
          const loadedReports =
            await loadAthleteReports(
              selectedMemberId,
            )

          if (!isMounted) {
            return
          }

          setReports(
            sortReports(
              loadedReports,
            ),
          )
        } catch (error) {
          console.error(
            '멤버 주간 리포트 조회 실패:',
            error,
          )

          if (isMounted) {
            setErrorMessage(
              error.message ||
                '리포트 기록을 불러오지 못했습니다.',
            )
          }
        } finally {
          if (isMounted) {
            setReportsLoading(
              false,
            )
          }
        }
      }

    loadReports()

    return () => {
      isMounted = false
    }
  }, [selectedMemberId])

  useEffect(() => {
    setCoachComment(
      selectedReport
        ?.coachComment || '',
    )
  }, [
    selectedReport?.id,
    selectedReport?.coachComment,
  ])

  const updateReportState = (
    nextReport,
  ) => {
    setReports((current) =>
      sortReports([
        nextReport,

        ...current.filter(
          (report) =>
            report.id !==
            nextReport.id,
        ),
      ]),
    )
  }

  const generateReport =
    async () => {
      if (
        !selectedMember ||
        !selectedWeek ||
        generating
      ) {
        return
      }

      if (
        selectedReport
          ?.isPublished
      ) {
        const confirmed =
          window.confirm(
            '현재 멤버에게 공개 중인 리포트입니다.\n\n재분석하면 공개가 중지되고 코치 검토가 다시 필요합니다. 계속할까요?',
          )

        if (!confirmed) {
          return
        }
      }

      setGenerating(true)
      setErrorMessage('')
      setStatusMessage(
        '체크인과 운동 기록을 분석하고 있습니다...',
      )

      try {
        if (
          selectedReport
            ?.isPublished
        ) {
          await unpublishAthleteReport(
            selectedReport.id,
          )
        }

        const generatedReport =
          await generateAthleteReport({
            userId:
              selectedMember.id,

            week:
              selectedWeek,
          })

        updateReportState(
          generatedReport,
        )

        setCoachComment(
          generatedReport
            .coachComment || '',
        )

        setStatusMessage(
          '자동 분석이 완료되었습니다. 코치 검토 후 공개해 주세요.',
        )
      } catch (error) {
        console.error(
          '주간 리포트 생성 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '주간 리포트를 생성하지 못했습니다.',
        )

        setStatusMessage('')
      } finally {
        setGenerating(false)
      }
    }

  const saveCoachReview =
    async () => {
      if (
        !selectedReport ||
        saving
      ) {
        return
      }

      setSaving(true)
      setErrorMessage('')
      setStatusMessage(
        '코치 리뷰를 저장하고 있습니다...',
      )

      try {
        const savedReport =
          await reviewAthleteReport({
            reportId:
              selectedReport.id,

            coachComment,

            publish:
              selectedReport
                .isPublished,
          })

        updateReportState(
          savedReport,
        )

        setStatusMessage(
          selectedReport
            .isPublished
            ? '코치 리뷰가 저장되고 공개 상태가 유지되었습니다.'
            : '코치 리뷰가 저장되었습니다.',
        )
      } catch (error) {
        console.error(
          '코치 리뷰 저장 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '코치 리뷰를 저장하지 못했습니다.',
        )

        setStatusMessage('')
      } finally {
        setSaving(false)
      }
    }

  const publishReport =
    async () => {
      if (
        !selectedReport ||
        saving
      ) {
        return
      }

      if (
        !coachComment.trim()
      ) {
        alert(
          '멤버에게 전달할 코치 코멘트를 작성해 주세요.',
        )

        return
      }

      const confirmed =
        window.confirm(
          `${getMemberName(
            selectedMember,
          )}님에게 ${selectedReport.weekLabel} 주간 리포트를 공개할까요?`,
        )

      if (!confirmed) {
        return
      }

      setSaving(true)
      setErrorMessage('')
      setStatusMessage(
        '리포트를 공개하고 있습니다...',
      )

      try {
        const publishedReport =
          await reviewAthleteReport({
            reportId:
              selectedReport.id,

            coachComment,

            publish: true,
          })

        updateReportState(
          publishedReport,
        )

        setStatusMessage(
          '주간 리포트가 멤버에게 공개되었습니다.',
        )
      } catch (error) {
        console.error(
          '주간 리포트 공개 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '리포트를 공개하지 못했습니다.',
        )

        setStatusMessage('')
      } finally {
        setSaving(false)
      }
    }

  const stopPublishing =
    async () => {
      if (
        !selectedReport ||
        saving
      ) {
        return
      }

      const confirmed =
        window.confirm(
          '이 리포트의 멤버 공개를 중지할까요?',
        )

      if (!confirmed) {
        return
      }

      setSaving(true)
      setErrorMessage('')
      setStatusMessage(
        '공개를 중지하고 있습니다...',
      )

      try {
        const unpublishedReport =
          await unpublishAthleteReport(
            selectedReport.id,
          )

        updateReportState(
          unpublishedReport,
        )

        setStatusMessage(
          '리포트 공개가 중지되었습니다.',
        )
      } catch (error) {
        console.error(
          '리포트 공개 중지 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '리포트 공개를 중지하지 못했습니다.',
        )

        setStatusMessage('')
      } finally {
        setSaving(false)
      }
    }

  if (loading) {
    return (
      <article className="feature-card">
        <h3>
          주간 리포트 관리자를
          준비하고 있습니다.
        </h3>

        <p>
          멤버와 프로그램 정보를
          불러오고 있어요.
        </p>
      </article>
    )
  }

  return (
    <section
      style={{
        display: 'grid',
        gap: '18px',
      }}
    >
      <div>
        <p
          style={{
            margin:
              '0 0 6px',
            color: '#0b6b4f',
            fontSize: '11px',
            fontWeight: '900',
            letterSpacing:
              '0.08em',
          }}
        >
          ATHLETE WEEKLY REPORT
        </p>

        <h3
          style={{
            margin: 0,
            color: '#17352c',
            fontSize: '22px',
          }}
        >
          주간 리포트 관리
        </h3>

        <p
          style={{
            margin:
              '8px 0 0',
            color: '#697872',
            fontSize: '13px',
            lineHeight: 1.6,
          }}
        >
          목표 RPE, 실제 RPE와
          체크인 기록을 비교한 뒤
          코치 검토를 거쳐
          멤버에게 공개합니다.
        </p>
      </div>

      {errorMessage && (
        <article className="feature-card locked">
          <span className="locked-badge">
            REPORT ERROR
          </span>

          <h3>
            리포트 작업을 완료하지
            못했습니다.
          </h3>

          <p>
            {errorMessage}
          </p>
        </article>
      )}

      {statusMessage && (
        <div
          style={{
            padding:
              '12px 14px',
            borderRadius:
              '12px',
            background:
              '#e5f3ed',
            color: '#0b6b4f',
            fontSize: '12px',
            fontWeight: '800',
          }}
        >
          {statusMessage}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gap: '14px',
          padding: '18px',
          border:
            '1px solid #dce5e1',
          borderRadius:
            '18px',
          background: '#ffffff',
        }}
      >
        <label className="admin-field">
          분석할 멤버

          <select
            value={
              selectedMemberId
            }
            onChange={(event) => {
              setSelectedMemberId(
                event.target.value,
              )

              setStatusMessage('')
            }}
          >
            {sortedMembers.map(
              (member) => (
                <option
                  key={member.id}
                  value={member.id}
                >
                  {getMemberName(
                    member,
                  )}

                  {' · '}

                  {member.membership ||
                    'NTAC RUN'}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="admin-field">
          분석할 주차

          <select
            value={
              selectedWeekId
            }
            onChange={(event) => {
              setSelectedWeekId(
                event.target.value,
              )

              setStatusMessage('')
            }}
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
                    ? ' · 프로그램 공개'
                    : ' · 프로그램 비공개'}
                </option>
              ),
            )}
          </select>
        </label>

        {selectedMember &&
          selectedMember.membership !==
            'NTAC ATHLETE' && (
            <div
              style={{
                padding:
                  '12px 14px',
                borderRadius:
                  '12px',
                background:
                  '#fff4cf',
                color:
                  '#7b5a00',
                fontSize:
                  '12px',
                fontWeight:
                  '700',
                lineHeight:
                  1.55,
              }}
            >
              현재 선택된 멤버의
              상품은{' '}
              {selectedMember.membership ||
                'NTAC RUN'}
              입니다. 테스트용 분석은
              가능하지만 멤버 전용
              리포트는 NTAC ATHLETE
              상품에서 제공하는 것을
              권장합니다.
            </div>
          )}

        <button
          type="button"
          disabled={
            generating ||
            !selectedMember ||
            !selectedWeek
          }
          onClick={
            generateReport
          }
          style={{
            ...buttonBaseStyle,
            background:
              generating
                ? '#9daaa5'
                : '#0b3d2e',
            color: '#ffffff',
          }}
        >
          {generating
            ? '주간 기록 분석 중...'
            : selectedReport
              ? '현재 주차 다시 분석'
              : '주간 리포트 자동 분석'}
        </button>
      </div>

      {reportsLoading && (
        <article className="feature-card">
          <h3>
            기존 리포트를 불러오는
            중입니다.
          </h3>
        </article>
      )}

      {!reportsLoading &&
        !selectedReport && (
          <article className="feature-card locked">
            <span className="locked-badge">
              분석 전
            </span>

            <h3>
              선택한 주차의 리포트가
              없습니다.
            </h3>

            <p>
              주간 리포트 자동 분석
              버튼을 눌러 분석을
              시작해 주세요.
            </p>
          </article>
        )}

      {selectedReport && (
        <article
          style={{
            display: 'grid',
            gap: '18px',
            padding: '20px',
            border:
              '1px solid #dce5e1',
            borderRadius:
              '20px',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems:
                'flex-start',
              justifyContent:
                'space-between',
              gap: '14px',
            }}
          >
            <div>
              <span
                style={{
                  color:
                    '#75827d',
                  fontSize:
                    '11px',
                  fontWeight:
                    '800',
                }}
              >
                {formatDate(
                  selectedReport
                    .startDate,
                )}
                {' - '}
                {formatDate(
                  selectedReport
                    .endDate,
                )}
              </span>

              <h3
                style={{
                  margin:
                    '5px 0 4px',
                  color:
                    '#17352c',
                  fontSize:
                    '20px',
                }}
              >
                {
                  selectedReport
                    .weekLabel
                }
              </h3>

              <p
                style={{
                  margin: 0,
                  color:
                    '#607069',
                  fontSize:
                    '12px',
                  fontWeight:
                    '700',
                }}
              >
                {
                  selectedReport
                    .weekTypeLabel
                }
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                justifyItems:
                  'end',
                gap: '7px',
              }}
            >
              <span
                style={{
                  padding:
                    '7px 10px',
                  borderRadius:
                    '999px',
                  fontSize:
                    '11px',
                  fontWeight:
                    '900',

                  ...(statusStyles[
                    selectedReport
                      .status
                  ] ||
                    statusStyles
                      .COACH_REVIEW),
                }}
              >
                {getReportStatusLabel(
                  selectedReport
                    .status,
                )}
              </span>

              <span
                style={{
                  color:
                    selectedReport
                      .isPublished
                      ? '#0b6b4f'
                      : '#7b8883',
                  fontSize:
                    '11px',
                  fontWeight:
                    '900',
                }}
              >
                {selectedReport
                  .isPublished
                  ? '멤버에게 공개 중'
                  : '코치 검토 중'}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: '10px',
            }}
          >
            {[
              {
                label:
                  '프로그램 수행',
                value:
                  `${selectedReport.completedSessions} / ${selectedReport.plannedSessions}`,
              },

              {
                label:
                  '평균 목표 RPE',
                value:
                  formatNumber(
                    selectedReport
                      .expectedRpeAverage,
                  ),
              },

              {
                label:
                  '평균 실제 RPE',
                value:
                  formatNumber(
                    selectedReport
                      .actualRpeAverage,
                  ),
              },

              {
                label:
                  '평균 RPE 차이',
                value:
                  selectedReport
                    .rpeGapAverage ===
                    null
                    ? '-'
                    : `${
                        Number(
                          selectedReport
                            .rpeGapAverage,
                        ) > 0
                          ? '+'
                          : ''
                      }${formatNumber(
                        selectedReport
                          .rpeGapAverage,
                      )}`,
              },

              {
                label:
                  '주간 체크인',
                value:
                  `${selectedReport.checkinDays}일`,
              },

              {
                label:
                  '평균 수면',
                value:
                  selectedReport
                    .averageSleep ===
                    null
                    ? '-'
                    : `${formatNumber(
                        selectedReport
                          .averageSleep,
                      )}시간`,
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding:
                    '14px',
                  borderRadius:
                    '14px',
                  background:
                    '#f2f6f4',
                }}
              >
                <span
                  style={{
                    display:
                      'block',
                    marginBottom:
                      '6px',
                    color:
                      '#71807a',
                    fontSize:
                      '11px',
                    fontWeight:
                      '700',
                  }}
                >
                  {item.label}
                </span>

                <strong
                  style={{
                    color:
                      '#17352c',
                    fontSize:
                      '18px',
                  }}
                >
                  {item.value}
                </strong>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius:
                '14px',
              background:
                '#edf5f1',
            }}
          >
            <span
              style={{
                color: '#0b6b4f',
                fontSize: '11px',
                fontWeight: '900',
              }}
            >
              AUTOMATIC ANALYSIS
            </span>

            <p
              style={{
                margin:
                  '8px 0 0',
                color: '#29443b',
                fontSize: '14px',
                fontWeight: '700',
                lineHeight: 1.7,
              }}
            >
              {selectedReport.summary}
            </p>
          </div>

          <div>
            <h4
              style={{
                margin:
                  '0 0 10px',
                color: '#17352c',
              }}
            >
              회복 상태
            </h4>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
                gap: '8px',
              }}
            >
              <span
                style={{
                  padding:
                    '10px',
                  borderRadius:
                    '10px',
                  background:
                    '#f5f7f6',
                  fontSize:
                    '12px',
                  fontWeight:
                    '700',
                }}
              >
                컨디션{' '}
                {formatNumber(
                  selectedReport
                    .averageCondition,
                )}
                {' / 5'}
              </span>

              <span
                style={{
                  padding:
                    '10px',
                  borderRadius:
                    '10px',
                  background:
                    '#f5f7f6',
                  fontSize:
                    '12px',
                  fontWeight:
                    '700',
                }}
              >
                근육통{' '}
                {formatNumber(
                  selectedReport
                    .averageSoreness,
                )}
                {' / 5'}
              </span>

              <span
                style={{
                  padding:
                    '10px',
                  borderRadius:
                    '10px',
                  background:
                    '#f5f7f6',
                  fontSize:
                    '12px',
                  fontWeight:
                    '700',
                }}
              >
                스트레스{' '}
                {formatNumber(
                  selectedReport
                    .averageStress,
                )}
                {' / 5'}
              </span>

              <span
                style={{
                  padding:
                    '10px',
                  borderRadius:
                    '10px',
                  background:
                    selectedReport
                      .painDetected
                      ? '#ffe7e3'
                      : '#f5f7f6',
                  color:
                    selectedReport
                      .painDetected
                      ? '#9f3228'
                      : '#253d35',
                  fontSize:
                    '12px',
                  fontWeight:
                    '800',
                }}
              >
                통증 기록{' '}
                {selectedReport
                  .painDetected
                  ? '있음'
                  : '없음'}
              </span>
            </div>

            {recoverySignals.length >
              0 && (
              <p
                style={{
                  margin:
                    '10px 0 0',
                  color:
                    '#945200',
                  fontSize:
                    '12px',
                  fontWeight:
                    '700',
                  lineHeight:
                    1.5,
                }}
              >
                확인 신호:{' '}
                {recoverySignals.join(
                  ', ',
                )}
              </p>
            )}
          </div>

          <div>
            <h4
              style={{
                margin:
                  '0 0 10px',
                color: '#17352c',
              }}
            >
              세션별 반응
            </h4>

            <div
              style={{
                display: 'grid',
                gap: '8px',
              }}
            >
              {sessionAnalysis.map(
                (session) => (
                  <div
                    key={
                      session.eventId ||
                      session.sessionId
                    }
                    style={{
                      display: 'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'space-between',
                      gap: '12px',
                      padding:
                        '12px',
                      border:
                        '1px solid #e1e8e5',
                      borderRadius:
                        '12px',
                      background:
                        session.completed
                          ? '#ffffff'
                          : '#f5f6f5',
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          color:
                            '#77837e',
                          fontSize:
                            '10px',
                          fontWeight:
                            '800',
                        }}
                      >
                        {formatDate(
                          session.date,
                        )}
                        {' · '}
                        {session.type}
                      </span>

                      <h5
                        style={{
                          margin:
                            '4px 0 0',
                          color:
                            '#203c33',
                          fontSize:
                            '13px',
                        }}
                      >
                        {session.title}
                      </h5>
                    </div>

                    <div
                      style={{
                        flexShrink: 0,
                        textAlign:
                          'right',
                      }}
                    >
                      {session.completed ? (
                        <>
                          <strong
                            style={{
                              display:
                                'block',
                              color:
                                '#17352c',
                              fontSize:
                                '13px',
                            }}
                          >
                            {session.targetRpe ??
                              '-'}
                            {' → '}
                            {session.actualRpe ??
                              '-'}
                          </strong>

                          <span
                            style={{
                              color:
                                Number(
                                  session.rpeGap ||
                                    0,
                                ) > 0
                                  ? '#a04435'
                                  : '#65746e',
                              fontSize:
                                '10px',
                              fontWeight:
                                '800',
                            }}
                          >
                            차이{' '}
                            {session.rpeGap >
                            0
                              ? '+'
                              : ''}
                            {session.rpeGap ??
                              '-'}
                          </span>
                        </>
                      ) : (
                        <span
                          style={{
                            color:
                              '#8b9691',
                            fontSize:
                              '11px',
                            fontWeight:
                              '800',
                          }}
                        >
                          미완료
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          <label className="admin-field">
            코치 코멘트

            <textarea
              rows={6}
              placeholder="이번 주 수행에 대한 판단과 다음 주 훈련 방향을 작성해 주세요."
              value={
                coachComment
              }
              onChange={(event) =>
                setCoachComment(
                  event.target.value,
                )
              }
            />
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: '10px',
            }}
          >
            <button
              type="button"
              disabled={saving}
              onClick={
                saveCoachReview
              }
              style={{
                ...buttonBaseStyle,
                background:
                  '#e9eeeb',
                color: '#29443b',
              }}
            >
              {saving
                ? '저장 중...'
                : '코치 리뷰 저장'}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={
                publishReport
              }
              style={{
                ...buttonBaseStyle,
                background:
                  '#0b3d2e',
                color: '#ffffff',
              }}
            >
              {saving
                ? '처리 중...'
                : selectedReport
                      .isPublished
                  ? '수정 내용 다시 공개'
                  : '멤버에게 공개'}
            </button>
          </div>

          {selectedReport
            .isPublished && (
            <button
              type="button"
              disabled={saving}
              onClick={
                stopPublishing
              }
              style={{
                ...buttonBaseStyle,
                border:
                  '1px solid #e4b5ae',
                background:
                  '#fff7f5',
                color: '#a13d32',
              }}
            >
              리포트 공개 중지
            </button>
          )}

          <p
            style={{
              margin: 0,
              color: '#84908b',
              fontSize: '10px',
              textAlign: 'right',
            }}
          >
            마지막 수정{' '}
            {formatDateTime(
              selectedReport
                .updatedAt,
            )}
          </p>
        </article>
      )}

      {reports.length > 0 && (
        <section>
          <h4
            style={{
              margin:
                '0 0 10px',
              color: '#17352c',
            }}
          >
            리포트 기록
          </h4>

          <div
            style={{
              display: 'grid',
              gap: '8px',
            }}
          >
            {reports.map(
              (report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() =>
                    setSelectedWeekId(
                      report.weekId,
                    )
                  }
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    gap: '12px',
                    width: '100%',
                    padding:
                      '13px 14px',
                    border:
                      report.weekId ===
                      selectedWeekId
                        ? '2px solid #0b3d2e'
                        : '1px solid #dce5e1',
                    borderRadius:
                      '13px',
                    background:
                      '#ffffff',
                    textAlign:
                      'left',
                    cursor:
                      'pointer',
                  }}
                >
                  <div>
                    <strong
                      style={{
                        display:
                          'block',
                        color:
                          '#17352c',
                        fontSize:
                          '13px',
                      }}
                    >
                      {
                        report.weekLabel
                      }
                    </strong>

                    <span
                      style={{
                        color:
                          '#74817c',
                        fontSize:
                          '10px',
                        fontWeight:
                          '700',
                      }}
                    >
                      {
                        report.weekTypeLabel
                      }
                    </span>
                  </div>

                  <div
                    style={{
                      textAlign:
                        'right',
                    }}
                  >
                    <strong
                      style={{
                        display:
                          'block',
                        color:
                          report.isPublished
                            ? '#0b6b4f'
                            : '#6d7974',
                        fontSize:
                          '10px',
                      }}
                    >
                      {report.isPublished
                        ? '공개 중'
                        : '검토 중'}
                    </strong>

                    <span
                      style={{
                        color:
                          '#89938f',
                        fontSize:
                          '10px',
                      }}
                    >
                      {getReportStatusLabel(
                        report.status,
                      )}
                    </span>
                  </div>
                </button>
              ),
            )}
          </div>
        </section>
      )}
    </section>
  )
}

export default WeeklyAthleteReportAdmin