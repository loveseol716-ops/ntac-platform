import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import WeeklyProgramAdmin from './WeeklyProgramAdmin.jsx'
import PersonalProgramAdmin from './PersonalProgramAdmin.jsx'
import CommunityAdmin from './CommunityAdmin.jsx'
import AdminAccessManagement from './AdminAccessManagement.jsx'
import WeeklyAthleteReportAdmin from './WeeklyAthleteReportAdmin.jsx'
import CoachSessionRequestAdmin from './CoachSessionRequestAdmin.jsx'
import {
  loadAllCoachSessionRequests,
  subscribeToCoachSessionRequests,
} from './data/coachSessionRequests.js'
import { supabase } from './lib/supabase.js'

const adminTabs = [
  {
    id: 'members',
    label: '멤버 관리',
  },
  {
    id: 'programs',
    label: '프로그램 관리',
  },
  {
    id: 'personal',
    label: '개인 프로그램',
  },
  {
    id: 'reports',
    label: '주간 리포트',
  },
  {
    id: 'coachRequests',
    label: '1:1 요청',
  },
  {
    id: 'community',
    label: '커뮤니티 관리',
  },
  {
    id: 'access',
    label: '권한 관리',
  },
]

const membershipOptions = [
  'NTAC RUN',
  'NTAC BUILD',
  'NTAC COMPLETE',
  'NTAC ATHLETE',
  'NTAC COMMUNITY',
]

const membershipStatusOptions = [
  {
    value: 'active',
    label: '이용 중',
  },
  {
    value: 'paused',
    label: '일시정지',
  },
  {
    value: 'expired',
    label: '만료',
  },
]

const emptyMemberSettings = {
  fullName: '',
  membership: 'NTAC RUN',
  membershipStatus: 'active',
  coachCare: false,
  coachName: '미배정',
}

function formatDateTime(value) {
  if (!value) {
    return '시간 기록 없음'
  }

  return new Date(value).toLocaleString(
    'ko-KR',
    {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  )
}

function normalizeCheckin(row) {
  return {
    id: row.id,
    date: row.checkin_date,
    condition: Number(
      row.condition_score,
    ),
    sleep: Number(row.sleep_hours),
    soreness: Number(
      row.soreness_score,
    ),
    stress: Number(
      row.stress_score,
    ),
    pain: row.pain_level,
    painArea: row.pain_area || '',
    message: row.message || '',
    completedAt:
      row.updated_at ||
      row.created_at,
  }
}

function normalizeWorkoutRecord(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    eventId: row.event_id,
    date: row.workout_date,
    title:
      row.title ||
      row.session_id ||
      '운동 기록',
    type:
      row.workout_type ||
      'TRAINING',
    rpe: Number(row.rpe),
    targetRpe:
      row.target_rpe === null ||
      row.target_rpe === undefined
        ? null
        : Number(row.target_rpe),
    targetRpeLabel:
      row.target_rpe_label || '',
    weekId: row.week_key || '',
    weekType: row.week_type || '',
    rpeGap:
      row.target_rpe === null ||
      row.target_rpe === undefined
        ? null
        : Number(
            (
              Number(row.rpe) -
              Number(row.target_rpe)
            ).toFixed(1),
          ),
    completedAt: row.completed_at,
  }
}

function isAttentionCheckin(checkin) {
  if (!checkin) {
    return false
  }

  return (
    Number(checkin.condition) <= 2 ||
    checkin.pain !== '없음'
  )
}

function getStatusLabel(status) {
  return (
    membershipStatusOptions.find(
      (option) =>
        option.value === status,
    )?.label || '이용 중'
  )
}

