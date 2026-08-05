import {
  useEffect,
  useState,
} from 'react'

import './App.css'

import RunningPaceSection from './RunningPaceSection'
import ProfileEditSection from './ProfileEditSection'
import PasswordChangeSection from './PasswordChangeSection'
import CoachAdminPage from './CoachAdminPage'
import BodyFitScoreSection from './BodyFitScoreSection'
import TrainingPage from './pages/TrainingPage'
import CommunityPage from './pages/CommunityPage'
import useMemberRecords from './useMemberRecords.js'

import {
  canUseTraining,
  getAllTrainingEvents,
  getDateKey,
  getWeekRange,
  isTrainingAssignment,
} from './data/trainingSchedule'

import {
  getPersonalizedSession,
  loadMemberProgramOverrides,
  programs,
} from './data/programs'

const accessByMembership = {
  'NTAC RUN': {
    run: true,
    build: false,
    community: false,
  },

  'NTAC BUILD': {
    run: true,
    build: true,
    community: false,
  },

  'NTAC COMPLETE': {
    run: true,
    build: true,
    community: true,
  },

  'NTAC COMMUNITY': {
    run: false,
    build: false,
    community: true,
  },
}

function createCurrentMember(profile) {
  const name =
    profile?.full_name?.trim() ||
    profile?.email?.split('@')[0] ||
    'NTAC 멤버'

  const compactName =
    name.replace(/\s/g, '')

  return {
    id: profile?.id || '',
    name,

    initials:
      compactName
        .slice(0, 2)
        .toUpperCase() || 'NT',

    membership:
      profile?.membership ||
      'NTAC RUN',
  }
}

function loadMemberSettings(profile) {
  return {
    membership:
      profile?.membership ||
      'NTAC RUN',

    membershipStatus:
      profile?.membership_status ||
      'active',

    coachCare:
      Boolean(profile?.coach_care),

    coach:
      profile?.coach_name ||
      '미배정',
  }
}

function getCurrentMemberAccess(
  profile,
) {
  const settings =
    loadMemberSettings(profile)

  const access =
    accessByMembership[
      settings.membership
    ] ||
    accessByMembership['NTAC RUN']

  return {
    settings,
    access,
  }
}

function getMembershipStatusLabel(
  status,
) {
  if (status === 'paused') {
    return '일시정지'
  }

  if (status === 'expired') {
    return '만료'
  }

  return '이용 중'
}

