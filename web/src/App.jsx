import {
  useEffect,
  useState,
} from 'react'

import './App.css'

import RunTrainerPage from './runTrainer/RunTrainerPage.jsx'
import RunningPaceSection from './RunningPaceSection.jsx'
import ProfileEditSection from './ProfileEditSection.jsx'
import PasswordChangeSection from './PasswordChangeSection.jsx'
import CoachAdminPage from './CoachAdminPage.jsx'
import WeeklyAthleteReportPage from './WeeklyAthleteReportPage.jsx'
import CoachSessionRequestSection from './CoachSessionRequestSection.jsx'
import BodyFitScoreSection from './BodyFitScoreSection.jsx'
import TrainingPage from './pages/TrainingPage.jsx'
import CommunityPage from './pages/CommunityPage.jsx'
import useMemberRecords from './useMemberRecords.js'

import {
  canUseTraining,
  getAllTrainingEvents,
  getDateKey,
  getWeekRange,
  isTrainingAssignment,
} from './data/trainingSchedule.js'

import {
  getPersonalizedSession,
  loadMemberProgramOverrides,
  programs,
} from './data/programs.js'

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

  'NTAC ATHLETE': {
    run: true,
    build: true,
    community: true,
    weeklyReport: true,
    coachCare: true,
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

function getUniqueWorkoutRecordCount(
  workoutRecords,
  calendarWorkoutRecords,
) {
  const uniqueKeys = new Set()

  const addRecord = (
    record,
    fallbackKey,
  ) => {
    if (!record) {
      return
    }

    const recordKey =
      record.id ||
      record.eventId ||
      record.event_id ||
      `${
        record.sessionId ||
        record.session_id ||
        fallbackKey ||
        'session'
      }-${
        record.workoutDate ||
        record.workout_date ||
        record.date ||
        record.completedAt ||
        record.completed_at ||
        record.createdAt ||
        record.created_at ||
        ''
      }`

    uniqueKeys.add(recordKey)
  }

  Object.entries(
    workoutRecords || {},
  ).forEach(([key, record]) => {
    addRecord(record, key)
  })

  Object.entries(
    calendarWorkoutRecords || {},
  ).forEach(([key, record]) => {
    addRecord(record, key)
  })

  return uniqueKeys.size
}

function getAchievementBadge(
  completedCount,
) {
  if (completedCount === 1) {
    return {
      icon: '⚡',
      title: 'FIRST STEP',
      description:
        'NTAC에서 첫 번째 훈련을 완료했습니다.',
    }
  }

  if (completedCount === 5) {
    return {
      icon: '🔥',
      title: 'MOMENTUM',
      description:
        '누적 5개의 훈련을 완료했습니다.',
    }
  }

  if (completedCount === 10) {
    return {
      icon: '🏅',
      title: 'CONSISTENCY',
      description:
        '누적 10개의 훈련을 완료했습니다.',
    }
  }

  return null
}

function WorkoutCompletionModal({
  result,
  onClose,
}) {
  if (!result) {
    return null
  }

  const progressPercent =
    result.weeklyTotal > 0
      ? Math.min(
          100,
          Math.round(
            (
              result.weeklyCompleted /
              result.weeklyTotal
            ) * 100,
          ),
        )
      : 0

  const confettiPieces = [
    '◆',
    '●',
    '▲',
    '■',
    '◆',
    '●',
    '▲',
    '■',
    '◆',
    '●',
    '▲',
    '■',
  ]

  return (
    <div
      style={completionStyles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-completion-title"
    >
      <style>
        {`
          @keyframes ntacModalIn {
            from {
              opacity: 0;
              transform: translateY(24px) scale(0.94);
            }

            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes ntacCheckIn {
            0% {
              opacity: 0;
              transform: scale(0.35) rotate(-15deg);
            }

            70% {
              transform: scale(1.12) rotate(3deg);
            }

            100% {
              opacity: 1;
              transform: scale(1) rotate(0deg);
            }
          }

          @keyframes ntacConfettiFall {
            0% {
              opacity: 0;
              transform: translateY(-10vh) rotate(0deg);
            }

            12% {
              opacity: 1;
            }

            100% {
              opacity: 0;
              transform: translateY(105vh) rotate(560deg);
            }
          }
        `}
      </style>

      <div
        style={
          completionStyles.confettiLayer
        }
        aria-hidden="true"
      >
        {confettiPieces.map(
          (piece, index) => (
            <span
              key={`${piece}-${index}`}
              style={{
                ...completionStyles.confettiPiece,

                left:
                  `${6 + index * 8}%`,

                animationDelay:
                  `${
                    (index % 5) *
                    0.18
                  }s`,

                color:
                  index % 3 === 0
                    ? '#f1d786'
                    : index % 3 === 1
                      ? '#65c49a'
                      : '#ffffff',
              }}
            >
              {piece}
            </span>
          ),
        )}
      </div>

      <article
        style={completionStyles.modal}
      >
        <div
          style={completionStyles.check}
        >
          ✓
        </div>

        <p
          style={
            completionStyles.eyebrow
          }
        >
          {result.weekComplete
            ? 'WEEK COMPLETE'
            : 'SESSION COMPLETE'}
        </p>

        <h2
          id="workout-completion-title"
          style={
            completionStyles.title
          }
        >
          {result.weekComplete
            ? '이번 주 훈련을 모두 해냈어요.'
            : '오늘의 세션을 완료했어요.'}
        </h2>

        <div
          style={
            completionStyles.workoutCard
          }
        >
          {result.workoutType && (
            <span
              style={
                completionStyles.workoutType
              }
            >
              {result.workoutType}
            </span>
          )}

          <strong
            style={
              completionStyles.workoutTitle
            }
          >
            {result.workoutTitle}
          </strong>
        </div>

        <div
          style={
            completionStyles.stats
          }
        >
          <div
            style={
              completionStyles.statItem
            }
          >
            <span
              style={
                completionStyles.statLabel
              }
            >
              수행 RPE
            </span>

            <strong
              style={
                completionStyles.statValue
              }
            >
              {result.rpe}
            </strong>
          </div>

          <div
            style={
              completionStyles.statItem
            }
          >
            <span
              style={
                completionStyles.statLabel
              }
            >
              이번 주
            </span>

            <strong
              style={
                completionStyles.statValue
              }
            >
              {result.weeklyCompleted}
              {' / '}
              {result.weeklyTotal}
            </strong>
          </div>

          <div
            style={
              completionStyles.statItem
            }
          >
            <span
              style={
                completionStyles.statLabel
              }
            >
              누적 완료
            </span>

            <strong
              style={
                completionStyles.statValue
              }
            >
              {result.lifetimeCompleted}
            </strong>
          </div>
        </div>

        {result.weeklyTotal > 0 && (
          <div
            style={
              completionStyles.progressSection
            }
          >
            <div
              style={
                completionStyles.progressHead
              }
            >
              <span>
                주간 훈련 달성률
              </span>

              <strong>
                {progressPercent}%
              </strong>
            </div>

            <div
              style={
                completionStyles.progressTrack
              }
            >
              <div
                style={{
                  ...completionStyles.progressValue,

                  width:
                    `${progressPercent}%`,
                }}
              />
            </div>
          </div>
        )}

        {result.weekComplete && (
          <div
            style={
              completionStyles.weekCard
            }
          >
            <span
              style={
                completionStyles.weekEyebrow
              }
            >
              FULL WEEK ACHIEVED
            </span>

            <strong
              style={
                completionStyles.weekTitle
              }
            >
              계획한 훈련을 모두
              완수했습니다.
            </strong>

            <p
              style={
                completionStyles.weekText
              }
            >
              이번 주에도 꾸준하게
              자신의 피트니스 여정을
              이어갔습니다.
            </p>
          </div>
        )}

        {result.unlockedBadge && (
          <div
            style={
              completionStyles.badgeCard
            }
          >
            <div
              style={
                completionStyles.badgeIcon
              }
            >
              {
                result.unlockedBadge
                  .icon
              }
            </div>

            <div
              style={
                completionStyles.badgeContent
              }
            >
              <span
                style={
                  completionStyles.badgeEyebrow
                }
              >
                NEW ACHIEVEMENT
              </span>

              <strong
                style={
                  completionStyles.badgeTitle
                }
              >
                {
                  result.unlockedBadge
                    .title
                }
              </strong>

              <p
                style={
                  completionStyles.badgeText
                }
              >
                {
                  result.unlockedBadge
                    .description
                }
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={
            completionStyles.closeButton
          }
        >
          좋아, 홈으로 돌아가기
        </button>
      </article>
    </div>
  )
}

const completionStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 40000,
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
    padding: '20px',
    background:
      'rgba(4, 22, 16, 0.78)',
    backdropFilter: 'blur(9px)',
    WebkitBackdropFilter:
      'blur(9px)',
  },

  confettiLayer: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },

  confettiPiece: {
    position: 'absolute',
    top: '-10vh',
    fontSize: '15px',
    animation:
      'ntacConfettiFall 2.7s linear infinite',
  },

  modal: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: '420px',
    maxHeight:
      'calc(100vh - 40px)',
    overflowY: 'auto',
    boxSizing: 'border-box',
    padding: '28px 22px 22px',
    borderRadius: '26px',
    background: '#ffffff',
    color: '#10251e',
    textAlign: 'center',
    boxShadow:
      '0 28px 80px rgba(0, 0, 0, 0.34)',
    animation:
      'ntacModalIn 0.42s cubic-bezier(0.2, 0.9, 0.3, 1.12)',
  },

  check: {
    display: 'grid',
    placeItems: 'center',
    width: '76px',
    height: '76px',
    margin: '0 auto 18px',
    borderRadius: '50%',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '38px',
    fontWeight: 900,
    lineHeight: 1,
    boxShadow:
      '0 13px 30px rgba(11, 61, 46, 0.23)',
    animation:
      'ntacCheckIn 0.55s cubic-bezier(0.2, 1.4, 0.4, 1)',
  },

  eyebrow: {
    margin: '0 0 7px',
    color: '#0b6b4f',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.16em',
  },

  title: {
    margin: 0,
    color: '#10251e',
    fontSize: '23px',
    lineHeight: 1.3,
    letterSpacing: '-0.04em',
  },

  workoutCard: {
    display: 'grid',
    gap: '4px',
    marginTop: '17px',
    padding: '14px',
    borderRadius: '15px',
    background: '#f1f5f3',
  },

  workoutType: {
    color: '#0b6b4f',
    fontSize: '9px',
    fontWeight: 900,
    letterSpacing: '0.1em',
  },

  workoutTitle: {
    color: '#243a32',
    fontSize: '14px',
    lineHeight: 1.45,
  },

  stats: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, minmax(0, 1fr))',
    gap: '8px',
    marginTop: '13px',
  },

  statItem: {
    display: 'grid',
    gap: '5px',
    padding: '12px 6px',
    borderRadius: '14px',
    background: '#f5f7f6',
  },

  statLabel: {
    color: '#7b8681',
    fontSize: '9px',
    fontWeight: 800,
  },

  statValue: {
    color: '#0b3d2e',
    fontSize: '19px',
    fontWeight: 900,
  },

  progressSection: {
    display: 'grid',
    gap: '8px',
    marginTop: '16px',
    textAlign: 'left',
  },

  progressHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
    color: '#65716c',
    fontSize: '11px',
    fontWeight: 800,
  },

  progressTrack: {
    height: '9px',
    overflow: 'hidden',
    borderRadius: '999px',
    background: '#e3e9e6',
  },

  progressValue: {
    height: '100%',
    borderRadius: '999px',
    background:
      'linear-gradient(90deg, #0b3d2e, #15906a)',
    transition: 'width 0.65s ease',
  },

  weekCard: {
    display: 'grid',
    gap: '5px',
    marginTop: '16px',
    padding: '16px',
    borderRadius: '17px',
    background: '#0b3d2e',
    color: '#ffffff',
    textAlign: 'left',
  },

  weekEyebrow: {
    color: '#a9cbbd',
    fontSize: '9px',
    fontWeight: 900,
    letterSpacing: '0.12em',
  },

  weekTitle: {
    fontSize: '14px',
  },

  weekText: {
    margin: 0,
    color: '#d8e7e1',
    fontSize: '11px',
    lineHeight: 1.5,
  },

  badgeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '13px',
    marginTop: '15px',
    padding: '15px',
    border:
      '1px solid #d5e4dd',
    borderRadius: '17px',
    background: '#edf5f1',
    textAlign: 'left',
  },

  badgeIcon: {
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 50px',
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: '#0b3d2e',
    fontSize: '23px',
  },

  badgeContent: {
    display: 'grid',
    gap: '3px',
  },

  badgeEyebrow: {
    color: '#0b6b4f',
    fontSize: '8px',
    fontWeight: 900,
    letterSpacing: '0.11em',
  },

  badgeTitle: {
    color: '#17342a',
    fontSize: '14px',
  },

  badgeText: {
    margin: 0,
    color: '#65716c',
    fontSize: '10px',
    lineHeight: 1.45,
  },

  closeButton: {
    width: '100%',
    minHeight: '50px',
    marginTop: '18px',
    border: 'none',
    borderRadius: '14px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 900,
    cursor: 'pointer',
  },
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
  selectedWorkout,
  sessionId,
  calendarEventId,
  workoutDate,
  records,
  calendarRecords,
  personalizationError,
  onBack,
  onStartRunTrainer,
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

  const programSessions =
    Array.isArray(program?.sessions)
      ? program.sessions
      : []

  const matchedSessions = sessionId
    ? programSessions.filter(
        (session) =>
          session.id === sessionId,
      )
    : programSessions

  const calendarSession =
    selectedWorkout
      ? [
          {
            id:
              selectedWorkout.sessionId ||
              sessionId ||
              selectedWorkout.id ||
              calendarEventId ||
              'calendar-session',

            type:
              selectedWorkout.sessionType ||
              selectedWorkout.type ||
              'TRAINING',

            title:
              selectedWorkout.title ||
              '오늘의 훈련',

            subtitle:
              selectedWorkout.subtitle ||
              selectedWorkout.description ||
              '',

            targetRpe:
              selectedWorkout.targetRpe ||
              '',

            sections:
              Array.isArray(
                selectedWorkout.sections,
              )
                ? selectedWorkout.sections
                : [],

            runTrainerEnabled:
              Boolean(
                selectedWorkout
                  .runTrainerEnabled,
              ),

            runTrainerKey:
              selectedWorkout
                .runTrainerKey ||
              selectedWorkout
                .sessionId ||
              sessionId ||
              '',

            isPersonalized:
              Boolean(
                selectedWorkout
                  .isPersonalized,
              ),

            coachNote:
              selectedWorkout.coachNote ||
              '',
          },
        ]
      : []

  const visibleSessions =
    matchedSessions.length > 0
      ? matchedSessions
      : calendarSession

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
    calendarEventId:
      calendarEventId ||
      selectedWorkout?.id ||
      selectedWorkout?.eventId ||
      '',

    workoutDate:
      workoutDate ||
      selectedWorkout?.date ||
      '',

    title:
      session.title ||
      selectedWorkout?.title ||
      '',

    type:
      session.type ||
      selectedWorkout?.type ||
      '',

    targetRpe:
      session.targetRpe ||
      selectedWorkout?.targetRpe ||
      '',

    targetRpeLabel:
      session.targetRpe ||
      selectedWorkout?.targetRpe ||
      '',

    weekId:
      session.weekId ||
      selectedWorkout?.weekId ||
      '',

    weekType:
      session.weekType ||
      selectedWorkout?.weekType ||
      '',
  },
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

      {visibleSessions.length === 0 ? (
        <article className="feature-card locked">
          <span className="locked-badge">
            PROGRAM DATA ERROR
          </span>

          <h3>
            운동 내용을 불러오지
            못했습니다.
          </h3>

          <p>
            뒤로 돌아가 다시 열어주세요.
          </p>
        </article>
      ) : (
        <div className="session-list">
          {visibleSessions.map(
            (commonSession) => {
              const personalizedSession =
  getPersonalizedSession(
    commonSession,
    member.id,
    calendarEventId,
  )

const session = {
  ...personalizedSession,

  targetRpe:
    personalizedSession.targetRpe ||
    selectedWorkout?.targetRpe ||
    '',

  weekId:
    personalizedSession.weekId ||
    selectedWorkout?.weekId ||
    '',

  weekLabel:
    personalizedSession.weekLabel ||
    selectedWorkout?.weekLabel ||
    '',

  weekType:
    personalizedSession.weekType ||
    selectedWorkout?.weekType ||
    '',

  weekTypeLabel:
    personalizedSession.weekTypeLabel ||
    selectedWorkout?.weekTypeLabel ||
    '',
}

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

              const isIntervalSession =
                String(
                  session.type || '',
                )
                  .toUpperCase()
                  .includes('INTERVAL')

              const canStartRunTrainer =
                !isCompleted &&
                (
                  session
                    .runTrainerEnabled ||
                  isIntervalSession
                )

              const sections =
                Array.isArray(
                  session.sections,
                )
                  ? session.sections
                  : []

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

                  {canStartRunTrainer && (
                    <button
                      className="run-trainer-button"
                      type="button"
                      onClick={() =>
                        onStartRunTrainer(
                          session,
                          {
                            calendarEventId,
                            workoutDate,
                          },
                        )
                      }
                    >
                      <div className="run-trainer-button-text">
                        <span>
                          GUIDED RUN
                        </span>

                        <strong>
                          런트레이너 시작
                        </strong>

                        <p>
                          구간과 페이스를
                          실시간으로 안내받으며
                          운동하세요.
                        </p>
                      </div>

                      <div className="run-trainer-play">
                        ▶
                      </div>
                    </button>
                  )}

                  <div className="training-sections">
                    {sections.length > 0 ? (
                      sections.map(
                        (
                          section,
                          sectionIndex,
                        ) => {
                          const items =
                            Array.isArray(
                              section.items,
                            )
                              ? section.items
                              : []

                          return (
                            <section
                              className="training-section"
                              key={
                                section.title ||
                                `section-${sectionIndex}`
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
                                {items.map(
                                  (
                                    item,
                                    itemIndex,
                                  ) => (
                                    <div
                                      className="training-item"
                                      key={
                                        `${
                                          section.title ||
                                          'section'
                                        }-${itemIndex}`
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
                          )
                        },
                      )
                    ) : (
                      <p className="session-subtitle">
                        세부 운동 내용이 아직
                        등록되지 않았습니다.
                      </p>
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
      )}
    </section>
  )
}

const servicePlans = [
  {
    id: 'NTAC RUN',
    eyebrow: 'RUN TRAINING',
    price: '39,000원',
    description:
      '개인 기준 페이스에 맞춘 러닝 프로그램과 런트레이너를 이용하는 서비스입니다.',
    features: [
      '개인 기준 페이스 기반 러닝 프로그램',
      '구간과 페이스를 안내하는 런트레이너',
    ],
  },
  {
    id: 'NTAC BUILD',
    eyebrow: 'HYROX BUILD',
    price: '79,000원',
    description:
      'RUN 전체 기능과 함께 하이록스 주요 종목 수행을 위한 근력·보강 프로그램을 제공합니다.',
    features: [
      'NTAC RUN 전체 기능',
      '하이록스 중심 근력·보강 프로그램',
    ],
  },
  {
    id: 'NTAC COMPLETE',
    eyebrow: 'ONLINE + COMMUNITY',
    price: '119,000원',
    description:
      'RUN과 BUILD 전체 기능에 매주 함께 진행하는 하이록스 커뮤니티 클래스가 포함됩니다.',
    features: [
      'NTAC RUN + BUILD 전체 기능',
      '주 1회 하이록스 커뮤니티 클래스',
    ],
  },
  {
    id: 'NTAC ATHLETE',
    eyebrow: 'FULL COACH CARE',
    price: '189,000원',
    description:
      '훈련 결과와 컨디션을 담당 코치가 지속적으로 관리하는 NTAC의 가장 완전한 코치 케어 서비스입니다.',
    features: [
      'NTAC COMPLETE 전체 기능',
      '주간 코치 리포트',
      '월 1회 코치 1:1 세션',
      '담당 코치 관리',
    ],
    featured: true,
  },
  {
    id: 'NTAC COMMUNITY',
    eyebrow: 'OFFLINE CLASS',
    price: '89,000원',
    description:
      '함께 하이록스를 경험하고 훈련하는 오프라인 커뮤니티 클래스 중심 서비스입니다.',
    features: [
      '주 1회 하이록스 커뮤니티 클래스',
      '하이록스 종목과 레이스 형식 훈련',
    ],
  },
]

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
    id: 'services',
    label: '서비스',
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
      'repeat(4, minmax(0, 1fr))',
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

function ServiceGuideSection({
  currentMembership,
}) {
  return (
    <section
      style={{
        display: 'grid',
        gap: '13px',
        marginTop: '17px',
      }}
    >
      <div>
        <p
          style={{
            margin: '0 0 6px',
            color: '#0b6b4f',
            fontSize: '10px',
            fontWeight: '900',
            letterSpacing: '0.12em',
          }}
        >
          NTAC MEMBERSHIP
        </p>

        <h3
          style={{
            margin: 0,
            color: '#17352c',
            fontSize: '22px',
            letterSpacing: '-0.03em',
          }}
        >
          나에게 맞는 서비스를 확인하세요.
        </h3>

        <p
          style={{
            margin: '9px 0 0',
            color: '#71807a',
            fontSize: '13px',
            lineHeight: 1.65,
          }}
        >
          러닝부터 하이록스 커뮤니티, 담당 코치의
          지속적인 관리까지 필요한 범위에 따라 선택할 수
          있습니다.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '11px',
        }}
      >
        {servicePlans.map((plan) => {
          const isCurrent =
            currentMembership === plan.id

          const isFeatured =
            Boolean(plan.featured)

          return (
            <article
              key={plan.id}
              style={{
                display: 'grid',
                gap: '14px',
                padding: '19px',
                border: isCurrent
                  ? '2px solid #0b3d2e'
                  : isFeatured
                    ? '1px solid #9cbcaf'
                    : '1px solid #dce5e1',
                borderRadius: '19px',
                background: isCurrent
                  ? '#0b3d2e'
                  : isFeatured
                    ? '#edf5f1'
                    : '#ffffff',
                color: isCurrent
                  ? '#ffffff'
                  : '#17352c',
                boxShadow: isCurrent
                  ? '0 15px 34px rgba(11, 61, 46, 0.18)'
                  : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <span
                    style={{
                      display: 'block',
                      color: isCurrent
                        ? '#a9cbbd'
                        : '#0b6b4f',
                      fontSize: '9px',
                      fontWeight: '900',
                      letterSpacing: '0.11em',
                    }}
                  >
                    {plan.eyebrow}
                  </span>

                  <h4
                    style={{
                      margin: '6px 0 0',
                      fontSize: '19px',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {plan.id}
                  </h4>
                </div>

                {isCurrent && (
                  <span
                    style={{
                      flexShrink: 0,
                      padding: '6px 9px',
                      borderRadius: '999px',
                      background: '#ffffff',
                      color: '#0b3d2e',
                      fontSize: '9px',
                      fontWeight: '900',
                    }}
                  >
                    현재 이용 중
                  </span>
                )}
              </div>

              <div>
                <strong
                  style={{
                    display: 'block',
                    fontSize: '25px',
                    letterSpacing: '-0.04em',
                  }}
                >
                  {plan.price}
                </strong>

                <span
                  style={{
                    display: 'block',
                    marginTop: '3px',
                    color: isCurrent
                      ? '#c6dcd3'
                      : '#7d8a85',
                    fontSize: '10px',
                    fontWeight: '700',
                  }}
                >
                  월 이용료 · 앱 결제 기능 준비 중
                </span>
              </div>

              <p
                style={{
                  margin: 0,
                  color: isCurrent
                    ? '#e2eee9'
                    : '#5f7069',
                  fontSize: '13px',
                  fontWeight: '700',
                  lineHeight: 1.65,
                }}
              >
                {plan.description}
              </p>

              <div
                style={{
                  display: 'grid',
                  gap: '8px',
                }}
              >
                {plan.features.map((feature) => (
                  <div
                    key={feature}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      color: isCurrent
                        ? '#dceae4'
                        : '#324b42',
                      fontSize: '12px',
                      fontWeight: '800',
                      lineHeight: 1.45,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        color: isCurrent
                          ? '#8ed0b5'
                          : '#0b6b4f',
                      }}
                    >
                      ✓
                    </span>

                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </div>

      <article
        style={{
          padding: '17px',
          borderRadius: '16px',
          background: '#eef2f0',
        }}
      >
        <strong
          style={{
            display: 'block',
            color: '#17352c',
            fontSize: '13px',
          }}
        >
          상품 변경 안내
        </strong>

        <p
          style={{
            margin: '6px 0 0',
            color: '#697872',
            fontSize: '12px',
            lineHeight: 1.6,
          }}
        >
          현재는 앱에서 바로 결제하지 않습니다. 상품 변경과
          가입은 담당 코치에게 문의해 주세요.
        </p>
      </article>
    </section>
  )
}

function MyPage({
  member,
  settings,
  access,
  progressPercent,
  openWeeklyReport,
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
          내 상태와 기록, 서비스 안내와
          계정 설정을 확인합니다.
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
            <p>
              ATHLETE WEEKLY REPORT
            </p>

            <h3>
              {access?.weeklyReport
                ? '이번 주 코치 리포트를 확인하세요.'
                : '훈련 반응을 코치에게 관리받아보세요.'}
            </h3>

            <span>
              목표 RPE와 실제 수행,
              컨디션과 회복 상태를 분석해
              다음 훈련 방향을 전달합니다.
            </span>

            <button
              type="button"
              onClick={openWeeklyReport}
            >
              {access?.weeklyReport
                ? '주간 리포트 확인'
                : 'ATHLETE 서비스 보기'}
            </button>
          </article>

          <CoachSessionRequestSection
            member={member}
            settings={settings}
          />

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

      {activeSection === 'services' && (
        <>
          <p
            style={
              myPageStyles.sectionIntro
            }
          >
            NTAC가 제공하는 서비스와 월 이용료를
            확인합니다. 현재 이용 중인 상품은 진한
            초록색으로 표시됩니다.
          </p>

          <ServiceGuideSection
            currentMembership={
              settings.membership
            }
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
    selectedRunTrainer,
    setSelectedRunTrainer,
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

  const [
    completionResult,
    setCompletionResult,
  ] = useState(null)

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

  const startRunTrainer = (
    session,
    context = {},
  ) => {
    setSelectedRunTrainer({
      session,

      calendarEventId:
        context.calendarEventId ||
        '',

      workoutDate:
        context.workoutDate ||
        '',
    })
  }

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

  const lifetimeCompletedCount =
    getUniqueWorkoutRecordCount(
      workoutRecords,
      calendarWorkoutRecords,
    )

  const completeWorkoutWithCelebration =
    async (
      sessionId,
      rpe,
      calendarInfo = {},
    ) => {
      const calendarEventId =
        calendarInfo.calendarEventId ||
        ''

      const workoutDate =
        calendarInfo.workoutDate ||
        ''

      const matchingCalendarEvent =
        weeklyAssignments.find(
          (event) =>
            event.id ===
              calendarEventId ||
            (
              event.sessionId ===
                sessionId &&
              event.date ===
                workoutDate
            ),
        )

      const existingRecord =
        calendarEventId
          ? calendarWorkoutRecords[
              calendarEventId
            ]
          : workoutRecords[
              sessionId
            ]

      const savedRecord =
        await completeWorkout(
          sessionId,
          rpe,
          calendarInfo,
        )

      const isNewCompletion =
        !existingRecord

      const belongsToCurrentWeek =
        Boolean(
          matchingCalendarEvent,
        )

      const nextWeeklyCompleted =
        belongsToCurrentWeek &&
        isNewCompletion
          ? Math.min(
              totalAssignments,
              completedCount + 1,
            )
          : completedCount

      const nextLifetimeCompleted =
        isNewCompletion
          ? lifetimeCompletedCount + 1
          : lifetimeCompletedCount

      const didCompleteWeek =
        belongsToCurrentWeek &&
        isNewCompletion &&
        totalAssignments > 0 &&
        nextWeeklyCompleted >=
          totalAssignments

      setCompletionResult({
        workoutTitle:
          calendarInfo.title ||
          matchingCalendarEvent
            ?.title ||
          selectedRunTrainer
            ?.session?.title ||
          savedRecord.title ||
          '오늘의 훈련',

        workoutType:
          calendarInfo.type ||
          matchingCalendarEvent
            ?.type ||
          selectedRunTrainer
            ?.session?.type ||
          savedRecord.type ||
          '',

        rpe: Number(rpe),

        weeklyCompleted:
          nextWeeklyCompleted,

        weeklyTotal:
          totalAssignments,

        weekComplete:
          didCompleteWeek,

        lifetimeCompleted:
          nextLifetimeCompleted,

        unlockedBadge:
          isNewCompletion
            ? getAchievementBadge(
                nextLifetimeCompleted,
              )
            : null,
      })

      return savedRecord
    }

  const closeCompletionModal = () => {
    setCompletionResult(null)
    setSelectedProgram(null)
    setSelectedRunTrainer(null)
    setActiveTab('home')
  }

  const completionModal =
    completionResult ? (
      <WorkoutCompletionModal
        result={completionResult}
        onClose={
          closeCompletionModal
        }
      />
    ) : null

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

    try {
      if (currentMember.id) {
        await loadMemberProgramOverrides(
          currentMember.id,
        )

        setPersonalizationError('')

        setPersonalizationVersion(
          (current) =>
            current + 1,
        )
      }
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
          access={access}
          progressPercent={
            progressPercent
          }
          openWeeklyReport={() =>
            setActiveTab(
              'weekly-report',
            )
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

  if (
    activeTab ===
    'weekly-report'
  ) {
    return (
      <WeeklyAthleteReportPage
        member={currentMember}
        access={access}
        onBack={() =>
          setActiveTab('my')
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

  if (selectedRunTrainer) {
    return (
      <>
        <RunTrainerPage
          member={currentMember}
          session={
            selectedRunTrainer.session
          }
          programKey={
            selectedRunTrainer
              .session
              .runTrainerKey
          }
          calendarEventId={
            selectedRunTrainer
              .calendarEventId
          }
          workoutDate={
            selectedRunTrainer
              .workoutDate
          }
          onClose={() =>
            setSelectedRunTrainer(null)
          }
          onComplete={
            completeWorkoutWithCelebration
          }
        />

        {completionModal}
      </>
    )
  }

  if (selectedProgram) {
    const selectedProgramData =
      programs[
        selectedProgram.programId
      ]

    const selectedWorkout =
      allTrainingEvents.find(
        (event) => {
          if (
            selectedProgram
              .calendarEventId
          ) {
            return (
              event.id ===
              selectedProgram
                .calendarEventId
            )
          }

          return (
            event.sessionId ===
            selectedProgram.sessionId
          )
        },
      ) || null

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
          selectedWorkout={
            selectedWorkout
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
          onStartRunTrainer={
            startRunTrainer
          }
          onComplete={
            completeWorkoutWithCelebration
          }
        />

        {completionModal}
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

      {completionModal}
    </div>
  )
}

export default App