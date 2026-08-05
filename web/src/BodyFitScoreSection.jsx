import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'

const MEASUREMENT_INTERVAL_DAYS = 30

const chartMetrics = [
  {
    id: 'score',
    label: '종합점수',
    dataKey: 'body_fit_total_score',
    suffix: '점',
    digits: 0,
  },
  {
    id: 'bodyFat',
    label: '체지방률',
    dataKey: 'body_fat_percent',
    suffix: '%',
    digits: 1,
  },
  {
    id: 'weight',
    label: '몸무게',
    dataKey: 'weight_kg',
    suffix: 'kg',
    digits: 1,
  },
  {
    id: 'ffmi',
    label: 'FFMI',
    dataKey: 'ffmi',
    suffix: '',
    digits: 1,
  },
  {
    id: 'leanMass',
    label: '제지방량',
    dataKey: 'lean_mass',
    suffix: 'kg',
    digits: 1,
  },
]

function getLocalDateKey(
  date = new Date(),
) {
  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0')

  const day = String(
    date.getDate(),
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseDateKey(value) {
  if (!value) {
    return null
  }

  const [
    year,
    month,
    day,
  ] = value
    .split('-')
    .map(Number)

  if (
    !year ||
    !month ||
    !day
  ) {
    return null
  }

  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
  )
}

function addDays(
  date,
  days,
) {
  const nextDate = new Date(date)

  nextDate.setDate(
    nextDate.getDate() + days,
  )

  return nextDate
}

function getDaysDifference(
  targetDate,
  currentDate,
) {
  const millisecondsPerDay =
    1000 * 60 * 60 * 24

  const targetTime =
    new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    ).getTime()

  const currentTime =
    new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
    ).getTime()

  return Math.ceil(
    (
      targetTime -
      currentTime
    ) /
      millisecondsPerDay,
  )
}

function getTodayKey() {
  return getLocalDateKey()
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

function formatSignedNumber(
  value,
  digits = 1,
) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return '-'
  }

  const number = Number(value)

  const formatted =
    Math.abs(number)
      .toFixed(digits)
      .replace(/\.0$/, '')

  if (number > 0) {
    return `+${formatted}`
  }

  if (number < 0) {
    return `-${formatted}`
  }

  return '0'
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  const date = parseDateKey(value)

  if (!date) {
    return '-'
  }

  return date.toLocaleDateString(
    'ko-KR',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    },
  )
}

function formatShortDate(value) {
  if (!value) {
    return '-'
  }

  const date = parseDateKey(value)

  if (!date) {
    return '-'
  }

  return date.toLocaleDateString(
    'ko-KR',
    {
      month: 'numeric',
      day: 'numeric',
    },
  )
}

