import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'
import {
  formatAccessDate,
  getLocalDateKey,
  getMemberAccessState,
} from './data/memberAccess.js'

function getWeekStartKey() {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset =
    day === 0 ? -6 : 1 - day

  const monday = new Date(now)
  monday.setDate(
    now.getDate() + mondayOffset,
  )

  return getLocalDateKey(monday)
}

function getDaysAgo(dateValue) {
  if (!dateValue) {
    return null
  }

  const value = new Date(dateValue)

  if (
    Number.isNaN(value.getTime())
  ) {
    return null
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  value.setHours(0, 0, 0, 0)

  return Math.max(
    0,
    Math.floor(
      (today.getTime() -
        value.getTime()) /
        86400000,
    ),
  )
}

function getActivityLabel(daysAgo) {
  if (daysAgo === null) {
    return '기록 없음'
  }

  if (daysAgo === 0) {
    return '오늘'
  }

  if (daysAgo === 1) {
    return '어제'
  }

  return `${daysAgo}일 전`
}

function getBehaviorStatus(daysAgo) {
  if (daysAgo === null) {
    return {
      label: 'NO DATA',
      background: '#ecefed',
      color: '#66736e',
    }
  }

  if (daysAgo <= 3) {
    return {
      label: 'ACTIVE',
      background: '#dff5e9',
      color: '#0b6b4f',
    }
  }

  if (daysAgo <= 7) {
    return {
      label: 'CHECK',
      background: '#fff4cf',
      color: '#7d5b00',
    }
  }

  return {
    label: 'AT RISK',
    background: '#ffe8e4',
    color: '#ad3f35',
  }
}

function getAccessBadge(accessState) {
  if (
    accessState.status === 'PAID'
  ) {
    return {
      background: '#dff5e9',
      color: '#0b6b4f',
    }
  }

  if (
    accessState.status === 'TRIAL'
  ) {
    return {
      background: '#e5efff',
      color: '#315f9c',
    }
  }

  if (
    accessState.status === 'OVERRIDE'
  ) {
    return {
      background: '#efe8ff',
      color: '#65469c',
    }
  }

  if (
    accessState.status === 'LEGACY'
  ) {
    return {
      background: '#fff4cf',
      color: '#7d5b00',
    }
  }

  return {
    background: '#ffe8e4',
    color: '#ad3f35',
  }
}

function MemberDashboard({
  refreshKey = 0,
  onOpenMember,
}) {
  const [members, setMembers] =
    useState([])

  const [checkins, setCheckins] =
    useState([])

  const [workouts, setWorkouts] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [statusFilter, setStatusFilter] =
    useState('ALL')

  const [search, setSearch] =
    useState('')

  useEffect(() => {
    let isMounted = true

    const loadDashboard = async () => {
      setLoading(true)
      setErrorMessage('')

      const [
        memberResult,
        checkinResult,
        workoutResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            `
              id,
              email,
              full_name,
              role,
              membership,
              membership_status,
              coach_care,
              coach_name,
              paid_until,
              trial_ends_at,
              access_override_until
            `,
          )
          .eq('role', 'member')
          .order('full_name', {
            ascending: true,
          }),

        supabase
          .from('daily_checkins')
          .select(
            `
              user_id,
              checkin_date,
              updated_at,
              created_at
            `,
          )
          .order('checkin_date', {
            ascending: false,
          }),

        supabase
          .from('workout_records')
          .select(
            `
              user_id,
              workout_date,
              completed_at
            `,
          )
          .order('completed_at', {
            ascending: false,
          }),
      ])

      if (!isMounted) {
        return
      }

      const firstError =
        memberResult.error ||
        checkinResult.error ||
        workoutResult.error

      if (firstError) {
        console.error(
          '멤버 대시보드 조회 실패:',
          firstError,
        )

        setErrorMessage(
          firstError.message ||
            '멤버 대시보드를 불러오지 못했습니다.',
        )

        setLoading(false)
        return
      }

      setMembers(
        memberResult.data || [],
      )

      setCheckins(
        checkinResult.data || [],
      )

      setWorkouts(
        workoutResult.data || [],
      )

      setLoading(false)
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [refreshKey])

  const memberRows = useMemo(() => {
    const weekStartKey =
      getWeekStartKey()

    const checkinsByMember =
      new Map()

    const workoutsByMember =
      new Map()

    checkins.forEach((checkin) => {
      const list =
        checkinsByMember.get(
          checkin.user_id,
        ) || []

      list.push(checkin)

      checkinsByMember.set(
        checkin.user_id,
        list,
      )
    })

    workouts.forEach((workout) => {
      const list =
        workoutsByMember.get(
          workout.user_id,
        ) || []

      list.push(workout)

      workoutsByMember.set(
        workout.user_id,
        list,
      )
    })

    return members.map((member) => {
      const memberCheckins =
        checkinsByMember.get(
          member.id,
        ) || []

      const memberWorkouts =
        workoutsByMember.get(
          member.id,
        ) || []

      const latestCheckin =
        memberCheckins[0] || null

      const latestWorkout =
        memberWorkouts[0] || null

      const checkinActivity =
        latestCheckin?.updated_at ||
        latestCheckin?.created_at ||
        (latestCheckin?.checkin_date
          ? `${latestCheckin.checkin_date}T00:00:00`
          : null)

      const workoutActivity =
        latestWorkout?.completed_at ||
        (latestWorkout?.workout_date
          ? `${latestWorkout.workout_date}T00:00:00`
          : null)

      const activityCandidates = [
        checkinActivity,
        workoutActivity,
      ]
        .filter(Boolean)
        .sort(
          (first, second) =>
            new Date(second).getTime() -
            new Date(first).getTime(),
        )

      const lastActivity =
        activityCandidates[0] || null

      const daysAgo =
        getDaysAgo(lastActivity)

      const weeklyCheckins =
        memberCheckins.filter(
          (checkin) =>
            checkin.checkin_date >=
            weekStartKey,
        ).length

      const weeklyWorkouts =
        memberWorkouts.filter(
          (workout) => {
            const dateKey =
              workout.workout_date ||
              workout.completed_at?.slice(
                0,
                10,
              ) ||
              ''

            return (
              dateKey >= weekStartKey
            )
          },
        ).length

      const accessState =
        getMemberAccessState(member)

      return {
        ...member,
        accessState,
        lastActivity,
        daysAgo,
        weeklyCheckins,
        weeklyWorkouts,
        behavior:
          getBehaviorStatus(daysAgo),
      }
    })
  }, [members, checkins, workouts])

  const summary = useMemo(() => {
    return {
      total: memberRows.length,

      paid: memberRows.filter(
        (member) =>
          member.accessState.status ===
            'PAID' ||
          member.accessState.status ===
            'OVERRIDE',
      ).length,

      trial: memberRows.filter(
        (member) =>
          member.accessState.status ===
          'TRIAL',
      ).length,

      expired: memberRows.filter(
        (member) =>
          !member.accessState.allowed,
      ).length,

      unset: memberRows.filter(
        (member) =>
          member.accessState.status ===
          'LEGACY',
      ).length,

      atRisk: memberRows.filter(
        (member) =>
          member.daysAgo === null ||
          member.daysAgo > 7,
      ).length,
    }
  }, [memberRows])

  const filteredRows = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase()

    return memberRows.filter((member) => {
      const matchesSearch =
        !keyword ||
        String(
          member.full_name || '',
        )
          .toLowerCase()
          .includes(keyword) ||
        String(member.email || '')
          .toLowerCase()
          .includes(keyword)

      if (!matchesSearch) {
        return false
      }

      if (statusFilter === 'ALL') {
        return true
      }

      if (
        statusFilter === 'AT_RISK'
      ) {
        return (
          member.daysAgo === null ||
          member.daysAgo > 7
        )
      }

      return (
        member.accessState.status ===
        statusFilter
      )
    })
  }, [
    memberRows,
    search,
    statusFilter,
  ])

  const summaryCards = [
    {
      label: '전체 멤버',
      value: summary.total,
      note: '등록된 NTAC 사용자',
    },
    {
      label: '정상 이용',
      value: summary.paid,
      note: '유료 / 임시 연장',
    },
    {
      label: '체험 중',
      value: summary.trial,
      note: 'BUILD Trial 포함',
    },
    {
      label: '결제 필요',
      value: summary.expired,
      note: '이용 기간 종료',
    },
    {
      label: '기간 미설정',
      value: summary.unset,
      note: '기존 멤버 정리 필요',
    },
    {
      label: '7일+ 미활동',
      value: summary.atRisk,
      note: '리텐션 확인 필요',
    },
  ]

  if (loading) {
    return (
      <article className="feature-card">
        <h3>
          전체 멤버 현황을 불러오는
          중입니다.
        </h3>
        <p>
          결제 상태와 최근 활동을
          분석하고 있어요.
        </p>
      </article>
    )
  }

  if (errorMessage) {
    return (
      <article className="feature-card locked">
        <span className="locked-badge">
          DASHBOARD ERROR
        </span>
        <h3>
          멤버 대시보드를 불러오지
          못했습니다.
        </h3>
        <p>{errorMessage}</p>
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
            margin: '0 0 5px',
            color: '#0b6b4f',
            fontSize: '10px',
            fontWeight: 900,
            letterSpacing: '0.12em',
          }}
        >
          MEMBER DASHBOARD
        </p>
        <h3
          style={{
            margin: 0,
            color: '#17352c',
            fontSize: '23px',
          }}
        >
          멤버 운영 현황
        </h3>
        <p
          style={{
            margin: '7px 0 0',
            color: '#73807b',
            fontSize: '12px',
            lineHeight: 1.6,
          }}
        >
          결제 상태와 훈련 행동을 한
          화면에서 확인합니다.
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
        {summaryCards.map((card) => (
          <article
            key={card.label}
            style={{
              padding: '15px',
              border:
                '1px solid #dce5e1',
              borderRadius: '16px',
              background: '#ffffff',
            }}
          >
            <span
              style={{
                color: '#74817c',
                fontSize: '10px',
                fontWeight: 800,
              }}
            >
              {card.label}
            </span>
            <strong
              style={{
                display: 'block',
                marginTop: '4px',
                color: '#0b3d2e',
                fontSize: '25px',
                fontWeight: 900,
              }}
            >
              {card.value}
            </strong>
            <small
              style={{
                color: '#89958f',
                fontSize: '9px',
              }}
            >
              {card.note}
            </small>
          </article>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: '8px',
        }}
      >
        <input
          type="search"
          placeholder="멤버 검색"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          style={{
            minWidth: 0,
            padding: '11px 12px',
            border:
              '1px solid #d6dedb',
            borderRadius: '11px',
            fontFamily: 'inherit',
          }}
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value,
            )
          }
          style={{
            minWidth: 0,
            padding: '11px 8px',
            border:
              '1px solid #d6dedb',
            borderRadius: '11px',
            background: '#ffffff',
            fontFamily: 'inherit',
          }}
        >
          <option value="ALL">
            전체 상태
          </option>
          <option value="PAID">
            정상 결제
          </option>
          <option value="TRIAL">
            체험 중
          </option>
          <option value="EXPIRED">
            결제 필요
          </option>
          <option value="LEGACY">
            기간 미설정
          </option>
          <option value="AT_RISK">
            7일+ 미활동
          </option>
        </select>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '9px',
        }}
      >
        {filteredRows.length > 0 ? (
          filteredRows.map((member) => {
            const accessBadge =
              getAccessBadge(
                member.accessState,
              )

            return (
              <article
                key={member.id}
                style={{
                  display: 'grid',
                  gap: '11px',
                  padding: '15px',
                  border:
                    '1px solid #dce5e1',
                  borderRadius: '16px',
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
                    gap: '10px',
                  }}
                >
                  <div>
                    <strong
                      style={{
                        display: 'block',
                        color: '#17352c',
                        fontSize: '15px',
                      }}
                    >
                      {member.full_name ||
                        member.email}
                    </strong>
                    <span
                      style={{
                        display: 'block',
                        marginTop: '3px',
                        color: '#85918c',
                        fontSize: '10px',
                      }}
                    >
                      {member.membership ||
                        'NTAC RUN'}
                    </span>
                  </div>

                  <span
                    style={{
                      padding: '6px 8px',
                      borderRadius: '999px',
                      fontSize: '9px',
                      fontWeight: 900,
                      ...accessBadge,
                    }}
                  >
                    {
                      member.accessState
                        .label
                    }
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(3, minmax(0, 1fr))',
                    gap: '7px',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 8px',
                      borderRadius: '11px',
                      background: '#f4f7f5',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        color: '#82908a',
                        fontSize: '8px',
                        fontWeight: 800,
                      }}
                    >
                      최근 활동
                    </span>
                    <strong
                      style={{
                        display: 'block',
                        marginTop: '4px',
                        color: '#17352c',
                        fontSize: '11px',
                      }}
                    >
                      {getActivityLabel(
                        member.daysAgo,
                      )}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: '10px 8px',
                      borderRadius: '11px',
                      background: '#f4f7f5',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        color: '#82908a',
                        fontSize: '8px',
                        fontWeight: 800,
                      }}
                    >
                      이번 주 운동
                    </span>
                    <strong
                      style={{
                        display: 'block',
                        marginTop: '4px',
                        color: '#17352c',
                        fontSize: '11px',
                      }}
                    >
                      {member.weeklyWorkouts}회
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: '10px 8px',
                      borderRadius: '11px',
                      background: '#f4f7f5',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        color: '#82908a',
                        fontSize: '8px',
                        fontWeight: 800,
                      }}
                    >
                      이번 주 체크인
                    </span>
                    <strong
                      style={{
                        display: 'block',
                        marginTop: '4px',
                        color: '#17352c',
                        fontSize: '11px',
                      }}
                    >
                      {member.weeklyCheckins}회
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent:
                      'space-between',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                    }}
                  >
                    <span
                      style={{
                        padding: '5px 7px',
                        borderRadius: '999px',
                        fontSize: '8px',
                        fontWeight: 900,
                        background:
                          member.behavior
                            .background,
                        color:
                          member.behavior
                            .color,
                      }}
                    >
                      {member.behavior.label}
                    </span>
                    <span
                      style={{
                        color: '#7c8984',
                        fontSize: '9px',
                      }}
                    >
                      이용 종료{' '}
                      {formatAccessDate(
                        member.accessState
                          .until,
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenMember?.(
                        member.id,
                      )
                    }
                    style={{
                      padding: '8px 10px',
                      border: 'none',
                      borderRadius: '9px',
                      background: '#0b3d2e',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    관리
                  </button>
                </div>
              </article>
            )
          })
        ) : (
          <article className="feature-card locked">
            <h3>
              조건에 맞는 멤버가 없습니다.
            </h3>
          </article>
        )}
      </div>
    </section>
  )
}

export default MemberDashboard
