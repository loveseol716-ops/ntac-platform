import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  COACH_REQUEST_STATUS,
  createCoachSessionRequest,
  getCurrentMonthKey,
  loadMyCoachSessionRequests,
  subscribeToCoachSessionRequests,
} from './data/coachSessionRequests.js'

function formatMonth(dateKey) {
  if (!dateKey) {
    return ''
  }

  return new Date(
    `${dateKey}T00:00:00`,
  ).toLocaleDateString(
    'ko-KR',
    {
      year: 'numeric',
      month: 'long',
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

const statusStyle = {
  REQUESTED: {
    background: '#fff4cf',
    color: '#7d5b00',
  },

  CONTACTED: {
    background: '#dff0fa',
    color: '#17618a',
  },

  COMPLETED: {
    background: '#dff5e9',
    color: '#0b6b4f',
  },

  CANCELLED: {
    background: '#ecefed',
    color: '#66736e',
  },
}

function CoachSessionRequestSection({
  member,
  settings,
}) {
  const [
    requests,
    setRequests,
  ] = useState([])

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    statusMessage,
    setStatusMessage,
  ] = useState('')

  const membership =
    settings?.membership ||
    member?.membership ||
    'NTAC RUN'

  const coachName =
    settings?.coach ||
    '미배정'

  const isAthlete =
    membership ===
    'NTAC ATHLETE'

  const currentMonth =
    getCurrentMonthKey()

  const currentRequest =
    useMemo(
      () =>
        requests.find(
          (request) =>
            request.requestMonth ===
            currentMonth,
        ) || null,

      [
        requests,
        currentMonth,
      ],
    )

  const sortedRequests =
    useMemo(
      () =>
        [...requests].sort(
          (
            first,
            second,
          ) =>
            String(
              second.requestMonth ||
                '',
            ).localeCompare(
              String(
                first.requestMonth ||
                  '',
              ),
            ),
        ),

      [requests],
    )

  const loadRequests =
    async () => {
      if (!member?.id) {
        setLoading(false)
        return
      }

      setErrorMessage('')

      try {
        const loadedRequests =
          await loadMyCoachSessionRequests()

        setRequests(
          loadedRequests,
        )
      } catch (error) {
        console.error(
          '코치 세션 요청 조회 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '코치 세션 요청을 불러오지 못했습니다.',
        )
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    loadRequests()

    const unsubscribe =
      subscribeToCoachSessionRequests(
        () => {
          loadRequests()
        },
      )

    return unsubscribe
  }, [member?.id])

  const submitRequest =
    async () => {
      if (
        !isAthlete ||
        submitting ||
        currentRequest
      ) {
        return
      }

      if (
        !coachName ||
        coachName === '미배정'
      ) {
        alert(
          '담당 코치가 아직 배정되지 않았습니다.',
        )

        return
      }

      const confirmed =
        window.confirm(
          `${coachName} 코치에게 이번 달 1:1 세션을 요청할까요?\n\n요청 후 코치가 개인적으로 연락하여 일정을 조율합니다.`,
        )

      if (!confirmed) {
        return
      }

      setSubmitting(true)
      setErrorMessage('')
      setStatusMessage(
        '담당 코치에게 요청을 전달하고 있습니다...',
      )

      try {
        const createdRequest =
          await createCoachSessionRequest({
            memberId:
              member.id,

            coachName,

            message,
          })

        setRequests(
          (current) => [
            createdRequest,
            ...current,
          ],
        )

        setMessage('')

        setStatusMessage(
          '코치 세션 요청이 접수되었습니다. 담당 코치가 개인적으로 연락드릴 예정입니다.',
        )
      } catch (error) {
        console.error(
          '코치 세션 요청 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '코치 세션을 요청하지 못했습니다.',
        )

        setStatusMessage('')
      } finally {
        setSubmitting(false)
      }
    }

  if (!isAthlete) {
    return (
      <article
        style={{
          marginTop: '18px',
          padding: '22px',
          borderRadius: '20px',
          background: '#17352c',
          color: '#ffffff',
        }}
      >
        <span
          style={{
            color: '#b7d4c8',
            fontSize: '10px',
            fontWeight: '900',
            letterSpacing:
              '0.08em',
          }}
        >
          NTAC ATHLETE ONLY
        </span>

        <h3
          style={{
            margin:
              '9px 0 8px',
            fontSize: '21px',
          }}
        >
          월 1회 코치 1:1 세션
        </h3>

        <p
          style={{
            margin: 0,
            color: '#d7e5df',
            fontSize: '13px',
            lineHeight: 1.65,
          }}
        >
          담당 코치와 현재 훈련
          상태를 점검하고 다음
          방향을 설정하는 ATHLETE
          전용 서비스입니다.
        </p>
      </article>
    )
  }

  if (loading) {
    return (
      <article
        style={{
          marginTop: '18px',
          padding: '20px',
          border:
            '1px solid #dce5e1',
          borderRadius: '19px',
          background: '#ffffff',
        }}
      >
        <strong
          style={{
            color: '#17352c',
          }}
        >
          코치 세션 요청 정보를
          불러오고 있습니다.
        </strong>
      </article>
    )
  }

  return (
    <section
      style={{
        display: 'grid',
        gap: '14px',
        marginTop: '18px',
      }}
    >
      <article
        style={{
          display: 'grid',
          gap: '16px',
          padding: '21px',
          border:
            '1px solid #dce5e1',
          borderRadius: '20px',
          background: '#ffffff',
        }}
      >
        <div>
          <span
            style={{
              color: '#0b6b4f',
              fontSize: '10px',
              fontWeight: '900',
              letterSpacing:
                '0.08em',
            }}
          >
            MONTHLY COACH SESSION
          </span>

          <h3
            style={{
              margin:
                '8px 0 6px',
              color: '#17352c',
              fontSize: '21px',
            }}
          >
            코치 1:1 세션 요청
          </h3>

          <p
            style={{
              margin: 0,
              color: '#687771',
              fontSize: '13px',
              lineHeight: 1.65,
            }}
          >
            월 1회 담당 코치에게
            세션을 요청할 수 있습니다.
            요청 후 코치가 개인적으로
            연락하여 일정을 조율합니다.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2, minmax(0, 1fr))',
            gap: '9px',
          }}
        >
          <div
            style={{
              padding: '13px',
              borderRadius: '13px',
              background: '#f1f6f3',
            }}
          >
            <span
              style={{
                display: 'block',
                color: '#74817c',
                fontSize: '10px',
                fontWeight: '800',
              }}
            >
              담당 코치
            </span>

            <strong
              style={{
                display: 'block',
                marginTop: '5px',
                color: '#17352c',
                fontSize: '14px',
              }}
            >
              {coachName}
            </strong>
          </div>

          <div
            style={{
              padding: '13px',
              borderRadius: '13px',
              background: '#f1f6f3',
            }}
          >
            <span
              style={{
                display: 'block',
                color: '#74817c',
                fontSize: '10px',
                fontWeight: '800',
              }}
            >
              이용 가능
            </span>

            <strong
              style={{
                display: 'block',
                marginTop: '5px',
                color: '#17352c',
                fontSize: '14px',
              }}
            >
              월 1회
            </strong>
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              padding:
                '12px 14px',
              borderRadius: '12px',
              background: '#fff0ed',
              color: '#a3362d',
              fontSize: '12px',
              fontWeight: '700',
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </div>
        )}

        {statusMessage && (
          <div
            style={{
              padding:
                '12px 14px',
              borderRadius: '12px',
              background: '#e5f3ed',
              color: '#0b6b4f',
              fontSize: '12px',
              fontWeight: '700',
              lineHeight: 1.5,
            }}
          >
            {statusMessage}
          </div>
        )}

        {currentRequest ? (
          <div
            style={{
              display: 'grid',
              gap: '11px',
              padding: '16px',
              borderRadius: '15px',
              background: '#f2f6f4',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'space-between',
                gap: '10px',
              }}
            >
              <strong
                style={{
                  color: '#17352c',
                  fontSize: '14px',
                }}
              >
                {formatMonth(
                  currentRequest
                    .requestMonth,
                )} 요청
              </strong>

              <span
                style={{
                  padding:
                    '6px 9px',
                  borderRadius:
                    '999px',
                  fontSize: '10px',
                  fontWeight: '900',

                  ...(statusStyle[
                    currentRequest
                      .status
                  ] ||
                    statusStyle
                      .REQUESTED),
                }}
              >
                {currentRequest
                  .statusLabel}
              </span>
            </div>

            <p
              style={{
                margin: 0,
                color: '#63716c',
                fontSize: '12px',
                lineHeight: 1.6,
                whiteSpace:
                  'pre-wrap',
              }}
            >
              {currentRequest.message ||
                '별도로 전달한 내용이 없습니다.'}
            </p>

            <span
              style={{
                color: '#8a9591',
                fontSize: '10px',
                fontWeight: '700',
              }}
            >
              요청 시간{' '}
              {formatDateTime(
                currentRequest
                  .requestedAt,
              )}
            </span>

            <p
              style={{
                margin: 0,
                color: '#0b6b4f',
                fontSize: '12px',
                fontWeight: '800',
                lineHeight: 1.5,
              }}
            >
              담당 코치가 확인한 뒤
              개인적으로 연락드릴
              예정입니다.
            </p>
          </div>
        ) : (
          <>
            <label
              style={{
                display: 'grid',
                gap: '7px',
                color: '#17352c',
                fontSize: '12px',
                fontWeight: '800',
              }}
            >
              코치에게 전달할 내용

              <textarea
                rows={5}
                maxLength={500}
                placeholder="현재 고민되는 부분이나 세션에서 확인하고 싶은 내용을 작성해 주세요."
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value,
                  )
                }
                style={{
                  width: '100%',
                  boxSizing:
                    'border-box',
                  padding: '13px',
                  border:
                    '1px solid #d3ded9',
                  borderRadius:
                    '13px',
                  background:
                    '#ffffff',
                  color: '#17352c',
                  fontFamily:
                    'inherit',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  resize: 'vertical',
                }}
              />

              <span
                style={{
                  color: '#8a9591',
                  fontSize: '10px',
                  textAlign: 'right',
                }}
              >
                {message.length} / 500
              </span>
            </label>

            <button
              type="button"
              disabled={
                submitting ||
                coachName ===
                  '미배정'
              }
              onClick={
                submitRequest
              }
              style={{
                width: '100%',
                minHeight: '50px',
                border: 'none',
                borderRadius:
                  '14px',
                background:
                  submitting ||
                  coachName ===
                    '미배정'
                    ? '#9daaa5'
                    : '#0b3d2e',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '900',
                cursor:
                  submitting
                    ? 'default'
                    : 'pointer',
              }}
            >
              {submitting
                ? '요청 전달 중...'
                : '이번 달 코치 세션 요청'}
            </button>
          </>
        )}
      </article>

      {sortedRequests.length >
        0 && (
        <article
          style={{
            padding: '18px',
            border:
              '1px solid #dce5e1',
            borderRadius: '18px',
            background: '#ffffff',
          }}
        >
          <h4
            style={{
              margin:
                '0 0 12px',
              color: '#17352c',
              fontSize: '15px',
            }}
          >
            이전 요청 기록
          </h4>

          <div
            style={{
              display: 'grid',
              gap: '8px',
            }}
          >
            {sortedRequests
              .slice(0, 6)
              .map((request) => (
                <div
                  key={request.id}
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    gap: '12px',
                    padding:
                      '11px 12px',
                    borderRadius:
                      '11px',
                    background:
                      '#f5f7f6',
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
                          '12px',
                      }}
                    >
                      {formatMonth(
                        request
                          .requestMonth,
                      )}
                    </strong>

                    <span
                      style={{
                        color:
                          '#81908a',
                        fontSize:
                          '10px',
                      }}
                    >
                      {request.coachName}{' '}
                      코치
                    </span>
                  </div>

                  <span
                    style={{
                      padding:
                        '5px 8px',
                      borderRadius:
                        '999px',
                      fontSize:
                        '9px',
                      fontWeight:
                        '900',

                      ...(statusStyle[
                        request.status
                      ] ||
                        statusStyle
                          .REQUESTED),
                    }}
                  >
                    {COACH_REQUEST_STATUS[
                      request.status
                    ]?.label ||
                      request.statusLabel}
                  </span>
                </div>
              ))}
          </div>
        </article>
      )}
    </section>
  )
}

export default CoachSessionRequestSection