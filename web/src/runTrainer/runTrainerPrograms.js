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

function normalizeTrainerText(value) {
  return String(value || '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTargetRpe(value) {
  const numbers =
    normalizeTrainerText(value)
      .match(/\d+(?:\.\d+)?/g)
      ?.map(Number)
      .filter(Number.isFinite) || []

  if (numbers.length === 0) {
    return { min: 1, max: 10 }
  }

  return {
    min: numbers[0],
    max: numbers[1] ?? numbers[0],
  }
}

function parseDurationSeconds(text) {
  const normalized = normalizeTrainerText(text)

  const findDuration = (pattern, multiplier) => {
    const matches = [
      ...normalized.matchAll(pattern),
    ]

    for (const match of matches) {
      const before = normalized
        .slice(0, match.index)
        .slice(-4)

      if (/[+-]\s*$/.test(before)) {
        continue
      }

      if (
        /(?:빠르게|느리게|faster|slower)/i.test(
          normalized,
        ) &&
        /(?:10\s*k|pace|페이스)/i.test(
          normalized,
        )
      ) {
        continue
      }

      return Math.max(
        1,
        Math.round(
          Number(match[1]) * multiplier,
        ),
      )
    }

    return null
  }

  return (
    findDuration(
      /(\d+(?:\.\d+)?)\s*(?:분|mins?|minutes?)/gi,
      60,
    ) ||
    findDuration(
      /(\d+(?:\.\d+)?)\s*(?:초|secs?|seconds?|s)(?![a-z])/gi,
      1,
    )
  )
}

function parseDistanceMeters(text) {
  const normalized = normalizeTrainerText(text)
  const matches = [
    ...normalized.matchAll(
      /(\d+(?:\.\d+)?)\s*(km|m)\b/gi,
    ),
  ]

  if (matches.length === 0) {
    return null
  }

  const value = Number(matches[0][1])

  if (!Number.isFinite(value)) {
    return null
  }

  return matches[0][2].toLowerCase() === 'km'
    ? Math.round(value * 1000)
    : Math.round(value)
}

function parseRepeatMarker(text) {
  const marker = normalizeTrainerText(text).match(
    /^(\d+)\s*(sets?|rounds?)\s*:?\s*$/i,
  )

  if (!marker) {
    return null
  }

  return {
    count: Math.max(1, Number(marker[1])),
    kind: marker[2].toLowerCase().startsWith('set')
      ? 'SET'
      : 'ROUND',
  }
}

function expandInlineTrainerItems(items) {
  const expanded = []

  ;(items || []).forEach((rawItem) => {
    const item = normalizeTrainerText(rawItem)

    if (!item) return

    const compound = item.match(
      /^(.+?)\s*\+\s*(.+?)\s*[×xX]\s*(\d+)\s*(sets?|rounds?)\s*$/i,
    )

    if (compound) {
      expanded.push(
        `${compound[3]} ${compound[4]}`,
        compound[1].trim(),
        compound[2].trim(),
      )
      return
    }

    const single = item.match(
      /^(.+?)\s*[×xX]\s*(\d+)\s*(sets?|rounds?)\s*$/i,
    )

    if (single) {
      expanded.push(
        `${single[2]} ${single[3]}`,
        single[1].trim(),
      )
      return
    }

    expanded.push(item)
  })

  return expanded
}

function hasRunKeyword(text) {
  return /(?:run(?:ning)?|jog|stride|treadmill|러닝|달리기|조깅|페이스|pace|threshold|역치|10\s*k(?:m)?)/i.test(
    normalizeTrainerText(text),
  )
}

function isRecoveryText(text) {
  return /(?:recovery|recover|회복|세트 사이)/i.test(
    normalizeTrainerText(text),
  )
}

function isRestText(text) {
  return /(?:rest|휴식|회복)/i.test(
    normalizeTrainerText(text),
  )
}

function isStandaloneGroupBoundary(text) {
  const normalized = normalizeTrainerText(text)

  return (
    /(?:정지 휴식|완전 휴식|complete rest|full rest|standing rest)/i.test(
      normalized,
    ) && Boolean(parseDurationSeconds(normalized))
  )
}

function getPaceInstruction(text) {
  const normalized = normalizeTrainerText(text)

  const has10k = /10\s*k(?:m)?\s*(?:pace|페이스)?/i.test(
    normalized,
  )

  const hasThreshold = /(?:threshold|역치|30\s*분\s*tt)/i.test(
    normalized,
  )

  let offset = null

  const signed = normalized.match(
    /10\s*k(?:m)?(?:\s*(?:pace|페이스))?\s*([+-])\s*(\d+(?:\.\d+)?)\s*(?:초|s)/i,
  )

  if (signed) {
    offset =
      Number(signed[2]) *
      (signed[1] === '-' ? -1 : 1)
  }

  const fasterRange = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:-|~)\s*(\d+(?:\.\d+)?)\s*(?:초|s)[^,]*(?:빠르게|faster)/i,
  )

  if (offset === null && fasterRange) {
    offset = -Math.round(
      (Number(fasterRange[1]) + Number(fasterRange[2])) / 2,
    )
  }

  const faster = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:초|s)[^,]*(?:빠르게|faster)/i,
  )

  if (offset === null && faster) {
    offset = -Number(faster[1])
  }

  const slower = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:초|s)[^,]*(?:느리게|slower)/i,
  )

  if (offset === null && slower) {
    offset = Number(slower[1])
  }

  if (hasThreshold && offset === null) {
    offset = 0
  }

  if (
    isRecoveryText(normalized) &&
    hasRunKeyword(normalized)
  ) {
    offset = offset ?? 120
  }

  if (
    /(?:easy jog|easy run|조깅)/i.test(normalized) &&
    offset === null
  ) {
    offset = 105
  }

  return {
    reference: has10k
      ? '10K'
      : hasThreshold
        ? 'TT30'
        : null,
    offset,
  }
}

