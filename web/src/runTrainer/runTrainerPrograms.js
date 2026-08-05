function createStrideSteps() {
  return Array.from({
    length: 4,
  }).flatMap((_, index) => [
    {
      section: 'WARM UP',

      phase:
        `Strides ${index + 1}/4`,

      time: 20,

      target:
        '30분 TT 평균 페이스까지 상승',

      paceOffset: 0,

      round:
        `Strides ${index + 1}/4`,

      message:
        '20초 Strides입니다. 전력질주하지 말고 30분 TT 평균 페이스까지 부드럽게 속도를 올리세요.',
    },

    {
      section: 'WARM UP',

      phase:
        `Easy Recovery ${index + 1}/4`,

      time: 40,

      target: '호흡 회복',

      paceOffset: 120,

      round:
        `Recovery ${index + 1}/4`,

      message:
        '40초 Easy Recovery입니다. 속도를 낮추고 다음 Strides를 준비하세요.',
    },
  ])
}

function create800mIntervalSteps() {
  return Array.from({
    length: 5,
  }).flatMap((_, index) => {
    const setNumber =
      index + 1

    const steps = [
      {
        section: 'MAIN SET',

        phase:
          `800m Interval ${setNumber}/5`,

        distanceMeters: 800,

        target:
          '30분 TT 평균 페이스보다 5초 빠르게',

        paceOffset: -5,

        round:
          `Set ${setNumber}/5`,

        message:
          '800m 인터벌입니다. 초반부터 과도하게 빠르게 달리지 말고, 마지막 세트까지 일정한 속도를 유지하세요.',
      },
    ]

    if (setNumber < 5) {
      steps.push({
        section: 'RECOVERY',

        phase:
          `Easy Jog Recovery ${setNumber}/4`,

        time: 90,

        target:
          '90초 Easy Jog',

        paceOffset: 120,

        round:
          `Recovery ${setNumber}/4`,

        message:
          '90초 Easy Jog입니다. 걷지 말고 가볍게 조깅하며 다음 세트를 준비하세요.',
      })
    }

    return steps
  })
}

function createThresholdIntervalSteps() {
  return Array.from({
    length: 4,
  }).flatMap((_, index) => {
    const setNumber =
      index + 1

    const steps = [
      {
        section: 'MAIN SET',

        phase:
          `6 Min Threshold ${setNumber}/4`,

        time: 360,

        target:
          '30분 TT 평균 페이스 유지',

        paceOffset: 0,

        round:
          `Set ${setNumber}/4`,

        message:
          '6분 Threshold 구간입니다. 첫 세트부터 과도하게 빠르게 시작하지 말고 일정한 페이스를 유지하세요.',
      },
    ]

    if (setNumber < 4) {
      steps.push({
        section: 'RECOVERY',

        phase:
          `Easy Jog Recovery ${setNumber}/3`,

        time: 90,

        target:
          '90초 Easy Jog',

        paceOffset: 120,

        round:
          `Recovery ${setNumber}/3`,

        message:
          '90초 Easy Jog입니다. 호흡을 정리하면서 다음 Threshold 구간을 준비하세요.',
      })
    }

    return steps
  })
}

export const runTrainerPrograms = {
  '2026-w32-run-800m': {
    key:
      '2026-w32-run-800m',

    title:
      '800m Interval',

    buttonTitle:
      '800m INTERVAL',

    buttonSubtitle:
      '800m × 5 Sets',

    targetRpeMin: 7,

    targetRpeMax: 8,

    description:
      '30분 TT 평균 페이스를 기준으로 800m 반복을 수행하며 빠른 페이스 유지 능력을 만드는 훈련입니다.',

    steps: [
      {
        section: 'BRIEFING',

        phase:
          '오늘의 훈련 안내',

        time: 60,

        target:
          '800m × 5 Sets',

        paceOffset: null,

        round:
          '목표 RPE 7-8',

        message:
          '오늘은 800m 인터벌 5세트입니다. 30분 TT 평균 페이스보다 약 5초 빠르게 진행하고, 세트 사이에는 90초 Easy Jog로 회복합니다.',
      },

      {
        section: 'WARM UP',

        phase: 'Easy Jog',

        time: 360,

        target:
          '몸의 온도 올리기',

        paceOffset: 105,

        round:
          '6 Minute Easy Jog',

        message:
          '6분 Easy Jog입니다. 호흡을 편하게 유지하며 몸을 천천히 준비하세요.',
      },

      ...createStrideSteps(),

      {
        section:
          'MAIN BRIEFING',

        phase: '본훈련 안내',

        time: 60,

        target:
          '800m × 5 Sets',

        paceOffset: null,

        round:
          '800m + 90초 Easy Jog',

        message:
          '800m를 5세트 진행합니다. 빠른 첫 세트보다 마지막 세트까지 일정한 페이스를 유지하는 것이 중요합니다.',
      },

      ...create800mIntervalSteps(),

      {
        section: 'COOL DOWN',

        phase: 'Easy Jog',

        time: 300,

        target:
          '호흡과 심박 안정',

        paceOffset: 105,

        round:
          '5 Minute Easy Jog',

        message:
          '5분 쿨다운입니다. 속도를 충분히 낮추고 호흡과 심박수를 안정시키세요.',
      },
    ],
  },

  '2026-w32-run-threshold-6min': {
    key:
      '2026-w32-run-threshold-6min',

    title:
      'Threshold Interval',

    buttonTitle:
      'THRESHOLD INTERVAL',

    buttonSubtitle:
      '6 Min × 4 Sets',

    targetRpeMin: 7,

    targetRpeMax: 8,

    description:
      '30분 TT 평균 페이스로 6분 반복을 수행하며 지속 가능한 빠른 페이스 적응력을 만드는 훈련입니다.',

    steps: [
      {
        section: 'BRIEFING',

        phase:
          '오늘의 훈련 안내',

        time: 60,

        target:
          '6 Min × 4 Sets',

        paceOffset: null,

        round:
          '목표 RPE 7-8',

        message:
          '오늘은 6분 Threshold 인터벌 4세트입니다. 30분 TT 평균 페이스를 유지하고 세트 사이에는 90초 Easy Jog로 회복합니다.',
      },

      {
        section: 'WARM UP',

        phase: 'Easy Jog',

        time: 480,

        target:
          '몸의 온도 올리기',

        paceOffset: 105,

        round:
          '8 Minute Easy Jog',

        message:
          '8분 Easy Jog입니다. 호흡을 편하게 유지하며 몸을 천천히 준비하세요.',
      },

      ...createStrideSteps(),

      {
        section:
          'MAIN BRIEFING',

        phase: '본훈련 안내',

        time: 60,

        target:
          '6 Min × 4 Sets',

        paceOffset: null,

        round:
          '6분 러닝 + 90초 Easy Jog',

        message:
          '6분 동안 30분 TT 평균 페이스를 유지합니다. 첫 세트부터 무리하지 말고 마지막 세트까지 일정한 속도를 유지하세요.',
      },

      ...createThresholdIntervalSteps(),

      {
        section: 'COOL DOWN',

        phase: 'Easy Jog',

        time: 360,

        target:
          '호흡과 심박 안정',

        paceOffset: 105,

        round:
          '6 Minute Easy Jog',

        message:
          '6분 쿨다운입니다. 속도를 낮추고 오늘 훈련을 마무리하세요.',
      },
    ],
  },
}

export function getRunTrainerProgram(
  programKey,
) {
  return (
    runTrainerPrograms[
      programKey
    ] || null
  )
}