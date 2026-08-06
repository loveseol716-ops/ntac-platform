import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  COACH_REQUEST_STATUS,
  loadAllCoachSessionRequests,
  markCoachSessionRequestRead,
  subscribeToCoachSessionRequests,
  updateCoachSessionRequestStatus,
} from './data/coachSessionRequests.js'

const statusStyles = {
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

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '-'
  }

  return date.toLocaleString(
    'ko-KR',
    {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  )
}

function formatMonth(value) {
  if (!value) {
    return '-'
  }

  const date =
    new Date(
      String(value).slice(
        0,
        10,
      ) + 'T00:00:00',
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '-'
  }

  return date.toLocaleDateString(
    'ko-KR',
    {
      year: 'numeric',
      month: 'long',
    },
  )
}

class RequestTabErrorBoundary extends Component {
  constructor(props) {
    super(props)

    this.state = {
      hasError: false,
      message: '',
    }
  }

  static getDerivedStateFromError(
    error,
  ) {
    return {
      hasError: true,
      message:
        error?.message ||
        '알 수 없는 화면 오류',
    }
  }

  componentDidCatch(
    error,
    info,
  ) {
    console.error(
      '1:1 요청 화면 오류:',
      error,
      info,
    )
  }

  render() {
    if (
      this.state.hasError
    ) {
      return (
        <article className="feature-card locked">
          <span className="locked-badge">
            REQUEST SCREEN ERROR
          </span>

          <h3>
            1:1 요청 화면을 표시하지
            못했습니다.
          </h3>

          <p>
            {this.state.message}
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={
              this.props.onBack
            }
          >
            멤버 관리로 돌아가기
          </button>
        </article>
      )
    }

    return this.props.children
  }
}