function CheckinPage({
  onClose,
  onComplete,
  todayCheckin,
}) {
  const [form, setForm] =
    useState({
      condition:
        todayCheckin?.condition ??
        3,

      sleep:
        todayCheckin?.sleep
          ?.toString() || '',

      soreness:
        todayCheckin?.soreness ??
        3,

      stress:
        todayCheckin?.stress ?? 3,

      pain:
        todayCheckin?.pain ||
        '없음',

      painArea:
        todayCheckin?.painArea ||
        '',

      message:
        todayCheckin?.message ||
        '',
    })

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    submitError,
    setSubmitError,
  ] = useState('')

  const updateForm = (
    name,
    value,
  ) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault()

    setSubmitting(true)
    setSubmitError('')

    try {
      await onComplete(form)
      onClose()
    } catch (error) {
      console.error(
        '체크인 저장 실패:',
        error,
      )

      setSubmitError(
        error.message ||
          '체크인을 저장하지 못했습니다.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="checkin-page">
      <div className="checkin-header">
        <button
          type="button"
          onClick={onClose}
        >
          ←
        </button>

        <div>
          <p>DAILY CHECK-IN</p>
          <h2>오늘의 컨디션</h2>
        </div>
      </div>

      <form
        className="checkin-form"
        onSubmit={handleSubmit}
      >
        <label>
          오늘 컨디션

          <span>
            {form.condition} / 5
          </span>
        </label>

        <input
          type="range"
          min="1"
          max="5"
          value={form.condition}
          onChange={(event) =>
            updateForm(
              'condition',
              Number(
                event.target.value,
              ),
            )
          }
        />

        <label>
          수면시간

          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            placeholder="예: 7.5"
            value={form.sleep}
            onChange={(event) =>
              updateForm(
                'sleep',
                event.target.value,
              )
            }
            required
          />
        </label>

        <label>
          근육통

          <span>
            {form.soreness} / 5
          </span>
        </label>

        <input
          type="range"
          min="1"
          max="5"
          value={form.soreness}
          onChange={(event) =>
            updateForm(
              'soreness',
              Number(
                event.target.value,
              ),
            )
          }
        />

        <label>
          스트레스

          <span>
            {form.stress} / 5
          </span>
        </label>

        <input
          type="range"
          min="1"
          max="5"
          value={form.stress}
          onChange={(event) =>
            updateForm(
              'stress',
              Number(
                event.target.value,
              ),
            )
          }
        />

        <label>
          통증 여부

          <select
            value={form.pain}
            onChange={(event) =>
              updateForm(
                'pain',
                event.target.value,
              )
            }
          >
            <option value="없음">
              없음
            </option>

            <option value="가벼움">
              가벼움
            </option>

            <option value="훈련 조절 필요">
              훈련 조절 필요
            </option>
          </select>
        </label>

        {form.pain !== '없음' && (
          <label>
            통증 부위

            <input
              type="text"
              placeholder="예: 오른쪽 어깨"
              value={form.painArea}
              onChange={(event) =>
                updateForm(
                  'painArea',
                  event.target.value,
                )
              }
              required
            />
          </label>
        )}

        <label>
          코치에게 전달할 내용

          <textarea
            rows="4"
            placeholder="오늘 컨디션이나 참고할 내용을 적어주세요."
            value={form.message}
            onChange={(event) =>
              updateForm(
                'message',
                event.target.value,
              )
            }
          />
        </label>

        {submitError && (
          <p
            style={{
              margin: 0,
              color: '#c43d3d',
              fontSize: '14px',
              fontWeight: '700',
            }}
          >
            {submitError}
          </p>
        )}

        <button
          className="checkin-submit"
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? '저장 중...'
            : '체크인 완료'}
        </button>
      </form>
    </div>
  )
}

