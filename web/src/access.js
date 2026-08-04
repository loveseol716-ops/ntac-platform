export const membershipOptions = [
  'NTAC RUN',
  'NTAC BUILD',
  'NTAC COMPLETE',
  'NTAC COMMUNITY',
]

export const accessByMembership = {
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

export function loadMemberSettings(memberId, defaults = {}) {
  try {
    const allSettings =
      JSON.parse(localStorage.getItem('ntac-member-settings')) || {}

    return {
      ...defaults,
      ...(allSettings[memberId] || {}),
    }
  } catch {
    return { ...defaults }
  }
}

export function saveMemberSettings(memberId, settings) {
  let allSettings = {}

  try {
    allSettings =
      JSON.parse(localStorage.getItem('ntac-member-settings')) || {}
  } catch {
    allSettings = {}
  }

  const updatedSettings = {
    ...allSettings,
    [memberId]: settings,
  }

  localStorage.setItem(
    'ntac-member-settings',
    JSON.stringify(updatedSettings),
  )

  return updatedSettings
}