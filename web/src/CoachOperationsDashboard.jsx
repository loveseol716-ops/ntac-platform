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
import {
  getReportStatusLabel,
  generateAthleteReport,
  loadAthleteReports,
  reviewAthleteReport,
  unpublishAthleteReport,
} from './data/weeklyAthleteReports.js'
import {
  getWeekTypeLabel,
  loadWeeklyProgramsFromSupabase,
} from './data/weeklyPrograms.js'

const MEMBERSHIPS = [
  'NTAC RUN',
  'NTAC BUILD',
  'NTAC COMPLETE',
  'NTAC ATHLETE',
  'NTAC COMMUNITY',
]

const emptyEditor = {
  title: '',
  subtitle: '',
  targetRpe: '',
  sections: [],
  coachNote: '',
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  return new Date(
    `${String(value).slice(0, 10)}T00:00:00`,
  ).toLocaleDateString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  })
}

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getMondayKey() {
  const now = new Date()
  const day = now.getDay()
  const offset = day === 0 ? -6 : 1 - day
  const monday = new Date(now)

  monday.setDate(
    now.getDate() + offset,
  )

  return getLocalDateKey(monday)
}

function getDaysAgo(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  return Math.max(
    0,
    Math.floor(
      (today.getTime() - date.getTime()) /
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

function hasPain(value) {
  const pain = String(value || '')
    .trim()
    .toLowerCase()

  if (!pain) {
    return false
  }

  return ![
    '없음',
    'none',
    'no',
    '0',
    '무',
  ].includes(pain)
}

function getWeekDates(week) {
  const dates = (week?.workouts || [])
    .map((workout) => workout.date)
    .filter(Boolean)
    .sort()

  return {
    start: dates[0] || '',
    end:
      dates[dates.length - 1] ||
      dates[0] ||
      '',
  }
}

function createSessions(week) {
  return (week?.workouts || []).map(
    (workout, index) => {
      const category = String(
        workout.category || 'TRAINING',
      ).toUpperCase()

      const sessionId =
        workout.sessionId ||
        workout.session_id ||
        `${String(
          week.weekId || '',
        ).toLowerCase()}-${category.toLowerCase()}-${index + 1}`

      const eventId =
        workout.eventId ||
        workout.event_id ||
        workout.id ||
        `${workout.date}-${sessionId}`

      return {
        ...workout,
        category,
        sessionId,
        eventId,
        weekKey: week.weekId,
        title:
          workout.title ||
          '제목 없는 프로그램',
        subtitle:
          workout.subtitle ||
          workout.description ||
          '',
        targetRpe:
          workout.targetRpe ||
          workout.target_rpe ||
          '',
        sections: Array.isArray(
          workout.sections,
        )
          ? workout.sections.map(
              (section, sectionIndex) => ({
                title:
                  section.title ||
                  `SECTION ${sectionIndex + 1}`,
                items: Array.isArray(
                  section.items,
                )
                  ? section.items.map(
                      (item) =>
                        typeof item === 'string'
                          ? item
                          : String(item),
                    )
                  : [],
              }),
            )
          : [],
      }
    },
  )
}

function editorFromSession(session) {
  if (!session) {
    return emptyEditor
  }

  return {
    title: session.title || '',
    subtitle: session.subtitle || '',
    targetRpe: session.targetRpe || '',
    sections: Array.isArray(
      session.sections,
    )
      ? session.sections.map(
          (section) => ({
            title: section.title || '',
            items: Array.isArray(
              section.items,
            )
              ? [...section.items]
              : [],
          }),
        )
      : [],
    coachNote: '',
  }
}

function editorFromOverride(
  session,
  row,
) {
  const common =
    editorFromSession(session)
  const overrideData =
    row?.override_data || {}

  return {
    title:
      overrideData.title !== undefined
        ? overrideData.title
        : common.title,
    subtitle:
      overrideData.subtitle !== undefined
        ? overrideData.subtitle
        : common.subtitle,
    targetRpe:
      overrideData.targetRpe !== undefined
        ? overrideData.targetRpe
        : common.targetRpe,
    sections: Array.isArray(
      overrideData.sections,
    )
      ? overrideData.sections.map(
          (section) => ({
            title: section.title || '',
            items: Array.isArray(
              section.items,
            )
              ? section.items.map(String)
              : [],
          }),
        )
      : common.sections,
    coachNote:
      row?.coach_note ||
      overrideData.coachNote ||
      '',
  }
}

function accessTone(state) {
  if (
    state.status === 'PAID' ||
    state.status === 'ADMIN'
  ) {
    return 'good'
  }

  if (state.status === 'TRIAL') {
    return 'trial'
  }

  if (
    state.status === 'LEGACY' ||
    state.status === 'OVERRIDE'
  ) {
    return 'warn'
  }

  return 'bad'
}

function CoachOperationsDashboard({
  refreshKey = 0,
  onDataChanged,
}) {
  const [members, setMembers] =
    useState([])
  const [checkins, setCheckins] =
    useState([])
  const [workouts, setWorkouts] =
    useState([])
  const [reportRows, setReportRows] =
    useState([])
  const [overrides, setOverrides] =
    useState([])
  const [weeks, setWeeks] =
    useState([])

  const [loading, setLoading] =
    useState(true)
  const [errorMessage, setErrorMessage] =
    useState('')
  const [reloadKey, setReloadKey] =
    useState(0)

  const [search, setSearch] =
    useState('')
  const [membershipFilter, setMembershipFilter] =
    useState('ALL')
  const [managementFilter, setManagementFilter] =
    useState('ALL')
  const [selectedMemberId, setSelectedMemberId] =
    useState('')

  const [selectedWeekId, setSelectedWeekId] =
    useState('')
  const [selectedEventId, setSelectedEventId] =
    useState('')

  const [quickForm, setQuickForm] =
    useState({
      membership: 'NTAC RUN',
      membershipStatus: 'active',
      coachName: '미배정',
      coachCare: false,
      paidUntil: '',
      trialEndsAt: '',
      overrideUntil: '',
    })
  const [quickSaving, setQuickSaving] =
    useState(false)

  const [editor, setEditor] =
    useState(emptyEditor)
  const [overrideId, setOverrideId] =
    useState(null)
  const [overrideLoading, setOverrideLoading] =
    useState(false)
  const [programSaving, setProgramSaving] =
    useState(false)

  const [memberReports, setMemberReports] =
    useState([])
  const [reportLoading, setReportLoading] =
    useState(false)
  const [reportActionLoading, setReportActionLoading] =
    useState(false)
  const [coachComment, setCoachComment] =
    useState('')

  useEffect(() => {
    let mounted = true

    const loadAll = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const [
          memberResult,
          checkinResult,
          workoutResult,
          reportResult,
          overrideResult,
          weeklyPrograms,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select(`
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
            `)
            .eq('role', 'member')
            .order('full_name', {
              ascending: true,
            }),
          supabase
            .from('daily_checkins')
            .select(`
              id,
              user_id,
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
            `)
            .order('checkin_date', {
              ascending: false,
            }),
          supabase
            .from('workout_records')
            .select(`
              id,
              user_id,
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
            `)
            .order('completed_at', {
              ascending: false,
            }),
          supabase
            .from('weekly_athlete_reports')
            .select(`
              id,
              user_id,
              week_key,
              analysis_status,
              coach_comment,
              reviewed_at,
              is_published,
              updated_at
            `),
          supabase
            .from('member_program_overrides')
            .select(`
              id,
              user_id,
              event_id,
              week_key,
              updated_at
            `),
          loadWeeklyProgramsFromSupabase(),
        ])

        if (!mounted) {
          return
        }

        const firstError =
          memberResult.error ||
          checkinResult.error ||
          workoutResult.error ||
          reportResult.error ||
          overrideResult.error

        if (firstError) {
          throw firstError
        }

        const nextMembers =
          memberResult.data || []
        const nextWeeks = [
          ...(weeklyPrograms || []),
        ].sort((first, second) => {
          const firstDates =
            getWeekDates(first)
          const secondDates =
            getWeekDates(second)

          return String(
            secondDates.start,
          ).localeCompare(
            String(firstDates.start),
          )
        })

        setMembers(nextMembers)
        setCheckins(
          checkinResult.data || [],
        )
        setWorkouts(
          workoutResult.data || [],
        )
        setReportRows(
          reportResult.data || [],
        )
        setOverrides(
          overrideResult.data || [],
        )
        setWeeks(nextWeeks)

        if (
          !selectedMemberId &&
          nextMembers.length > 0
        ) {
          setSelectedMemberId(
            nextMembers[0].id,
          )
        }

        const todayKey =
          getLocalDateKey()

        const currentWeek =
          nextWeeks.find((week) => {
            const range =
              getWeekDates(week)

            return (
              range.start &&
              range.end &&
              todayKey >= range.start &&
              todayKey <= range.end
            )
          }) ||
          nextWeeks.find(
            (week) => week.published,
          ) ||
          nextWeeks[0]

        if (
          !selectedWeekId &&
          currentWeek
        ) {
          setSelectedWeekId(
            currentWeek.weekId,
          )
        }
      } catch (error) {
        console.error(
          '운영 콘솔 조회 실패:',
          error,
        )

        if (mounted) {
          setErrorMessage(
            error.message ||
              '운영 콘솔을 불러오지 못했습니다.',
          )
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadAll()

    return () => {
      mounted = false
    }
  }, [refreshKey, reloadKey])

  const todayKey = getLocalDateKey()
  const mondayKey = getMondayKey()

  const currentWeek = useMemo(() => {
    return (
      weeks.find((week) => {
        const range = getWeekDates(week)

        return (
          range.start &&
          range.end &&
          todayKey >= range.start &&
          todayKey <= range.end
        )
      }) ||
      weeks.find(
        (week) => week.published,
      ) ||
      weeks[0] ||
      null
    )
  }, [weeks, todayKey])

  const rows = useMemo(() => {
    const checkinsByMember = new Map()
    const workoutsByMember = new Map()
    const reportsByMember = new Map()
    const overridesByMember = new Map()

    checkins.forEach((row) => {
      const list =
        checkinsByMember.get(
          row.user_id,
        ) || []
      list.push(row)
      checkinsByMember.set(
        row.user_id,
        list,
      )
    })

    workouts.forEach((row) => {
      const list =
        workoutsByMember.get(
          row.user_id,
        ) || []
      list.push(row)
      workoutsByMember.set(
        row.user_id,
        list,
      )
    })

    reportRows.forEach((row) => {
      const list =
        reportsByMember.get(
          row.user_id,
        ) || []
      list.push(row)
      reportsByMember.set(
        row.user_id,
        list,
      )
    })

    overrides.forEach((row) => {
      const list =
        overridesByMember.get(
          row.user_id,
        ) || []
      list.push(row)
      overridesByMember.set(
        row.user_id,
        list,
      )
    })

    return members.map((member) => {
      const memberCheckins =
        checkinsByMember.get(member.id) || []
      const memberWorkouts =
        workoutsByMember.get(member.id) || []
      const memberReportRows =
        reportsByMember.get(member.id) || []
      const memberOverrides =
        overridesByMember.get(member.id) || []

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

      const latestActivity = [
        checkinActivity,
        workoutActivity,
      ]
        .filter(Boolean)
        .sort(
          (first, second) =>
            new Date(second).getTime() -
            new Date(first).getTime(),
        )[0] || null

      const daysAgo =
        getDaysAgo(latestActivity)

      const weeklyCheckins =
        memberCheckins.filter(
          (row) =>
            row.checkin_date >= mondayKey,
        )

      const weeklyWorkouts =
        memberWorkouts.filter((row) => {
          const key =
            row.workout_date ||
            row.completed_at?.slice(0, 10) ||
            ''

          return key >= mondayKey
        })

      const rpes = weeklyWorkouts
        .map((row) => Number(row.rpe))
        .filter(Number.isFinite)

      const averageRpe =
        rpes.length > 0
          ? (
              rpes.reduce(
                (sum, value) =>
                  sum + value,
                0,
              ) / rpes.length
            ).toFixed(1)
          : '-'

      const currentReport =
        currentWeek
          ? memberReportRows.find(
              (report) =>
                report.week_key ===
                currentWeek.weekId,
            ) || null
          : null

      const accessState =
        getMemberAccessState(member)

      const reasons = []

      if (!accessState.allowed) {
        reasons.push('결제/이용기간 확인')
      } else if (accessState.needsDate) {
        reasons.push('이용기간 미설정')
      }

      if (
        daysAgo === null ||
        daysAgo > 7
      ) {
        reasons.push('7일 이상 활동 없음')
      }

      if (
        latestCheckin &&
        Number(
          latestCheckin.condition_score,
        ) <= 2
      ) {
        reasons.push('컨디션 저하')
      }

      if (
        latestCheckin &&
        hasPain(
          latestCheckin.pain_level,
        )
      ) {
        reasons.push('통증 체크인')
      }

      if (
        member.membership ===
          'NTAC ATHLETE' &&
        currentWeek &&
        (!currentReport ||
          !currentReport.reviewed_at)
      ) {
        reasons.push('주간 리포트 작성 필요')
      }

      return {
        ...member,
        accessState,
        latestCheckin,
        latestWorkout,
        lastActivity: latestActivity,
        daysAgo,
        weeklyCheckins:
          weeklyCheckins.length,
        weeklyWorkouts:
          weeklyWorkouts.length,
        averageRpe,
        currentReport,
        overrideCount:
          memberOverrides.length,
        reasons,
        needsAttention:
          reasons.length > 0,
      }
    })
  }, [
    members,
    checkins,
    workouts,
    reportRows,
    overrides,
    currentWeek,
    mondayKey,
  ])

  const filteredRows = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase()

    return rows.filter((row) => {
      const matchesSearch =
        !keyword ||
        String(
          row.full_name || '',
        )
          .toLowerCase()
          .includes(keyword) ||
        String(row.email || '')
          .toLowerCase()
          .includes(keyword)

      const matchesMembership =
        membershipFilter === 'ALL' ||
        row.membership ===
          membershipFilter

      let matchesManagement = true

      if (
        managementFilter ===
        'ATTENTION'
      ) {
        matchesManagement =
          row.needsAttention
      }

      if (
        managementFilter === 'ACTIVE'
      ) {
        matchesManagement =
          !row.needsAttention &&
          row.accessState.allowed
      }

      if (
        managementFilter === 'TRIAL'
      ) {
        matchesManagement =
          row.accessState.status ===
          'TRIAL'
      }

      if (
        managementFilter === 'EXPIRED'
      ) {
        matchesManagement =
          !row.accessState.allowed
      }

      return (
        matchesSearch &&
        matchesMembership &&
        matchesManagement
      )
    })
  }, [
    rows,
    search,
    membershipFilter,
    managementFilter,
  ])

  useEffect(() => {
    if (filteredRows.length === 0) {
      return
    }

    const exists = filteredRows.some(
      (row) =>
        row.id === selectedMemberId,
    )

    if (!exists) {
      setSelectedMemberId(
        filteredRows[0].id,
      )
    }
  }, [filteredRows, selectedMemberId])

  const selectedRow =
    rows.find(
      (row) =>
        row.id === selectedMemberId,
    ) || null

  useEffect(() => {
    if (!selectedRow) {
      return
    }

    setQuickForm({
      membership:
        selectedRow.membership ||
        'NTAC RUN',
      membershipStatus:
        selectedRow.membership_status ||
        'active',
      coachName:
        selectedRow.coach_name ||
        '미배정',
      coachCare: Boolean(
        selectedRow.coach_care,
      ),
      paidUntil:
        selectedRow.paid_until || '',
      trialEndsAt:
        selectedRow.trial_ends_at || '',
      overrideUntil:
        selectedRow.access_override_until ||
        '',
    })
  }, [selectedRow?.id])

  const selectedWeek =
    weeks.find(
      (week) =>
        week.weekId === selectedWeekId,
    ) || null

  const sessions = useMemo(
    () => createSessions(selectedWeek),
    [selectedWeek],
  )

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedEventId('')
      return
    }

    const exists = sessions.some(
      (session) =>
        session.eventId ===
        selectedEventId,
    )

    if (!exists) {
      setSelectedEventId(
        sessions[0].eventId,
      )
    }
  }, [sessions, selectedEventId])

  const selectedSession =
    sessions.find(
      (session) =>
        session.eventId ===
        selectedEventId,
    ) || null

  useEffect(() => {
    let mounted = true

    const loadOverride = async () => {
      if (
        !selectedMemberId ||
        !selectedSession ||
        !selectedRow?.coach_care
      ) {
        setOverrideId(null)
        setEditor(
          editorFromSession(
            selectedSession,
          ),
        )
        return
      }

      setOverrideLoading(true)

      const { data, error } =
        await supabase
          .from(
            'member_program_overrides',
          )
          .select(`
            id,
            override_data,
            coach_note
          `)
          .eq(
            'user_id',
            selectedMemberId,
          )
          .eq(
            'event_id',
            selectedSession.eventId,
          )
          .maybeSingle()

      if (!mounted) {
        return
      }

      if (error) {
        console.error(
          '개인 프로그램 조회 실패:',
          error,
        )
        setErrorMessage(
          error.message ||
            '개인 프로그램을 불러오지 못했습니다.',
        )
        setOverrideLoading(false)
        return
      }

      setOverrideId(data?.id || null)
      setEditor(
        data
          ? editorFromOverride(
              selectedSession,
              data,
            )
          : editorFromSession(
              selectedSession,
            ),
      )
      setOverrideLoading(false)
    }

    loadOverride()

    return () => {
      mounted = false
    }
  }, [
    selectedMemberId,
    selectedSession?.eventId,
    selectedRow?.coach_care,
  ])

  useEffect(() => {
    let mounted = true

    const loadReports = async () => {
      if (!selectedMemberId) {
        setMemberReports([])
        return
      }

      setReportLoading(true)

      try {
        const reports =
          await loadAthleteReports(
            selectedMemberId,
          )

        if (mounted) {
          setMemberReports(reports)
        }
      } catch (error) {
        console.error(
          '멤버 리포트 조회 실패:',
          error,
        )

        if (mounted) {
          setErrorMessage(
            error.message ||
              '리포트를 불러오지 못했습니다.',
          )
        }
      } finally {
        if (mounted) {
          setReportLoading(false)
        }
      }
    }

    loadReports()

    return () => {
      mounted = false
    }
  }, [selectedMemberId, reloadKey])

  const selectedReport =
    memberReports.find(
      (report) =>
        report.weekId === selectedWeekId,
    ) || null

  useEffect(() => {
    setCoachComment(
      selectedReport?.coachComment || '',
    )
  }, [selectedReport?.id])

  const summary = useMemo(() => {
    return {
      total: rows.length,
      athlete: rows.filter(
        (row) =>
          row.membership ===
          'NTAC ATHLETE',
      ).length,
      build: rows.filter(
        (row) =>
          row.membership ===
          'NTAC BUILD',
      ).length,
      trial: rows.filter(
        (row) =>
          row.accessState.status ===
          'TRIAL',
      ).length,
      attention: rows.filter(
        (row) => row.needsAttention,
      ).length,
      expired: rows.filter(
        (row) =>
          !row.accessState.allowed,
      ).length,
    }
  }, [rows])

  const saveQuickMember = async () => {
    if (!selectedMemberId) {
      return
    }

    setQuickSaving(true)
    setErrorMessage('')

    const { data, error } =
      await supabase
        .from('profiles')
        .update({
          membership:
            quickForm.membership,
          membership_status:
            quickForm.membershipStatus,
          coach_name:
            quickForm.coachName.trim() ||
            '미배정',
          coach_care:
            quickForm.membership ===
            'NTAC ATHLETE'
              ? true
              : Boolean(
                  quickForm.coachCare,
                ),
          paid_until:
            quickForm.paidUntil || null,
          trial_ends_at:
            quickForm.trialEndsAt || null,
          access_override_until:
            quickForm.overrideUntil ||
            null,
        })
        .eq('id', selectedMemberId)
        .select(`
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
        `)
        .single()

    if (error) {
      console.error(
        '빠른 멤버 저장 실패:',
        error,
      )
      setErrorMessage(error.message)
      alert(
        `저장에 실패했습니다.\n${error.message}`,
      )
      setQuickSaving(false)
      return
    }

    setMembers((current) =>
      current.map((member) =>
        member.id === data.id
          ? data
          : member,
      ),
    )

    setQuickSaving(false)
    onDataChanged?.()
    alert('멤버 정보가 저장되었습니다.')
  }

  const updateEditor = (
    key,
    value,
  ) => {
    setEditor((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const updateSection = (
    sectionIndex,
    nextSection,
  ) => {
    setEditor((current) => ({
      ...current,
      sections: current.sections.map(
        (section, index) =>
          index === sectionIndex
            ? nextSection
            : section,
      ),
    }))
  }

  const savePersonalProgram = async () => {
    if (
      !selectedMemberId ||
      !selectedSession ||
      !selectedRow?.coach_care
    ) {
      return
    }

    const title = editor.title.trim()
    const sections = editor.sections
      .map((section) => ({
        title:
          section.title.trim(),
        items: section.items
          .map((item) => item.trim())
          .filter(Boolean),
      }))
      .filter(
        (section) =>
          section.title &&
          section.items.length > 0,
      )

    if (!title) {
      alert('프로그램 제목을 입력해 주세요.')
      return
    }

    if (sections.length === 0) {
      alert(
        '최소 한 개 이상의 운동 섹션을 입력해 주세요.',
      )
      return
    }

    setProgramSaving(true)
    setErrorMessage('')

    try {
      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!userData.user) {
        throw new Error(
          '관리자 로그인 정보를 찾을 수 없습니다.',
        )
      }

      const { data, error } =
        await supabase
          .from(
            'member_program_overrides',
          )
          .upsert(
            {
              user_id:
                selectedMemberId,
              event_id:
                selectedSession.eventId,
              session_id:
                selectedSession.sessionId,
              week_key:
                selectedSession.weekKey,
              override_data: {
                personalizedProgram: true,
                title,
                subtitle:
                  editor.subtitle.trim(),
                targetRpe:
                  editor.targetRpe.trim(),
                sections,
              },
              coach_note:
                editor.coachNote.trim() ||
                null,
              created_by:
                userData.user.id,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                'user_id,event_id',
            },
          )
          .select('id')
          .single()

      if (error) {
        throw error
      }

      setOverrideId(data.id)
      setReloadKey(
        (current) => current + 1,
      )
      onDataChanged?.()
      alert(
        '개인 프로그램이 저장되었습니다.',
      )
    } catch (error) {
      console.error(
        '개인 프로그램 저장 실패:',
        error,
      )
      setErrorMessage(error.message)
      alert(
        `저장에 실패했습니다.\n${error.message}`,
      )
    } finally {
      setProgramSaving(false)
    }
  }

  const deletePersonalProgram = async () => {
    if (!overrideId) {
      return
    }

    const confirmed = window.confirm(
      '개인 프로그램을 삭제하고 공통 프로그램으로 되돌릴까요?',
    )

    if (!confirmed) {
      return
    }

    setProgramSaving(true)

    const { error } = await supabase
      .from('member_program_overrides')
      .delete()
      .eq('id', overrideId)

    if (error) {
      setErrorMessage(error.message)
      setProgramSaving(false)
      return
    }

    setOverrideId(null)
    setEditor(
      editorFromSession(
        selectedSession,
      ),
    )
    setReloadKey(
      (current) => current + 1,
    )
    onDataChanged?.()
    setProgramSaving(false)
  }

  const generateReport = async () => {
    if (
      !selectedMemberId ||
      !selectedWeek
    ) {
      return
    }

    setReportActionLoading(true)
    setErrorMessage('')

    try {
      const report =
        await generateAthleteReport({
          userId: selectedMemberId,
          week: selectedWeek,
        })

      setMemberReports((current) => {
        const others = current.filter(
          (item) =>
            item.weekId !== report.weekId,
        )

        return [report, ...others]
      })

      setCoachComment(
        report.coachComment || '',
      )
      setReloadKey(
        (current) => current + 1,
      )
      onDataChanged?.()
    } catch (error) {
      console.error(
        '리포트 생성 실패:',
        error,
      )
      setErrorMessage(error.message)
      alert(
        `리포트 생성에 실패했습니다.\n${error.message}`,
      )
    } finally {
      setReportActionLoading(false)
    }
  }

  const saveReportReview = async (
    publish,
  ) => {
    if (!selectedReport) {
      return
    }

    setReportActionLoading(true)
    setErrorMessage('')

    try {
      const report =
        await reviewAthleteReport({
          reportId: selectedReport.id,
          coachComment,
          publish,
        })

      setMemberReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? report
            : item,
        ),
      )
      setReloadKey(
        (current) => current + 1,
      )
      onDataChanged?.()
    } catch (error) {
      console.error(
        '리포트 저장 실패:',
        error,
      )
      setErrorMessage(error.message)
      alert(
        `리포트 저장에 실패했습니다.\n${error.message}`,
      )
    } finally {
      setReportActionLoading(false)
    }
  }

  const handleUnpublish = async () => {
    if (!selectedReport) {
      return
    }

    setReportActionLoading(true)

    try {
      const report =
        await unpublishAthleteReport(
          selectedReport.id,
        )

      setMemberReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? report
            : item,
        ),
      )
      setReloadKey(
        (current) => current + 1,
      )
      onDataChanged?.()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setReportActionLoading(false)
    }
  }

  if (loading) {
    return (
      <article className="feature-card">
        <h3>
          NTAC 운영 콘솔을 불러오는 중입니다.
        </h3>
        <p>
          멤버, 행동 데이터, 프로그램과 리포트를 연결하고 있어요.
        </p>
      </article>
    )
  }

  return (
    <section className="ntac-console">
      <style>{`
        .ntac-console {
          display: grid;
          gap: 18px;
          width: 100%;
          color: #17342a;
        }

        .ntac-console * {
          box-sizing: border-box;
        }

        .ntac-console-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
        }

        .ntac-console-head p,
        .ntac-console-card p {
          margin: 0;
        }

        .ntac-console-head small {
          color: #7b8782;
          font-weight: 700;
        }

        .ntac-console-summary {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
        }

        .ntac-console-summary article {
          padding: 16px;
          border: 1px solid #dbe4df;
          border-radius: 16px;
          background: #fff;
        }

        .ntac-console-summary span {
          display: block;
          color: #7a8681;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .ntac-console-summary strong {
          font-size: 23px;
          color: #0b3d2e;
        }

        .ntac-console-main {
          display: grid;
          grid-template-columns: minmax(620px, 1.15fr) minmax(480px, 0.85fr);
          gap: 16px;
          align-items: start;
        }

        .ntac-console-card {
          border: 1px solid #dbe4df;
          border-radius: 18px;
          background: #fff;
          overflow: hidden;
        }

        .ntac-console-toolbar {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 8px;
          padding: 14px;
          border-bottom: 1px solid #e5ebe8;
          background: #f8faf9;
        }

        .ntac-console input,
        .ntac-console select,
        .ntac-console textarea {
          width: 100%;
          border: 1px solid #cfd9d4;
          border-radius: 10px;
          background: #fff;
          color: #18372c;
          font: inherit;
        }

        .ntac-console input,
        .ntac-console select {
          min-height: 40px;
          padding: 0 10px;
        }

        .ntac-console textarea {
          padding: 10px;
          resize: vertical;
        }

        .ntac-console-table-wrap {
          overflow: auto;
          max-height: calc(100vh - 285px);
        }

        .ntac-console-table {
          width: 100%;
          min-width: 940px;
          border-collapse: collapse;
          font-size: 12px;
        }

        .ntac-console-table th {
          position: sticky;
          top: 0;
          z-index: 2;
          padding: 11px 9px;
          background: #eef3f0;
          color: #607069;
          text-align: left;
          font-size: 10px;
          letter-spacing: .04em;
        }

        .ntac-console-table td {
          padding: 11px 9px;
          border-top: 1px solid #edf1ef;
          vertical-align: middle;
        }

        .ntac-console-table tbody tr {
          cursor: pointer;
        }

        .ntac-console-table tbody tr:hover,
        .ntac-console-table tbody tr.selected {
          background: #eff6f2;
        }

        .ntac-console-name {
          display: grid;
          gap: 2px;
        }

        .ntac-console-name small {
          color: #8a9490;
        }

        .ntac-chip {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          min-height: 24px;
          padding: 4px 8px;
          border-radius: 999px;
          background: #edf2ef;
          color: #52625c;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }

        .ntac-chip.good { background: #dff5e9; color: #0b6b4f; }
        .ntac-chip.trial { background: #e6efff; color: #315f9c; }
        .ntac-chip.warn { background: #fff3cf; color: #7b5c00; }
        .ntac-chip.bad { background: #ffe7e3; color: #a83c33; }

        .ntac-console-detail {
          display: grid;
          gap: 12px;
          max-height: calc(100vh - 205px);
          overflow: auto;
          padding-right: 2px;
        }

        .ntac-detail-block {
          padding: 17px;
          border: 1px solid #dbe4df;
          border-radius: 18px;
          background: #fff;
        }

        .ntac-detail-block h3,
        .ntac-detail-block h4 {
          margin: 0;
        }

        .ntac-detail-head {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .ntac-detail-head p {
          margin: 0 0 4px;
          color: #0b6b4f;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .ntac-metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 7px;
          margin-top: 12px;
        }

        .ntac-metric-grid article {
          padding: 11px 9px;
          border-radius: 12px;
          background: #f4f7f5;
        }

        .ntac-metric-grid span {
          display: block;
          color: #7b8782;
          font-size: 9px;
          font-weight: 800;
          margin-bottom: 4px;
        }

        .ntac-metric-grid strong {
          color: #0b3d2e;
          font-size: 16px;
        }

        .ntac-action-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }

        .ntac-action-list span {
          padding: 6px 8px;
          border-radius: 9px;
          background: #fff0ed;
          color: #a33d34;
          font-size: 10px;
          font-weight: 800;
        }

        .ntac-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }

        .ntac-form-grid label,
        .ntac-stack label {
          display: grid;
          gap: 5px;
          color: #63716c;
          font-size: 10px;
          font-weight: 800;
        }

        .ntac-span-2 {
          grid-column: 1 / -1;
        }

        .ntac-button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 11px;
        }

        .ntac-button {
          min-height: 39px;
          padding: 9px 12px;
          border: none;
          border-radius: 10px;
          background: #0b3d2e;
          color: #fff;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .ntac-button.secondary {
          background: #edf2ef;
          color: #28463b;
        }

        .ntac-button.danger {
          background: #fff0ed;
          color: #a33d34;
        }

        .ntac-button:disabled {
          opacity: .48;
          cursor: not-allowed;
        }

        .ntac-stack {
          display: grid;
          gap: 10px;
        }

        .ntac-section-editor {
          display: grid;
          gap: 7px;
          padding: 10px;
          border: 1px solid #e0e7e3;
          border-radius: 12px;
          background: #fafcfb;
        }

        .ntac-section-item {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 6px;
        }

        .ntac-mini-button {
          border: none;
          border-radius: 8px;
          padding: 0 9px;
          background: #edf2ef;
          color: #445851;
          font-weight: 900;
          cursor: pointer;
        }

        .ntac-report-summary {
          padding: 12px;
          border-radius: 12px;
          background: #f3f7f5;
          color: #4e6059;
          font-size: 11px;
          line-height: 1.55;
        }

        .ntac-empty {
          padding: 18px;
          border-radius: 12px;
          background: #f5f7f6;
          color: #75817d;
          font-size: 12px;
          line-height: 1.5;
        }

        .ntac-console-error {
          padding: 12px;
          border-radius: 12px;
          background: #fff0ed;
          color: #a33d34;
          font-size: 11px;
          font-weight: 800;
        }

        @media (max-width: 1100px) {
          .ntac-console-summary { grid-template-columns: repeat(3, 1fr); }
          .ntac-console-main { grid-template-columns: 1fr; }
          .ntac-console-detail { max-height: none; }
          .ntac-console-table-wrap { max-height: 520px; }
        }
      `}</style>

      <div className="ntac-console-head">
        <div>
          <p
            style={{
              margin: 0,
              color: '#0b6b4f',
              fontSize: '10px',
              fontWeight: 900,
              letterSpacing: '.14em',
            }}
          >
            NTAC COACH CONSOLE
          </p>
          <h2
            style={{
              margin: '4px 0 2px',
              fontSize: '25px',
            }}
          >
            멤버 운영 대시보드
          </h2>
          <small>
            전체 멤버를 비교하고, 선택한 멤버의 프로그램·리포트·이용 상태를 한 화면에서 관리합니다.
          </small>
        </div>

        <button
          type="button"
          className="ntac-button secondary"
          onClick={() =>
            setReloadKey(
              (current) => current + 1,
            )
          }
        >
          새로고침
        </button>
      </div>

      {errorMessage && (
        <div className="ntac-console-error">
          {errorMessage}
        </div>
      )}

      <div className="ntac-console-summary">
        {[
          ['전체 멤버', summary.total],
          ['ATHLETE', summary.athlete],
          ['BUILD', summary.build],
          ['체험 중', summary.trial],
          ['관리 필요', summary.attention],
          ['결제 필요', summary.expired],
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="ntac-console-main">
        <section className="ntac-console-card">
          <div className="ntac-console-toolbar">
            <input
              type="search"
              placeholder="이름 또는 이메일 검색"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
            />

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
              {MEMBERSHIPS.map(
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

            <select
              value={managementFilter}
              onChange={(event) =>
                setManagementFilter(
                  event.target.value,
                )
              }
            >
              <option value="ALL">
                전체 상태
              </option>
              <option value="ATTENTION">
                관리 필요
              </option>
              <option value="ACTIVE">
                정상 관리
              </option>
              <option value="TRIAL">
                체험 중
              </option>
              <option value="EXPIRED">
                결제 필요
              </option>
            </select>
          </div>

          <div className="ntac-console-table-wrap">
            <table className="ntac-console-table">
              <thead>
                <tr>
                  <th>멤버</th>
                  <th>상품</th>
                  <th>이용</th>
                  <th>이번 주 운동</th>
                  <th>체크인</th>
                  <th>평균 RPE</th>
                  <th>최근 활동</th>
                  <th>리포트</th>
                  <th>개인화</th>
                  <th>관리</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map(
                  (row) => (
                    <tr
                      key={row.id}
                      className={
                        row.id ===
                        selectedMemberId
                          ? 'selected'
                          : ''
                      }
                      onClick={() =>
                        setSelectedMemberId(
                          row.id,
                        )
                      }
                    >
                      <td>
                        <div className="ntac-console-name">
                          <strong>
                            {row.full_name ||
                              row.email}
                          </strong>
                          <small>
                            {row.coach_name ||
                              '미배정'}
                          </small>
                        </div>
                      </td>
                      <td>{row.membership}</td>
                      <td>
                        <span
                          className={`ntac-chip ${accessTone(
                            row.accessState,
                          )}`}
                        >
                          {row.accessState.label}
                        </span>
                      </td>
                      <td>
                        {row.weeklyWorkouts}회
                      </td>
                      <td>
                        {row.weeklyCheckins}회
                      </td>
                      <td>{row.averageRpe}</td>
                      <td>
                        {getActivityLabel(
                          row.daysAgo,
                        )}
                      </td>
                      <td>
                        {row.membership ===
                        'NTAC ATHLETE'
                          ? row.currentReport
                            ? row.currentReport
                                .reviewed_at
                              ? row.currentReport
                                  .is_published
                                ? '공개 완료'
                                : '검토 완료'
                              : '작성 필요'
                            : '미생성'
                          : '-'}
                      </td>
                      <td>
                        {row.overrideCount}개
                      </td>
                      <td>
                        <span
                          className={`ntac-chip ${
                            row.needsAttention
                              ? 'bad'
                              : 'good'
                          }`}
                        >
                          {row.needsAttention
                            ? 'ACTION'
                            : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>

            {filteredRows.length === 0 && (
              <div className="ntac-empty">
                현재 필터 조건에 맞는 멤버가 없습니다.
              </div>
            )}
          </div>
        </section>

        <aside className="ntac-console-detail">
          {!selectedRow ? (
            <div className="ntac-empty">
              왼쪽 목록에서 관리할 멤버를 선택해 주세요.
            </div>
          ) : (
            <>
              <section className="ntac-detail-block">
                <div className="ntac-detail-head">
                  <div>
                    <p>SELECTED MEMBER</p>
                    <h3>
                      {selectedRow.full_name ||
                        selectedRow.email}
                    </h3>
                    <span
                      style={{
                        color: '#718079',
                        fontSize: '11px',
                      }}
                    >
                      {selectedRow.membership}
                      {' · '}
                      {selectedRow.coach_name ||
                        '미배정'}
                    </span>
                  </div>

                  <span
                    className={`ntac-chip ${accessTone(
                      selectedRow.accessState,
                    )}`}
                  >
                    {selectedRow.accessState.label}
                  </span>
                </div>

                <div className="ntac-metric-grid">
                  <article>
                    <span>이번 주 운동</span>
                    <strong>
                      {selectedRow.weeklyWorkouts}
                    </strong>
                  </article>
                  <article>
                    <span>체크인</span>
                    <strong>
                      {selectedRow.weeklyCheckins}
                    </strong>
                  </article>
                  <article>
                    <span>평균 RPE</span>
                    <strong>
                      {selectedRow.averageRpe}
                    </strong>
                  </article>
                  <article>
                    <span>최근 활동</span>
                    <strong
                      style={{
                        fontSize: '12px',
                      }}
                    >
                      {getActivityLabel(
                        selectedRow.daysAgo,
                      )}
                    </strong>
                  </article>
                </div>

                {selectedRow.reasons.length >
                  0 && (
                  <div className="ntac-action-list">
                    {selectedRow.reasons.map(
                      (reason) => (
                        <span key={reason}>
                          {reason}
                        </span>
                      ),
                    )}
                  </div>
                )}
              </section>

              <section className="ntac-detail-block">
                <div className="ntac-detail-head">
                  <div>
                    <p>MEMBERSHIP</p>
                    <h4>
                      상품 · 결제 빠른 관리
                    </h4>
                  </div>
                </div>

                <div className="ntac-form-grid">
                  <label>
                    이용 상품
                    <select
                      value={
                        quickForm.membership
                      }
                      onChange={(event) =>
                        setQuickForm(
                          (current) => ({
                            ...current,
                            membership:
                              event.target
                                .value,
                            coachCare:
                              event.target
                                .value ===
                              'NTAC ATHLETE'
                                ? true
                                : current.coachCare,
                          }),
                        )
                      }
                    >
                      {MEMBERSHIPS.map(
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

                  <label>
                    멤버십 상태
                    <select
                      value={
                        quickForm.membershipStatus
                      }
                      onChange={(event) =>
                        setQuickForm(
                          (current) => ({
                            ...current,
                            membershipStatus:
                              event.target
                                .value,
                          }),
                        )
                      }
                    >
                      <option value="active">
                        이용 중
                      </option>
                      <option value="paused">
                        일시정지
                      </option>
                      <option value="expired">
                        만료
                      </option>
                    </select>
                  </label>

                  <label>
                    담당 코치
                    <input
                      value={
                        quickForm.coachName
                      }
                      onChange={(event) =>
                        setQuickForm(
                          (current) => ({
                            ...current,
                            coachName:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label>
                    유료 이용 종료일
                    <input
                      type="date"
                      value={
                        quickForm.paidUntil
                      }
                      onChange={(event) =>
                        setQuickForm(
                          (current) => ({
                            ...current,
                            paidUntil:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label>
                    무료 체험 종료일
                    <input
                      type="date"
                      value={
                        quickForm.trialEndsAt
                      }
                      onChange={(event) =>
                        setQuickForm(
                          (current) => ({
                            ...current,
                            trialEndsAt:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label>
                    임시 연장 종료일
                    <input
                      type="date"
                      value={
                        quickForm.overrideUntil
                      }
                      onChange={(event) =>
                        setQuickForm(
                          (current) => ({
                            ...current,
                            overrideUntil:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>
                </div>

                <div
                  style={{
                    marginTop: '9px',
                    color: '#7c8883',
                    fontSize: '10px',
                  }}
                >
                  현재 이용 종료:{' '}
                  {formatAccessDate(
                    selectedRow.accessState
                      .until,
                  )}
                </div>

                <div className="ntac-button-row">
                  <button
                    type="button"
                    className="ntac-button"
                    disabled={quickSaving}
                    onClick={saveQuickMember}
                  >
                    {quickSaving
                      ? '저장 중...'
                      : '멤버 정보 저장'}
                  </button>
                </div>
              </section>

              <section className="ntac-detail-block">
                <div className="ntac-detail-head">
                  <div>
                    <p>COACH CARE</p>
                    <h4>
                      개인 프로그램 편집
                    </h4>
                  </div>

                  <span
                    className={`ntac-chip ${
                      overrideId
                        ? 'good'
                        : 'warn'
                    }`}
                  >
                    {overrideId
                      ? '개인화 적용 중'
                      : '공통 프로그램'}
                  </span>
                </div>

                {!selectedRow.coach_care ? (
                  <div className="ntac-empty">
                    COACH CARE가 활성화된 멤버에게만 개인 프로그램을 적용합니다. 위의 상품/멤버 관리에서 ATHLETE 또는 COACH CARE 상태를 먼저 확인해 주세요.
                  </div>
                ) : weeks.length === 0 ? (
                  <div className="ntac-empty">
                    등록된 주간 프로그램이 없습니다.
                  </div>
                ) : (
                  <div className="ntac-stack">
                    <div className="ntac-form-grid">
                      <label>
                        주차
                        <select
                          value={selectedWeekId}
                          onChange={(event) =>
                            setSelectedWeekId(
                              event.target
                                .value,
                            )
                          }
                        >
                          {weeks.map((week) => (
                            <option
                              key={week.weekId}
                              value={week.weekId}
                            >
                              {week.label}
                              {' · '}
                              {week.published
                                ? '공개'
                                : '임시저장'}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        운동
                        <select
                          value={selectedEventId}
                          onChange={(event) =>
                            setSelectedEventId(
                              event.target
                                .value,
                            )
                          }
                        >
                          {sessions.map(
                            (session) => (
                              <option
                                key={
                                  session.eventId
                                }
                                value={
                                  session.eventId
                                }
                              >
                                {session.date}
                                {' · '}
                                {session.category}
                                {' · '}
                                {session.title}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>

                    {overrideLoading ? (
                      <div className="ntac-empty">
                        개인 프로그램을 불러오는 중입니다.
                      </div>
                    ) : selectedSession ? (
                      <>
                        <label>
                          프로그램 제목
                          <input
                            value={editor.title}
                            onChange={(event) =>
                              updateEditor(
                                'title',
                                event.target
                                  .value,
                              )
                            }
                          />
                        </label>

                        <label>
                          프로그램 설명
                          <textarea
                            rows="2"
                            value={
                              editor.subtitle
                            }
                            onChange={(event) =>
                              updateEditor(
                                'subtitle',
                                event.target
                                  .value,
                              )
                            }
                          />
                        </label>

                        <div className="ntac-form-grid">
                          <label>
                            목표 RPE
                            <input
                              value={
                                editor.targetRpe
                              }
                              onChange={(event) =>
                                updateEditor(
                                  'targetRpe',
                                  event.target
                                    .value,
                                )
                              }
                            />
                          </label>

                          <label>
                            Coach Note
                            <input
                              value={
                                editor.coachNote
                              }
                              onChange={(event) =>
                                updateEditor(
                                  'coachNote',
                                  event.target
                                    .value,
                                )
                              }
                            />
                          </label>
                        </div>

                        {editor.sections.map(
                          (
                            section,
                            sectionIndex,
                          ) => (
                            <div
                              className="ntac-section-editor"
                              key={`section-${sectionIndex}`}
                            >
                              <div className="ntac-section-item">
                                <input
                                  value={
                                    section.title
                                  }
                                  placeholder="SECTION TITLE"
                                  onChange={(event) =>
                                    updateSection(
                                      sectionIndex,
                                      {
                                        ...section,
                                        title:
                                          event
                                            .target
                                            .value,
                                      },
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  className="ntac-mini-button"
                                  onClick={() =>
                                    setEditor(
                                      (current) => ({
                                        ...current,
                                        sections:
                                          current.sections.filter(
                                            (
                                              _,
                                              index,
                                            ) =>
                                              index !==
                                              sectionIndex,
                                          ),
                                      }),
                                    )
                                  }
                                >
                                  삭제
                                </button>
                              </div>

                              {section.items.map(
                                (
                                  item,
                                  itemIndex,
                                ) => (
                                  <div
                                    className="ntac-section-item"
                                    key={`item-${sectionIndex}-${itemIndex}`}
                                  >
                                    <input
                                      value={item}
                                      onChange={(event) =>
                                        updateSection(
                                          sectionIndex,
                                          {
                                            ...section,
                                            items:
                                              section.items.map(
                                                (
                                                  currentItem,
                                                  index,
                                                ) =>
                                                  index ===
                                                  itemIndex
                                                    ? event
                                                        .target
                                                        .value
                                                    : currentItem,
                                              ),
                                          },
                                        )
                                      }
                                    />
                                    <button
                                      type="button"
                                      className="ntac-mini-button"
                                      onClick={() =>
                                        updateSection(
                                          sectionIndex,
                                          {
                                            ...section,
                                            items:
                                              section.items.filter(
                                                (
                                                  _,
                                                  index,
                                                ) =>
                                                  index !==
                                                  itemIndex,
                                              ),
                                          },
                                        )
                                      }
                                    >
                                      −
                                    </button>
                                  </div>
                                ),
                              )}

                              <button
                                type="button"
                                className="ntac-button secondary"
                                onClick={() =>
                                  updateSection(
                                    sectionIndex,
                                    {
                                      ...section,
                                      items: [
                                        ...section.items,
                                        '',
                                      ],
                                    },
                                  )
                                }
                              >
                                운동 항목 추가
                              </button>
                            </div>
                          ),
                        )}

                        <div className="ntac-button-row">
                          <button
                            type="button"
                            className="ntac-button secondary"
                            onClick={() =>
                              setEditor(
                                (current) => ({
                                  ...current,
                                  sections: [
                                    ...current.sections,
                                    {
                                      title: 'MAIN',
                                      items: [''],
                                    },
                                  ],
                                }),
                              )
                            }
                          >
                            섹션 추가
                          </button>

                          <button
                            type="button"
                            className="ntac-button secondary"
                            onClick={() =>
                              setEditor(
                                editorFromSession(
                                  selectedSession,
                                ),
                              )
                            }
                          >
                            공통 내용 불러오기
                          </button>

                          <button
                            type="button"
                            className="ntac-button"
                            disabled={programSaving}
                            onClick={savePersonalProgram}
                          >
                            {programSaving
                              ? '저장 중...'
                              : '개인 프로그램 저장'}
                          </button>

                          {overrideId && (
                            <button
                              type="button"
                              className="ntac-button danger"
                              disabled={programSaving}
                              onClick={deletePersonalProgram}
                            >
                              개인화 해제
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="ntac-empty">
                        선택한 주차에 운동이 없습니다.
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="ntac-detail-block">
                <div className="ntac-detail-head">
                  <div>
                    <p>ATHLETE REPORT</p>
                    <h4>
                      주간 리포트 관리
                    </h4>
                  </div>

                  {selectedReport && (
                    <span
                      className={`ntac-chip ${
                        selectedReport.isPublished
                          ? 'good'
                          : 'warn'
                      }`}
                    >
                      {selectedReport.isPublished
                        ? '멤버 공개 완료'
                        : '내부 검토'}
                    </span>
                  )}
                </div>

                {selectedRow.membership !==
                'NTAC ATHLETE' ? (
                  <div className="ntac-empty">
                    주간 코치 리포트는 NTAC ATHLETE 멤버에게 제공됩니다.
                  </div>
                ) : (
                  <div className="ntac-stack">
                    <label>
                      리포트 주차
                      <select
                        value={selectedWeekId}
                        onChange={(event) =>
                          setSelectedWeekId(
                            event.target.value,
                          )
                        }
                      >
                        {weeks.map((week) => (
                          <option
                            key={week.weekId}
                            value={week.weekId}
                          >
                            {week.label}
                            {' · '}
                            {getWeekTypeLabel(
                              week.weekType,
                            )}
                          </option>
                        ))}
                      </select>
                    </label>

                    {reportLoading ? (
                      <div className="ntac-empty">
                        리포트를 불러오는 중입니다.
                      </div>
                    ) : selectedReport ? (
                      <>
                        <div className="ntac-metric-grid">
                          <article>
                            <span>수행</span>
                            <strong>
                              {selectedReport.completedSessions}
                              {' / '}
                              {selectedReport.plannedSessions}
                            </strong>
                          </article>
                          <article>
                            <span>목표 RPE</span>
                            <strong>
                              {selectedReport.expectedRpeAverage ?? '-'}
                            </strong>
                          </article>
                          <article>
                            <span>실제 RPE</span>
                            <strong>
                              {selectedReport.actualRpeAverage ?? '-'}
                            </strong>
                          </article>
                          <article>
                            <span>체크인</span>
                            <strong>
                              {selectedReport.checkinDays}
                            </strong>
                          </article>
                        </div>

                        <span
                          className="ntac-chip"
                          style={{
                            marginTop: '3px',
                          }}
                        >
                          {getReportStatusLabel(
                            selectedReport.status,
                          )}
                        </span>

                        <div className="ntac-report-summary">
                          {selectedReport.summary ||
                            '자동 분석 요약이 없습니다.'}
                        </div>

                        <div className="ntac-form-grid">
                          <label>
                            평균 컨디션
                            <input
                              readOnly
                              value={
                                selectedReport.averageCondition ?? '-'
                              }
                            />
                          </label>
                          <label>
                            평균 수면
                            <input
                              readOnly
                              value={
                                selectedReport.averageSleep ?? '-'
                              }
                            />
                          </label>
                        </div>

                        {selectedReport.painDetected && (
                          <div className="ntac-console-error">
                            이번 주 체크인에서 통증 신호가 감지되었습니다.
                          </div>
                        )}

                        <label>
                          코치 코멘트
                          <textarea
                            rows="5"
                            placeholder="이번 주 수행에 대한 코치 피드백과 다음 훈련 방향을 작성해 주세요."
                            value={coachComment}
                            onChange={(event) =>
                              setCoachComment(
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        <div
                          style={{
                            color: '#81908a',
                            fontSize: '10px',
                          }}
                        >
                          마지막 업데이트: {' '}
                          {formatDateTime(
                            selectedReport.updatedAt,
                          )}
                        </div>

                        <div className="ntac-button-row">
                          <button
                            type="button"
                            className="ntac-button secondary"
                            disabled={reportActionLoading}
                            onClick={generateReport}
                          >
                            다시 분석
                          </button>

                          <button
                            type="button"
                            className="ntac-button"
                            disabled={reportActionLoading}
                            onClick={() =>
                              saveReportReview(
                                Boolean(
                                  selectedReport.isPublished,
                                ),
                              )
                            }
                          >
                            코멘트 저장
                          </button>

                          {!selectedReport.isPublished ? (
                            <button
                              type="button"
                              className="ntac-button"
                              disabled={reportActionLoading}
                              onClick={() =>
                                saveReportReview(true)
                              }
                            >
                              멤버에게 공개
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ntac-button danger"
                              disabled={reportActionLoading}
                              onClick={handleUnpublish}
                            >
                              공개 취소
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ntac-empty">
                          선택한 주차의 리포트가 아직 생성되지 않았습니다.
                        </div>
                        <div className="ntac-button-row">
                          <button
                            type="button"
                            className="ntac-button"
                            disabled={reportActionLoading}
                            onClick={generateReport}
                          >
                            {reportActionLoading
                              ? '분석 중...'
                              : '주간 리포트 생성'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </aside>
      </div>
    </section>
  )
}

export default CoachOperationsDashboard
