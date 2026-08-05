import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'

function getTodayKey() {
  return new Date()
    .toISOString()
    .slice(0, 10)
}

const initialForm = {
  measuredAt: getTodayKey(),
  measurementMethod: 'inbody',
  sex: '',
  heightCm: '',
  weightKg: '',
  bodyFatPercent: '',
  note: '',
}

function formatNumber(
  value,
  digits = 1,
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '-'
  }

  const number = Number(value)

  if (Number.isNaN(number)) {
    return '-'
  }

  return number
    .toFixed(digits)
    .replace(/\.0$/, '')
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  return new Date(
    `${value}T00:00:00`,
  ).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getGradeDescription(grade) {
  if (grade === 'Elite Fit') {
    return '하이브리드 퍼포먼스에 매우 유리한 체성분 상태입니다.'
  }

  if (grade === 'Performance Fit') {
    return '좋은 체성분 기반을 갖추고 있습니다.'
  }

  if (grade === 'Ready Fit') {
    return '하이록스 훈련을 준비하기에 안정적인 상태입니다.'
  }

  if (grade === 'Build Fit') {
    return '근육량과 체지방 밸런스를 개선할 여지가 있습니다.'
  }

  return '기초 체성분 개선부터 차근차근 시작해 보세요.'
}

function BodyFitScoreSection({
  memberId,
  mode = 'records',
}) {
  const [records, setRecords] =
    useState([])

  const [form, setForm] =
    useState(initialForm)

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [
    formOpen,
    setFormOpen,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const latestRecord =
    records[0] || null

  const previousRecord =
    records[1] || null

  const scoreDifference =
    latestRecord &&
    previousRecord
      ? Number(
          latestRecord
            .body_fit_total_score,
        ) -
        Number(
          previousRecord
            .body_fit_total_score,
        )
      : null

  const scoreItems = useMemo(() => {
    if (!latestRecord) {
      return []
    }

    return [
      {
        label: 'FFMI',
        score:
          latestRecord.ffmi_score,
        maxScore: 25,
      },
      {
        label: '절대 몸무게',
        score:
          latestRecord.weight_score,
        maxScore: 22,
      },
      {
        label: '절대 키',
        score:
          latestRecord.height_score,
        maxScore: 20,
      },
      {
        label: '체지방률',
        score:
          latestRecord.body_fat_score,
        maxScore: 20,
      },
      {
        label: '키-몸무게 밸런스',
        score:
          latestRecord
            .height_weight_score,
        maxScore: 13,
      },
    ]
  }, [latestRecord])

  useEffect(() => {
    let isMounted = true

    const loadRecords = async () => {
      if (!memberId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')

      const [
        profileResult,
        recordsResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('sex')
          .eq('id', memberId)
          .maybeSingle(),

        supabase
          .from(
            'body_composition_records',
          )
          .select('*')
          .eq('user_id', memberId)
          .order('measured_at', {
            ascending: false,
          })
          .order('created_at', {
            ascending: false,
          }),
      ])

      if (!isMounted) {
        return
      }

      if (recordsResult.error) {
        console.error(
          'Body Fit Score 조회 실패:',
          recordsResult.error,
        )

        setErrorMessage(
          recordsResult.error.message ||
            'Body Fit Score 기록을 불러오지 못했습니다.',
        )

        setLoading(false)
        return
      }

      const nextRecords =
        recordsResult.data || []

      setRecords(nextRecords)

      const latest =
        nextRecords[0]

      setForm((current) => ({
        ...current,

        sex:
          latest?.sex ||
          profileResult.data?.sex ||
          '',

        heightCm:
          latest?.height_cm
            ? String(
                latest.height_cm,
              )
            : '',

        weightKg:
          latest?.weight_kg
            ? String(
                latest.weight_kg,
              )
            : '',

        bodyFatPercent:
          latest?.body_fat_percent
            ? String(
                latest.body_fat_percent,
              )
            : '',
      }))

      setFormOpen(
        mode === 'records' &&
          nextRecords.length === 0,
      )

      setLoading(false)
    }

    loadRecords()

    return () => {
      isMounted = false
    }
  }, [memberId, mode])

  const updateForm = (
    name,
    value,
  ) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const saveRecord = async (
    event,
  ) => {
    event.preventDefault()

    if (!memberId || saving) {
      return
    }

    const heightCm =
      Number(form.heightCm)

    const weightKg =
      Number(form.weightKg)

    const bodyFatPercent =
      Number(form.bodyFatPercent)

    if (!form.sex) {
      alert('성별을 선택해 주세요.')
      return
    }

    if (
      !heightCm ||
      heightCm < 100 ||
      heightCm > 250
    ) {
      alert(
        '키를 정확하게 입력해 주세요.',
      )
      return
    }

    if (
      !weightKg ||
      weightKg < 25 ||
      weightKg > 300
    ) {
      alert(
        '몸무게를 정확하게 입력해 주세요.',
      )
      return
    }

    if (
      !bodyFatPercent ||
      bodyFatPercent < 1 ||
      bodyFatPercent > 70
    ) {
      alert(
        '체지방률을 정확하게 입력해 주세요.',
      )
      return
    }

    setSaving(true)
    setErrorMessage('')

    const {
      data,
      error,
    } = await supabase
      .from(
        'body_composition_records',
      )
      .insert({
        user_id: memberId,

        measured_at:
          form.measuredAt,

        measurement_method:
          form.measurementMethod,

        sex: form.sex,

        height_cm: heightCm,

        weight_kg: weightKg,

        body_fat_percent:
          bodyFatPercent,

        note:
          form.note.trim() ||
          null,
      })
      .select('*')
      .single()

    if (error) {
      console.error(
        'Body Fit Score 저장 실패:',
        error,
      )

      setErrorMessage(
        error.message ||
          '측정 결과를 저장하지 못했습니다.',
      )

      setSaving(false)
      return
    }

    setRecords((current) => [
      data,
      ...current,
    ])

    setForm((current) => ({
      ...current,
      measuredAt: getTodayKey(),
      note: '',
    }))

    setFormOpen(false)
    setSaving(false)

    alert(
      `Body Fit Score ${data.body_fit_total_score}점이 저장되었습니다.`,
    )
  }

  if (loading) {
    return (
      <article style={styles.loadingCard}>
        Body Fit Score를 불러오는
        중입니다.
      </article>
    )
  }

  if (mode === 'summary') {
    return (
      <section style={styles.summarySection}>
        <div style={styles.summaryHeading}>
          <div>
            <p style={styles.eyebrow}>
              BODY FIT SCORE
            </p>

            <h3 style={styles.summaryTitle}>
              최신 체성분 점수
            </h3>
          </div>

          <span style={styles.summaryHint}>
            기록 탭에서 상세 확인
          </span>
        </div>

        {errorMessage && (
          <article style={styles.error}>
            {errorMessage}
          </article>
        )}

        {latestRecord ? (
          <article style={styles.scoreCard}>
            <div style={styles.scoreTop}>
              <div>
                <p style={styles.scoreLabel}>
                  CURRENT SCORE
                </p>

                <div style={styles.scoreValue}>
                  <strong>
                    {
                      latestRecord
                        .body_fit_total_score
                    }
                  </strong>

                  <span>/ 100</span>
                </div>
              </div>

              <div style={styles.gradeBox}>
                <span>GRADE</span>

                <strong>
                  {
                    latestRecord
                      .body_fit_grade
                  }
                </strong>
              </div>
            </div>

            <p style={styles.gradeDescription}>
              {getGradeDescription(
                latestRecord
                  .body_fit_grade,
              )}
            </p>

            <div style={styles.measurementMeta}>
              <span>
                {formatDate(
                  latestRecord
                    .measured_at,
                )}
              </span>

              {scoreDifference !==
                null && (
                <strong>
                  이전 대비{' '}
                  {scoreDifference > 0
                    ? `+${scoreDifference}`
                    : scoreDifference}
                  점
                </strong>
              )}
            </div>
          </article>
        ) : (
          <article style={styles.summaryEmpty}>
            <div>
              <span style={styles.emptyBadge}>
                NO SCORE
              </span>

              <h3>
                아직 측정 기록이
                없습니다.
              </h3>

              <p>
                기록 탭에서 첫 Body Fit
                Score를 등록해 주세요.
              </p>
            </div>
          </article>
        )}
      </section>
    )
  }

  return (
    <section style={styles.section}>
      <div style={styles.heading}>
        <div>
          <p style={styles.eyebrow}>
            BODY FIT SCORE
          </p>

          <h3 style={styles.title}>
            체성분 기록
          </h3>

          <p style={styles.description}>
            새로운 측정 결과를 등록하고
            점수 변화를 확인합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setFormOpen(
              (current) =>
                !current,
            )
          }
          style={styles.openButton}
        >
          {formOpen
            ? '입력 닫기'
            : latestRecord
              ? '새 측정 등록'
              : '점수 측정'}
        </button>
      </div>

      {errorMessage && (
        <article style={styles.error}>
          {errorMessage}
        </article>
      )}

      {formOpen && (
        <form
          onSubmit={saveRecord}
          style={styles.formCard}
        >
          <div>
            <p style={styles.formEyebrow}>
              NEW MEASUREMENT
            </p>

            <h4 style={styles.formTitle}>
              체성분 정보 입력
            </h4>
          </div>

          <label style={styles.field}>
            측정일

            <input
              type="date"
              value={form.measuredAt}
              onChange={(event) =>
                updateForm(
                  'measuredAt',
                  event.target.value,
                )
              }
              style={styles.input}
              required
            />
          </label>

          <label style={styles.field}>
            측정 방식

            <select
              value={
                form.measurementMethod
              }
              onChange={(event) =>
                updateForm(
                  'measurementMethod',
                  event.target.value,
                )
              }
              style={styles.input}
            >
              <option value="inbody">
                인바디
              </option>

              <option value="manual">
                직접 입력
              </option>

              <option value="other">
                기타 측정
              </option>
            </select>
          </label>

          <label style={styles.field}>
            성별

            <select
              value={form.sex}
              onChange={(event) =>
                updateForm(
                  'sex',
                  event.target.value,
                )
              }
              style={styles.input}
              required
            >
              <option value="">
                선택
              </option>

              <option value="male">
                남성
              </option>

              <option value="female">
                여성
              </option>
            </select>
          </label>

          <div style={styles.inputGrid}>
            <label style={styles.field}>
              키(cm)

              <input
                type="number"
                min="100"
                max="250"
                step="0.1"
                placeholder="180"
                value={form.heightCm}
                onChange={(event) =>
                  updateForm(
                    'heightCm',
                    event.target.value,
                  )
                }
                style={styles.input}
                required
              />
            </label>

            <label style={styles.field}>
              몸무게(kg)

              <input
                type="number"
                min="25"
                max="300"
                step="0.1"
                placeholder="80"
                value={form.weightKg}
                onChange={(event) =>
                  updateForm(
                    'weightKg',
                    event.target.value,
                  )
                }
                style={styles.input}
                required
              />
            </label>
          </div>

          <label style={styles.field}>
            체지방률(%)

            <input
              type="number"
              min="1"
              max="70"
              step="0.1"
              placeholder="20"
              value={
                form.bodyFatPercent
              }
              onChange={(event) =>
                updateForm(
                  'bodyFatPercent',
                  event.target.value,
                )
              }
              style={styles.input}
              required
            />
          </label>

          <label style={styles.field}>
            측정 메모

            <textarea
              rows="3"
              placeholder="예: 아침 공복 인바디 측정"
              value={form.note}
              onChange={(event) =>
                updateForm(
                  'note',
                  event.target.value,
                )
              }
              style={styles.textarea}
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            style={{
              ...styles.saveButton,
              opacity:
                saving ? 0.6 : 1,
            }}
          >
            {saving
              ? '계산 및 저장 중...'
              : 'Body Fit Score 계산'}
          </button>
        </form>
      )}

      {latestRecord ? (
        <>
          <article style={styles.scoreCard}>
            <div style={styles.scoreTop}>
              <div>
                <p style={styles.scoreLabel}>
                  CURRENT SCORE
                </p>

                <div style={styles.scoreValue}>
                  <strong>
                    {
                      latestRecord
                        .body_fit_total_score
                    }
                  </strong>

                  <span>/ 100</span>
                </div>
              </div>

              <div style={styles.gradeBox}>
                <span>GRADE</span>

                <strong>
                  {
                    latestRecord
                      .body_fit_grade
                  }
                </strong>
              </div>
            </div>

            <p style={styles.gradeDescription}>
              {getGradeDescription(
                latestRecord
                  .body_fit_grade,
              )}
            </p>

            <div style={styles.measurementMeta}>
              <span>
                {formatDate(
                  latestRecord
                    .measured_at,
                )}
              </span>

              {scoreDifference !==
                null && (
                <strong>
                  이전 측정 대비{' '}
                  {scoreDifference > 0
                    ? `+${scoreDifference}`
                    : scoreDifference}
                  점
                </strong>
              )}
            </div>
          </article>

          <article style={styles.card}>
            <p style={styles.formEyebrow}>
              SCORE BREAKDOWN
            </p>

            <h4 style={styles.formTitle}>
              항목별 점수
            </h4>

            <div style={styles.scoreList}>
              {scoreItems.map(
                (item) => {
                  const percent =
                    Math.min(
                      100,
                      Math.max(
                        0,
                        (
                          Number(
                            item.score,
                          ) /
                          item.maxScore
                        ) *
                          100,
                      ),
                    )

                  return (
                    <div
                      key={item.label}
                      style={styles.scoreItem}
                    >
                      <div style={styles.scoreItemHead}>
                        <span>
                          {item.label}
                        </span>

                        <strong>
                          {formatNumber(
                            item.score,
                          )}
                          {' / '}
                          {item.maxScore}
                        </strong>
                      </div>

                      <div style={styles.track}>
                        <div
                          style={{
                            ...styles.trackValue,
                            width:
                              `${percent}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                },
              )}
            </div>
          </article>

          <article style={styles.card}>
            <p style={styles.formEyebrow}>
              BODY DATA
            </p>

            <h4 style={styles.formTitle}>
              현재 체성분
            </h4>

            <div style={styles.dataGrid}>
              <div style={styles.dataItem}>
                <span>FFMI</span>

                <strong>
                  {formatNumber(
                    latestRecord.ffmi,
                  )}
                </strong>
              </div>

              <div style={styles.dataItem}>
                <span>제지방량</span>

                <strong>
                  {formatNumber(
                    latestRecord
                      .lean_mass,
                  )}
                  kg
                </strong>
              </div>

              <div style={styles.dataItem}>
                <span>체지방률</span>

                <strong>
                  {formatNumber(
                    latestRecord
                      .body_fat_percent,
                  )}
                  %
                </strong>
              </div>

              <div style={styles.dataItem}>
                <span>키-몸무게 값</span>

                <strong>
                  {formatNumber(
                    latestRecord
                      .height_weight_value,
                  )}
                </strong>
              </div>
            </div>
          </article>

          {records.length > 1 && (
            <article style={styles.card}>
              <p style={styles.formEyebrow}>
                SCORE HISTORY
              </p>

              <h4 style={styles.formTitle}>
                측정 기록
              </h4>

              <div style={styles.historyList}>
                {records
                  .slice(0, 6)
                  .map((record) => (
                    <div
                      key={record.id}
                      style={styles.historyItem}
                    >
                      <div>
                        <strong>
                          {formatDate(
                            record.measured_at,
                          )}
                        </strong>

                        <span>
                          {formatNumber(
                            record.weight_kg,
                          )}
                          kg
                          {' · '}
                          {formatNumber(
                            record.body_fat_percent,
                          )}
                          %
                        </span>
                      </div>

                      <div style={styles.historyScore}>
                        <strong>
                          {
                            record
                              .body_fit_total_score
                          }
                        </strong>

                        <span>
                          {
                            record
                              .body_fit_grade
                          }
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </article>
          )}

          <p style={styles.notice}>
            Body Fit Score는 체성분 기반
            참고 지표입니다. 러닝 능력,
            근력, 기술, 컨디션을 포함한
            HYROX 경기력 종합점수는
            아닙니다.
          </p>
        </>
      ) : (
        !formOpen && (
          <article style={styles.emptyCard}>
            <span style={styles.emptyBadge}>
              NO SCORE
            </span>

            <h3>
              아직 측정 기록이 없습니다.
            </h3>

            <p>
              키, 몸무게, 체지방률을
              입력해 첫 Body Fit Score를
              확인해 보세요.
            </p>
          </article>
        )
      )}
    </section>
  )
}

const styles = {
  section: {
    display: 'grid',
    gap: '14px',
    marginTop: '18px',
  },

  summarySection: {
    display: 'grid',
    gap: '12px',
    marginTop: '20px',
  },

  summaryHeading: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '12px',
  },

  summaryTitle: {
    margin: 0,
    color: '#10251e',
    fontSize: '18px',
  },

  summaryHint: {
    color: '#7b8681',
    fontSize: '10px',
    fontWeight: '800',
  },

  heading: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '12px',
  },

  eyebrow: {
    margin: '0 0 5px',
    color: '#0b6b4f',
    fontSize: '11px',
    fontWeight: '900',
    letterSpacing: '0.12em',
  },

  title: {
    margin: 0,
    color: '#10251e',
    fontSize: '21px',
  },

  description: {
    margin: '7px 0 0',
    color: '#66736e',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  openButton: {
    flexShrink: 0,
    minHeight: '40px',
    padding: '8px 11px',
    border: 'none',
    borderRadius: '11px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  loadingCard: {
    marginTop: '18px',
    padding: '18px',
    borderRadius: '18px',
    background: '#ffffff',
    color: '#66736e',
    fontSize: '13px',
  },

  card: {
    display: 'grid',
    gap: '14px',
    padding: '19px',
    borderRadius: '18px',
    background: '#ffffff',
  },

  formCard: {
    display: 'grid',
    gap: '15px',
    padding: '19px',
    borderRadius: '18px',
    background: '#eef4f1',
    border: '1px solid #cdded6',
  },

  formEyebrow: {
    margin: '0 0 5px',
    color: '#0b6b4f',
    fontSize: '10px',
    fontWeight: '900',
    letterSpacing: '0.11em',
  },

  formTitle: {
    margin: 0,
    color: '#10251e',
    fontSize: '17px',
  },

  field: {
    display: 'grid',
    gap: '7px',
    color: '#33463f',
    fontSize: '12px',
    fontWeight: '800',
  },

  inputGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },

  input: {
    width: '100%',
    minWidth: 0,
    minHeight: '45px',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid #d5ddda',
    borderRadius: '11px',
    background: '#ffffff',
    fontSize: '14px',
  },

  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    border: '1px solid #d5ddda',
    borderRadius: '11px',
    background: '#ffffff',
    fontFamily: 'inherit',
    fontSize: '14px',
    lineHeight: 1.5,
    resize: 'vertical',
  },

  saveButton: {
    minHeight: '50px',
    border: 'none',
    borderRadius: '13px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  scoreCard: {
    display: 'grid',
    gap: '15px',
    padding: '21px',
    borderRadius: '19px',
    background: '#0b3d2e',
    color: '#ffffff',
  },

  scoreTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '15px',
  },

  scoreLabel: {
    margin: 0,
    color: '#b8d2c8',
    fontSize: '10px',
    fontWeight: '900',
    letterSpacing: '0.12em',
  },

  scoreValue: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '5px',
    marginTop: '4px',
  },

  gradeBox: {
    display: 'grid',
    gap: '3px',
    textAlign: 'right',
  },

  gradeDescription: {
    margin: 0,
    color: '#d9e7e1',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  measurementMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    color: '#bdd3ca',
    fontSize: '11px',
  },

  scoreList: {
    display: 'grid',
    gap: '13px',
  },

  scoreItem: {
    display: 'grid',
    gap: '7px',
  },

  scoreItemHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    color: '#33463f',
    fontSize: '12px',
  },

  track: {
    height: '8px',
    overflow: 'hidden',
    borderRadius: '999px',
    background: '#e4eae7',
  },

  trackValue: {
    height: '100%',
    borderRadius: '999px',
    background: '#0b6b4f',
  },

  dataGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },

  dataItem: {
    display: 'grid',
    gap: '4px',
    padding: '13px',
    borderRadius: '13px',
    background: '#f2f5f3',
  },

  historyList: {
    display: 'grid',
    gap: '9px',
  },

  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 0',
    borderBottom: '1px solid #e7ebe9',
  },

  historyScore: {
    display: 'grid',
    textAlign: 'right',
  },

  notice: {
    margin: 0,
    color: '#7b8681',
    fontSize: '11px',
    lineHeight: 1.55,
  },

  emptyCard: {
    display: 'grid',
    gap: '8px',
    padding: '19px',
    borderRadius: '18px',
    background: '#f1f4f2',
  },

  summaryEmpty: {
    display: 'grid',
    gap: '8px',
    padding: '18px',
    borderRadius: '18px',
    background: '#ffffff',
  },

  emptyBadge: {
    width: 'fit-content',
    padding: '5px 9px',
    borderRadius: '999px',
    background: '#dce4e0',
    color: '#607069',
    fontSize: '10px',
    fontWeight: '900',
  },

  error: {
    padding: '14px',
    borderRadius: '13px',
    background: '#fff0f0',
    color: '#b52d2d',
    fontSize: '12px',
    fontWeight: '800',
  },
}

export default BodyFitScoreSection