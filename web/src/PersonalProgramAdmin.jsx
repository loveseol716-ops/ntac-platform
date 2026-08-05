import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'

const emptyEditor = {
  title: '',
  subtitle: '',
  targetRpe: '',
  sections: [],
  coachNote: '',
}

function getProgramWorkouts(programData) {
  if (Array.isArray(programData)) {
    return programData
  }

  if (
    Array.isArray(
      programData?.workouts,
    )
  ) {
    return programData.workouts
  }

  return []
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) {
    return []
  }

  return sections.map(
    (section, index) => ({
      title:
        section.title ||
        `SECTION ${index + 1}`,

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
}

function createSession(
  week,
  workout,
  index,
) {
  const category =
    workout.category?.toUpperCase() ||
    'TRAINING'

  const sessionId =
    workout.sessionId ||
    workout.session_id ||
    `${week.week_key}-${category}-${index + 1}`

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

    weekKey: week.week_key,

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

    sections:
      normalizeSections(
        workout.sections,
      ),
  }
}

function createEditorFromSession(
  session,
) {
  if (!session) {
    return emptyEditor
  }

  return {
    title: session.title || '',

    subtitle:
      session.subtitle || '',

    targetRpe:
      session.targetRpe || '',

    sections:
      normalizeSections(
        session.sections,
      ),

    coachNote: '',
  }
}

function createEditorFromOverride(
  session,
  row,
) {
  const commonProgram =
    createEditorFromSession(
      session,
    )

  const overrideData =
    row?.override_data || {}

  return {
    title:
      overrideData.title !==
      undefined
        ? overrideData.title
        : commonProgram.title,

    subtitle:
      overrideData.subtitle !==
      undefined
        ? overrideData.subtitle
        : commonProgram.subtitle,

    targetRpe:
      overrideData.targetRpe !==
      undefined
        ? overrideData.targetRpe
        : commonProgram.targetRpe,

    sections:
      Array.isArray(
        overrideData.sections,
      )
        ? normalizeSections(
            overrideData.sections,
          )
        : commonProgram.sections,

    coachNote:
      row?.coach_note ||
      overrideData.coachNote ||
      '',
  }
}

function PersonalProgramAdmin() {
  const [members, setMembers] =
    useState([])

  const [weeks, setWeeks] =
    useState([])

  const [
    selectedMemberId,
    setSelectedMemberId,
  ] = useState('')

  const [
    selectedWeekKey,
    setSelectedWeekKey,
  ] = useState('')

  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState('')

  const [editor, setEditor] =
    useState(emptyEditor)

  const [
    currentOverrideId,
    setCurrentOverrideId,
  ] = useState(null)

  const [loading, setLoading] =
    useState(true)

  const [
    overrideLoading,
    setOverrideLoading,
  ] = useState(false)

  const [saving, setSaving] =
    useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const selectedWeek =
    weeks.find(
      (week) =>
        week.week_key ===
        selectedWeekKey,
    ) || null

  const sessions = useMemo(() => {
    if (!selectedWeek) {
      return []
    }

    return getProgramWorkouts(
      selectedWeek.program_data,
    ).map((workout, index) =>
      createSession(
        selectedWeek,
        workout,
        index,
      ),
    )
  }, [selectedWeek])

  const selectedSession =
    sessions.find(
      (session) =>
        session.eventId ===
        selectedEventId,
    ) || null

  const selectedMember =
    members.find(
      (member) =>
        member.id ===
        selectedMemberId,
    ) || null

  useEffect(() => {
    let isMounted = true

    const loadInitialData =
      async () => {
        setLoading(true)
        setErrorMessage('')

        const [
          membersResult,
          weeksResult,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select(
              `
                id,
                email,
                full_name,
                membership,
                coach_care,
                membership_status
              `,
            )
            .neq('role', 'admin')
            .eq('coach_care', true)
            .eq(
              'membership_status',
              'active',
            )
            .order('full_name', {
              ascending: true,
            }),

          supabase
            .from('weekly_programs')
            .select(
              `
                week_key,
                title,
                start_date,
                end_date,
                status,
                program_data
              `,
            )
            .order('start_date', {
              ascending: false,
            }),
        ])

        if (!isMounted) {
          return
        }

        if (membersResult.error) {
          console.error(
            'COACH CARE 멤버 조회 실패:',
            membersResult.error,
          )

          setErrorMessage(
            membersResult.error.message,
          )
        }

        if (weeksResult.error) {
          console.error(
            '프로그램 조회 실패:',
            weeksResult.error,
          )

          setErrorMessage(
            weeksResult.error.message,
          )
        }

        const nextMembers =
          membersResult.data || []

        const nextWeeks =
          weeksResult.data || []

        setMembers(nextMembers)
        setWeeks(nextWeeks)

        if (nextMembers.length > 0) {
          setSelectedMemberId(
            nextMembers[0].id,
          )
        }

        if (nextWeeks.length > 0) {
          setSelectedWeekKey(
            nextWeeks[0].week_key,
          )
        }

        setLoading(false)
      }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedEventId('')
      return
    }

    const selectedExists =
      sessions.some(
        (session) =>
          session.eventId ===
          selectedEventId,
      )

    if (!selectedExists) {
      setSelectedEventId(
        sessions[0].eventId,
      )
    }
  }, [
    sessions,
    selectedEventId,
  ])

  useEffect(() => {
    let isMounted = true

    const loadOverride = async () => {
      if (
        !selectedMemberId ||
        !selectedSession
      ) {
        setEditor(emptyEditor)
        setCurrentOverrideId(null)
        return
      }

      setOverrideLoading(true)
      setErrorMessage('')

      const {
        data,
        error,
      } = await supabase
        .from(
          'member_program_overrides',
        )
        .select(
          `
            id,
            override_data,
            coach_note
          `,
        )
        .eq(
          'user_id',
          selectedMemberId,
        )
        .eq(
          'event_id',
          selectedSession.eventId,
        )
        .maybeSingle()

      if (!isMounted) {
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

      setCurrentOverrideId(
        data?.id || null,
      )

      setEditor(
        data
          ? createEditorFromOverride(
              selectedSession,
              data,
            )
          : createEditorFromSession(
              selectedSession,
            ),
      )

      setOverrideLoading(false)
    }

    loadOverride()

    return () => {
      isMounted = false
    }
  }, [
    selectedMemberId,
    selectedSession,
  ])

  const updateEditor = (
    name,
    value,
  ) => {
    setEditor((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const addSection = () => {
    setEditor((current) => ({
      ...current,

      sections: [
        ...current.sections,
        {
          title: 'MAIN',
          items: [''],
        },
      ],
    }))
  }

  const updateSectionTitle = (
    sectionIndex,
    value,
  ) => {
    setEditor((current) => ({
      ...current,

      sections: current.sections.map(
        (section, index) =>
          index === sectionIndex
            ? {
                ...section,
                title: value,
              }
            : section,
      ),
    }))
  }

  const removeSection = (
    sectionIndex,
  ) => {
    setEditor((current) => ({
      ...current,

      sections:
        current.sections.filter(
          (_, index) =>
            index !== sectionIndex,
        ),
    }))
  }

  const addSectionItem = (
    sectionIndex,
  ) => {
    setEditor((current) => ({
      ...current,

      sections: current.sections.map(
        (section, index) =>
          index === sectionIndex
            ? {
                ...section,

                items: [
                  ...section.items,
                  '',
                ],
              }
            : section,
      ),
    }))
  }

  const updateSectionItem = (
    sectionIndex,
    itemIndex,
    value,
  ) => {
    setEditor((current) => ({
      ...current,

      sections: current.sections.map(
        (section, index) =>
          index === sectionIndex
            ? {
                ...section,

                items:
                  section.items.map(
                    (
                      item,
                      currentItemIndex,
                    ) =>
                      currentItemIndex ===
                      itemIndex
                        ? value
                        : item,
                  ),
              }
            : section,
      ),
    }))
  }

  const removeSectionItem = (
    sectionIndex,
    itemIndex,
  ) => {
    setEditor((current) => ({
      ...current,

      sections: current.sections.map(
        (section, index) =>
          index === sectionIndex
            ? {
                ...section,

                items:
                  section.items.filter(
                    (
                      _,
                      currentItemIndex,
                    ) =>
                      currentItemIndex !==
                      itemIndex,
                  ),
              }
            : section,
      ),
    }))
  }

  const loadCommonProgram = () => {
    if (!selectedSession) {
      return
    }

    setEditor(
      createEditorFromSession(
        selectedSession,
      ),
    )
  }

  const savePersonalProgram =
    async (event) => {
      event.preventDefault()

      if (
        !selectedMemberId ||
        !selectedSession ||
        saving
      ) {
        return
      }

      if (!editor.title.trim()) {
        alert(
          '프로그램 제목을 입력해 주세요.',
        )
        return
      }

      const sections =
        editor.sections
          .map((section) => ({
            title:
              section.title.trim(),

            items: section.items
              .map((item) =>
                item.trim(),
              )
              .filter(Boolean),
          }))
          .filter(
            (section) =>
              section.title &&
              section.items.length > 0,
          )

      if (sections.length === 0) {
        alert(
          '최소 한 개 이상의 운동 섹션을 입력해 주세요.',
        )
        return
      }

      setSaving(true)
      setErrorMessage('')

      const {
        data: userResult,
        error: userError,
      } =
        await supabase.auth.getUser()

      if (
        userError ||
        !userResult.user
      ) {
        setSaving(false)

        alert(
          '관리자 로그인 정보를 확인하지 못했습니다.',
        )
        return
      }

      const overrideData = {
        personalizedProgram: true,

        title:
          editor.title.trim(),

        subtitle:
          editor.subtitle.trim(),

        targetRpe:
          editor.targetRpe.trim(),

        sections,
      }

      const {
        data,
        error,
      } = await supabase
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

            override_data:
              overrideData,

            coach_note:
              editor.coachNote
                .trim() || null,

            created_by:
              userResult.user.id,

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
        console.error(
          '개인 프로그램 저장 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '개인 프로그램을 저장하지 못했습니다.',
        )

        alert(
          `저장에 실패했습니다.\n${error.message}`,
        )

        setSaving(false)
        return
      }

      setCurrentOverrideId(data.id)
      setSaving(false)

      alert(
        '개인 프로그램이 저장되었습니다.',
      )
    }

  const deletePersonalProgram =
    async () => {
      if (!currentOverrideId) {
        return
      }

      const confirmed =
        window.confirm(
          '개인 프로그램을 삭제하고 공통 프로그램으로 되돌릴까요?',
        )

      if (!confirmed) {
        return
      }

      setSaving(true)
      setErrorMessage('')

      const { error } =
        await supabase
          .from(
            'member_program_overrides',
          )
          .delete()
          .eq(
            'id',
            currentOverrideId,
          )

      if (error) {
        console.error(
          '개인 프로그램 삭제 실패:',
          error,
        )

        setErrorMessage(
          error.message,
        )

        setSaving(false)
        return
      }

      setCurrentOverrideId(null)

      setEditor(
        createEditorFromSession(
          selectedSession,
        ),
      )

      setSaving(false)

      alert(
        '공통 프로그램으로 되돌렸습니다.',
      )
    }

  if (loading) {
    return (
      <article style={styles.card}>
        개인 프로그램을 불러오는
        중입니다.
      </article>
    )
  }

  if (members.length === 0) {
    return (
      <article style={styles.card}>
        <span style={styles.badge}>
          COACH CARE
        </span>

        <h3>
          활성화된 멤버가 없습니다.
        </h3>

        <p style={styles.description}>
          멤버 관리에서 COACH CARE를
          활성화해 주세요.
        </p>
      </article>
    )
  }

  if (weeks.length === 0) {
    return (
      <article style={styles.card}>
        등록된 주간 프로그램이
        없습니다.
      </article>
    )
  }

  return (
    <section style={styles.page}>
      <div>
        <p style={styles.eyebrow}>
          COACH CARE
        </p>

        <h3 style={styles.title}>
          개인 프로그램 편집
        </h3>

        <p style={styles.description}>
          공통 프로그램 전체를 멤버에게
          맞게 수정합니다.
        </p>
      </div>

      {errorMessage && (
        <article style={styles.error}>
          {errorMessage}
        </article>
      )}

      <section style={styles.card}>
        <div style={styles.selectGrid}>
          <label style={styles.field}>
            멤버 선택

            <select
              value={selectedMemberId}
              onChange={(event) =>
                setSelectedMemberId(
                  event.target.value,
                )
              }
              style={styles.input}
            >
              {members.map((member) => (
                <option
                  key={member.id}
                  value={member.id}
                >
                  {member.full_name ||
                    member.email}

                  {' · '}

                  {member.membership}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            주차 선택

            <select
              value={selectedWeekKey}
              onChange={(event) =>
                setSelectedWeekKey(
                  event.target.value,
                )
              }
              style={styles.input}
            >
              {weeks.map((week) => (
                <option
                  key={week.week_key}
                  value={week.week_key}
                >
                  {week.title}
                  {' · '}
                  {week.status ===
                  'published'
                    ? '공개'
                    : '임시저장'}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            운동 선택

            <select
              value={selectedEventId}
              onChange={(event) =>
                setSelectedEventId(
                  event.target.value,
                )
              }
              style={styles.input}
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
      </section>

      {selectedMember &&
        selectedSession && (
          <article style={styles.summary}>
            <div>
              <span style={styles.summaryLabel}>
                ATHLETE
              </span>

              <strong>
                {selectedMember.full_name ||
                  selectedMember.email}
              </strong>
            </div>

            <div>
              <span style={styles.summaryLabel}>
                ORIGINAL PROGRAM
              </span>

              <strong>
                {selectedSession.title}
              </strong>
            </div>

            <span
              style={
                currentOverrideId
                  ? styles.activeBadge
                  : styles.basicBadge
              }
            >
              {currentOverrideId
                ? '개인 프로그램 적용 중'
                : '공통 프로그램 사용 중'}
            </span>
          </article>
        )}

      {overrideLoading ? (
        <article style={styles.card}>
          프로그램을 불러오는
          중입니다.
        </article>
      ) : (
        <form
          onSubmit={
            savePersonalProgram
          }
          style={styles.form}
        >
          <section style={styles.card}>
            <div style={styles.sectionHead}>
              <div>
                <p style={styles.eyebrow}>
                  PROGRAM INFO
                </p>

                <h4 style={styles.sectionTitle}>
                  프로그램 기본 정보
                </h4>
              </div>

              <button
                type="button"
                onClick={
                  loadCommonProgram
                }
                style={styles.secondaryButton}
              >
                공통 내용 다시 불러오기
              </button>
            </div>

            <label style={styles.field}>
              프로그램 제목

              <input
                type="text"
                value={editor.title}
                onChange={(event) =>
                  updateEditor(
                    'title',
                    event.target.value,
                  )
                }
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              프로그램 설명

              <textarea
                rows="3"
                value={editor.subtitle}
                onChange={(event) =>
                  updateEditor(
                    'subtitle',
                    event.target.value,
                  )
                }
                style={styles.textarea}
              />
            </label>

            <label style={styles.field}>
              전체 목표 RPE

              <input
                type="text"
                placeholder="예: 4–5"
                value={
                  editor.targetRpe
                }
                onChange={(event) =>
                  updateEditor(
                    'targetRpe',
                    event.target.value,
                  )
                }
                style={styles.input}
              />
            </label>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHead}>
              <div>
                <p style={styles.eyebrow}>
                  FULL PROGRAM
                </p>

                <h4 style={styles.sectionTitle}>
                  운동 프로그램 전체 편집
                </h4>
              </div>

              <button
                type="button"
                onClick={addSection}
                style={styles.addButton}
              >
                + 섹션 추가
              </button>
            </div>

            <div style={styles.list}>
              {editor.sections.map(
                (
                  section,
                  sectionIndex,
                ) => (
                  <article
                    key={sectionIndex}
                    style={
                      styles.sectionCard
                    }
                  >
                    <div
                      style={
                        styles.sectionHead
                      }
                    >
                      <input
                        type="text"
                        placeholder="예: WARM UP, MAIN"
                        value={
                          section.title
                        }
                        onChange={(event) =>
                          updateSectionTitle(
                            sectionIndex,
                            event.target.value,
                          )
                        }
                        style={
                          styles.sectionTitleInput
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeSection(
                            sectionIndex,
                          )
                        }
                        style={
                          styles.removeButton
                        }
                      >
                        섹션 삭제
                      </button>
                    </div>

                    <div style={styles.list}>
                      {section.items.map(
                        (
                          item,
                          itemIndex,
                        ) => (
                          <div
                            key={
                              itemIndex
                            }
                            style={
                              styles.itemRow
                            }
                          >
                            <textarea
                              rows="2"
                              placeholder="운동 내용을 입력해 주세요."
                              value={item}
                              onChange={(
                                event,
                              ) =>
                                updateSectionItem(
                                  sectionIndex,
                                  itemIndex,
                                  event
                                    .target
                                    .value,
                                )
                              }
                              style={
                                styles.textarea
                              }
                            />

                            <button
                              type="button"
                              onClick={() =>
                                removeSectionItem(
                                  sectionIndex,
                                  itemIndex,
                                )
                              }
                              style={
                                styles.removeButton
                              }
                            >
                              삭제
                            </button>
                          </div>
                        ),
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        addSectionItem(
                          sectionIndex,
                        )
                      }
                      style={
                        styles.itemAddButton
                      }
                    >
                      + 운동 내용 추가
                    </button>
                  </article>
                ),
              )}
            </div>
          </section>

          <section style={styles.coachNoteCard}>
            <p style={styles.coachEyebrow}>
              COACH NOTE
            </p>

            <h4 style={styles.coachTitle}>
              멤버에게 전하는 코치 메시지
            </h4>

            <p style={styles.coachDescription}>
              프로그램을 조정한 이유와 오늘
              집중해야 할 부분을 전달해 주세요.
            </p>

            <textarea
              rows="5"
              value={editor.coachNote}
              onChange={(event) =>
                updateEditor(
                  'coachNote',
                  event.target.value,
                )
              }
              placeholder="예: 지난주보다 강도를 낮췄습니다. 오늘은 기록보다 끝까지 일정한 페이스를 유지하는 데 집중해 주세요."
              style={styles.textarea}
            />
          </section>

          <div style={styles.actions}>
            <button
              type="submit"
              disabled={saving}
              style={styles.saveButton}
            >
              {saving
                ? '저장 중...'
                : currentOverrideId
                  ? '개인 프로그램 수정'
                  : '개인 프로그램 저장'}
            </button>

            {currentOverrideId && (
              <button
                type="button"
                disabled={saving}
                onClick={
                  deletePersonalProgram
                }
                style={styles.deleteButton}
              >
                개인화 해제
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  )
}

const styles = {
  page: {
    display: 'grid',
    gap: '18px',
  },

  form: {
    display: 'grid',
    gap: '16px',
  },

  card: {
    display: 'grid',
    gap: '16px',
    padding: '20px',
    borderRadius: '18px',
    background: '#ffffff',
  },

  coachNoteCard: {
    display: 'grid',
    gap: '12px',
    padding: '20px',
    borderRadius: '18px',
    background: '#e4f0eb',
    border: '1px solid #bdd5cb',
  },

  coachEyebrow: {
    margin: 0,
    color: '#0b6b4f',
    fontSize: '11px',
    fontWeight: '900',
    letterSpacing: '0.12em',
  },

  coachTitle: {
    margin: 0,
    color: '#10251e',
    fontSize: '19px',
  },

  coachDescription: {
    margin: 0,
    color: '#587069',
    fontSize: '13px',
    lineHeight: 1.6,
  },

  eyebrow: {
    margin: '0 0 6px',
    color: '#0b6b4f',
    fontSize: '11px',
    fontWeight: '900',
    letterSpacing: '0.12em',
  },

  title: {
    margin: '0 0 8px',
    fontSize: '24px',
    color: '#10251e',
  },

  description: {
    margin: 0,
    color: '#66736e',
    fontSize: '14px',
    lineHeight: 1.6,
  },

  error: {
    padding: '15px',
    borderRadius: '14px',
    background: '#fff0f0',
    color: '#b52d2d',
    fontSize: '13px',
    fontWeight: '800',
  },

  selectGrid: {
    display: 'grid',
    gap: '14px',
  },

  field: {
    display: 'grid',
    gap: '8px',
    color: '#33463f',
    fontSize: '13px',
    fontWeight: '800',
  },

  input: {
    width: '100%',
    minWidth: 0,
    minHeight: '46px',
    boxSizing: 'border-box',
    padding: '11px 13px',
    border: '1px solid #d6dedb',
    borderRadius: '12px',
    background: '#ffffff',
    fontSize: '14px',
  },

  textarea: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '12px 13px',
    border: '1px solid #d6dedb',
    borderRadius: '12px',
    background: '#ffffff',
    fontFamily: 'inherit',
    fontSize: '14px',
    lineHeight: 1.6,
    resize: 'vertical',
  },

  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },

  sectionTitle: {
    margin: 0,
    color: '#10251e',
    fontSize: '18px',
  },

  summary: {
    display: 'grid',
    gap: '15px',
    padding: '20px',
    borderRadius: '18px',
    background: '#0b3d2e',
    color: '#ffffff',
  },

  summaryLabel: {
    display: 'block',
    marginBottom: '4px',
    color: '#bbd6cc',
    fontSize: '10px',
    fontWeight: '900',
    letterSpacing: '0.1em',
  },

  badge: {
    width: 'fit-content',
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#dfeee8',
    color: '#0b6b4f',
    fontSize: '11px',
    fontWeight: '900',
  },

  activeBadge: {
    width: 'fit-content',
    padding: '7px 11px',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#0b3d2e',
    fontSize: '11px',
    fontWeight: '900',
  },

  basicBadge: {
    width: 'fit-content',
    padding: '7px 11px',
    borderRadius: '999px',
    background:
      'rgba(255,255,255,0.14)',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '900',
  },

  list: {
    display: 'grid',
    gap: '12px',
  },

  sectionCard: {
    display: 'grid',
    gap: '14px',
    padding: '15px',
    border: '1px solid #dfe6e2',
    borderRadius: '15px',
    background: '#f8faf9',
  },

  sectionTitleInput: {
    width: '100%',
    minWidth: 0,
    padding: '10px 12px',
    boxSizing: 'border-box',
    border: '1px solid #d6dedb',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '900',
  },

  itemRow: {
    display: 'grid',
    gap: '8px',
  },

  addButton: {
    padding: '9px 11px',
    border: 'none',
    borderRadius: '10px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  secondaryButton: {
    padding: '9px 11px',
    border: '1px solid #cfd9d5',
    borderRadius: '10px',
    background: '#ffffff',
    color: '#33463f',
    fontSize: '11px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  removeButton: {
    padding: '9px 11px',
    border: '1px solid #e2b5b5',
    borderRadius: '10px',
    background: '#ffffff',
    color: '#b52d2d',
    fontSize: '11px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  itemAddButton: {
    minHeight: '42px',
    border: '1px dashed #9fb8ae',
    borderRadius: '11px',
    background: '#ffffff',
    color: '#0b6b4f',
    fontSize: '12px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  actions: {
    display: 'grid',
    gap: '10px',
  },

  saveButton: {
    minHeight: '52px',
    border: 'none',
    borderRadius: '14px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  deleteButton: {
    minHeight: '48px',
    border: '1px solid #e2b5b5',
    borderRadius: '14px',
    background: '#ffffff',
    color: '#b52d2d',
    fontSize: '14px',
    fontWeight: '900',
    cursor: 'pointer',
  },
}

export default PersonalProgramAdmin