import './WorkoutCompletionModal.css'

function WorkoutCompletionModal({
  result,
  onClose,
}) {
  if (!result) {
    return null
  }

  const {
    workoutTitle,
    workoutType,
    rpe,
    weeklyCompleted,
    weeklyTotal,
    weekComplete,
    lifetimeCompleted,
    unlockedBadge,
  } = result

  const progressPercent =
    weeklyTotal > 0
      ? Math.min(
          100,
          Math.round(
            (
              weeklyCompleted /
              weeklyTotal
            ) * 100,
          ),
        )
      : 0

  return (
    <div
      className="completion-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
    >
      <div className="completion-confetti">
        {Array.from({
          length: 14,
        }).map((_, index) => (
          <span key={index} />
        ))}
      </div>

      <article className="completion-modal">
        <div className="completion-check">
          <span>✓</span>
        </div>

        <p className="completion-eyebrow">
          {weekComplete
            ? 'WEEK COMPLETE'
            : 'SESSION COMPLETE'}
        </p>

        <h2 id="completion-title">
          {weekComplete
            ? '이번 주 훈련을 모두 해냈어요.'
            : '오늘의 세션을 완료했어요.'}
        </h2>

        <div className="completion-workout">
          {workoutType && (
            <span>{workoutType}</span>
          )}

          <strong>
            {workoutTitle}
          </strong>
        </div>

        <div className="completion-stats">
          <div>
            <span>수행 RPE</span>
            <strong>{rpe}</strong>
          </div>

          <div>
            <span>이번 주</span>

            <strong>
              {weeklyCompleted}
              {' / '}
              {weeklyTotal}
            </strong>
          </div>

          <div>
            <span>누적 완료</span>

            <strong>
              {lifetimeCompleted}
            </strong>
          </div>
        </div>

        {weeklyTotal > 0 && (
          <div className="completion-progress">
            <div className="completion-progress-head">
              <span>
                주간 훈련 달성률
              </span>

              <strong>
                {progressPercent}%
              </strong>
            </div>

            <div className="completion-progress-track">
              <div
                className="completion-progress-value"
                style={{
                  width:
                    `${progressPercent}%`,
                }}
              />
            </div>
          </div>
        )}

        {weekComplete && (
          <div className="week-complete-message">
            <span>
              FULL WEEK ACHIEVED
            </span>

            <strong>
              계획한 훈련을 모두
              완수했습니다.
            </strong>

            <p>
              이번 주에도 자신의
              피트니스 여정을 제대로
              이어갔어요.
            </p>
          </div>
        )}

        {unlockedBadge && (
          <div className="achievement-badge">
            <div className="achievement-icon">
              {unlockedBadge.icon}
            </div>

            <div>
              <span>
                NEW ACHIEVEMENT
              </span>

              <strong>
                {unlockedBadge.title}
              </strong>

              <p>
                {
                  unlockedBadge.description
                }
              </p>
            </div>
          </div>
        )}

        <button
          className="completion-close-button"
          type="button"
          onClick={onClose}
        >
          좋아, 계속하기
        </button>
      </article>
    </div>
  )
}

export default WorkoutCompletionModal