function CoachSessionRequestAdminContent({
  onBack,
  onRequestsChanged,
}) {
  const [
    requests,
    setRequests,
  ] = useState([])

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('ALL')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    processingId,
    setProcessingId,
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const commitRequests =
    useCallback(
      (nextRequests) => {
        const safeRequests =
          Array.isArray(
            nextRequests,
          )
            ? nextRequests
            : []

        setRequests(
          safeRequests,
        )

        if (
          typeof onRequestsChanged ===
          'function'
        ) {
          onRequestsChanged(
            safeRequests,
          )
        }
      },
      [onRequestsChanged],
    )

  const loadRequests =
    useCallback(
      async ({
        showLoading = true,
      } = {}) => {
        if (showLoading) {
          setLoading(true)
        }

        setErrorMessage('')

        try {
          const loadedRequests =
            await loadAllCoachSessionRequests()

          commitRequests(
            loadedRequests,
          )
        } catch (error) {
          console.error(
            '코치 세션 요청 조회 실패:',
            error,
          )

          setErrorMessage(
            error?.message ||
              '코치 세션 요청을 불러오지 못했습니다.',
          )
        } finally {
          if (showLoading) {
            setLoading(false)
          }
        }
      },
      [commitRequests],
    )

  useEffect(() => {
    loadRequests()

    const unsubscribe =
      subscribeToCoachSessionRequests(
        () => {
          loadRequests({
            showLoading: false,
          })
        },
        'admin-request-list',
      )

    return unsubscribe
  }, [loadRequests])

  const filteredRequests =
    useMemo(() => {
      if (
        statusFilter === 'ALL'
      ) {
        return requests
      }

      return requests.filter(
        (request) =>
          request.status ===
          statusFilter,
      )
    }, [
      requests,
      statusFilter,
    ])

  const counts =
    useMemo(
      () => ({
        unread:
          requests.filter(
            (request) =>
              !request.isRead &&
              request.status ===
                'REQUESTED',
          ).length,

        requested:
          requests.filter(
            (request) =>
              request.status ===
              'REQUESTED',
          ).length,

        contacted:
          requests.filter(
            (request) =>
              request.status ===
              'CONTACTED',
          ).length,

        completed:
          requests.filter(
            (request) =>
              request.status ===
              'COMPLETED',
          ).length,
      }),
      [requests],
    )

  const reloadAfterAction =
    async () => {
      await loadRequests({
        showLoading: false,
      })
    }

  const handleRead =
    async (request) => {
      if (
        request.isRead ||
        processingId
      ) {
        return
      }

      setProcessingId(
        request.id,
      )

      try {
        await markCoachSessionRequestRead(
          request.id,
        )

        await reloadAfterAction()
      } catch (error) {
        setErrorMessage(
          error?.message ||
            '읽음 처리에 실패했습니다.',
        )
      } finally {
        setProcessingId('')
      }
    }

  const handleStatus =
    async (
      request,
      nextStatus,
    ) => {
      if (processingId) {
        return
      }

      const statusLabel =
        COACH_REQUEST_STATUS[
          nextStatus
        ]?.label ||
        nextStatus

      const confirmed =
        window.confirm(
          `${request.memberName}님의 요청을 '${statusLabel}' 상태로 변경할까요?`,
        )

      if (!confirmed) {
        return
      }

      setProcessingId(
        request.id,
      )

      setErrorMessage('')

      try {
        await updateCoachSessionRequestStatus(
          request.id,
          nextStatus,
        )

        await reloadAfterAction()
      } catch (error) {
        setErrorMessage(
          error?.message ||
            '상태 변경에 실패했습니다.',
        )
      } finally {
        setProcessingId('')
      }
    }

  return (
    <section
      style={{
        display: 'grid',
        gap: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems:
            'flex-start',
          justifyContent:
            'space-between',
          gap: '12px',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 6px',
              color: '#0b6b4f',
              fontSize: '11px',
              fontWeight: '900',
              letterSpacing:
                '0.08em',
            }}
          >
            MONTHLY COACH SESSION
          </p>

          <h3
            style={{
              margin: 0,
              color: '#17352c',
              fontSize: '22px',
            }}
          >
            코치 1:1 세션 요청
          </h3>
        </div>

        <button
          type="button"
          onClick={onBack}
          style={{
            flexShrink: 0,
            padding: '9px 11px',
            border:
              '1px solid #d5ded9',
            borderRadius: '11px',
            background: '#ffffff',
            color: '#17352c',
            fontSize: '11px',
            fontWeight: '900',
            cursor: 'pointer',
          }}
        >
          ← 멤버 관리
        </button>
      </div>

      {loading ? (
        <article className="feature-card">
          <h3>
            요청을 불러오는 중입니다.
          </h3>
        </article>
      ) : (
        <>
          {errorMessage && (
            <article className="feature-card locked">
              <span className="locked-badge">
                REQUEST ERROR
              </span>

              <h3>
                요청 정보를 불러오지
                못했습니다.
              </h3>

              <p>
                {errorMessage}
              </p>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  loadRequests()
                }
              >
                다시 불러오기
              </button>
            </article>
          )}

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
                label: '새 알림',
                value:
                  counts.unread,
              },
              {
                label: '요청 접수',
                value:
                  counts.requested,
              },
              {
                label: '연락 완료',
                value:
                  counts.contacted,
              },
              {
                label: '세션 완료',
                value:
                  counts.completed,
              },
            ].map((item) => (
              <article
                key={item.label}
                style={{
                  padding: '15px',
                  border:
                    '1px solid #dce5e1',
                  borderRadius:
                    '15px',
                  background:
                    '#ffffff',
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
                      '6px',
                    color:
                      '#17352c',
                    fontSize:
                      '22px',
                  }}
                >
                  {item.value}
                </strong>
              </article>
            ))}
          </div>

          <label className="admin-field">
            요청 상태 필터

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
            >
              <option value="ALL">
                전체 요청
              </option>

              {Object.entries(
                COACH_REQUEST_STATUS,
              ).map(
                ([
                  value,
                  option,
                ]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </label>

          {filteredRequests.length ===
          0 ? (
            <article className="feature-card locked">
              <span className="locked-badge">
                요청 없음
              </span>

              <h3>
                현재 확인할 요청이
                없습니다.
              </h3>
            </article>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: '12px',
              }}
            >
              {filteredRequests.map(
                (request) => {
                  const isProcessing =
                    processingId ===
                    request.id

                  return (
                    <article
                      key={request.id}
                      onClick={() =>
                        handleRead(
                          request,
                        )
                      }
                      style={{
                        display:
                          'grid',
                        gap: '13px',
                        padding:
                          '17px',
                        border:
                          request.isRead
                            ? '1px solid #dce5e1'
                            : '2px solid #0b6b4f',
                        borderRadius:
                          '17px',
                        background:
                          request.isRead
                            ? '#ffffff'
                            : '#f0f8f4',
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          justifyContent:
                            'space-between',
                          gap: '10px',
                        }}
                      >
                        <div>
                          {!request.isRead && (
                            <span
                              style={{
                                display:
                                  'inline-block',
                                marginBottom:
                                  '6px',
                                padding:
                                  '4px 7px',
                                borderRadius:
                                  '999px',
                                background:
                                  '#0b6b4f',
                                color:
                                  '#ffffff',
                                fontSize:
                                  '9px',
                                fontWeight:
                                  '900',
                              }}
                            >
                              NEW REQUEST
                            </span>
                          )}

                          <h4
                            style={{
                              margin: 0,
                              color:
                                '#17352c',
                              fontSize:
                                '17px',
                            }}
                          >
                            {
                              request.memberName
                            }
                          </h4>

                          <p
                            style={{
                              margin:
                                '5px 0 0',
                              color:
                                '#71807a',
                              fontSize:
                                '11px',
                              fontWeight:
                                '700',
                            }}
                          >
                            {
                              request.membership ||
                              '상품 정보 없음'
                            }
                            {' · '}
                            {
                              request.coachName
                            }
                            {' 코치'}
                          </p>
                        </div>

                        <span
                          style={{
                            alignSelf:
                              'flex-start',
                            padding:
                              '6px 9px',
                            borderRadius:
                              '999px',
                            fontSize:
                              '10px',
                            fontWeight:
                              '900',
                            ...(statusStyles[
                              request.status
                            ] ||
                              statusStyles
                                .REQUESTED),
                          }}
                        >
                          {
                            request.statusLabel
                          }
                        </span>
                      </div>

                      <div
                        style={{
                          padding:
                            '13px',
                          borderRadius:
                            '12px',
                          background:
                            '#f4f7f5',
                        }}
                      >
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
                          멤버 전달 내용
                        </span>

                        <p
                          style={{
                            margin:
                              '7px 0 0',
                            color:
                              '#29443b',
                            fontSize:
                              '13px',
                            fontWeight:
                              '700',
                            lineHeight:
                              1.6,
                            whiteSpace:
                              'pre-wrap',
                          }}
                        >
                          {request.message ||
                            '별도로 전달한 내용이 없습니다.'}
                        </p>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          color:
                            '#7c8984',
                          fontSize:
                            '10px',
                          fontWeight:
                            '700',
                        }}
                      >
                        {formatMonth(
                          request.requestMonth,
                        )}
                        {' · '}
                        {formatDateTime(
                          request.requestedAt,
                        )}
                      </p>

                      <div
                        style={{
                          display:
                            'grid',
                          gridTemplateColumns:
                            'repeat(2, minmax(0, 1fr))',
                          gap: '8px',
                        }}
                      >
                        {request.status ===
                          'REQUESTED' && (
                          <button
                            type="button"
                            disabled={
                              isProcessing
                            }
                            onClick={(
                              event,
                            ) => {
                              event.stopPropagation()

                              handleStatus(
                                request,
                                'CONTACTED',
                              )
                            }}
                            className="secondary-button"
                          >
                            연락 완료
                          </button>
                        )}

                        {request.status !==
                          'COMPLETED' &&
                          request.status !==
                            'CANCELLED' && (
                            <button
                              type="button"
                              disabled={
                                isProcessing
                              }
                              onClick={(
                                event,
                              ) => {
                                event.stopPropagation()

                                handleStatus(
                                  request,
                                  'COMPLETED',
                                )
                              }}
                              className="primary-button"
                            >
                              세션 완료
                            </button>
                          )}

                        {request.status !==
                          'COMPLETED' &&
                          request.status !==
                            'CANCELLED' && (
                            <button
                              type="button"
                              disabled={
                                isProcessing
                              }
                              onClick={(
                                event,
                              ) => {
                                event.stopPropagation()

                                handleStatus(
                                  request,
                                  'CANCELLED',
                                )
                              }}
                              className="secondary-button"
                            >
                              요청 취소
                            </button>
                          )}
                      </div>

                      {isProcessing && (
                        <span
                          style={{
                            color:
                              '#0b6b4f',
                            fontSize:
                              '11px',
                            fontWeight:
                              '800',
                          }}
                        >
                          처리 중...
                        </span>
                      )}
                    </article>
                  )
                },
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function CoachSessionRequestAdmin(
  props,
) {
  return (
    <RequestTabErrorBoundary
      onBack={props.onBack}
    >
      <CoachSessionRequestAdminContent
        {...props}
      />
    </RequestTabErrorBoundary>
  )
}

export default CoachSessionRequestAdmin
