import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  getReportStatusLabel,
  loadPublishedAthleteReports,
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

function WeeklyAthleteReportPage({
  member,
  access,
  onBack,
}) {
  const [
    reports,
    setReports,
  ] = useState([])

  const [
    selectedReportId,
    setSelectedReportId,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const canViewReport =
    Boolean(
      access?.weeklyReport,
    ) ||
    member?.membership ===
      'NTAC ATHLETE'

  useEffect(() => {
    let isMounted = true

    const loadReports =
      async () => {
        if (
          !member?.id ||
          !canViewReport
        ) {
          setLoading(false)
          return
        }

        setLoading(true)
        setErrorMessage('')

        try {
          const loadedReports =
            await loadPublishedAthleteReports()

          if (!isMounted) {
            return
          }

          const memberReports =
            loadedReports
              .filter(
                (report) =>
                  report.userId ===
                  member.id,
              )
              .sort(
                (
                  first,
                  second,
                ) =>
                  String(
                    second.startDate ||
                      '',
                  ).localeCompare(
                    String(
                      first.startDate ||
                        '',
                    ),
                  ),
              )

          setReports(
            memberReports,
          )

          setSelectedReportId(
            memberReports[0]?.id ||
              '',
          )
        } catch (error) {
          console.error(
            '주간 리포트 조회 실패:',
            error,
          )

          if (isMounted) {
            setErrorMessage(
              error.message ||
                '주간 리포트를 불러오지 못했습니다.',
            )
          }
        } finally {
          if (isMounted) {
            setLoading(false)
          }
        }
      }

    loadReports()

    return () => {
      isMounted = false
    }
  }, [
    member?.id,
    canViewReport,
  ])

  const selectedReport =
    useMemo(
      () =>
        reports.find(
          (report) =>
            report.id ===
            selectedReportId,
        ) ||
        reports[0] ||
        null,

      [
        reports,
        selectedReportId,
      ],
    )

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

  if (!canViewReport) {
    return (
      <main
        style={{
          minHeight: '100vh',
          padding:
            '24px 18px 100px',
          background:
            '#f4f7f5',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            marginBottom: '22px',
            border: 'none',
            background:
              'transparent',
            color: '#17352c',
            fontSize: '14px',
            fontWeight: '800',
            cursor: 'pointer',
          }}
        >
          ← 돌아가기
        </button>

        <article
          style={{
            padding: '24px',
            borderRadius:
              '22px',
            background:
              '#17352c',
            color: '#ffffff',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: '900',
              letterSpacing:
                '0.08em',
              color: '#b9d5ca',
            }}
          >
            NTAC ATHLETE ONLY
          </span>

          <h1
            style={{
              margin:
                '10px 0 8px',
              fontSize: '25px',
            }}
          >
            주간 코치 리포트
          </h1>

          <p
            style={{
              margin: 0,
              color: '#d5e5de',
              fontSize: '14px',
              lineHeight: 1.7,
            }}
          >
            목표 강도와 실제 수행,
            컨디션과 회복 상태를
            분석해 다음 훈련 방향을
            코치가 직접 전달하는
            ATHLETE 전용 서비스입니다.
          </p>
        </article>
      </main>
    )
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background:
            '#f4f7f5',
          color: '#17352c',
          fontWeight: '800',
        }}
      >
        주간 리포트를 불러오는
        중입니다.
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding:
          '22px 18px 100px',
        background:
          '#f4f7f5',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          marginBottom: '18px',
          border: 'none',
          background:
            'transparent',
          color: '#17352c',
          fontSize: '14px',
          fontWeight: '800',
          cursor: 'pointer',
        }}
      >
        ← 돌아가기
      </button>

      <header
        style={{
          marginBottom: '20px',
        }}
      >
        <span
          style={{
            color: '#0b6b4f',
            fontSize: '11px',
            fontWeight: '900',
            letterSpacing:
              '0.08em',
          }}
        >
          ATHLETE WEEKLY REPORT
        </span>

        <h1
          style={{
            margin:
              '7px 0 5px',
            color: '#17352c',
            fontSize: '27px',
          }}
        >
          주간 코치 리포트
        </h1>

        <p
          style={{
            margin: 0,
            color: '#6d7b76',
            fontSize: '13px',
          }}
        >
          {member?.name ||
            member?.fullName ||
            member?.full_name ||
            'NTAC ATHLETE'}
          님의 훈련 반응을
          정리했습니다.
        </p>
      </header>

      {errorMessage && (
        <article
          style={{
            padding: '18px',
            marginBottom: '16px',
            borderRadius:
              '16px',
            background:
              '#fff0ed',
            color: '#a3362d',
            fontSize: '13px',
            fontWeight: '700',
          }}
        >
          {errorMessage}
        </article>
      )}

      {!errorMessage &&
        reports.length === 0 && (
          <article
            style={{
              padding: '24px',
              borderRadius:
                '20px',
              background:
                '#ffffff',
              border:
                '1px solid #dce5e1',
            }}
          >
            <span
              style={{
                color: '#71807a',
                fontSize: '11px',
                fontWeight: '900',
              }}
            >
              REPORT PREPARING
            </span>

            <h2
              style={{
                margin:
                  '9px 0 7px',
                color: '#17352c',
                fontSize: '20px',
              }}
            >
              공개된 리포트가 아직
              없습니다.
            </h2>

            <p
              style={{
                margin: 0,
                color: '#6d7b76',
                fontSize: '13px',
                lineHeight: 1.65,
              }}
            >
              코치가 이번 주 운동
              기록과 체크인을 검토한
              뒤 리포트를 전달할
              예정입니다.
            </p>
          </article>
        )}

      {reports.length > 1 && (
        <label
          style={{
            display: 'grid',
            gap: '7px',
            marginBottom: '15px',
            color: '#17352c',
            fontSize: '12px',
            fontWeight: '800',
          }}
        >
          확인할 주차

          <select
            value={
              selectedReport?.id ||
              ''
            }
            onChange={(event) =>
              setSelectedReportId(
                event.target.value,
              )
            }
            style={{
              minHeight: '48px',
              padding:
                '0 14px',
              border:
                '1px solid #d3ded9',
              borderRadius:
                '13px',
              background:
                '#ffffff',
              color: '#17352c',
              fontSize: '14px',
              fontWeight: '700',
            }}
          >
            {reports.map(
              (report) => (
                <option
                  key={report.id}
                  value={report.id}
                >
                  {report.weekLabel}
                  {' · '}
                  {
                    report.weekTypeLabel
                  }
                </option>
              ),
            )}
          </select>
        </label>
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
              '22px',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems:
                'flex-start',
              gap: '12px',
            }}
          >
            <div>
              <span
                style={{
                  color: '#74817c',
                  fontSize: '11px',
                  fontWeight: '800',
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

              <h2
                style={{
                  margin:
                    '5px 0 4px',
                  color: '#17352c',
                  fontSize: '22px',
                }}
              >
                {
                  selectedReport
                    .weekLabel
                }
              </h2>

              <p
                style={{
                  margin: 0,
                  color: '#61716b',
                  fontSize: '12px',
                  fontWeight: '700',
                }}
              >
                {
                  selectedReport
                    .weekTypeLabel
                }
              </p>
            </div>

            <span
              style={{
                padding:
                  '7px 10px',
                borderRadius:
                  '999px',
                fontSize: '10px',
                fontWeight: '900',

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
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: '9px',
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
                  '주간 체크인',
                value:
                  `${selectedReport.checkinDays}일`,
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

              {
                label:
                  'RPE 차이',
                value:
                  selectedReport
                    .rpeGapAverage ===
                    null
                    ? '-'
                    : `${
                        selectedReport
                          .rpeGapAverage >
                        0
                          ? '+'
                          : ''
                      }${formatNumber(
                        selectedReport
                          .rpeGapAverage,
                      )}`,
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: '14px',
                  borderRadius:
                    '14px',
                  background:
                    '#f1f6f3',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    marginBottom:
                      '6px',
                    color: '#74817c',
                    fontSize: '10px',
                    fontWeight: '800',
                  }}
                >
                  {item.label}
                </span>

                <strong
                  style={{
                    color: '#17352c',
                    fontSize: '18px',
                  }}
                >
                  {item.value}
                </strong>
              </div>
            ))}
          </div>

          <section
            style={{
              padding: '17px',
              borderRadius:
                '16px',
              background:
                '#edf5f1',
            }}
          >
            <span
              style={{
                color: '#0b6b4f',
                fontSize: '10px',
                fontWeight: '900',
                letterSpacing:
                  '0.06em',
              }}
            >
              WEEKLY ANALYSIS
            </span>

            <p
              style={{
                margin:
                  '8px 0 0',
                color: '#29443b',
                fontSize: '14px',
                fontWeight: '700',
                lineHeight: 1.75,
              }}
            >
              {selectedReport.summary}
            </p>
          </section>

          <section>
            <h3
              style={{
                margin:
                  '0 0 10px',
                color: '#17352c',
                fontSize: '16px',
              }}
            >
              회복 상태
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
                gap: '8px',
              }}
            >
              {[
                {
                  label: '컨디션',
                  value:
                    `${formatNumber(
                      selectedReport
                        .averageCondition,
                    )} / 5`,
                },

                {
                  label: '근육통',
                  value:
                    `${formatNumber(
                      selectedReport
                        .averageSoreness,
                    )} / 5`,
                },

                {
                  label: '스트레스',
                  value:
                    `${formatNumber(
                      selectedReport
                        .averageStress,
                    )} / 5`,
                },

                {
                  label: '통증 기록',
                  value:
                    selectedReport
                      .painDetected
                      ? '확인 필요'
                      : '없음',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding:
                      '12px',
                    borderRadius:
                      '12px',
                    background:
                      item.label ===
                        '통증 기록' &&
                      selectedReport
                        .painDetected
                        ? '#ffe9e5'
                        : '#f5f7f6',
                  }}
                >
                  <span
                    style={{
                      display:
                        'block',
                      color:
                        '#74817c',
                      fontSize:
                        '10px',
                      fontWeight:
                        '800',
                    }}
                  >
                    {item.label}
                  </span>

                  <strong
                    style={{
                      display:
                        'block',
                      marginTop:
                        '5px',
                      color:
                        '#17352c',
                      fontSize:
                        '14px',
                    }}
                  >
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>

            {recoverySignals.length >
              0 && (
              <p
                style={{
                  margin:
                    '10px 0 0',
                  color: '#935300',
                  fontSize: '12px',
                  fontWeight: '700',
                }}
              >
                확인 항목:{' '}
                {recoverySignals.join(
                  ', ',
                )}
              </p>
            )}
          </section>

          <section>
            <h3
              style={{
                margin:
                  '0 0 10px',
                color: '#17352c',
                fontSize: '16px',
              }}
            >
              세션별 수행
            </h3>

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
                      justifyContent:
                        'space-between',
                      alignItems:
                        'center',
                      gap: '12px',
                      padding:
                        '12px',
                      border:
                        '1px solid #e0e8e4',
                      borderRadius:
                        '12px',
                      background:
                        session.completed
                          ? '#ffffff'
                          : '#f5f6f5',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          color:
                            '#74817c',
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

                      <strong
                        style={{
                          display:
                            'block',
                          marginTop:
                            '4px',
                          color:
                            '#17352c',
                          fontSize:
                            '13px',
                        }}
                      >
                        {session.title}
                      </strong>
                    </div>

                    {session.completed ? (
                      <div
                        style={{
                          flexShrink: 0,
                          textAlign:
                            'right',
                        }}
                      >
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
                              '#75827d',
                            fontSize:
                              '10px',
                            fontWeight:
                              '800',
                          }}
                        >
                          목표 → 실제
                        </span>
                      </div>
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
                ),
              )}
            </div>
          </section>

          <section
            style={{
              padding: '18px',
              borderRadius:
                '16px',
              background:
                '#17352c',
              color: '#ffffff',
            }}
          >
            <span
              style={{
                color: '#b7d4c8',
                fontSize: '10px',
                fontWeight: '900',
                letterSpacing:
                  '0.06em',
              }}
            >
              COACH COMMENT
            </span>

            <p
              style={{
                margin:
                  '9px 0 0',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: '700',
                lineHeight: 1.75,
                whiteSpace:
                  'pre-wrap',
              }}
            >
              {selectedReport
                .coachComment ||
                '코치 코멘트를 준비하고 있습니다.'}
            </p>
          </section>
        </article>
      )}
    </main>
  )
}

export default WeeklyAthleteReportPage