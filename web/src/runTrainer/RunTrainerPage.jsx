import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { supabase } from '../lib/supabase.js'

import {
  getRunTrainerProgram,
} from './runTrainerPrograms.js'

import './runTrainer.css'

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(
    0,
    Math.round(totalSeconds || 0),
  )

  const minutes = Math.floor(
    safeSeconds / 60,
  )

  const seconds =
    safeSeconds % 60

  return `${minutes}:${String(
    seconds,
  ).padStart(2, '0')}`
}

function formatPace(paceSeconds) {
  if (!paceSeconds) {
    return '-'
  }

  const minutes = Math.floor(
    paceSeconds / 60,
  )

  const seconds =
    paceSeconds % 60

  return `${minutes}:${String(
    seconds,
  ).padStart(2, '0')} /km`
}

function paceToSpeed(paceSeconds) {
  if (!paceSeconds) {
    return '-'
  }

  return (
    3600 / paceSeconds
  ).toFixed(1)
}

function getStepPace(
  step,
  basePaceSeconds,
) {
  if (
    !step ||
    !Number.isFinite(
      step.paceOffset,
    )
  ) {
    return null
  }

  return Math.max(
    120,
    basePaceSeconds +
      step.paceOffset,
  )
}

function getStepDuration(
  step,
  basePaceSeconds,
) {
  if (!step) {
    return 0
  }

  if (
    Number.isFinite(step.time)
  ) {
    return Math.max(
      1,
      Math.round(step.time),
    )
  }

  if (
    Number.isFinite(
      step.distanceMeters,
    )
  ) {
    const paceSeconds =
      getStepPace(
        step,
        basePaceSeconds,
      )

    if (!paceSeconds) {
      return 0
    }

    return Math.max(
      1,
      Math.round(
        (
          step.distanceMeters *
          paceSeconds
        ) / 1000,
      ),
    )
  }

  return 0
}

function getModeClass(step) {
  const section = String(
    step?.section || '',
  ).toUpperCase()

  if (
    section.includes(
      'BRIEFING',
    )
  ) {
    return 'briefing'
  }

  if (
    section.includes(
      'WARM',
    )
  ) {
    return 'warmup'
  }

  if (
    section.includes(
      'RECOVERY',
    )
  ) {
    return 'recovery'
  }

  if (
    section.includes(
      'COOL',
    )
  ) {
    return 'cooldown'
  }

  return 'main'
}

