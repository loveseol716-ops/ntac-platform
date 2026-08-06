import {
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

  return new Date(
    value,
  ).toLocaleString(
    'ko-KR',
    {
      year: 'numeric',
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

  return new Date(
    `${value}T00:00:00`,
  ).toLocaleDateString(
    'ko-KR',
    {
      year: 'numeric',
      month: 'long',
    },
  )
}

function CoachSessionRequestAdmin({
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

  const loadRequests =
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

        setRequests(
          loadedRequests,
        )

        if (
          typeof onRequestsChanged ===
          'function'
        ) {
          onRequestsChanged(
            loadedRequests,
          )
        }
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
        if (showLoading) {
          setLoading(false)
        }
      }
    }

  useEffect(() => {
    loadRequests()

    const unsubscribe =
      subscribeToCoachSessionRequests(
        () => {
          loadRequests({
            showLoading: false,
          })
        },
      )

    return unsubscribe
  }, [])

  const filteredRequests =
    useMemo(
      () =>
        statusFilter === 'ALL'
          ? requests
          : requests.filter(
              (request) =>
                request.status ===
                statusFilter,
            ),
      [
        requests,
        statusFilter,
      ],
    )

  const unreadCount =
    requests.filter(
      (request) =>
        !request.isRead &&
        request.status ===
          'REQUESTED',
    ).length

  const requestedCount =
    requests.filter(
      (request) =>
        request.status ===
        'REQUESTED',
    ).length

  const contactedCount =
    requests.filter(
      (request) =>
        request.status ===
        'CONTACTED',
    ).length

  const completedCount =
    requests.filter(
      (request) =>
        request.status ===
        'COMPLETED',
    ).length

  const refreshParent =
    (nextRequests) => {
      if (
        typeof onRequestsChanged ===
        'function'
      ) {
        onRequestsChanged(
          nextRequests,
        )
      }
    }

  const updateRequestState = (
    nextRequest,
  ) => {
    setRequests((current) => {
      const nextRequests =
        current.map(
          (request) =>
            request.id ===
            nextRequest.id
              ? {
                  ...request,
                  ...nextRequest,
                }
              : request,
        )

      refreshParent(
        nextRequests,
      )

      return nextRequests
    })
  }

  const readRequest =
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
        const updatedRequest =
          await markCoachSessionRequestRead(
            request.id,
          )

        updateRequestState({
          ...request,
          ...updatedRequest,
        })
      } catch (error) {
        console.error(
          '요청 읽음 처리 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '요청을 읽음 처리하지 못했습니다.',
        )
      } finally {
        setProcessingId('')
      }
    }

  const changeStatus =
    async (
      request,
      nextStatus,
    ) => {
      if (processingId) {
        return
      }

      const nextLabel =
        COACH_REQUEST_STATUS[
          nextStatus
        ]?.label ||
        nextStatus

      const confirmed =
        window.confirm(
          `${request.memberName}님의 요청 상태를 '${nextLabel}'로 변경할까요?`,
        )

      if (!confirmed) {
        return
      }

      setProcessingId(
        request.id,
      )

      setErrorMessage('')

      try {
        const updatedRequest =
          await updateCoachSessionRequestStatus(
            request.id,
            nextStatus,
          )

        updateRequestState({
          ...request,
          ...updatedRequest,
        })
      } catch (error) {
        console.error(
          '코치 세션 상태 변경 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '요청 상태를 변경하지 못했습니다.',
        )
      } finally {
        setProcessingId('')
      }
    }

  if (loading) {
    return (
      <article className="feature-card">
        <h3>
          코치 세션 요청을 불러오는
          중입니다.
        </h3>

        <p>
          ATHLETE 멤버의 요청을
          확인하고 있어요.
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

        <p
          style={{
            margin: '8px 0 0',
            color: '#697872',
            fontSize: '13px',
            lineHeight: 1.6,
          }}
        >
          멤버에게 개인적으로 연락한 뒤
          상태를 변경해 주세요.
        </p>
      </div>

      {errorMessage && (
        <article className="feature-card locked">
          <span className="locked-badge">
            REQUEST ERROR
          </span>

          <h3>
            요청 작업을 완료하지
            못했습니다.
          </h3>

          <p>
            {errorMessage}
          </p>
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
            value: unreadCount,
          },
          {
            label: '요청 접수',
            value: requestedCount,
          },
          {
            label: '연락 완료',
            value: contactedCount,
          },
          {
            label: '세션 완료',
            value: completedCount,
          },
        ].map((item) => (
          <article
            key={item.label}
            style={{
              padding: '15px',
              borderRadius:
                '15px',
              background: '#ffffff',
              border:
                '1px solid #dce5e1',
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
              {item.label}
            </span>

            <strong
              style={{
                display: 'block',
                marginTop: '6px',
                color: '#17352c',
                fontSize: '22px',
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
                    readRequest(
                      request,
                    )
                  }
                  style={{
                    display: 'grid',
                    gap: '15px',
                    padding: '18px',
                    border:
                      request.isRead
                        ? '1px solid #dce5e1'
                        : '2px solid #0b6b4f',
                    borderRadius:
                      '18px',
                    background:
                      request.isRead
                        ? '#ffffff'
                        : '#f0f8f4',
                    cursor:
                      request.isRead
                        ? 'default'
                        : 'pointer',
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
                      {!request.isRead && (
                        <span
                          style={{
                            display:
                              'inline-block',
                            marginBottom:
                              '7px',
                            padding:
                              '5px 8px',
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
                            '18px',
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
                          request.membership
                        }
                        {' · 담당 '}
                        {
                          request.coachName
                        }
                        {' 코치'}
                      </p>
                    </div>

                    <span
                      style={{
                        flexShrink: 0,
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
                      padding: '14px',
                      borderRadius:
                        '13px',
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
                          1.65,
                        whiteSpace:
                          'pre-wrap',
                      }}
                    >
                      {request.message ||
                        '별도로 전달한 내용이 없습니다.'}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(2, minmax(0, 1fr))',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        padding:
                          '11px',
                        borderRadius:
                          '11px',
                        background:
                          '#f5f7f6',
                      }}
                    >
                      <span
                        style={{
                          display:
                            'block',
                          color:
                            '#7b8782',
                          fontSize:
                            '9px',
                          fontWeight:
                            '800',
                        }}
                      >
                        요청 월
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
                            '12px',
                        }}
                      >
                        {formatMonth(
                          request.requestMonth,
                        )}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding:
                          '11px',
                        borderRadius:
                          '11px',
                        background:
                          '#f5f7f6',
                      }}
                    >
                      <span
                        style={{
                          display:
                            'block',
                          color:
                            '#7b8782',
                          fontSize:
                            '9px',
                          fontWeight:
                            '800',
                        }}
                      >
                        요청 시간
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
                            '11px',
                        }}
                      >
                        {formatDateTime(
                          request.requestedAt,
                        )}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(2, minmax(0, 1fr))',
                      gap: '8px',
                    }}
                  >
                    {request.status !==
                      'CONTACTED' &&
                      request.status !==
                        'COMPLETED' && (
                        <button
                          type="button"
                          disabled={
                            isProcessing
                          }
                          onClick={(
                            event,
                          ) => {
                            event.stopPropagation()

                            changeStatus(
                              request,
                              'CONTACTED',
                            )
                          }}
                          style={{
                            minHeight:
                              '45px',
                            border:
                              'none',
                            borderRadius:
                              '12px',
                            background:
                              '#dff0fa',
                            color:
                              '#17618a',
                            fontSize:
                              '12px',
                            fontWeight:
                              '900',
                            cursor:
                              'pointer',
                          }}
                        >
                          연락 완료
                        </button>
                      )}

                    {request.status !==
                      'COMPLETED' && (
                      <button
                        type="button"
                        disabled={
                          isProcessing
                        }
                        onClick={(
                          event,
                        ) => {
                          event.stopPropagation()

                          changeStatus(
                            request,
                            'COMPLETED',
                          )
                        }}
                        style={{
                          minHeight:
                            '45px',
                          border:
                            'none',
                          borderRadius:
                            '12px',
                          background:
                            '#0b3d2e',
                          color:
                            '#ffffff',
                          fontSize:
                            '12px',
                          fontWeight:
                            '900',
                          cursor:
                            'pointer',
                        }}
                      >
                        세션 완료
                      </button>
                    )}

                    {request.status !==
                      'CANCELLED' &&
                      request.status !==
                        'COMPLETED' && (
                        <button
                          type="button"
                          disabled={
                            isProcessing
                          }
                          onClick={(
                            event,
                          ) => {
                            event.stopPropagation()

                            changeStatus(
                              request,
                              'CANCELLED',
                            )
                          }}
                          style={{
                            minHeight:
                              '45px',
                            border:
                              '1px solid #d8dfdc',
                            borderRadius:
                              '12px',
                            background:
                              '#ffffff',
                            color:
                              '#687570',
                            fontSize:
                              '12px',
                            fontWeight:
                              '900',
                            cursor:
                              'pointer',
                          }}
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
                      요청을 처리하고
                      있습니다...
                    </span>
                  )}
                </article>
              )
            },
          )}
        </div>
      )}
    </section>
  )
}

export default CoachSessionRequestAdmin
