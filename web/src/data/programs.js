import {
  getPublishedWorkouts,
} from './weeklyPrograms'

const publishedWorkouts =
  getPublishedWorkouts()

function createSessions(category) {
  return publishedWorkouts
    .filter(
      (workout) =>
        workout.category === category,
    )
    .map((workout) => ({
      id: workout.sessionId,
      type:
        workout.sessionType ||
        workout.category,
      title: workout.title,
      subtitle:
        workout.subtitle ||
        workout.description,
      targetRpe: workout.targetRpe,
      sections: workout.sections || [],
    }))
}

export const programs = {
  run: {
    eyebrow: 'RUN PROGRAM',
    title: '주간 러닝 프로그램',
    description:
      '이번 주 공개된 러닝 프로그램',
    sessions: createSessions('RUN'),
  },

  build: {
    eyebrow: 'BUILD PROGRAM',
    title: '하이록스 보강 프로그램',
    description:
      '이번 주 공개된 하이록스 보강 프로그램',
    sessions: createSessions('BUILD'),
  },
}

const memberOverrides = {
  'seol-jaehyun': {
    'run-interval-1': {
      targetPace: '4:10–4:15/km',
      treadmillSpeed: '14.1–14.4km/h',
      targetRpe: '8–9',
      coachNote:
        '마지막 2세트까지 동일한 자세와 속도를 유지하세요.',
    },

    'run-zone2-1': {
      targetPace: '개인 Zone 2 페이스',
      treadmillSpeed: '심박수 기준으로 조절',
      targetRpe: '3–4',
      coachNote:
        '속도보다 호흡과 심박수 유지가 우선입니다.',
    },

    'build-sled-1': {
      targetLoad: '현재 수행 가능한 무게 기준',
      targetRpe: '7–8',
      coachNote:
        '슬레드 푸시에서 상체 각도와 짧은 보폭을 유지하세요.',
    },
  },
}

function loadJson(key, fallback) {
  try {
    const savedValue =
      localStorage.getItem(key)

    return savedValue
      ? JSON.parse(savedValue)
      : fallback
  } catch {
    return fallback
  }
}

export function getPersonalizedSession(
  session,
  memberId,
) {
  const savedOverrides = loadJson(
    'ntac-member-overrides',
    {},
  )

  const defaultOverride =
    memberOverrides[memberId]?.[
      session.id
    ] || {}

  const savedOverride =
    savedOverrides[memberId]?.[
      session.id
    ] || {}

  const override = {
    ...defaultOverride,
    ...savedOverride,
  }

  return {
    ...session,
    ...override,

    sections:
      savedOverride.sections ||
      defaultOverride.sections ||
      session.sections,

    isPersonalized:
      Object.keys(override).length > 0,
  }
}