function isPaceOnlyInstruction(text) {
  const normalized = normalizeTrainerText(text)

  if (!/(?:pace|페이스|threshold|역치|10\s*k)/i.test(normalized)) {
    return false
  }

  return (
    !parseDurationSeconds(normalized) &&
    !(
      parseDistanceMeters(normalized) &&
      /(?:run|running|러닝|달리기|조깅)/i.test(normalized)
    )
  )
}

function buildStepFromText(sectionTitle, text) {
  const normalized = normalizeTrainerText(text)
  const duration = parseDurationSeconds(normalized)
  const distanceMeters = parseDistanceMeters(normalized)
  const runStep = hasRunKeyword(normalized)
  const recovery = isRecoveryText(normalized)
  const rest = isRestText(normalized)
  const pace = getPaceInstruction(normalized)

  const section =
    recovery || rest
      ? 'RECOVERY'
      : sectionTitle || 'MAIN'

  if (
    !duration &&
    !distanceMeters &&
    !runStep &&
    !rest
  ) {
    return null
  }

  if (rest && !runStep && duration) {
    return {
      section,
      phase: normalized,
      time: duration,
      target: normalized,
      paceOffset: null,
      round: '',
      message: normalized,
      isRecovery: recovery,
      betweenSets: /(?:세트 사이|between sets?)/i.test(normalized),
    }
  }

  if (runStep) {
    const step = {
      section,
      phase: normalized,
      target: normalized,
      paceOffset: Number.isFinite(pace.offset)
        ? pace.offset
        : null,
      paceReference: pace.reference,
      round: '',
      message: normalized,
      isRecovery: recovery,
      betweenSets: /(?:세트 사이|between sets?)/i.test(normalized),
    }

    if (duration) step.time = duration

    if (distanceMeters) {
      step.distanceMeters = distanceMeters

      if (!Number.isFinite(step.paceOffset)) {
        step.manual = true
        step.manualLabel = `${distanceMeters}m`
      }
    }

    return step
  }

  return {
    section,
    phase: normalized,
    target: normalized,
    paceOffset: null,
    round: '',
    message: normalized,
    distanceMeters: distanceMeters || null,
    time: duration || null,
    manual: !duration,
    manualLabel: distanceMeters
      ? `${distanceMeters}m`
      : '완료 후 다음',
    isRecovery: recovery,
    betweenSets: /(?:세트 사이|between sets?)/i.test(normalized),
  }
}