function RunTrainerPage({
  member,
  session,
  programKey,
  calendarEventId = '',
  workoutDate = '',
  onClose,
  onComplete,
}) {
  const program = useMemo(
    () =>
      getRunTrainerProgram(
        programKey,
      ),
    [programKey],
  )

  const [
    basePaceSeconds,
    setBasePaceSeconds,
  ] = useState(null)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    loadError,
    setLoadError,
  ] = useState('')

  const [
    screen,
    setScreen,
  ] = useState('ready')

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0)

  const [
    remainingTime,
    setRemainingTime,
  ] = useState(0)

  const [
    isPaused,
    setIsPaused,
  ] = useState(false)

  const [
    selectedRpe,
    setSelectedRpe,
  ] = useState(null)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    saveError,
    setSaveError,
  ] = useState('')

  const [
    startedAt,
    setStartedAt,
  ] = useState(null)

  const audioContextRef =
    useRef(null)

  const lastBeepSecondRef =
    useRef(null)

  const steps =
    program?.steps || []

  const currentStep =
    steps[currentIndex] || null

  const nextStep =
    steps[currentIndex + 1] ||
    null

  const currentStepTotal =
    getStepDuration(
      currentStep,
      basePaceSeconds,
    )

  const currentPace =
    getStepPace(
      currentStep,
      basePaceSeconds,
    )

  const progress =
    currentStepTotal > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              (
                currentStepTotal -
                remainingTime
              ) /
              currentStepTotal
            ) *
              100,
          ),
        )
      : 0

  const countdownVisible =
    screen === 'workout' &&
    remainingTime > 0 &&
    remainingTime <= 10

  const sessionTargetRpe =
    session?.targetRpe ||
    (
      program?.targetRpeMin &&
      program?.targetRpeMax
        ? `${program.targetRpeMin}–${program.targetRpeMax}`
        : ''
    )

  const initializeAudio =
    useCallback(() => {
      if (
        typeof window ===
        'undefined'
      ) {
        return
      }

      if (
        !audioContextRef.current
      ) {
        const AudioContextClass =
          window.AudioContext ||
          window.webkitAudioContext

        if (
          AudioContextClass
        ) {
          audioContextRef.current =
            new AudioContextClass()
        }
      }

      if (
        audioContextRef.current
          ?.state === 'suspended'
      ) {
        audioContextRef.current
          .resume()
          .catch(() => {})
      }
    }, [])

  const playBeep =
    useCallback(
      (
        frequency = 880,
        duration = 0.12,
      ) => {
        const audioContext =
          audioContextRef.current

        if (!audioContext) {
          return
        }

        const oscillator =
          audioContext.createOscillator()

        const gain =
          audioContext.createGain()

        oscillator.type =
          'sine'

        oscillator.frequency.value =
          frequency

        gain.gain.setValueAtTime(
          0.15,
          audioContext.currentTime,
        )

        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime +
            duration,
        )

        oscillator.connect(gain)

        gain.connect(
          audioContext.destination,
        )

        oscillator.start()

        oscillator.stop(
          audioContext.currentTime +
            duration,
        )
      },
      [],
    )

  useEffect(() => {
    let isMounted = true

    const loadRunningProfile =
      async () => {
        if (!member?.id) {
          setLoadError(
            '로그인 회원 정보를 찾을 수 없습니다.',
          )

          setLoading(false)
          return
        }

        if (!program) {
          setLoadError(
            '런트레이너 프로그램을 찾을 수 없습니다.',
          )

          setLoading(false)
          return
        }

        const {
          data,
          error,
        } = await supabase
          .from(
            'running_profiles',
          )
          .select(
            `
              average_pace_seconds,
              tested_at
            `,
          )
          .eq(
            'user_id',
            member.id,
          )
          .maybeSingle()

        if (!isMounted) {
          return
        }

        if (error) {
          console.error(
            '러닝 프로필 조회 실패:',
            error,
          )

          setLoadError(
            error.message ||
              '러닝 기준 페이스를 불러오지 못했습니다.',
          )

          setLoading(false)
          return
        }

        if (
          !data?.average_pace_seconds
        ) {
          setLoadError(
            '마이페이지 설정에서 30분 TT 평균 페이스를 먼저 저장해 주세요.',
          )

          setLoading(false)
          return
        }

        setBasePaceSeconds(
          Number(
            data.average_pace_seconds,
          ),
        )

        setLoading(false)
      }

    loadRunningProfile()

    return () => {
      isMounted = false
    }
  }, [
    member?.id,
    program,
  ])

  const moveToStep =
    useCallback(
      (stepIndex) => {
        const targetStep =
          steps[stepIndex]

        if (!targetStep) {
          setIsPaused(true)
          setScreen('rpe')
          return
        }

        const duration =
          getStepDuration(
            targetStep,
            basePaceSeconds,
          )

        setCurrentIndex(
          stepIndex,
        )

        setRemainingTime(
          duration,
        )

        setIsPaused(false)

        lastBeepSecondRef.current =
          null
      },
      [
        steps,
        basePaceSeconds,
      ],
    )

  const moveToNextStep =
    useCallback(() => {
      initializeAudio()

      const nextIndex =
        currentIndex + 1

      if (
        nextIndex >=
        steps.length
      ) {
        playBeep(
          1050,
          0.45,
        )

        setIsPaused(true)
        setScreen('rpe')
        return
      }

      playBeep(
        1050,
        0.3,
      )

      moveToStep(nextIndex)
    }, [
      currentIndex,
      steps.length,
      initializeAudio,
      moveToStep,
      playBeep,
    ])

  useEffect(() => {
    if (
      screen !== 'workout' ||
      isPaused ||
      remainingTime <= 0
    ) {
      return undefined
    }

    const timerId =
      window.setInterval(() => {
        setRemainingTime(
          (current) =>
            Math.max(
              0,
              current - 1,
            ),
        )
      }, 1000)

    return () => {
      window.clearInterval(
        timerId,
      )
    }
  }, [
    screen,
    isPaused,
    remainingTime,
  ])

  useEffect(() => {
    if (
      screen !== 'workout' ||
      isPaused ||
      remainingTime !== 0
    ) {
      return undefined
    }

    const timeoutId =
      window.setTimeout(() => {
        moveToNextStep()
      }, 150)

    return () => {
      window.clearTimeout(
        timeoutId,
      )
    }
  }, [
    screen,
    isPaused,
    remainingTime,
    moveToNextStep,
  ])

  useEffect(() => {
    if (
      screen !== 'workout' ||
      isPaused ||
      remainingTime <= 0 ||
      remainingTime > 3
    ) {
      return
    }

    if (
      lastBeepSecondRef.current ===
      remainingTime
    ) {
      return
    }

    lastBeepSecondRef.current =
      remainingTime

    playBeep(
      remainingTime === 1
        ? 1000
        : 820,
      0.14,
    )
  }, [
    screen,
    isPaused,
    remainingTime,
    playBeep,
  ])

  const startWorkout = () => {
    if (
      !program ||
      !basePaceSeconds ||
      steps.length === 0
    ) {
      return
    }

    initializeAudio()

    setStartedAt(
      new Date().toISOString(),
    )

    setSelectedRpe(null)
    setSaveError('')
    setScreen('workout')

    moveToStep(0)
  }

  const togglePause = () => {
    initializeAudio()

    setIsPaused(
      (current) => !current,
    )
  }

  const resetWorkout = () => {
    const confirmed =
      window.confirm(
        '현재 런트레이너를 처음부터 다시 시작할까요?',
      )

    if (!confirmed) {
      return
    }

    setScreen('ready')
    setCurrentIndex(0)
    setRemainingTime(0)
    setIsPaused(false)
    setSelectedRpe(null)
    setSaveError('')
    setStartedAt(null)

    lastBeepSecondRef.current =
      null
  }

  const submitRpe = async () => {
    if (!selectedRpe) {
      setSaveError(
        '실제 수행 RPE를 선택해 주세요.',
      )

      return
    }

    setSaving(true)
    setSaveError('')

    try {
      const completedAt =
        new Date().toISOString()

      const {
        error,
      } = await supabase
        .from(
          'run_trainer_records',
        )
        .insert({
          user_id:
            member.id,

          calendar_event_id:
            calendarEventId ||
            null,

          program_id:
            programKey,

          program_name:
            program.title,

          base_pace_seconds:
            basePaceSeconds,

          target_rpe_min:
            program.targetRpeMin,

          target_rpe_max:
            program.targetRpeMax,

          actual_rpe:
            Number(
              selectedRpe,
            ),

          started_at:
            startedAt,

          completed_at:
            completedAt,
        })

      if (error) {
        throw error
      }

      if (
        typeof onComplete ===
        'function'
      ) {
        await onComplete(
          session.id,
          Number(
            selectedRpe,
          ),
          {
            calendarEventId:
              calendarEventId ||
              session?.eventId ||
              session?.id ||
              '',

            workoutDate:
              workoutDate ||
              session?.date ||
              '',

            title:
              session?.title ||
              program.title ||
              '런트레이닝',

            type:
              session?.type ||
              session?.sessionType ||
              'RUN',

            targetRpe:
              sessionTargetRpe,

            targetRpeLabel:
              sessionTargetRpe,

            weekId:
              session?.weekId ||
              '',

            weekType:
              session?.weekType ||
              '',
          },
        )
      }

      setScreen('finish')
    } catch (error) {
      console.error(
        '런트레이너 기록 저장 실패:',
        error,
      )

      setSaveError(
        error.message ||
          '런트레이너 기록을 저장하지 못했습니다.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="run-trainer loading">
        <p>
          런트레이너를 준비하는
          중입니다.
        </p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="run-trainer error-screen">
        <p className="trainer-brand">
          NOLTO RUN TRAINER
        </p>

        <h1>
          실행할 수 없습니다
        </h1>

        <p>
          {loadError}
        </p>

        <button
          type="button"
          onClick={onClose}
        >
          돌아가기
        </button>
      </div>
    )
  }

  if (screen === 'ready') {
    return (
      <div className="run-trainer briefing">
        <main className="trainer-screen">
          <p className="trainer-brand">
            NOLTO RUN TRAINER
          </p>

          <h1>
            {program.title}
          </h1>

          <p className="trainer-subtitle">
            {program.buttonSubtitle}
          </p>

          <p className="trainer-description">
            {program.description}
          </p>

          <div className="trainer-profile-box">
            <span>
              30분 TT 평균 페이스
            </span>

            <strong>
              {formatPace(
                basePaceSeconds,
              )}
            </strong>

            <span>
              트레드밀 기준 속도
            </span>

            <strong>
              {paceToSpeed(
                basePaceSeconds,
              )}
              km/h
            </strong>
          </div>

          <div className="trainer-ready-actions">
            <button
              type="button"
              onClick={onClose}
            >
              돌아가기
            </button>

            <button
              type="button"
              onClick={startWorkout}
            >
              런트레이너 시작
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (screen === 'rpe') {
    return (
      <div className="run-trainer briefing">
        <main className="trainer-screen">
          <p className="trainer-brand">
            NOLTO RUN TRAINER
          </p>

          <h1>
            훈련 완료
          </h1>

          <p className="trainer-subtitle">
            실제 수행 RPE를
            선택해 주세요.
          </p>

          <div className="trainer-rpe-target">
            목표 RPE{' '}
            {program.targetRpeMin}
            –
            {program.targetRpeMax}
          </div>

          <div className="trainer-rpe-buttons">
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
            ].map((value) => (
              <button
                type="button"
                key={value}
                className={
                  selectedRpe === value
                    ? 'selected'
                    : ''
                }
                onClick={() =>
                  setSelectedRpe(
                    value,
                  )
                }
              >
                {value}
              </button>
            ))}
          </div>

          {saveError && (
            <p className="trainer-error">
              {saveError}
            </p>
          )}

          <button
            className="trainer-save-button"
            type="button"
            disabled={saving}
            onClick={submitRpe}
          >
            {saving
              ? '기록 저장 중...'
              : 'RPE 저장하고 완료'}
          </button>
        </main>
      </div>
    )
  }

  if (screen === 'finish') {
    return (
      <div className="run-trainer cooldown">
        <main className="trainer-screen">
          <p className="trainer-brand">
            NOLTO RUN TRAINER
          </p>

          <h1>
            GOOD WORK
          </h1>

          <p className="trainer-subtitle">
            오늘의 런트레이닝
            기록이 저장되었습니다.
          </p>

          <button
            type="button"
            onClick={onClose}
          >
            NTAC로 돌아가기
          </button>
        </main>
      </div>
    )
  }

  return (
    <div
      className={
        `run-trainer ${
          getModeClass(
            currentStep,
          )
        }`
      }
    >
      <main className="trainer-screen workout-screen">
        <p className="trainer-section-label">
          {currentStep.section}
        </p>

        <h1 className="trainer-phase-label">
          {currentStep.phase}
        </h1>

        <div className="trainer-time">
          {formatTime(
            remainingTime,
          )}
        </div>

        <div className="trainer-progress-wrap">
          <div className="trainer-progress-label">
            <span>
              현재 구간
            </span>

            <span>
              {currentIndex + 1}/
              {steps.length}
            </span>
          </div>

          <div className="trainer-progress-bar">
            <div
              className="trainer-progress-fill"
              style={{
                width:
                  `${progress}%`,
              }}
            />
          </div>
        </div>

        <div className="trainer-info-box">
          <p className="trainer-pace">
            페이스:{' '}
            {formatPace(
              currentPace,
            )}
          </p>

          <p className="trainer-speed">
            트레드밀:{' '}
            {currentPace
              ? `${paceToSpeed(
                  currentPace,
                )} km/h`
              : '-'}
          </p>

          <p>
            {currentStep.target}
          </p>

          <p>
            {currentStep.round}
          </p>
        </div>

        <p className="trainer-coach-message">
          {currentStep.message}
        </p>

        <p className="trainer-next-phase">
          다음 구간:{' '}
          {nextStep
            ? nextStep.phase
            : '훈련 종료'}
        </p>

        <div className="trainer-controls">
          <button
            type="button"
            onClick={togglePause}
          >
            {isPaused
              ? '재시작'
              : '일시정지'}
          </button>

          <button
            type="button"
            onClick={
              moveToNextStep
            }
          >
            다음
          </button>

          <button
            type="button"
            onClick={
              resetWorkout
            }
          >
            처음부터
          </button>
        </div>
      </main>

      <div
        className={
          `trainer-countdown ${
            countdownVisible
              ? 'show'
              : ''
          }`
        }
      >
        <p>
          NEXT PHASE
        </p>

        <strong>
          {remainingTime}
        </strong>

        <span>
          {nextStep
            ? nextStep.phase
            : 'FINISH'}
        </span>
      </div>
    </div>
  )
}

export default RunTrainerPage