function CoachAdminPage({
  onClose,
}) {
  const [
    activeAdminTab,
    setActiveAdminTab,
  ] = useState('members')

  const [
    membersRefreshKey,
    setMembersRefreshKey,
  ] = useState(0)

  const [
    coachRequestCount,
    setCoachRequestCount,
  ] = useState(0)

  const [members, setMembers] =
    useState([])

  const [
    memberSearch,
    setMemberSearch,
  ] = useState('')

  const [
    membershipFilter,
    setMembershipFilter,
  ] = useState('ALL')

  const [
    selectedMemberId,
    setSelectedMemberId,
  ] = useState('')

  const [
    memberSettings,
    setMemberSettings,
  ] = useState(emptyMemberSettings)

  const [
    checkinHistory,
    setCheckinHistory,
  ] = useState([])

  const [
    workoutRecords,
    setWorkoutRecords,
  ] = useState([])

  const [
    membersLoading,
    setMembersLoading,
  ] = useState(true)

  const [
    recordsLoading,
    setRecordsLoading,
  ] = useState(false)

  const [saving, setSaving] =
    useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const updateCoachRequestCount = (
    requests,
  ) => {
    setCoachRequestCount(
      (
        Array.isArray(requests)
          ? requests
          : []
      ).filter(
        (request) =>
          !request.isRead &&
          request.status ===
            'REQUESTED',
      ).length,
    )
  }

  useEffect(() => {
    let isMounted = true

    const refreshCount =
      async () => {
        try {
          const requests =
            await loadAllCoachSessionRequests()

          if (isMounted) {
            updateCoachRequestCount(
              requests,
            )
          }
        } catch (error) {
          console.error(
            '1:1 요청 알림 조회 실패:',
            error,
          )
        }
      }

    refreshCount()

    const unsubscribe =
      subscribeToCoachSessionRequests(
        refreshCount,
        'admin-badge',
      )

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const filteredMembers = useMemo(() => {
    const keyword = memberSearch
      .trim()
      .toLowerCase()

    return members.filter((member) => {
      const memberName =
        member.full_name
          ?.toLowerCase() || ''

      const memberEmail =
        member.email
          ?.toLowerCase() || ''

      const matchesSearch =
        !keyword ||
        memberName.includes(keyword) ||
        memberEmail.includes(keyword)

      const matchesMembership =
        membershipFilter === 'ALL' ||
        member.membership ===
          membershipFilter

      return (
        matchesSearch &&
        matchesMembership
      )
    })
  }, [
    members,
    memberSearch,
    membershipFilter,
  ])

  const selectedMember =
    members.find(
      (member) =>
        member.id ===
        selectedMemberId,
    ) || null

  useEffect(() => {
    let isMounted = true

    const loadMembers = async () => {
      setMembersLoading(true)
      setErrorMessage('')

      const {
        data,
        error,
      } = await supabase
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
            coach_name
          `,
        )
        .eq('role', 'member')
        .order('full_name', {
          ascending: true,
        })

      if (!isMounted) {
        return
      }

      if (error) {
        console.error(
          '회원 목록 조회 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '회원 목록을 불러오지 못했습니다.',
        )

        setMembersLoading(false)
        return
      }

      setMembers(data || [])
      setMembersLoading(false)
    }

    loadMembers()

    return () => {
      isMounted = false
    }
  }, [membersRefreshKey])

  useEffect(() => {
    if (membersLoading) {
      return
    }

    if (filteredMembers.length === 0) {
      if (selectedMemberId) {
        setSelectedMemberId('')
      }

      return
    }

    const selectedMemberExists =
      filteredMembers.some(
        (member) =>
          member.id ===
          selectedMemberId,
      )

    if (!selectedMemberExists) {
      setSelectedMemberId(
        filteredMembers[0].id,
      )
    }
  }, [
    filteredMembers,
    membersLoading,
    selectedMemberId,
  ])

  useEffect(() => {
    let isMounted = true

    const loadSelectedMember =
      async () => {
        if (!selectedMemberId) {
          setMemberSettings(
            emptyMemberSettings,
          )
          setCheckinHistory([])
          setWorkoutRecords([])
          setRecordsLoading(false)
          return
        }

        const member = members.find(
          (item) =>
            item.id ===
            selectedMemberId,
        )

        if (member) {
          setMemberSettings({
            fullName:
              member.full_name || '',
            membership:
              member.membership ||
              'NTAC RUN',
            membershipStatus:
              member.membership_status ||
              'active',
            coachCare: Boolean(
              member.coach_care,
            ),
            coachName:
              member.coach_name ||
              '미배정',
          })
        }

        setRecordsLoading(true)
        setErrorMessage('')

        const [
          checkinResult,
          workoutResult,
        ] = await Promise.all([
          supabase
            .from('daily_checkins')
            .select(
              `
                id,
                checkin_date,
                condition_score,
                sleep_hours,
                soreness_score,
                stress_score,
                pain_level,
                pain_area,
                message,
                created_at,
                updated_at
              `,
            )
            .eq(
              'user_id',
              selectedMemberId,
            )
            .order('checkin_date', {
              ascending: false,
            }),

          supabase
            .from('workout_records')
            .select(
              `
                id,
                session_id,
                event_id,
                workout_date,
                title,
                workout_type,
                rpe,
                target_rpe,
                target_rpe_label,
                week_key,
                week_type,
                completed_at
              `,
            )
            .eq(
              'user_id',
              selectedMemberId,
            )
            .order('completed_at', {
              ascending: false,
            }),
        ])

        if (!isMounted) {
          return
        }

        if (checkinResult.error) {
          console.error(
            '체크인 조회 실패:',
            checkinResult.error,
          )

          setErrorMessage(
            checkinResult.error.message,
          )
        }

        if (workoutResult.error) {
          console.error(
            '운동 기록 조회 실패:',
            workoutResult.error,
          )

          setErrorMessage(
            workoutResult.error.message,
          )
        }

        setCheckinHistory(
          (
            checkinResult.data || []
          ).map(normalizeCheckin),
        )

        setWorkoutRecords(
          (
            workoutResult.data || []
          ).map(
            normalizeWorkoutRecord,
          ),
        )

        setRecordsLoading(false)
      }

    loadSelectedMember()

    return () => {
      isMounted = false
    }
  }, [
    selectedMemberId,
    members,
  ])

  const latestCheckin =
    checkinHistory[0] || null

  const trendCheckins = useMemo(
    () =>
      [...checkinHistory]
        .sort(
          (first, second) =>
            new Date(
              first.completedAt,
            ).getTime() -
            new Date(
              second.completedAt,
            ).getTime(),
        )
        .slice(-7),
    [checkinHistory],
  )

  const averageCondition =
    checkinHistory.length > 0
      ? (
          checkinHistory.reduce(
            (total, checkin) =>
              total +
              Number(
                checkin.condition || 0,
              ),
            0,
          ) / checkinHistory.length
        ).toFixed(1)
      : '-'

  const averageRpe =
    workoutRecords.length > 0
      ? (
          workoutRecords.reduce(
            (total, record) =>
              total +
              Number(record.rpe || 0),
            0,
          ) / workoutRecords.length
        ).toFixed(1)
      : '-'

  const needsAttention =
    isAttentionCheckin(
      latestCheckin,
    )

  const updateMemberSettings = (
    name,
    value,
  ) => {
    setMemberSettings(
      (current) => {
        if (name === 'membership') {
          return {
            ...current,
            membership: value,
            coachCare:
              value === 'NTAC ATHLETE'
                ? true
                : current.coachCare,
          }
        }

        return {
          ...current,
          [name]: value,
        }
      },
    )
  }

  const resetMemberFilters = () => {
    setMemberSearch('')
    setMembershipFilter('ALL')
  }

  const saveMemberSettings =
    async (event) => {
      event.preventDefault()

      if (
        !selectedMemberId ||
        saving
      ) {
        return
      }

      if (
        !memberSettings.fullName.trim()
      ) {
        alert(
          '멤버 이름을 입력해 주세요.',
        )
        return
      }

      setSaving(true)
      setErrorMessage('')

      const {
        data,
        error,
      } = await supabase
        .from('profiles')
        .update({
          full_name:
            memberSettings.fullName.trim(),

          membership:
            memberSettings.membership,

          membership_status:
            memberSettings
              .membershipStatus,

          coach_care:
            memberSettings.membership ===
            'NTAC ATHLETE'
              ? true
              : memberSettings.coachCare,

          coach_name:
            memberSettings.coachName
              .trim() || '미배정',
        })
        .eq('id', selectedMemberId)
        .select(
          `
            id,
            email,
            full_name,
            role,
            membership,
            membership_status,
            coach_care,
            coach_name
          `,
        )
        .single()

      if (error) {
        console.error(
          '회원 정보 저장 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '회원 정보를 저장하지 못했습니다.',
        )

        alert(
          `저장에 실패했습니다.\n${
            error.message ||
            '알 수 없는 오류'
          }`,
        )

        setSaving(false)
        return
      }

      setMembers((current) =>
        current.map((member) =>
          member.id === data.id
            ? data
            : member,
        ),
      )

      setMemberSettings({
        fullName:
          data.full_name || '',

        membership:
          data.membership ||
          'NTAC RUN',

        membershipStatus:
          data.membership_status ||
          'active',

        coachCare: Boolean(
          data.coach_care,
        ),

        coachName:
          data.coach_name ||
          '미배정',
      })

      setSaving(false)

      alert(
        '멤버 정보가 Supabase에 저장되었습니다.',
      )
    }

  const renderMemberManagement =
    () => (
      <>
        {membersLoading && (
          <article className="feature-card">
            <h3>
              회원 목록을 불러오는
              중입니다.
            </h3>

            <p>
              Supabase의 회원 정보를
              확인하고 있어요.
            </p>
          </article>
        )}

        {errorMessage && (
          <article className="feature-card locked">
            <span className="locked-badge">
              ADMIN ERROR
            </span>

            <h3>
              관리자 데이터를 불러오지
              못했습니다.
            </h3>

            <p>{errorMessage}</p>
          </article>
        )}

        {!membersLoading &&
          members.length === 0 && (
            <article className="feature-card locked">
              <h3>
                등록된 멤버가 없습니다.
              </h3>
            </article>
          )}

        {!membersLoading &&
          members.length > 0 && (
            <>
              <div className="admin-select-grid">
                <label className="admin-field">
                  이름 또는 이메일 검색

                  <input
                    type="search"
                    placeholder="예: 설재현"
                    value={memberSearch}
                    onChange={(event) =>
                      setMemberSearch(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="admin-field">
                  이용 상품 필터

                  <select
                    value={membershipFilter}
                    onChange={(event) =>
                      setMembershipFilter(
                        event.target.value,
                      )
                    }
                  >
                    <option value="ALL">
                      전체 상품
                    </option>

                    {membershipOptions.map(
                      (membership) => (
                        <option
                          key={membership}
                          value={membership}
                        >
                          {membership}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent:
                      'space-between',
                    gap: '12px',
                    gridColumn: '1 / -1',
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#66736e',
                    }}
                  >
                    전체 {members.length}명
                    {' · '}
                    검색 결과{' '}
                    {filteredMembers.length}명
                  </span>

                  <button
                    type="button"
                    onClick={
                      resetMemberFilters
                    }
                    style={{
                      padding: '8px 12px',
                      border:
                        '1px solid #d6dedb',
                      borderRadius: '10px',
                      background: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                    }}
                  >
                    필터 초기화
                  </button>
                </div>

                {filteredMembers.length >
                0 ? (
                  <label className="admin-field">
                    멤버 선택

                    <select
                      value={selectedMemberId}
                      onChange={(event) =>
                        setSelectedMemberId(
                          event.target.value,
                        )
                      }
                    >
                      {filteredMembers.map(
                        (member) => (
                          <option
                            key={member.id}
                            value={member.id}
                          >
                            {member.full_name ||
                              member.email}

                            {' · '}

                            {member.membership ||
                              'NTAC RUN'}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ) : (
                  <article
                    className="feature-card locked"
                    style={{
                      gridColumn: '1 / -1',
                    }}
                  >
                    <span className="locked-badge">
                      검색 결과 없음
                    </span>

                    <h3>
                      조건에 맞는 멤버가
                      없습니다.
                    </h3>

                    <p>
                      검색어나 상품 필터를
                      변경해 주세요.
                    </p>
                  </article>
                )}
              </div>

              {selectedMember &&
                filteredMembers.length >
                  0 && (
                  <>
                    <article className="admin-member-card">
                      <div>
                        <p>
                          SELECTED ATHLETE
                        </p>

                        <h3>
                          {selectedMember.full_name ||
                            selectedMember.email}
                        </h3>

                        <span>
                          {
                            memberSettings.membership
                          }

                          {' · '}

                          {getStatusLabel(
                            memberSettings
                              .membershipStatus,
                          )}
                        </span>
                      </div>

                      <div className="admin-coach-info">
                        <span>
                          담당 코치
                        </span>

                        <strong>
                          {
                            memberSettings.coachName
                          }
                        </strong>
                      </div>
                    </article>

                    <section className="coach-dashboard">
                      <div className="admin-form-heading">
                        <p>
                          ATHLETE DASHBOARD
                        </p>

                        <h3>
                          체크인 및 수행 현황
                        </h3>
                      </div>

                      {recordsLoading ? (
                        <div className="dashboard-empty">
                          기록을 불러오는
                          중입니다.
                        </div>
                      ) : (
                        <>
                          <div className="dashboard-summary-grid">
                            <article>
                              <span>
                                체크인 기록
                              </span>

                              <strong>
                                {
                                  checkinHistory.length
                                }
                                개
                              </strong>
                            </article>

                            <article>
                              <span>
                                평균 컨디션
                              </span>

                              <strong>
                                {
                                  averageCondition
                                }
                              </strong>
                            </article>

                            <article>
                              <span>
                                완료한 과제
                              </span>

                              <strong>
                                {
                                  workoutRecords.length
                                }
                                개
                              </strong>
                            </article>

                            <article>
                              <span>
                                평균 실제 RPE
                              </span>

                              <strong>
                                {averageRpe}
                              </strong>
                            </article>
                          </div>

                          <article
                            className={`dashboard-checkin-card ${
                              needsAttention
                                ? 'attention'
                                : ''
                            }`}
                          >
                            <div className="dashboard-card-heading">
                              <div>
                                <span>
                                  DAILY CHECK-IN
                                </span>

                                <h4>
                                  최근 컨디션 기록
                                </h4>
                              </div>

                              {needsAttention && (
                                <strong>
                                  확인 필요
                                </strong>
                              )}
                            </div>

                            {latestCheckin ? (
                              <>
                                <div className="checkin-score-grid">
                                  <div>
                                    <span>
                                      컨디션
                                    </span>

                                    <strong>
                                      {
                                        latestCheckin.condition
                                      }
                                      {' / 5'}
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      수면
                                    </span>

                                    <strong>
                                      {
                                        latestCheckin.sleep
                                      }
                                      시간
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      근육통
                                    </span>

                                    <strong>
                                      {
                                        latestCheckin.soreness
                                      }
                                      {' / 5'}
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      스트레스
                                    </span>

                                    <strong>
                                      {
                                        latestCheckin.stress
                                      }
                                      {' / 5'}
                                    </strong>
                                  </div>
                                </div>

                                <div className="dashboard-detail-row">
                                  <span>
                                    통증 여부
                                  </span>

                                  <strong>
                                    {
                                      latestCheckin.pain
                                    }

                                    {latestCheckin.painArea
                                      ? ` · ${latestCheckin.painArea}`
                                      : ''}
                                  </strong>
                                </div>

                                <div className="dashboard-message">
                                  <span>
                                    코치에게 전달한 내용
                                  </span>

                                  <p>
                                    {latestCheckin.message ||
                                      '전달한 내용이 없습니다.'}
                                  </p>
                                </div>

                                <p className="dashboard-record-time">
                                  {formatDateTime(
                                    latestCheckin.completedAt,
                                  )}
                                </p>
                              </>
                            ) : (
                              <div className="dashboard-empty">
                                아직 체크인 기록이
                                없습니다.
                              </div>
                            )}
                          </article>

                          <section className="checkin-trend-card">
                            <div className="dashboard-section-title">
                              <div>
                                <span>
                                  CONDITION TREND
                                </span>

                                <h4>
                                  최근 컨디션 변화
                                </h4>
                              </div>

                              <strong>
                                최근 7회
                              </strong>
                            </div>

                            {trendCheckins.length >
                            0 ? (
                              <div className="trend-list">
                                {trendCheckins.map(
                                  (
                                    checkin,
                                    index,
                                  ) => (
                                    <div
                                      className="trend-row"
                                      key={
                                        checkin.id ||
                                        index
                                      }
                                    >
                                      <span>
                                        {formatDateTime(
                                          checkin.completedAt,
                                        )}
                                      </span>

                                      <div className="trend-track">
                                        <div
                                          className="trend-value"
                                          style={{
                                            width: `${
                                              (Number(
                                                checkin.condition,
                                              ) /
                                                5) *
                                              100
                                            }%`,
                                          }}
                                        />
                                      </div>

                                      <strong>
                                        {
                                          checkin.condition
                                        }
                                      </strong>
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : (
                              <div className="dashboard-empty">
                                컨디션 추이를 표시할
                                기록이 없습니다.
                              </div>
                            )}
                          </section>

                          <section className="checkin-history-section">
                            <div className="dashboard-section-title">
                              <div>
                                <span>
                                  CHECK-IN HISTORY
                                </span>

                                <h4>
                                  날짜별 체크인 기록
                                </h4>
                              </div>

                              <strong>
                                {
                                  checkinHistory.length
                                }
                                개
                              </strong>
                            </div>

                            <div className="checkin-history-list">
                              {checkinHistory.length >
                              0 ? (
                                checkinHistory
                                  .slice(0, 10)
                                  .map(
                                    (checkin) => (
                                      <article
                                        className={`checkin-history-card ${
                                          isAttentionCheckin(
                                            checkin,
                                          )
                                            ? 'attention'
                                            : ''
                                        }`}
                                        key={checkin.id}
                                      >
                                        <div className="history-card-head">
                                          <div>
                                            <span>
                                              {formatDateTime(
                                                checkin.completedAt,
                                              )}
                                            </span>

                                            <h4>
                                              컨디션{' '}
                                              {
                                                checkin.condition
                                              }
                                              {' / 5'}
                                            </h4>
                                          </div>

                                          {isAttentionCheckin(
                                            checkin,
                                          ) && (
                                            <strong>
                                              확인 필요
                                            </strong>
                                          )}
                                        </div>

                                        <div className="history-score-row">
                                          <span>
                                            수면{' '}
                                            {
                                              checkin.sleep
                                            }
                                            시간
                                          </span>

                                          <span>
                                            근육통{' '}
                                            {
                                              checkin.soreness
                                            }
                                            {' / 5'}
                                          </span>

                                          <span>
                                            스트레스{' '}
                                            {
                                              checkin.stress
                                            }
                                            {' / 5'}
                                          </span>
                                        </div>

                                        <p>
                                          통증:{' '}
                                          {
                                            checkin.pain
                                          }

                                          {checkin.painArea
                                            ? ` · ${checkin.painArea}`
                                            : ''}
                                        </p>

                                        {checkin.message && (
                                          <p className="history-message">
                                            {
                                              checkin.message
                                            }
                                          </p>
                                        )}
                                      </article>
                                    ),
                                  )
                              ) : (
                                <div className="dashboard-empty">
                                  저장된 체크인 기록이
                                  없습니다.
                                </div>
                              )}
                            </div>
                          </section>

                          <div className="dashboard-workout-section">
                            <div className="dashboard-section-title">
                              <div>
                                <span>
                                  WORKOUT RECORDS
                                </span>

                                <h4>
                                  운동 수행 기록
                                </h4>
                              </div>

                              <strong>
                                {
                                  workoutRecords.length
                                }
                                개 완료
                              </strong>
                            </div>

                            <div className="dashboard-workout-list">
                              {workoutRecords.length >
                              0 ? (
                                workoutRecords.map(
                                  (record) => (
                                    <article
                                      className="dashboard-workout-card"
                                      key={record.id}
                                    >
                                      <div>
                                        <span>
                                          {
                                            record.type
                                          }
                                        </span>

                                        <h4>
                                          {
                                            record.title
                                          }
                                        </h4>

                                        <p>
                                          {formatDateTime(
                                            record.completedAt,
                                          )}
                                        </p>
                                      </div>

                                      <div className="dashboard-rpe">
                                        <span>
                                          목표 → 실제
                                        </span>

                                        <strong>
                                          {record.targetRpe ??
                                            '-'}
                                          {' → '}
                                          {record.rpe}
                                        </strong>

                                        {record.rpeGap !==
                                          null && (
                                          <small>
                                            차이{' '}
                                            {record.rpeGap >
                                            0
                                              ? '+'
                                              : ''}
                                            {
                                              record.rpeGap
                                            }
                                          </small>
                                        )}
                                      </div>
                                    </article>
                                  ),
                                )
                              ) : (
                                <div className="dashboard-empty">
                                  아직 완료한 운동
                                  기록이 없습니다.
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </section>

                    <form
                      className="admin-product-settings"
                      onSubmit={
                        saveMemberSettings
                      }
                    >
                      <div className="admin-form-heading">
                        <p>
                          MEMBERSHIP ACCESS
                        </p>

                        <h3>
                          상품 및 코치 설정
                        </h3>
                      </div>

                      <label className="admin-field">
                        멤버 이름

                        <input
                          type="text"
                          value={
                            memberSettings.fullName
                          }
                          onChange={(event) =>
                            updateMemberSettings(
                              'fullName',
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label className="admin-field">
                        이용 상품

                        <select
                          value={
                            memberSettings.membership
                          }
                          onChange={(event) =>
                            updateMemberSettings(
                              'membership',
                              event.target.value,
                            )
                          }
                        >
                          {membershipOptions.map(
                            (membership) => (
                              <option
                                key={membership}
                                value={membership}
                              >
                                {membership}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label className="admin-field">
                        멤버십 상태

                        <select
                          value={
                            memberSettings
                              .membershipStatus
                          }
                          onChange={(event) =>
                            updateMemberSettings(
                              'membershipStatus',
                              event.target.value,
                            )
                          }
                        >
                          {membershipStatusOptions.map(
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
                        담당 코치

                        <input
                          type="text"
                          placeholder="예: 윤다원"
                          value={
                            memberSettings.coachName
                          }
                          onChange={(event) =>
                            updateMemberSettings(
                              'coachName',
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label className="admin-check-field">
                        <input
                          type="checkbox"
                          checked={
                            memberSettings.membership ===
                            'NTAC ATHLETE'
                              ? true
                              : memberSettings.coachCare
                          }
                          disabled={
                            memberSettings.membership ===
                            'NTAC ATHLETE'
                          }
                          onChange={(event) =>
                            updateMemberSettings(
                              'coachCare',
                              event.target.checked,
                            )
                          }
                        />

                        <span>
                          COACH CARE 서비스
                          활성화
                          {memberSettings.membership ===
                          'NTAC ATHLETE'
                            ? ' · ATHLETE 필수'
                            : ''}
                        </span>
                      </label>

                      <button
                        className="admin-save-button"
                        type="submit"
                        disabled={saving}
                      >
                        {saving
                          ? '저장 중...'
                          : '멤버 정보 저장'}
                      </button>
                    </form>
                  </>
                )}
            </>
          )}
      </>
    )

  return (
    <section className="coach-admin-page">
      <div className="admin-page-header">
        <button
          type="button"
          onClick={onClose}
        >
          ←
        </button>

        <div>
          <p>NTAC ADMIN</p>
          <h2>관리자</h2>
        </div>
      </div>

      <nav
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(3, minmax(0, 1fr))',
          gap: '6px',
          margin: '18px 0 24px',
          padding: '6px',
          borderRadius: '16px',
          background: '#e9eeeb',
        }}
      >
        {adminTabs.map((tab) => {
          const isActive =
            activeAdminTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveAdminTab(
                  tab.id,
                )
              }
              style={{
                minWidth: 0,
                minHeight: '48px',
                padding: '8px 4px',
                border: 'none',
                borderRadius: '12px',
                background: isActive
                  ? '#0b3d2e'
                  : 'transparent',
                color: isActive
                  ? '#ffffff'
                  : '#33463f',
                fontSize: '10px',
                fontWeight: '800',
                lineHeight: 1.25,
                cursor: 'pointer',
                wordBreak: 'keep-all',
              }}
            >
              <span>
                {tab.label}
              </span>

              {tab.id ===
                'coachRequests' &&
                coachRequestCount > 0 && (
                  <strong
                    style={{
                      display:
                        'inline-grid',
                      placeItems:
                        'center',
                      minWidth:
                        '18px',
                      height:
                        '18px',
                      marginLeft:
                        '4px',
                      padding:
                        '0 4px',
                      borderRadius:
                        '999px',
                      background:
                        isActive
                          ? '#ffffff'
                          : '#d93f35',
                      color:
                        isActive
                          ? '#0b3d2e'
                          : '#ffffff',
                      fontSize:
                        '9px',
                    }}
                  >
                    {
                      coachRequestCount
                    }
                  </strong>
                )}
            </button>
          )
        })}
      </nav>

      {activeAdminTab ===
        'members' &&
        renderMemberManagement()}

      {activeAdminTab ===
        'programs' && (
        <WeeklyProgramAdmin />
      )}

      {activeAdminTab ===
        'personal' && (
        <PersonalProgramAdmin />
      )}

      {activeAdminTab ===
        'reports' && (
        <WeeklyAthleteReportAdmin />
      )}

      {activeAdminTab ===
        'coachRequests' && (
        <CoachSessionRequestAdmin
          onBack={() =>
            setActiveAdminTab(
              'members',
            )
          }
          onRequestsChanged={
            updateCoachRequestCount
          }
        />
      )}

      {activeAdminTab ===
        'community' && (
        <CommunityAdmin />
      )}

      {activeAdminTab ===
        'access' && (
        <AdminAccessManagement
          onAccessChanged={() =>
            setMembersRefreshKey(
              (current) =>
                current + 1,
            )
          }
        />
      )}
    </section>
  )
}

export default CoachAdminPage