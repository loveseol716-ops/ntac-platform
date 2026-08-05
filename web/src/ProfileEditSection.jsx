import {
  useEffect,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'

const trainingGoalOptions = [
  'HYROX 첫 완주',
  'HYROX 기록 향상',
  '러닝 능력 향상',
  '근력 향상',
  '전반적인 체력 향상',
  '체성분 개선',
]

const trainingExperienceOptions = [
  '6개월 미만',
  '6개월 이상 1년 미만',
  '1년 이상 3년 미만',
  '3년 이상',
]

function ProfileEditSection() {
  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [email, setEmail] =
    useState('')

  const [fullName, setFullName] =
    useState('')

  const [sex, setSex] =
    useState('')

  const [birthDate, setBirthDate] =
    useState('')

  const [phone, setPhone] =
    useState('')

  const [
    trainingGoal,
    setTrainingGoal,
  ] = useState('')

  const [
    trainingExperience,
    setTrainingExperience,
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const {
          data: userData,
          error: userError,
        } =
          await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        const userId =
          userData.user?.id

        if (!userId) {
          throw new Error(
            '로그인 정보를 확인하지 못했습니다.',
          )
        }

        const {
          data,
          error,
        } = await supabase
          .from('profiles')
          .select(
            `
              email,
              full_name,
              sex,
              birth_date,
              phone,
              training_goal,
              training_experience
            `,
          )
          .eq('id', userId)
          .single()

        if (error) {
          throw error
        }

        if (!isMounted) {
          return
        }

        setEmail(
          data.email ||
            userData.user.email ||
            '',
        )

        setFullName(
          data.full_name || '',
        )

        setSex(
          data.sex || '',
        )

        setBirthDate(
          data.birth_date || '',
        )

        setPhone(
          data.phone || '',
        )

        setTrainingGoal(
          data.training_goal || '',
        )

        setTrainingExperience(
          data.training_experience ||
            '',
        )
      } catch (error) {
        console.error(
          '개인정보 조회 실패:',
          error,
        )

        if (isMounted) {
          setErrorMessage(
            error.message ||
              '개인정보를 불러오지 못했습니다.',
          )
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    const normalizedName =
      fullName.trim()

    const normalizedPhone =
      phone.replace(
        /[^0-9]/g,
        '',
      )

    if (normalizedName.length < 2) {
      setErrorMessage(
        '이름을 두 글자 이상 입력해 주세요.',
      )
      return
    }

    if (!sex) {
      setErrorMessage(
        '성별을 선택해 주세요.',
      )
      return
    }

    if (!birthDate) {
      setErrorMessage(
        '생년월일을 입력해 주세요.',
      )
      return
    }

    if (
      new Date(birthDate) >
      new Date()
    ) {
      setErrorMessage(
        '생년월일을 정확하게 입력해 주세요.',
      )
      return
    }

    if (
      normalizedPhone.length < 10 ||
      normalizedPhone.length > 11
    ) {
      setErrorMessage(
        '휴대전화 번호를 정확하게 입력해 주세요.',
      )
      return
    }

    if (!trainingGoal) {
      setErrorMessage(
        '운동 목표를 선택해 주세요.',
      )
      return
    }

    if (!trainingExperience) {
      setErrorMessage(
        '운동 경력을 선택해 주세요.',
      )
      return
    }

    setSaving(true)

    try {
      const {
        error: profileError,
      } = await supabase.rpc(
        'update_my_profile',
        {
          profile_full_name:
            normalizedName,

          profile_sex:
            sex,

          profile_birth_date:
            birthDate,

          profile_phone:
            normalizedPhone,

          profile_training_goal:
            trainingGoal,

          profile_training_experience:
            trainingExperience,
        },
      )

      if (profileError) {
        throw profileError
      }

      /*
       * 로그인 계정의 이름 메타데이터도
       * 프로필 이름과 동일하게 맞춘다.
       */
      const {
        error: authUpdateError,
      } =
        await supabase.auth.updateUser({
          data: {
            full_name:
              normalizedName,
          },
        })

      if (authUpdateError) {
        console.error(
          '계정 이름 동기화 실패:',
          authUpdateError,
        )
      }

      setPhone(normalizedPhone)

      setSuccessMessage(
        '개인정보가 수정되었습니다.',
      )

      window.setTimeout(() => {
        window.location.reload()
      }, 800)
    } catch (error) {
      console.error(
        '개인정보 수정 실패:',
        error,
      )

      setErrorMessage(
        error.message ||
          '개인정보를 수정하지 못했습니다.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <article style={styles.card}>
        <p style={styles.description}>
          개인정보를 불러오고 있습니다.
        </p>
      </article>
    )
  }

  return (
    <article style={styles.card}>
      <div>
        <p style={styles.eyebrow}>
          ATHLETE PROFILE
        </p>

        <h3 style={styles.title}>
          개인정보 수정
        </h3>

        <p style={styles.description}>
          회원 정보와 훈련 목표를
          최신 상태로 관리해 주세요.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={styles.form}
      >
        <label style={styles.label}>
          로그인 이메일

          <input
            type="email"
            value={email}
            disabled
            style={{
              ...styles.input,
              ...styles.disabledInput,
            }}
          />
        </label>

        <label style={styles.label}>
          이름

          <input
            type="text"
            value={fullName}
            onChange={(event) =>
              setFullName(
                event.target.value,
              )
            }
            placeholder="이름 입력"
            autoComplete="name"
            required
            style={styles.input}
          />
        </label>

        <div style={styles.inputGrid}>
          <label style={styles.label}>
            성별

            <select
              value={sex}
              onChange={(event) =>
                setSex(
                  event.target.value,
                )
              }
              required
              style={styles.input}
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

          <label style={styles.label}>
            생년월일

            <input
              type="date"
              value={birthDate}
              onChange={(event) =>
                setBirthDate(
                  event.target.value,
                )
              }
              required
              style={styles.input}
            />
          </label>
        </div>

        <p style={styles.notice}>
          성별을 수정해도 이미 저장된
          Body Fit Score 기록은 다시
          계산되지 않습니다.
        </p>

        <label style={styles.label}>
          휴대전화 번호

          <input
            type="tel"
            value={phone}
            onChange={(event) =>
              setPhone(
                event.target.value,
              )
            }
            placeholder="01012345678"
            autoComplete="tel"
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          주요 운동 목표

          <select
            value={trainingGoal}
            onChange={(event) =>
              setTrainingGoal(
                event.target.value,
              )
            }
            required
            style={styles.input}
          >
            <option value="">
              선택
            </option>

            {trainingGoalOptions.map(
              (goal) => (
                <option
                  key={goal}
                  value={goal}
                >
                  {goal}
                </option>
              ),
            )}
          </select>
        </label>

        <label style={styles.label}>
          운동 경력

          <select
            value={
              trainingExperience
            }
            onChange={(event) =>
              setTrainingExperience(
                event.target.value,
              )
            }
            required
            style={styles.input}
          >
            <option value="">
              선택
            </option>

            {trainingExperienceOptions.map(
              (experience) => (
                <option
                  key={experience}
                  value={experience}
                >
                  {experience}
                </option>
              ),
            )}
          </select>
        </label>

        {errorMessage && (
          <p
            style={styles.error}
            aria-live="polite"
          >
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p
            style={styles.success}
            aria-live="polite"
          >
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
            : '개인정보 저장'}
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
    border: '1px solid #e2e8e5',
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
    gap: '14px',
  },

  inputGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },

  label: {
    display: 'grid',
    gap: '8px',
    color: '#263b33',
    fontSize: '14px',
    fontWeight: '800',
  },

  input: {
    width: '100%',
    minWidth: 0,
    padding: '14px',
    border: '1px solid #d6dedb',
    borderRadius: '12px',
    background: '#ffffff',
    boxSizing: 'border-box',
    fontSize: '16px',
  },

  disabledInput: {
    background: '#f1f3f2',
    color: '#7c8783',
  },

  notice: {
    margin: '-3px 0 2px',
    padding: '11px 12px',
    borderRadius: '10px',
    background: '#fff8e8',
    color: '#70581e',
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: 1.5,
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
    lineHeight: 1.5,
  },

  success: {
    margin: 0,
    padding: '12px',
    borderRadius: '10px',
    background: '#eaf5ef',
    color: '#0b6b4f',
    fontSize: '13px',
    fontWeight: '700',
    lineHeight: 1.5,
  },
}

export default ProfileEditSection