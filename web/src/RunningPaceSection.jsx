import {
  useEffect,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'

function paceToSpeed(
  paceSeconds,
) {
  if (!paceSeconds) {
    return '-'
  }

  return (
    3600 / paceSeconds
  ).toFixed(1)
}

function RunningPaceSection({
  memberId,
}) {
  const [minutes, setMinutes] =
    useState('')

  const [seconds, setSeconds] =
    useState('')

  const [testedAt, setTestedAt] =
    useState(
      new Date()
        .toISOString()
        .slice(0, 10),
    )

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  const totalPaceSeconds =
    Number(minutes || 0) * 60 +
    Number(seconds || 0)

  useEffect(() => {
    let isMounted = true

    const loadRunningProfile =
      async () => {
        if (!memberId) {
          setLoading(false)
          return
        }

        setLoading(true)
        setErrorMessage('')

        const {
          data,
          error,
        } = await supabase
          .from('running_profiles')
          .select(
            `
              average_pace_seconds,
              tested_at
            `,
          )
          .eq('user_id', memberId)
          .maybeSingle()

        if (!isMounted) {
          return
        }

        if (error) {
          console.error(
            '러닝 페이스 조회 실패:',
            error,
          )

          setErrorMessage(
            error.message ||
              '러닝 페이스를 불러오지 못했습니다.',
          )

          setLoading(false)
          return
        }

        if (data) {
          const paceSeconds =
            Number(
              data.average_pace_seconds,
            )

          setMinutes(
            String(
              Math.floor(
                paceSeconds / 60,
              ),
            ),
          )

          setSeconds(
            String(
              paceSeconds % 60,
            ).padStart(2, '0'),
          )

          setTestedAt(
            data.tested_at ||
              new Date()
                .toISOString()
                .slice(0, 10),
          )
        }

        setLoading(false)
      }

    loadRunningProfile()

    return () => {
      isMounted = false
    }
  }, [memberId])

  const handleSave = async (
    event,
  ) => {
    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    const paceMinutes =
      Number(minutes)

    const paceSeconds =
      Number(seconds)

    if (
      Number.isNaN(paceMinutes) ||
      paceMinutes < 2 ||
      paceMinutes > 15
    ) {
      setErrorMessage(
        '평균 페이스의 분을 정확하게 입력해 주세요.',
      )
      return
    }

    if (
      Number.isNaN(paceSeconds) ||
      paceSeconds < 0 ||
      paceSeconds > 59
    ) {
      setErrorMessage(
        '초는 0부터 59 사이로 입력해 주세요.',
      )
      return
    }

    const averagePaceSeconds =
      paceMinutes * 60 +
      paceSeconds

    setSaving(true)

    const {
      error,
    } = await supabase
      .from('running_profiles')
      .upsert(
        {
          user_id: memberId,

          average_pace_seconds:
            averagePaceSeconds,

          test_type:
            '30_min_tt',

          tested_at:
            testedAt,
        },
        {
          onConflict: 'user_id',
        },
      )

    if (error) {
      console.error(
        '러닝 페이스 저장 실패:',
        error,
      )

      setErrorMessage(
        error.message ||
          '평균 페이스를 저장하지 못했습니다.',
      )

      setSaving(false)
      return
    }

    setSuccessMessage(
      '30분 TT 평균 페이스가 저장되었습니다.',
    )

    setSaving(false)
  }

  if (loading) {
    return (
      <article style={styles.card}>
        러닝 페이스를 불러오는
        중입니다.
      </article>
    )
  }

  return (
    <article style={styles.card}>
      <div>
        <p style={styles.eyebrow}>
          RUNNING PROFILE
        </p>

        <h3 style={styles.title}>
          30분 TT 평균 페이스
        </h3>

        <p style={styles.description}>
          30분 타임 트라이얼에서 기록한
          평균 페이스를 입력해 주세요.
          인터벌 페이스와 트레드밀
          속도의 기준으로 사용됩니다.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        style={styles.form}
      >
        <label style={styles.label}>
          테스트 날짜

          <input
            type="date"
            value={testedAt}
            onChange={(event) =>
              setTestedAt(
                event.target.value,
              )
            }
            required
            style={styles.input}
          />
        </label>

        <div>
          <p style={styles.labelText}>
            평균 페이스
          </p>

          <div style={styles.paceRow}>
            <input
              type="number"
              min="2"
              max="15"
              value={minutes}
              onChange={(event) =>
                setMinutes(
                  event.target.value,
                )
              }
              placeholder="5"
              required
              style={styles.paceInput}
            />

            <span style={styles.unit}>
              분
            </span>

            <input
              type="number"
              min="0"
              max="59"
              value={seconds}
              onChange={(event) =>
                setSeconds(
                  event.target.value,
                )
              }
              placeholder="30"
              required
              style={styles.paceInput}
            />

            <span style={styles.unit}>
              초 / km
            </span>
          </div>
        </div>

        {totalPaceSeconds >= 120 && (
          <div style={styles.preview}>
            <span>기준 페이스</span>

            <strong>
              {minutes}:
              {String(
                Number(seconds || 0),
              ).padStart(2, '0')}
              /km
            </strong>

            <span>트레드밀 기준</span>

            <strong>
              {paceToSpeed(
                totalPaceSeconds,
              )}
              km/h
            </strong>
          </div>
        )}

        {errorMessage && (
          <p style={styles.error}>
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p style={styles.success}>
            {successMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            ...styles.button,

            opacity:
              saving ? 0.6 : 1,
          }}
        >
          {saving
            ? '저장 중...'
            : '평균 페이스 저장'}
        </button>
      </form>
    </article>
  )
}

const styles = {
  card: {
    display: 'grid',
    gap: '20px',
    marginTop: '20px',
    padding: '22px 18px',
    borderRadius: '20px',
    background: '#ffffff',
    border:
      '1px solid #e2e8e5',
    boxSizing: 'border-box',
  },

  eyebrow: {
    margin: '0 0 6px',
    color: '#0b6b4f',
    fontSize: '10px',
    fontWeight: '900',
    letterSpacing: '0.12em',
  },

  title: {
    margin: '0 0 7px',
    color: '#10251e',
    fontSize: '20px',
  },

  description: {
    margin: 0,
    color: '#68746f',
    fontSize: '14px',
    lineHeight: 1.5,
  },

  form: {
    display: 'grid',
    gap: '16px',
  },

  label: {
    display: 'grid',
    gap: '8px',
    color: '#263b33',
    fontSize: '14px',
    fontWeight: '800',
  },

  labelText: {
    margin: '0 0 8px',
    color: '#263b33',
    fontSize: '14px',
    fontWeight: '800',
  },

  input: {
    width: '100%',
    padding: '14px',
    border:
      '1px solid #d6dedb',
    borderRadius: '12px',
    background: '#ffffff',
    boxSizing: 'border-box',
    fontSize: '16px',
  },

  paceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  paceInput: {
    width: '72px',
    minWidth: 0,
    padding: '14px 8px',
    border:
      '1px solid #d6dedb',
    borderRadius: '12px',
    background: '#ffffff',
    boxSizing: 'border-box',
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: '800',
  },

  unit: {
    color: '#68746f',
    fontSize: '13px',
    fontWeight: '800',
  },

  preview: {
    display: 'grid',
    gridTemplateColumns:
      '1fr auto',
    gap: '8px 12px',
    padding: '14px',
    borderRadius: '13px',
    background: '#eef4f1',
    color: '#33463f',
    fontSize: '13px',
  },

  button: {
    width: '100%',
    padding: '15px',
    border: 'none',
    borderRadius: '12px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  error: {
    margin: 0,
    padding: '12px',
    borderRadius: '10px',
    background: '#fff0f0',
    color: '#c43d3d',
    fontSize: '13px',
    fontWeight: '700',
  },

  success: {
    margin: 0,
    padding: '12px',
    borderRadius: '10px',
    background: '#eaf5ef',
    color: '#0b6b4f',
    fontSize: '13px',
    fontWeight: '700',
  },
}

export default RunningPaceSection