function applyInstructionToPreviousStep(steps, text) {
  const normalized = normalizeTrainerText(text)

  const previousRun = [...steps]
    .reverse()
    .find(
      (step) =>
        step &&
        (Number.isFinite(step.time) ||
          Number.isFinite(step.distanceMeters)) &&
        hasRunKeyword(`${step.phase} ${step.target}`),
    )

  if (isPaceOnlyInstruction(normalized) && previousRun) {
    const pace = getPaceInstruction(normalized)

    if (Number.isFinite(pace.offset)) {
      previousRun.paceOffset = pace.offset

      if (previousRun.distanceMeters) {
        previousRun.manual = false
        delete previousRun.manualLabel
      }
    }

    previousRun.paceReference =
      pace.reference || previousRun.paceReference || null

    previousRun.target = `${previousRun.target} · ${normalized}`
    previousRun.message = `${previousRun.message} ${normalized}`
    return true
  }

  if (
    steps.length > 0 &&
    !parseDurationSeconds(normalized) &&
    !parseDistanceMeters(normalized)
  ) {
    const previous = steps[steps.length - 1]
    previous.message = `${previous.message} ${normalized}`
    return true
  }

  return false
}

function parseTrainerItemBlock(sectionTitle, items) {
  const steps = []

  ;(items || []).forEach((item) => {
    if (applyInstructionToPreviousStep(steps, item)) return

    const step = buildStepFromText(sectionTitle, item)
    if (step) steps.push(step)
  })

  return steps
}

function repeatTrainerSteps(sourceSteps, repeatCount, repeatKind) {
  const result = []

  for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
    sourceSteps.forEach((sourceStep, stepIndex) => {
      const isFinalRepeat = repeatIndex === repeatCount - 1
      const isTrailingRecovery =
        stepIndex === sourceSteps.length - 1 &&
        (sourceStep.betweenSets ||
          (repeatKind === 'SET' && sourceStep.isRecovery))

      if (isFinalRepeat && isTrailingRecovery) return

      result.push({
        ...sourceStep,
        round: `${repeatKind === 'SET' ? 'Set' : 'Round'} ${repeatIndex + 1}/${repeatCount}`,
      })
    })
  }

  return result
}

function parseTrainerSection(section) {
  const sectionTitle = normalizeTrainerText(
    section?.title || 'MAIN',
  )

  const items = expandInlineTrainerItems(section?.items)
  const steps = []
  let index = 0

  while (index < items.length) {
    const repeatMarker = parseRepeatMarker(items[index])

    if (!repeatMarker) {
      if (applyInstructionToPreviousStep(steps, items[index])) {
        index += 1
        continue
      }

      const step = buildStepFromText(sectionTitle, items[index])
      if (step) steps.push(step)
      index += 1
      continue
    }

    const blockItems = []
    index += 1

    while (index < items.length) {
      if (parseRepeatMarker(items[index])) break

      if (
        blockItems.length > 0 &&
        isStandaloneGroupBoundary(items[index])
      ) {
        break
      }

      blockItems.push(items[index])
      index += 1
    }

    const blockSteps = parseTrainerItemBlock(
      sectionTitle,
      blockItems,
    )

    steps.push(
      ...repeatTrainerSteps(
        blockSteps,
        repeatMarker.count,
        repeatMarker.kind,
      ),
    )

    if (
      index < items.length &&
      isStandaloneGroupBoundary(items[index])
    ) {
      const boundaryStep = buildStepFromText(
        sectionTitle,
        items[index],
      )

      if (boundaryStep) steps.push(boundaryStep)
      index += 1
    }
  }

  return steps
}

export function buildRunTrainerProgramFromSession(
  session,
  programKey = '',
) {
  const sections = Array.isArray(session?.sections)
    ? session.sections
    : []

  if (sections.length === 0) return null

  const steps = sections.flatMap(parseTrainerSection)
  if (steps.length === 0) return null

  const targetRpe = parseTargetRpe(session?.targetRpe)

  const resolvedKey =
    programKey ||
    session?.runTrainerKey ||
    session?.id ||
    session?.eventId ||
    'dynamic-run-trainer'

  return {
    key: resolvedKey,
    title: session?.title || 'Interval Training',
    buttonTitle: session?.title || 'INTERVAL',
    buttonSubtitle:
      session?.description ||
      session?.subtitle ||
      'Coach Program',
    targetRpeMin: targetRpe.min,
    targetRpeMax: targetRpe.max,
    description:
      '코치가 등록한 프로그램을 런트레이너가 자동으로 변환했습니다.',
    dynamic: true,
    steps,
  }
}

export function getRunTrainerProgram(
  programKey,
  session = null,
) {
  const registeredProgram =
    programKey
      ? runTrainerPrograms[
          programKey
        ] || null
      : null

  if (registeredProgram) {
    return registeredProgram
  }

  return buildRunTrainerProgramFromSession(
    session,
    programKey,
  )
}