function HomePage({
  member,
  settings,
  openCheckin,
  todayCheckin,
  completedCount,
  totalAssignments,
  progressPercent,
  openProgram,
  moveToTraining,
  homeTrainings,
  todayKey,
  calendarWorkoutRecords,
  recordsLoading,
  recordsError,
}) {
  return (
    <>
      <section className="welcome">
        <p>
          안녕하세요, {member.name}님
        </p>

        <h2>
          오늘도 훈련을 이어가세요.
        </h2>

        <span>
          {settings.membership}
        </span>
      </section>

      {recordsLoading && (
        <article className="feature-card">
          <h3>
            멤버 기록을 불러오는
            중입니다.
          </h3>

          <p>
            체크인과 운동 기록을
            확인하고 있어요.
          </p>
        </article>
      )}

      {recordsError && (
        <article className="feature-card locked">
          <span className="locked-badge">
            RECORD ERROR
          </span>

          <h3>
            멤버 기록을 불러오지
            못했습니다.
          </h3>

          <p>{recordsError}</p>
        </article>
      )}

      <section className="checkin-card">
        <div>
          <p className="section-label">
            DAILY CHECK-IN
          </p>

          {todayCheckin ? (
            <>
              <h3>
                오늘 체크인이
                완료됐어요.
              </h3>

              <p>
                컨디션{' '}
                {todayCheckin.condition}
                점
                {' · '}
                수면{' '}
                {todayCheckin.sleep}
                시간
              </p>
            </>
          ) : (
            <>
              <h3>
                오늘 컨디션은
                어떤가요?
              </h3>

              <p>
                훈련 전 컨디션을
                기록해 주세요.
              </p>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={openCheckin}
        >
          {todayCheckin
            ? '다시 기록'
            : '체크인하기'}
        </button>
      </section>

      <section className="progress-section">
        <div className="section-title">
          <h3>이번 주 진행률</h3>

          <strong>
            {completedCount}
            {' / '}
            {totalAssignments}
          </strong>
        </div>

        <div className="progress-bar">
          <div
            className="progress-value"
            style={{
              width:
                `${progressPercent}%`,
            }}
          />
        </div>
      </section>

      <section>
        <div className="section-title">
          <h3>나의 트레이닝</h3>

          <button
            className="text-button"
            type="button"
            onClick={moveToTraining}
          >
            캘린더 보기
          </button>
        </div>

        <div className="workout-list">
          {homeTrainings.length >
          0 ? (
            homeTrainings.map(
              (workout) => {
                const record =
                  calendarWorkoutRecords[
                    workout.id
                  ]

                const isToday =
                  workout.date ===
                  todayKey

                const workoutDateLabel =
                  new Date(
                    `${workout.date}T00:00:00`,
                  ).toLocaleDateString(
                    'ko-KR',
                    {
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                    },
                  )

                const scheduleLabel =
                  isToday
                    ? '오늘의 훈련'
                    : `${workoutDateLabel} 예정`

                return (
                  <article
                    className="workout-card"
                    key={workout.id}
                    onClick={() =>
                      openProgram(
                        workout.programId,
                        workout.sessionId,
                        workout.id,
                        workout.date,
                      )
                    }
                  >
                    <div className="workout-type">
                      {workout.type}
                    </div>

                    <div className="workout-info">
                      <p>
                        {record
                          ? '완료한 훈련'
                          : scheduleLabel}
                      </p>

                      <h4>
                        {workout.title}
                      </h4>

                      <span>
                        {
                          workout.description
                        }
                      </span>
                    </div>

                    <button
                      className="arrow-button"
                      type="button"
                      aria-label={
                        `${workout.title} 열기`
                      }
                    >
                      {record ? '✓' : '›'}
                    </button>
                  </article>
                )
              },
            )
          ) : (
            <article className="feature-card locked">
              <span className="locked-badge">
                예정된 훈련 없음
              </span>

              <h3>
                앞으로 예정된 개인
                훈련이 없습니다.
              </h3>

              <p>
                트레이닝 캘린더에서
                전체 일정을 확인해
                주세요.
              </p>
            </article>
          )}
        </div>
      </section>
    </>
  )
}

function PersonalPlan({
  session,
  member,
}) {
  if (!session.isPersonalized) {
    return null
  }

  return (
    <div className="personal-plan">
      <div className="personal-plan-head">
        <div>
          <p>
            PERSONALIZED PROGRAM
          </p>

          <h4>
            {member.name}님을 위해
            조정된 프로그램
          </h4>
        </div>

        <span>개인화 적용</span>
      </div>

      {session.coachNote && (
        <div className="coach-note">
          <span>
            COACH NOTE
          </span>

          <p>
            {session.coachNote}
          </p>
        </div>
      )}
    </div>
  )
}

function ProgramDetailPage({
  member,
  program,
  sessionId,
  calendarEventId,
  workoutDate,
  records,
  calendarRecords,
  personalizationError,
  onBack,
  onComplete,
}) {
  const [
    rpeValues,
    setRpeValues,
  ] = useState({})

  const [
    savingSessionId,
    setSavingSessionId,
  ] = useState(null)

  const visibleSessions = sessionId
    ? program.sessions.filter(
        (session) =>
          session.id === sessionId,
      )
    : program.sessions

  const completeSession = async (
    session,
  ) => {
    const selectedRpe =
      rpeValues[session.id]

    if (!selectedRpe) {
      alert(
        '실제 수행 RPE를 선택해 주세요.',
      )

      return
    }

    setSavingSessionId(session.id)

    try {
      await onComplete(
        session.id,
        Number(selectedRpe),
        {
          calendarEventId,
          workoutDate,
          title: session.title,
          type: session.type,
        },
      )

      alert(
        '운동 기록이 Supabase에 저장되었습니다.',
      )
    } catch (error) {
      console.error(
        '운동 기록 저장 실패:',
        error,
      )

      alert(
        `운동 기록 저장에 실패했습니다.\n${
          error.message ||
          '알 수 없는 오류'
        }`,
      )
    } finally {
      setSavingSessionId(null)
    }
  }

  return (
    <section className="program-detail">
      <div className="detail-header">
        <button
          className="back-button"
          type="button"
          onClick={onBack}
        >
          ←
        </button>

        <div>
          <p>{program.eyebrow}</p>
          <h2>{program.title}</h2>
        </div>
      </div>

      <p className="detail-description">
        {program.description}
      </p>

      {personalizationError && (
        <article className="feature-card locked">
          <span className="locked-badge">
            PERSONAL DATA ERROR
          </span>

          <h3>
            개인 설정을 불러오지
            못했습니다.
          </h3>

          <p>
            공통 프로그램을 표시하고
            있습니다.
          </p>
        </article>
      )}

      <div className="session-list">
        {visibleSessions.map(
          (commonSession) => {
            const session =
              getPersonalizedSession(
                commonSession,
                member.id,
                calendarEventId,
              )

            const record =
              calendarEventId
                ? calendarRecords[
                    calendarEventId
                  ]
                : records[
                    session.id
                  ]

            const isCompleted =
              Boolean(record)

            const isSaving =
              savingSessionId ===
              session.id

            return (
              <article
                className={
                  `session-card ${
                    isCompleted
                      ? 'completed'
                      : ''
                  }`
                }
                key={session.id}
              >
                <div className="session-top">
                  <span className="session-tag">
                    {session.type}
                  </span>

                  {isCompleted && (
                    <span className="done-badge">
                      완료
                    </span>
                  )}
                </div>

                <h3>
                  {session.title}
                </h3>

                <p className="session-subtitle">
                  {session.subtitle}
                </p>

                <PersonalPlan
                  session={session}
                  member={member}
                />

                <div className="training-sections">
                  {session.sections.map(
                    (section) => (
                      <section
                        className="training-section"
                        key={
                          section.title
                        }
                      >
                        <div className="training-section-title">
                          <span>
                            {
                              section.title
                            }
                          </span>
                        </div>

                        <div className="training-items">
                          {section.items.map(
                            (
                              item,
                              itemIndex,
                            ) => (
                              <div
                                className="training-item"
                                key={
                                  `${section.title}-${itemIndex}`
                                }
                              >
                                <span className="training-dot" />

                                <p>
                                  {item}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      </section>
                    ),
                  )}
                </div>

                {isCompleted ? (
                  <div className="completed-record">
                    <span>
                      실제 수행 RPE
                    </span>

                    <strong>
                      {record.rpe}
                    </strong>
                  </div>
                ) : (
                  <>
                    <label className="rpe-field">
                      실제 수행 RPE

                      <select
                        value={
                          rpeValues[
                            session.id
                          ] || ''
                        }
                        onChange={(
                          event,
                        ) =>
                          setRpeValues(
                            (
                              current,
                            ) => ({
                              ...current,

                              [session.id]:
                                event
                                  .target
                                  .value,
                            }),
                          )
                        }
                      >
                        <option value="">
                          선택
                        </option>

                        {[
                          1,
                          2,
                          3,
                          4,
                          5,
                          6,
                          7,
                          8,
                          9,
                          10,
                        ].map(
                          (value) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {value}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <button
                      className="complete-button"
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        completeSession(
                          session,
                        )
                      }
                    >
                      {isSaving
                        ? '저장 중...'
                        : '운동 완료'}
                    </button>
                  </>
                )}
              </article>
            )
          },
        )}
      </div>
    </section>
  )
}

const myPageTabs = [
  {
    id: 'status',
    label: '내 상태',
  },
  {
    id: 'records',
    label: '기록',
  },
  {
    id: 'settings',
    label: '설정',
  },
]

const myPageStyles = {
  tabs: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, minmax(0, 1fr))',
    gap: '6px',
    margin: '22px 0 4px',
    padding: '5px',
    borderRadius: '15px',
    background: '#e7ece9',
  },

  tabButton: {
    minHeight: '42px',
    padding: '9px 8px',
    border: 'none',
    borderRadius: '11px',
    background: 'transparent',
    color: '#66736e',
    fontSize: '13px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  activeTabButton: {
    background: '#ffffff',
    color: '#0b3d2e',
    boxShadow:
      '0 2px 10px rgba(11, 61, 46, 0.08)',
  },

  sectionIntro: {
    margin: '17px 0 0',
    color: '#73807b',
    fontSize: '12px',
    lineHeight: 1.5,
  },
}

function MyPage({
  member,
  settings,
  progressPercent,
  openAdmin,
  isAdmin,
}) {
  const [
    activeSection,
    setActiveSection,
  ] = useState('status')

  return (
    <section className="sub-page">
      <div className="page-heading">
        <p>MY NTAC</p>

        <h2>마이페이지</h2>

        <span>
          내 상태와 기록, 계정 설정을
          확인합니다.
        </span>
      </div>

      <div
        style={myPageStyles.tabs}
        role="tablist"
        aria-label="마이페이지 메뉴"
      >
        {myPageTabs.map((tab) => {
          const isActive =
            activeSection === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() =>
                setActiveSection(tab.id)
              }
              style={{
                ...myPageStyles.tabButton,

                ...(isActive
                  ? myPageStyles
                      .activeTabButton
                  : {}),
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeSection === 'status' && (
        <>
          <p
            style={
              myPageStyles.sectionIntro
            }
          >
            현재 이용 상품과 코칭 상태,
            최신 Body Fit Score를 한눈에
            확인합니다.
          </p>

          <article className="membership-card">
            <p>현재 이용 상품</p>

            <h3>
              {settings.membership}
            </h3>

            <span>
              코치 관리와 프로그램 이용
              권한을 확인하세요.
            </span>
          </article>

          <div className="status-list">
            <div className="status-row">
              <span>멤버십 상태</span>

              <strong>
                {getMembershipStatusLabel(
                  settings.membershipStatus,
                )}
              </strong>
            </div>

            <div className="status-row">
              <span>담당 코치</span>

              <strong>
                {settings.coach}
              </strong>
            </div>

            <div className="status-row">
              <span>COACH CARE</span>

              <strong>
                {settings.coachCare
                  ? '이용 중'
                  : '미이용'}
              </strong>
            </div>

            <div className="status-row">
              <span>이번 주 수행률</span>

              <strong>
                {progressPercent}%
              </strong>
            </div>
          </div>

          <BodyFitScoreSection
            memberId={member.id}
            mode="summary"
          />

          <article className="coach-card">
            <p>COACH CARE</p>

            <h3>
              더 세밀한 코칭이
              필요하신가요?
            </h3>

            <span>
              담당 코치가 컨디션과 수행
              기록을 확인하고 관리합니다.
            </span>

            <button type="button">
              서비스 알아보기
            </button>
          </article>

          {isAdmin && (
            <button
              className="admin-entry-button"
              type="button"
              onClick={openAdmin}
            >
              관리자 열기
            </button>
          )}
        </>
      )}

      {activeSection === 'records' && (
        <>
          <p
            style={
              myPageStyles.sectionIntro
            }
          >
            새 체성분 기록을 등록하고,
            항목별 점수와 이전 측정
            결과를 확인합니다.
          </p>

          <BodyFitScoreSection
            memberId={member.id}
            mode="records"
          />
        </>
      )}

      {activeSection === 'settings' && (
  <>
    <p
      style={
        myPageStyles.sectionIntro
      }
    >
      개인정보와 러닝 기준 페이스,
      로그인 비밀번호를 관리합니다.
    </p>

    <RunningPaceSection
      memberId={member.id}
    />

    <ProfileEditSection />

    <PasswordChangeSection />
  </>
)}
    </section>
  )
}

function App({
  profile,
}) {
  const isAdmin =
  profile?.role === 'admin' ||
  profile?.role === 'owner'

  const currentMember =
    createCurrentMember(profile)

  const [
    activeTab,
    setActiveTab,
  ] = useState('home')

  const [
    selectedProgram,
    setSelectedProgram,
  ] = useState(null)

  const [
    personalizationVersion,
    setPersonalizationVersion,
  ] = useState(0)

  const [
    personalizationError,
    setPersonalizationError,
  ] = useState('')

  const [
    checkinOpen,
    setCheckinOpen,
  ] = useState(false)

  const {
    todayCheckin,
    workoutRecords,
    calendarWorkoutRecords,
    recordsLoading,
    recordsError,
    submitCheckin,
    completeWorkout,
  } = useMemberRecords()

  const {
    settings,
    access,
  } = getCurrentMemberAccess(
    profile,
  )

  useEffect(() => {
    let isMounted = true

    const loadPersonalization =
      async () => {
        if (!currentMember.id) {
          return
        }

        try {
          await loadMemberProgramOverrides(
            currentMember.id,
          )

          if (isMounted) {
            setPersonalizationError('')

            setPersonalizationVersion(
              (current) =>
                current + 1,
            )
          }
        } catch (error) {
          console.error(
            '개인 프로그램 초기 조회 실패:',
            error,
          )

          if (isMounted) {
            setPersonalizationError(
              error.message ||
                '개인 프로그램을 불러오지 못했습니다.',
            )
          }
        }
      }

    loadPersonalization()

    return () => {
      isMounted = false
    }
  }, [currentMember.id])

  const todayKey =
    getDateKey()

  const allTrainingEvents =
    getAllTrainingEvents()

  const currentWeek =
    getWeekRange(todayKey)

  const weeklyAssignments =
    allTrainingEvents.filter(
      (event) =>
        event.date >=
          currentWeek.startKey &&
        event.date <=
          currentWeek.endKey &&
        isTrainingAssignment(
          event,
        ) &&
        canUseTraining(
          event,
          access,
        ),
    )

  const completedCount =
    weeklyAssignments.filter(
      (event) =>
        calendarWorkoutRecords[
          event.id
        ],
    ).length

  const totalAssignments =
    weeklyAssignments.length

  const progressPercent =
    totalAssignments === 0
      ? 0
      : Math.round(
          (
            completedCount /
            totalAssignments
          ) * 100,
        )

  const upcomingAccessibleTrainings =
    allTrainingEvents
      .filter(
        (event) =>
          event.date >= todayKey &&
          isTrainingAssignment(
            event,
          ) &&
          canUseTraining(
            event,
            access,
          ),
      )
      .sort(
        (first, second) =>
          first.date.localeCompare(
            second.date,
          ),
      )

  const todayTrainings =
    upcomingAccessibleTrainings.filter(
      (event) =>
        event.date === todayKey,
    )

  const nextTrainingDate =
    upcomingAccessibleTrainings.find(
      (event) =>
        event.date > todayKey,
    )?.date

  const homeTrainings =
    todayTrainings.length > 0
      ? todayTrainings
      : upcomingAccessibleTrainings.filter(
          (event) =>
            event.date ===
            nextTrainingDate,
        )

  const openProgram = async (
    programId,
    sessionId = null,
    calendarEventId = null,
    workoutDate = null,
  ) => {
    if (
      programId === 'run' &&
      !access.run
    ) {
      alert(
        '현재 상품에서는 RUN을 이용할 수 없습니다.',
      )

      return
    }

    if (
      programId === 'build' &&
      !access.build
    ) {
      alert(
        '현재 상품에서는 BUILD를 이용할 수 없습니다.',
      )

      return
    }

    /*
     * 프로그램을 열 때마다
     * Supabase에서 최신 개인 설정을
     * 다시 가져온다.
     */
    try {
      await loadMemberProgramOverrides(
        currentMember.id,
      )

      setPersonalizationError('')

      setPersonalizationVersion(
        (current) =>
          current + 1,
      )
    } catch (error) {
      console.error(
        '개인 프로그램 최신 조회 실패:',
        error,
      )

      setPersonalizationError(
        error.message ||
          '개인 프로그램을 불러오지 못했습니다.',
      )
    }

    setSelectedProgram({
      programId,
      sessionId,
      calendarEventId,
      workoutDate,
    })
  }

  const renderPage = () => {
    if (
      activeTab === 'training'
    ) {
      return (
        <TrainingPage
          settings={settings}
          access={access}
          openProgram={openProgram}
        />
      )
    }

    if (
      activeTab === 'community'
    ) {
      return (
        <CommunityPage
          settings={settings}
          access={access}
        />
      )
    }

    if (activeTab === 'my') {
      return (
        <MyPage
  member={currentMember}
  settings={settings}
          progressPercent={
            progressPercent
          }
          isAdmin={isAdmin}
          openAdmin={() =>
            setActiveTab('admin')
          }
        />
      )
    }

    return (
      <HomePage
        member={currentMember}
        settings={settings}
        openCheckin={() =>
          setCheckinOpen(true)
        }
        todayCheckin={
          todayCheckin
        }
        completedCount={
          completedCount
        }
        totalAssignments={
          totalAssignments
        }
        progressPercent={
          progressPercent
        }
        openProgram={openProgram}
        moveToTraining={() =>
          setActiveTab('training')
        }
        homeTrainings={
          homeTrainings
        }
        todayKey={todayKey}
        calendarWorkoutRecords={
          calendarWorkoutRecords
        }
        recordsLoading={
          recordsLoading
        }
        recordsError={
          recordsError
        }
      />
    )
  }

  if (activeTab === 'admin') {
    if (!isAdmin) {
      return (
        <div className="app">
          <section className="sub-page">
            <div className="page-heading">
              <p>
                ACCESS DENIED
              </p>

              <h2>
                접근 권한이 없습니다.
              </h2>

              <span>
                관리자 계정만 이용할
                수 있습니다.
              </span>
            </div>

            <button
              className="admin-entry-button"
              type="button"
              onClick={() =>
                setActiveTab('my')
              }
            >
              마이페이지로 돌아가기
            </button>
          </section>
        </div>
      )
    }

    return (
      <div className="app">
        <CoachAdminPage
          onClose={() =>
            setActiveTab('my')
          }
        />
      </div>
    )
  }

  if (selectedProgram) {
    const selectedProgramData =
      programs[
        selectedProgram.programId
      ]

    if (!selectedProgramData) {
      return (
        <div className="app">
          <section className="sub-page">
            <div className="page-heading">
              <p>PROGRAM ERROR</p>

              <h2>
                프로그램을 찾을 수
                없습니다.
              </h2>
            </div>

            <button
              className="admin-entry-button"
              type="button"
              onClick={() =>
                setSelectedProgram(null)
              }
            >
              돌아가기
            </button>
          </section>
        </div>
      )
    }

    return (
      <div className="app">
        <ProgramDetailPage
          key={
            `${
              selectedProgram.programId
            }-${
              selectedProgram
                .calendarEventId ||
              selectedProgram
                .sessionId ||
              'all'
            }-${personalizationVersion}`
          }
          member={currentMember}
          program={
            selectedProgramData
          }
          sessionId={
            selectedProgram.sessionId
          }
          calendarEventId={
            selectedProgram
              .calendarEventId
          }
          workoutDate={
            selectedProgram.workoutDate
          }
          records={
            workoutRecords
          }
          calendarRecords={
            calendarWorkoutRecords
          }
          personalizationError={
            personalizationError
          }
          onBack={() =>
            setSelectedProgram(null)
          }
          onComplete={
            completeWorkout
          }
        />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="brand-caption">
            NOLTO TRAINING
          </p>

          <h1>NTAC</h1>
        </div>

        <button
          className="profile-button"
          type="button"
          onClick={() =>
            setActiveTab('my')
          }
        >
          {currentMember.initials}
        </button>
      </header>

      <main>
        {renderPage()}
      </main>

      <nav className="bottom-nav">
        <button
          type="button"
          className={
            activeTab === 'home'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('home')
          }
        >
          홈
        </button>

        <button
          type="button"
          className={
            activeTab === 'training'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('training')
          }
        >
          트레이닝
        </button>

        <button
          type="button"
          className={
            activeTab ===
            'community'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab(
              'community',
            )
          }
        >
          커뮤니티
        </button>

        <button
          type="button"
          className={
            activeTab === 'my'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('my')
          }
        >
          마이
        </button>
      </nav>

      {checkinOpen && (
        <CheckinPage
          todayCheckin={
            todayCheckin
          }
          onClose={() =>
            setCheckinOpen(false)
          }
          onComplete={
            submitCheckin
          }
        />
      )}
    </div>
  )
}

export default App