function getGradeDescription(grade) {
  if (grade === 'Elite Fit') {
    return '하이브리드 퍼포먼스에 매우 유리한 체성분 상태입니다.'
  }

  if (
    grade ===
    'Performance Fit'
  ) {
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

function BodyFitLineChart({
  records,
  metric,
}) {
  const chartRecords =
    records
      .slice(0, 12)
      .reverse()
      .map((record) => ({
        id: record.id,

        date:
          record.measured_at,

        value:
          Number(
            record[
              metric.dataKey
            ],
          ),
      }))
      .filter(
        (record) =>
          !Number.isNaN(
            record.value,
          ),
      )

  if (chartRecords.length === 0) {
    return (
      <div style={styles.chartEmpty}>
        표시할 데이터가 없습니다.
      </div>
    )
  }

  const width = 340
  const height = 190

  const padding = {
    top: 22,
    right: 18,
    bottom: 38,
    left: 42,
  }

  const values =
    chartRecords.map(
      (record) => record.value,
    )

  const originalMin =
    Math.min(...values)

  const originalMax =
    Math.max(...values)

  const valueRange =
    originalMax - originalMin

  const rangePadding =
    valueRange === 0
      ? Math.max(
          Math.abs(originalMax) *
            0.08,
          1,
        )
      : valueRange * 0.18

  const minValue =
    originalMin - rangePadding

  const maxValue =
    originalMax + rangePadding

  const graphWidth =
    width -
    padding.left -
    padding.right

  const graphHeight =
    height -
    padding.top -
    padding.bottom

  const getX = (index) => {
    if (
      chartRecords.length === 1
    ) {
      return (
        padding.left +
        graphWidth / 2
      )
    }

    return (
      padding.left +
      (
        index /
        (
          chartRecords.length -
          1
        )
      ) *
        graphWidth
    )
  }

  const getY = (value) => {
    const ratio =
      (
        value - minValue
      ) /
      (
        maxValue - minValue
      )

    return (
      padding.top +
      graphHeight -
      ratio * graphHeight
    )
  }

  const points =
    chartRecords
      .map(
        (record, index) =>
          `${getX(index)},${getY(
            record.value,
          )}`,
      )
      .join(' ')

  const yGuides = [
    maxValue,
    (
      maxValue + minValue
    ) / 2,
    minValue,
  ]

  const shouldShowDate = (
    index,
  ) => {
    if (
      chartRecords.length <= 5
    ) {
      return true
    }

    return (
      index === 0 ||
      index ===
        chartRecords.length - 1 ||
      index ===
        Math.floor(
          (
            chartRecords.length -
            1
          ) / 2,
        )
    )
  }

  return (
    <div style={styles.chartWrap}>
      <svg
        viewBox={
          `0 0 ${width} ${height}`
        }
        width="100%"
        role="img"
        aria-label={
          `${metric.label} 변화 그래프`
        }
      >
        {yGuides.map(
          (guide, index) => {
            const y = getY(guide)

            return (
              <g
                key={
                  `guide-${index}`
                }
              >
                <line
                  x1={padding.left}
                  x2={
                    width -
                    padding.right
                  }
                  y1={y}
                  y2={y}
                  stroke="#dce5e1"
                  strokeWidth="1"
                  strokeDasharray="4 5"
                />

                <text
                  x={
                    padding.left - 7
                  }
                  y={y + 4}
                  textAnchor="end"
                  fontSize="9"
                  fill="#81908a"
                >
                  {formatNumber(
                    guide,
                    metric.digits,
                  )}
                </text>
              </g>
            )
          },
        )}

        {chartRecords.length >
          1 && (
          <polyline
            points={points}
            fill="none"
            stroke="#0b6b4f"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {chartRecords.map(
          (record, index) => {
            const x = getX(index)

            const y = getY(
              record.value,
            )

            const isLatest =
              index ===
              chartRecords.length - 1

            return (
              <g key={record.id}>
                <circle
                  cx={x}
                  cy={y}
                  r={
                    isLatest
                      ? 5
                      : 3.5
                  }
                  fill={
                    isLatest
                      ? '#0b3d2e'
                      : '#ffffff'
                  }
                  stroke="#0b6b4f"
                  strokeWidth="2.5"
                />

                {isLatest && (
                  <text
                    x={x}
                    y={y - 11}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="800"
                    fill="#0b3d2e"
                  >
                    {formatNumber(
                      record.value,
                      metric.digits,
                    )}
                    {metric.suffix}
                  </text>
                )}

                {shouldShowDate(
                  index,
                ) && (
                  <text
                    x={x}
                    y={
                      height - 12
                    }
                    textAnchor="middle"
                    fontSize="9"
                    fill="#81908a"
                  >
                    {formatShortDate(
                      record.date,
                    )}
                  </text>
                )}
              </g>
            )
          },
        )}
      </svg>
    </div>
  )
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

  const [
    selectedMetricId,
    setSelectedMetricId,
  ] = useState('score')

  const latestRecord =
    records[0] || null

  const previousRecord =
    records[1] || null

  const firstRecord =
    records.length > 0
      ? records[
          records.length - 1
        ]
      : null

  const measurementAccess =
    useMemo(() => {
      if (!latestRecord) {
        return {
          canRegister: true,
          daysRemaining: 0,
          nextDateKey:
            getTodayKey(),
        }
      }

      const latestDate =
        parseDateKey(
          latestRecord.measured_at,
        )

      if (!latestDate) {
        return {
          canRegister: true,
          daysRemaining: 0,
          nextDateKey:
            getTodayKey(),
        }
      }

      const nextDate =
        addDays(
          latestDate,
          MEASUREMENT_INTERVAL_DAYS,
        )

      const today =
        parseDateKey(
          getTodayKey(),
        )

      const daysRemaining =
        getDaysDifference(
          nextDate,
          today,
        )

      return {
        canRegister:
          daysRemaining <= 0,

        daysRemaining:
          Math.max(
            0,
            daysRemaining,
          ),

        nextDateKey:
          getLocalDateKey(
            nextDate,
          ),
      }
    }, [latestRecord])

  const selectedMetric =
    chartMetrics.find(
      (metric) =>
        metric.id ===
        selectedMetricId,
    ) || chartMetrics[0]

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

  const totalScoreDifference =
    latestRecord &&
    firstRecord &&
    latestRecord.id !==
      firstRecord.id
      ? Number(
          latestRecord
            .body_fit_total_score,
        ) -
        Number(
          firstRecord
            .body_fit_total_score,
        )
      : null

  const bodyFatDifference =
    latestRecord &&
    previousRecord
      ? Number(
          latestRecord
            .body_fat_percent,
        ) -
        Number(
          previousRecord
            .body_fat_percent,
        )
      : null

  const weightDifference =
    latestRecord &&
    previousRecord
      ? Number(
          latestRecord
            .weight_kg,
        ) -
        Number(
          previousRecord
            .weight_kg,
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
        label:
          '키-몸무게 밸런스',

        score:
          latestRecord
            .height_weight_score,

        maxScore: 13,
      },
    ]
  }, [latestRecord])

  useEffect(() => {
    let isMounted = true

    const loadRecords =
      async () => {
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
            .eq(
              'user_id',
              memberId,
            )
            .order(
              'measured_at',
              {
                ascending: false,
              },
            )
            .order(
              'created_at',
              {
                ascending: false,
              },
            ),
        ])

        if (!isMounted) {
          return
        }

        if (
          recordsResult.error
        ) {
          console.error(
            'Body Fit Score 조회 실패:',
            recordsResult.error,
          )

          setErrorMessage(
            recordsResult.error
              .message ||
              'Body Fit Score 기록을 불러오지 못했습니다.',
          )

          setLoading(false)
          return
        }

        const nextRecords =
          recordsResult.data || []

        setRecords(
          nextRecords,
        )

        const latest =
          nextRecords[0]

        setForm(
          (current) => ({
            ...current,

            measuredAt:
              getTodayKey(),

            sex:
              latest?.sex ||
              profileResult.data
                ?.sex ||
              '',

            heightCm:
              latest?.height_cm
                ? String(
                    latest
                      .height_cm,
                  )
                : '',

            weightKg:
              latest?.weight_kg
                ? String(
                    latest
                      .weight_kg,
                  )
                : '',

            bodyFatPercent:
              latest
                ?.body_fat_percent
                ? String(
                    latest
                      .body_fat_percent,
                  )
                : '',
          }),
        )

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

  const toggleForm = () => {
    if (formOpen) {
      setFormOpen(false)
      return
    }

    if (
      !measurementAccess
        .canRegister
    ) {
      alert(
        `다음 Body Fit Check는 ${formatDate(
          measurementAccess
            .nextDateKey,
        )}부터 등록할 수 있습니다.`,
      )

      return
    }

    setForm((current) => ({
      ...current,
      measuredAt: getTodayKey(),
    }))

    setFormOpen(true)
  }

  const saveRecord = async (
    event,
  ) => {
    event.preventDefault()

    if (!memberId || saving) {
      return
    }

    if (
      !measurementAccess
        .canRegister
    ) {
      alert(
        `다음 Body Fit Check는 ${formatDate(
          measurementAccess
            .nextDateKey,
        )}부터 등록할 수 있습니다.`,
      )

      return
    }

    const todayKey =
      getTodayKey()

    if (
      form.measuredAt >
      todayKey
    ) {
      alert(
        '미래 날짜는 측정일로 등록할 수 없습니다.',
      )

      return
    }

    if (
      latestRecord &&
      form.measuredAt <
        measurementAccess
          .nextDateKey
    ) {
      alert(
        `측정일은 ${formatDate(
          measurementAccess
            .nextDateKey,
        )} 이후로 선택해 주세요.`,
      )

      return
    }

    const heightCm =
      Number(form.heightCm)

    const weightKg =
      Number(form.weightKg)

    const bodyFatPercent =
      Number(
        form.bodyFatPercent,
      )

    if (!form.sex) {
      alert(
        '성별을 선택해 주세요.',
      )

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

    setRecords(
      (current) =>
        [
          data,
          ...current,
        ].sort(
          (
            first,
            second,
          ) => {
            const dateCompare =
              String(
                second.measured_at,
              ).localeCompare(
                String(
                  first.measured_at,
                ),
              )

            if (
              dateCompare !== 0
            ) {
              return dateCompare
            }

            return String(
              second.created_at ||
                '',
            ).localeCompare(
              String(
                first.created_at ||
                  '',
              ),
            )
          },
        ),
    )

    setForm(
      (current) => ({
        ...current,
        measuredAt:
          getTodayKey(),
        note: '',
      }),
    )

    setFormOpen(false)
    setSaving(false)

    alert(
      `Body Fit Score ${data.body_fit_total_score}점이 저장되었습니다.`,
    )
  }

  if (loading) {
    return (
      <article
        style={
          styles.loadingCard
        }
      >
        Body Fit Score를 불러오는
        중입니다.
      </article>
    )
  }

  if (mode === 'summary') {
    return (
      <section
        style={
          styles.summarySection
        }
      >
        <div
          style={
            styles.summaryHeading
          }
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              BODY FIT SCORE
            </p>

            <h3
              style={
                styles.summaryTitle
              }
            >
              최신 체성분 점수
            </h3>
          </div>

          <span
            style={
              styles.summaryHint
            }
          >
            기록 탭에서 상세 확인
          </span>
        </div>

        {errorMessage && (
          <article
            style={styles.error}
          >
            {errorMessage}
          </article>
        )}

        {latestRecord ? (
          <>
            <article
              style={
                styles.scoreCard
              }
            >
              <div
                style={
                  styles.scoreTop
                }
              >
                <div>
                  <p
                    style={
                      styles.scoreLabel
                    }
                  >
                    CURRENT SCORE
                  </p>

                  <div
                    style={
                      styles.scoreValue
                    }
                  >
                    <strong>
                      {
                        latestRecord
                          .body_fit_total_score
                      }
                    </strong>

                    <span>/ 100</span>
                  </div>
                </div>

                <div
                  style={
                    styles.gradeBox
                  }
                >
                  <span>GRADE</span>

                  <strong>
                    {
                      latestRecord
                        .body_fit_grade
                    }
                  </strong>
                </div>
              </div>

              <p
                style={
                  styles.gradeDescription
                }
              >
                {getGradeDescription(
                  latestRecord
                    .body_fit_grade,
                )}
              </p>

              <div
                style={
                  styles.measurementMeta
                }
              >
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
                    {formatSignedNumber(
                      scoreDifference,
                      0,
                    )}
                    점
                  </strong>
                )}
              </div>
            </article>

            <article
              style={
                measurementAccess
                  .canRegister
                  ? styles
                      .nextMeasurementReady
                  : styles
                      .nextMeasurementCard
              }
            >
              <div>
                <span
                  style={
                    styles.nextBadge
                  }
                >
                  {measurementAccess
                    .canRegister
                    ? 'CHECK AVAILABLE'
                    : `D-${measurementAccess.daysRemaining}`}
                </span>

                <h4
                  style={
                    styles.nextTitle
                  }
                >
                  {measurementAccess
                    .canRegister
                    ? '새 Body Fit Check를 등록할 수 있어요.'
                    : '다음 Body Fit Check'}
                </h4>

                <p
                  style={
                    styles.nextText
                  }
                >
                  {measurementAccess
                    .canRegister
                    ? '기록 탭에서 새로운 체성분 측정을 등록해 주세요.'
                    : `${formatDate(
                        measurementAccess
                          .nextDateKey,
                      )}부터 다시 측정할 수 있습니다.`}
                </p>
              </div>
            </article>
          </>
        ) : (
          <article
            style={
              styles.summaryEmpty
            }
          >
            <div>
              <span
                style={
                  styles.emptyBadge
                }
              >
                NO SCORE
              </span>

              <h3>
                아직 측정 기록이
                없습니다.
              </h3>

              <p>
                기록 탭에서 첫 Body
                Fit Score를 등록해
                주세요.
              </p>
            </div>
          </article>
        )}
      </section>
    )
  }

  return (
    <section
      style={styles.section}
    >
      <div
        style={styles.heading}
      >
        <div>
          <p
            style={
              styles.eyebrow
            }
          >
            BODY FIT SCORE
          </p>

          <h3
            style={styles.title}
          >
            체성분 기록
          </h3>

          <p
            style={
              styles.description
            }
          >
            30일마다 새로운 측정
            결과를 등록하고 변화를
            확인합니다.
          </p>
        </div>

        <button
          type="button"
          disabled={
            !formOpen &&
            !measurementAccess
              .canRegister
          }
          onClick={toggleForm}
          style={{
            ...styles.openButton,

            ...(
              !formOpen &&
              !measurementAccess
                .canRegister
                ? styles
                    .openButtonDisabled
                : {}
            ),
          }}
        >
          {formOpen
            ? '입력 닫기'
            : !measurementAccess
                .canRegister
              ? `${measurementAccess.daysRemaining}일 후 등록`
              : latestRecord
                ? '새 측정 등록'
                : '점수 측정'}
        </button>
      </div>

      {errorMessage && (
        <article
          style={styles.error}
        >
          {errorMessage}
        </article>
      )}

      {latestRecord && (
        <article
          style={
            measurementAccess
              .canRegister
              ? styles
                  .nextMeasurementReady
              : styles
                  .nextMeasurementCard
          }
        >
          <div
            style={
              styles.nextMeasurementTop
            }
          >
            <div>
              <span
                style={
                  styles.nextBadge
                }
              >
                {measurementAccess
                  .canRegister
                  ? 'CHECK AVAILABLE'
                  : `D-${measurementAccess.daysRemaining}`}
              </span>

              <h4
                style={
                  styles.nextTitle
                }
              >
                {measurementAccess
                  .canRegister
                  ? '새 Body Fit Check를 등록할 수 있어요.'
                  : '다음 Body Fit Check'}
              </h4>
            </div>

            {!measurementAccess
              .canRegister && (
              <strong
                style={
                  styles.nextDate
                }
              >
                {formatDate(
                  measurementAccess
                    .nextDateKey,
                )}
              </strong>
            )}
          </div>

          <p
            style={
              styles.nextText
            }
          >
            {measurementAccess
              .canRegister
              ? '지난 측정으로부터 30일이 지났습니다. 새로운 체성분 변화를 기록해 보세요.'
              : '지금은 훈련에 집중하고, 다음 측정에서 변화를 확인해 보세요.'}
          </p>
        </article>
      )}

      {formOpen && (
        <form
          onSubmit={saveRecord}
          style={styles.formCard}
        >
          <div>
            <p
              style={
                styles.formEyebrow
              }
            >
              NEW MEASUREMENT
            </p>

            <h4
              style={
                styles.formTitle
              }
            >
              체성분 정보 입력
            </h4>
          </div>

          <label
            style={styles.field}
          >
            측정일

            <input
              type="date"
              min={
                latestRecord
                  ? measurementAccess
                      .nextDateKey
                  : undefined
              }
              max={getTodayKey()}
              value={
                form.measuredAt
              }
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

          <label
            style={styles.field}
          >
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

          <label
            style={styles.field}
          >
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

          <div
            style={
              styles.inputGrid
            }
          >
            <label
              style={
                styles.field
              }
            >
              키(cm)

              <input
                type="number"
                min="100"
                max="250"
                step="0.1"
                placeholder="180"
                value={
                  form.heightCm
                }
                onChange={(
                  event,
                ) =>
                  updateForm(
                    'heightCm',
                    event.target
                      .value,
                  )
                }
                style={
                  styles.input
                }
                required
              />
            </label>

            <label
              style={
                styles.field
              }
            >
              몸무게(kg)

              <input
                type="number"
                min="25"
                max="300"
                step="0.1"
                placeholder="80"
                value={
                  form.weightKg
                }
                onChange={(
                  event,
                ) =>
                  updateForm(
                    'weightKg',
                    event.target
                      .value,
                  )
                }
                style={
                  styles.input
                }
                required
              />
            </label>
          </div>

          <label
            style={styles.field}
          >
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

          <label
            style={styles.field}
          >
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
              style={
                styles.textarea
              }
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
          <article
            style={
              styles.scoreCard
            }
          >
            <div
              style={
                styles.scoreTop
              }
            >
              <div>
                <p
                  style={
                    styles.scoreLabel
                  }
                >
                  CURRENT SCORE
                </p>

                <div
                  style={
                    styles.scoreValue
                  }
                >
                  <strong>
                    {
                      latestRecord
                        .body_fit_total_score
                    }
                  </strong>

                  <span>/ 100</span>
                </div>
              </div>

              <div
                style={
                  styles.gradeBox
                }
              >
                <span>GRADE</span>

                <strong>
                  {
                    latestRecord
                      .body_fit_grade
                  }
                </strong>
              </div>
            </div>

            <p
              style={
                styles.gradeDescription
              }
            >
              {getGradeDescription(
                latestRecord
                  .body_fit_grade,
              )}
            </p>

            <div
              style={
                styles.measurementMeta
              }
            >
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
                  {formatSignedNumber(
                    scoreDifference,
                    0,
                  )}
                  점
                </strong>
              )}
            </div>
          </article>

          {records.length > 1 && (
            <article
              style={
                styles.changeCard
              }
            >
              <div>
                <p
                  style={
                    styles.formEyebrow
                  }
                >
                  LATEST CHANGE
                </p>

                <h4
                  style={
                    styles.formTitle
                  }
                >
                  지난 측정 이후 변화
                </h4>
              </div>

              <div
                style={
                  styles.changeGrid
                }
              >
                <div
                  style={
                    styles.changeItem
                  }
                >
                  <span>
                    종합점수
                  </span>

                  <strong>
                    {formatSignedNumber(
                      scoreDifference,
                      0,
                    )}
                    점
                  </strong>
                </div>

                <div
                  style={
                    styles.changeItem
                  }
                >
                  <span>
                    체지방률
                  </span>

                  <strong>
                    {formatSignedNumber(
                      bodyFatDifference,
                      1,
                    )}
                    %
                  </strong>
                </div>

                <div
                  style={
                    styles.changeItem
                  }
                >
                  <span>
                    몸무게
                  </span>

                  <strong>
                    {formatSignedNumber(
                      weightDifference,
                      1,
                    )}
                    kg
                  </strong>
                </div>

                <div
                  style={
                    styles.changeItem
                  }
                >
                  <span>
                    최초 대비 점수
                  </span>

                  <strong>
                    {totalScoreDifference ===
                    null
                      ? '-'
                      : `${formatSignedNumber(
                          totalScoreDifference,
                          0,
                        )}점`}
                  </strong>
                </div>
              </div>
            </article>
          )}

          <article
            style={
              styles.chartCard
            }
          >
            <div
              style={
                styles.chartHeader
              }
            >
              <div>
                <p
                  style={
                    styles.formEyebrow
                  }
                >
                  BODY TREND
                </p>

                <h4
                  style={
                    styles.formTitle
                  }
                >
                  체성분 변화 그래프
                </h4>
              </div>

              <span
                style={
                  styles.chartCount
                }
              >
                최근 최대 12회
              </span>
            </div>

            <div
              style={
                styles.metricTabs
              }
            >
              {chartMetrics.map(
                (metric) => {
                  const isActive =
                    selectedMetricId ===
                    metric.id

                  return (
                    <button
                      key={
                        metric.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedMetricId(
                          metric.id,
                        )
                      }
                      style={{
                        ...styles.metricButton,

                        ...(isActive
                          ? styles.metricButtonActive
                          : {}),
                      }}
                    >
                      {metric.label}
                    </button>
                  )
                },
              )}
            </div>

            <BodyFitLineChart
              records={records}
              metric={
                selectedMetric
              }
            />

            {records.length === 1 && (
              <p
                style={
                  styles.chartNotice
                }
              >
                다음 측정부터 변화
                추세가 선으로
                연결됩니다.
              </p>
            )}
          </article>

          <article
            style={styles.card}
          >
            <p
              style={
                styles.formEyebrow
              }
            >
              SCORE BREAKDOWN
            </p>

            <h4
              style={
                styles.formTitle
              }
            >
              항목별 점수
            </h4>

            <div
              style={
                styles.scoreList
              }
            >
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
                      key={
                        item.label
                      }
                      style={
                        styles.scoreItem
                      }
                    >
                      <div
                        style={
                          styles.scoreItemHead
                        }
                      >
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

                      <div
                        style={
                          styles.track
                        }
                      >
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

          <article
            style={styles.card}
          >
            <p
              style={
                styles.formEyebrow
              }
            >
              BODY DATA
            </p>

            <h4
              style={
                styles.formTitle
              }
            >
              현재 체성분
            </h4>

            <div
              style={
                styles.dataGrid
              }
            >
              <div
                style={
                  styles.dataItem
                }
              >
                <span>FFMI</span>

                <strong>
                  {formatNumber(
                    latestRecord.ffmi,
                  )}
                </strong>
              </div>

              <div
                style={
                  styles.dataItem
                }
              >
                <span>
                  제지방량
                </span>

                <strong>
                  {formatNumber(
                    latestRecord
                      .lean_mass,
                  )}
                  kg
                </strong>
              </div>

              <div
                style={
                  styles.dataItem
                }
              >
                <span>
                  체지방률
                </span>

                <strong>
                  {formatNumber(
                    latestRecord
                      .body_fat_percent,
                  )}
                  %
                </strong>
              </div>

              <div
                style={
                  styles.dataItem
                }
              >
                <span>
                  키-몸무게 값
                </span>

                <strong>
                  {formatNumber(
                    latestRecord
                      .height_weight_value,
                  )}
                </strong>
              </div>
            </div>
          </article>

          <article
            style={styles.card}
          >
            <p
              style={
                styles.formEyebrow
              }
            >
              SCORE HISTORY
            </p>

            <h4
              style={
                styles.formTitle
              }
            >
              측정 기록
            </h4>

            <div
              style={
                styles.historyList
              }
            >
              {records
                .slice(0, 12)
                .map(
                  (
                    record,
                    index,
                  ) => (
                    <div
                      key={
                        record.id
                      }
                      style={
                        styles.historyItem
                      }
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

                      <div
                        style={
                          styles.historyScore
                        }
                      >
                        <strong>
                          {
                            record
                              .body_fit_total_score
                          }
                        </strong>

                        <span>
                          {index === 0
                            ? '최신 기록'
                            : record
                                .body_fit_grade}
                        </span>
                      </div>
                    </div>
                  ),
                )}
            </div>
          </article>

          <p
            style={
              styles.notice
            }
          >
            Body Fit Score는 체성분
            기반 참고 지표입니다.
            러닝 능력, 근력, 기술,
            컨디션을 포함한 HYROX
            경기력 종합점수는
            아닙니다.
          </p>
        </>
      ) : (
        !formOpen && (
          <article
            style={
              styles.emptyCard
            }
          >
            <span
              style={
                styles.emptyBadge
              }
            >
              NO SCORE
            </span>

            <h3>
              아직 측정 기록이
              없습니다.
            </h3>

            <p>
              키, 몸무게, 체지방률을
              입력해 첫 Body Fit
              Score를 확인해 보세요.
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
    justifyContent:
      'space-between',
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
    justifyContent:
      'space-between',
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

  openButtonDisabled: {
    background: '#dce4e0',
    color: '#7b8681',
    cursor: 'not-allowed',
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
    border:
      '1px solid #cdded6',
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
    border:
      '1px solid #d5ddda',
    borderRadius: '11px',
    background: '#ffffff',
    fontSize: '14px',
  },

  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    border:
      '1px solid #d5ddda',
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
    justifyContent:
      'space-between',
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
    justifyContent:
      'space-between',
    gap: '10px',
    color: '#bdd3ca',
    fontSize: '11px',
  },

  nextMeasurementCard: {
    display: 'grid',
    gap: '9px',
    padding: '17px',
    borderRadius: '17px',
    background: '#eef4f1',
    border:
      '1px solid #d5e2dc',
  },

  nextMeasurementReady: {
    display: 'grid',
    gap: '9px',
    padding: '17px',
    borderRadius: '17px',
    background: '#e2f1e9',
    border:
      '1px solid #b9d8ca',
  },

  nextMeasurementTop: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },

  nextBadge: {
    display: 'inline-block',
    width: 'fit-content',
    marginBottom: '6px',
    padding: '5px 8px',
    borderRadius: '999px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: '900',
    letterSpacing: '0.08em',
  },

  nextTitle: {
    margin: 0,
    color: '#17342a',
    fontSize: '15px',
  },

  nextText: {
    margin: 0,
    color: '#66736e',
    fontSize: '12px',
    lineHeight: 1.55,
  },

  nextDate: {
    color: '#0b6b4f',
    fontSize: '11px',
    textAlign: 'right',
  },

  changeCard: {
    display: 'grid',
    gap: '14px',
    padding: '19px',
    borderRadius: '18px',
    background: '#ffffff',
  },

  changeGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '9px',
  },

  changeItem: {
    display: 'grid',
    gap: '5px',
    padding: '13px',
    borderRadius: '13px',
    background: '#f1f5f3',
  },

  chartCard: {
    display: 'grid',
    gap: '15px',
    padding: '19px',
    borderRadius: '18px',
    background: '#ffffff',
  },

  chartHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'flex-end',
    gap: '12px',
  },

  chartCount: {
    color: '#87928e',
    fontSize: '10px',
    fontWeight: '800',
  },

  metricTabs: {
    display: 'flex',
    gap: '6px',
    overflowX: 'auto',
    paddingBottom: '2px',
  },

  metricButton: {
    flexShrink: 0,
    minHeight: '34px',
    padding: '7px 11px',
    border: 'none',
    borderRadius: '999px',
    background: '#edf1ef',
    color: '#65716c',
    fontSize: '10px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  metricButtonActive: {
    background: '#0b3d2e',
    color: '#ffffff',
  },

  chartWrap: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: '14px',
    background: '#f8faf9',
  },

  chartEmpty: {
    padding: '40px 15px',
    textAlign: 'center',
    color: '#87928e',
    fontSize: '12px',
  },

  chartNotice: {
    margin: 0,
    color: '#7b8681',
    fontSize: '10px',
    lineHeight: 1.5,
    textAlign: 'center',
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
    justifyContent:
      'space-between',
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
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 0',
    borderBottom:
      '1px solid #e7ebe9',
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