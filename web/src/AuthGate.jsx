import {
  useEffect,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'

import {
  loadWeeklyProgramsFromSupabase,
} from './data/weeklyPrograms.js'

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

function AuthGate() {
  const [session, setSession] =
    useState(undefined)

  const [profile, setProfile] =
    useState(null)

  const [
    AppComponent,
    setAppComponent,
  ] = useState(null)

  const [
    appLoading,
    setAppLoading,
  ] = useState(false)

  const [
    bootMessage,
    setBootMessage,
  ] = useState('')

  const [
    accountSetupRequired,
    setAccountSetupRequired,
  ] = useState(false)

  const [setupName, setSetupName] =
    useState('')

  const [setupSex, setSetupSex] =
    useState('')

  const [
    setupBirthDate,
    setSetupBirthDate,
  ] = useState('')

  const [setupPhone, setSetupPhone] =
    useState('')

  const [
    setupTrainingGoal,
    setSetupTrainingGoal,
  ] = useState('')

  const [
    setupTrainingExperience,
    setSetupTrainingExperience,
  ] = useState('')

  const [
    setupBodyFitEnabled,
    setSetupBodyFitEnabled,
  ] = useState(false)

  const [
    setupMeasurementMethod,
    setSetupMeasurementMethod,
  ] = useState('inbody')

  const [
    setupHeightCm,
    setSetupHeightCm,
  ] = useState('')

  const [
    setupWeightKg,
    setSetupWeightKg,
  ] = useState('')

  const [
    setupBodyFatPercent,
    setSetupBodyFatPercent,
  ] = useState('')

  const [
    setupPrivacyConsent,
    setSetupPrivacyConsent,
  ] = useState(false)

  const [
    setupPassword,
    setSetupPassword,
  ] = useState('')

  const [
    setupPasswordConfirm,
    setSetupPasswordConfirm,
  ] = useState('')

  const [
    setupLoading,
    setSetupLoading,
  ] = useState(false)

  const [
    setupError,
    setSetupError,
  ] = useState('')

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [
    loginLoading,
    setLoginLoading,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      const {
        data,
        error,
      } =
        await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (error) {
        console.error(
          '세션 조회 실패:',
          error,
        )

        setSession(null)
        return
      }

      setSession(data.session)
    }

    loadSession()

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          setSession(nextSession)
        },
      )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const prepareApp = async () => {
      if (!session?.user?.id) {
        setProfile(null)
        setAppComponent(null)
        setAccountSetupRequired(false)
        setAppLoading(false)
        return
      }

      setAppLoading(true)
      setErrorMessage('')

      setBootMessage(
        '회원 정보와 최신 프로그램을 불러오고 있습니다.',
      )

      try {
        const {
          data,
          error,
        } = await supabase
          .from('profiles')
          .select(
            `
              id,
              email,
              full_name,
              role,
              membership,
              membership_status,
              coach_care,
              coach_name,
              onboarding_completed,
              sex,
              birth_date,
              phone,
              training_goal,
              training_experience,
              privacy_consent_at
            `,
          )
          .eq(
            'id',
            session.user.id,
          )
          .single()

        if (error) {
          throw error
        }

        if (!isMounted) {
          return
        }

        setProfile(data)

        if (
          data.onboarding_completed !==
          true
        ) {
          setSetupName(
            data.full_name || '',
          )

          setSetupSex(
            data.sex || '',
          )

          setSetupBirthDate(
            data.birth_date || '',
          )

          setSetupPhone(
            data.phone || '',
          )

          setSetupTrainingGoal(
            data.training_goal || '',
          )

          setSetupTrainingExperience(
            data.training_experience ||
              '',
          )

          setSetupPrivacyConsent(
            Boolean(
              data.privacy_consent_at,
            ),
          )

          setAccountSetupRequired(true)
          setAppComponent(null)
          return
        }

        setAccountSetupRequired(false)

        try {
          await loadWeeklyProgramsFromSupabase()

          setBootMessage(
            '최신 프로그램을 불러왔습니다.',
          )
        } catch (programError) {
          console.error(
            '프로그램 동기화 실패:',
            programError,
          )

          setBootMessage(
            '프로그램 동기화에 실패해 기존 데이터를 사용합니다.',
          )
        }

        const appModule =
          await import('./App.jsx')

        if (!isMounted) {
          return
        }

        setAppComponent(
          () => appModule.default,
        )
      } catch (error) {
        console.error(
          '앱 준비 실패:',
          error,
        )

        if (isMounted) {
          setProfile(null)

          setErrorMessage(
            error.message ||
              '앱 정보를 불러오지 못했습니다.',
          )
        }
      } finally {
        if (isMounted) {
          setAppLoading(false)
        }
      }
    }

    prepareApp()

    return () => {
      isMounted = false
    }
  }, [session?.user?.id])

  const handleAccountSetup = async (
    event,
  ) => {
    event.preventDefault()

    const normalizedName =
      setupName.trim()

    const normalizedPhone =
      setupPhone.replace(
        /[^0-9]/g,
        '',
      )

    if (normalizedName.length < 2) {
      setSetupError(
        '이름을 두 글자 이상 입력해 주세요.',
      )
      return
    }

    if (!setupSex) {
      setSetupError(
        '성별을 선택해 주세요.',
      )
      return
    }

    if (!setupBirthDate) {
      setSetupError(
        '생년월일을 입력해 주세요.',
      )
      return
    }

    if (
      new Date(setupBirthDate) >
      new Date()
    ) {
      setSetupError(
        '생년월일을 정확하게 입력해 주세요.',
      )
      return
    }

    if (
      normalizedPhone.length < 10 ||
      normalizedPhone.length > 11
    ) {
      setSetupError(
        '휴대전화 번호를 정확하게 입력해 주세요.',
      )
      return
    }

    if (!setupTrainingGoal) {
      setSetupError(
        '운동 목표를 선택해 주세요.',
      )
      return
    }

    if (!setupTrainingExperience) {
      setSetupError(
        '운동 경력을 선택해 주세요.',
      )
      return
    }

    if (setupPassword.length < 8) {
      setSetupError(
        '비밀번호를 8자 이상 입력해 주세요.',
      )
      return
    }

    if (
      setupPassword !==
      setupPasswordConfirm
    ) {
      setSetupError(
        '비밀번호가 서로 일치하지 않습니다.',
      )
      return
    }

    if (!setupPrivacyConsent) {
      setSetupError(
        '개인정보 수집 및 이용에 동의해 주세요.',
      )
      return
    }

    let bodyHeightCm = null
    let bodyWeightKg = null
    let bodyFatPercent = null

    if (setupBodyFitEnabled) {
      bodyHeightCm =
        Number(setupHeightCm)

      bodyWeightKg =
        Number(setupWeightKg)

      bodyFatPercent =
        Number(
          setupBodyFatPercent,
        )

      if (
        !bodyHeightCm ||
        bodyHeightCm < 100 ||
        bodyHeightCm > 250
      ) {
        setSetupError(
          '키를 정확하게 입력해 주세요.',
        )
        return
      }

      if (
        !bodyWeightKg ||
        bodyWeightKg < 25 ||
        bodyWeightKg > 300
      ) {
        setSetupError(
          '몸무게를 정확하게 입력해 주세요.',
        )
        return
      }

      if (
        !bodyFatPercent ||
        bodyFatPercent < 1 ||
        bodyFatPercent > 70
      ) {
        setSetupError(
          '체지방률을 정확하게 입력해 주세요.',
        )
        return
      }
    }

    setSetupLoading(true)
    setSetupError('')

    try {
      const {
        error: userUpdateError,
      } =
        await supabase.auth.updateUser({
          password: setupPassword,

          data: {
            full_name:
              normalizedName,
          },
        })

      if (userUpdateError) {
        throw userUpdateError
      }

      const {
        error: profileUpdateError,
      } = await supabase.rpc(
        'complete_account_profile',
        {
          profile_full_name:
            normalizedName,

          profile_sex:
            setupSex,

          profile_birth_date:
            setupBirthDate,

          profile_phone:
            normalizedPhone,

          profile_training_goal:
            setupTrainingGoal,

          profile_training_experience:
            setupTrainingExperience,

          body_height_cm:
            bodyHeightCm,

          body_weight_kg:
            bodyWeightKg,

          body_fat_percent:
            bodyFatPercent,

          body_measurement_method:
            setupMeasurementMethod,
        },
      )

      if (profileUpdateError) {
        throw profileUpdateError
      }

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname,
      )

      window.location.reload()
    } catch (error) {
      console.error(
        '계정 설정 실패:',
        error,
      )

      setSetupError(
        error.message ||
          '계정 설정을 완료하지 못했습니다.',
      )
    } finally {
      setSetupLoading(false)
    }
  }

  const handleLogin = async (
    event,
  ) => {
    event.preventDefault()

    setLoginLoading(true)
    setErrorMessage('')

    const { error } =
      await supabase.auth
        .signInWithPassword({
          email: email.trim(),
          password,
        })

    if (error) {
      console.error(
        '로그인 실패:',
        error,
      )

      setErrorMessage(
        '이메일 또는 비밀번호를 확인해 주세요.',
      )
    }

    setLoginLoading(false)
  }

  const handleLogout = async () => {
    const { error } =
      await supabase.auth.signOut({
        scope: 'local',
      })

    if (error) {
      console.error(
        '로그아웃 실패:',
        error,
      )

      alert(
        '로그아웃에 실패했습니다.',
      )
      return
    }

    window.location.reload()
  }

  if (
    session === undefined ||
    appLoading
  ) {
    return (
      <main style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <p style={styles.eyebrow}>
            NTAC PLATFORM
          </p>

          <h2 style={styles.loadingTitle}>
            앱을 준비하고 있습니다.
          </h2>

          <p style={styles.description}>
            {bootMessage ||
              '로그인 정보를 확인하고 있습니다.'}
          </p>
        </div>
      </main>
    )
  }

  if (
    session &&
    accountSetupRequired
  ) {
    return (
      <main style={styles.setupPage}>
        <section style={styles.setupCard}>
          <p style={styles.eyebrow}>
            WELCOME TO NTAC
          </p>

          <h1 style={styles.title}>
            계정 및 개인정보 설정
          </h1>

          <p style={styles.description}>
            정확한 회원 관리와 개인화된
            훈련 제공을 위해 기본 정보를
            등록해 주세요.
          </p>

          <div style={styles.emailBox}>
            {profile?.email ||
              session.user.email}
          </div>

          <form
            onSubmit={
              handleAccountSetup
            }
            style={styles.form}
          >
            <div style={styles.formSection}>
              <div>
                <p style={styles.sectionEyebrow}>
                  BASIC PROFILE
                </p>

                <h3 style={styles.sectionTitle}>
                  기본 정보
                </h3>
              </div>

              <label style={styles.label}>
                이름

                <input
                  type="text"
                  value={setupName}
                  onChange={(event) =>
                    setSetupName(
                      event.target.value,
                    )
                  }
                  placeholder="이름 입력"
                  autoComplete="name"
                  required
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                성별

                <select
                  value={setupSex}
                  onChange={(event) =>
                    setSetupSex(
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
                  value={
                    setupBirthDate
                  }
                  onChange={(event) =>
                    setSetupBirthDate(
                      event.target.value,
                    )
                  }
                  required
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                휴대전화 번호

                <input
                  type="tel"
                  value={setupPhone}
                  onChange={(event) =>
                    setSetupPhone(
                      event.target.value,
                    )
                  }
                  placeholder="01012345678"
                  autoComplete="tel"
                  required
                  style={styles.input}
                />
              </label>
            </div>

            <div style={styles.formSection}>
              <div>
                <p style={styles.sectionEyebrow}>
                  TRAINING PROFILE
                </p>

                <h3 style={styles.sectionTitle}>
                  훈련 정보
                </h3>
              </div>

              <label style={styles.label}>
                주요 운동 목표

                <select
                  value={
                    setupTrainingGoal
                  }
                  onChange={(event) =>
                    setSetupTrainingGoal(
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
                    setupTrainingExperience
                  }
                  onChange={(event) =>
                    setSetupTrainingExperience(
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
            </div>

            <div style={styles.formSection}>
              <label style={styles.toggleField}>
                <input
                  type="checkbox"
                  checked={
                    setupBodyFitEnabled
                  }
                  onChange={(event) =>
                    setSetupBodyFitEnabled(
                      event.target.checked,
                    )
                  }
                />

                <span>
                  <strong>
                    초기 Body Fit Score
                    등록
                  </strong>

                  <small>
                    지금 입력하지 않아도
                    마이페이지에서 나중에
                    등록할 수 있습니다.
                  </small>
                </span>
              </label>

              {setupBodyFitEnabled && (
                <div style={styles.bodyFitBox}>
                  <p style={styles.sectionEyebrow}>
                    BODY FIT SCORE
                  </p>

                  <label style={styles.label}>
                    측정 방식

                    <select
                      value={
                        setupMeasurementMethod
                      }
                      onChange={(event) =>
                        setSetupMeasurementMethod(
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

                  <div style={styles.inputGrid}>
                    <label style={styles.label}>
                      키(cm)

                      <input
                        type="number"
                        min="100"
                        max="250"
                        step="0.1"
                        value={
                          setupHeightCm
                        }
                        onChange={(event) =>
                          setSetupHeightCm(
                            event.target.value,
                          )
                        }
                        placeholder="180"
                        required={
                          setupBodyFitEnabled
                        }
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.label}>
                      몸무게(kg)

                      <input
                        type="number"
                        min="25"
                        max="300"
                        step="0.1"
                        value={
                          setupWeightKg
                        }
                        onChange={(event) =>
                          setSetupWeightKg(
                            event.target.value,
                          )
                        }
                        placeholder="80"
                        required={
                          setupBodyFitEnabled
                        }
                        style={styles.input}
                      />
                    </label>
                  </div>

                  <label style={styles.label}>
                    체지방률(%)

                    <input
                      type="number"
                      min="1"
                      max="70"
                      step="0.1"
                      value={
                        setupBodyFatPercent
                      }
                      onChange={(event) =>
                        setSetupBodyFatPercent(
                          event.target.value,
                        )
                      }
                      placeholder="20"
                      required={
                        setupBodyFitEnabled
                      }
                      style={styles.input}
                    />
                  </label>
                </div>
              )}
            </div>

            <div style={styles.formSection}>
              <div>
                <p style={styles.sectionEyebrow}>
                  SECURITY
                </p>

                <h3 style={styles.sectionTitle}>
                  비밀번호 설정
                </h3>
              </div>

              <label style={styles.label}>
                새 비밀번호

                <input
                  type="password"
                  value={setupPassword}
                  onChange={(event) =>
                    setSetupPassword(
                      event.target.value,
                    )
                  }
                  placeholder="8자 이상 입력"
                  autoComplete="new-password"
                  minLength="8"
                  required
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                비밀번호 확인

                <input
                  type="password"
                  value={
                    setupPasswordConfirm
                  }
                  onChange={(event) =>
                    setSetupPasswordConfirm(
                      event.target.value,
                    )
                  }
                  placeholder="비밀번호 다시 입력"
                  autoComplete="new-password"
                  minLength="8"
                  required
                  style={styles.input}
                />
              </label>
            </div>

            <label style={styles.consentField}>
              <input
                type="checkbox"
                checked={
                  setupPrivacyConsent
                }
                onChange={(event) =>
                  setSetupPrivacyConsent(
                    event.target.checked,
                  )
                }
                required
              />

              <span>
                개인정보 수집 및 이용에
                동의합니다.

                <small>
                  입력 정보는 회원 식별,
                  훈련 개인화 및 Body Fit
                  Score 계산에 사용됩니다.
                  AI 분석 기능은 추후 별도
                  동의를 받은 경우에만
                  적용됩니다.
                </small>
              </span>
            </label>

            {setupError && (
              <p style={styles.error}>
                {setupError}
              </p>
            )}

            <button
              type="submit"
              disabled={setupLoading}
              style={{
                ...styles.button,

                opacity:
                  setupLoading
                    ? 0.6
                    : 1,
              }}
            >
              {setupLoading
                ? '계정 설정 중...'
                : 'NTAC 시작하기'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <p style={styles.eyebrow}>
            NTAC PLATFORM
          </p>

          <h1 style={styles.title}>
            Welcome, Athlete.
          </h1>

          <p style={styles.description}>
            등록된 계정으로 로그인해 주세요.
          </p>

          <form
            onSubmit={handleLogin}
            style={styles.form}
          >
            <label style={styles.label}>
              이메일

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                placeholder="이메일 입력"
                autoComplete="email"
                required
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              비밀번호

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                placeholder="비밀번호 입력"
                autoComplete="current-password"
                required
                style={styles.input}
              />
            </label>

            {errorMessage && (
              <p style={styles.error}>
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                ...styles.button,

                opacity:
                  loginLoading
                    ? 0.6
                    : 1,
              }}
            >
              {loginLoading
                ? '로그인 중...'
                : '로그인'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  if (
    !profile ||
    !AppComponent
  ) {
    return (
      <main style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <p style={styles.eyebrow}>
            NTAC PLATFORM
          </p>

          <h2 style={styles.loadingTitle}>
            앱을 열지 못했습니다.
          </h2>

          <p style={styles.error}>
            {errorMessage ||
              '회원 정보를 불러오지 못했습니다.'}
          </p>

          <button
            type="button"
            onClick={handleLogout}
            style={styles.button}
          >
            로그인 화면으로 돌아가기
          </button>
        </div>
      </main>
    )
  }

  return (
    <>
      <div style={styles.accountBar}>
        <span style={styles.roleBadge}>
          {profile.role?.toUpperCase() ||
            'USER'}
        </span>

        <span style={styles.userName}>
          {profile.full_name ||
            profile.email}
        </span>

        <button
          type="button"
          onClick={handleLogout}
          style={styles.logoutButton}
        >
          로그아웃
        </button>
      </div>

      <AppComponent
        profile={profile}
      />
    </>
  )
}

const styles = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: '#071f18',
    color: '#ffffff',
  },

  setupPage: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '28px 18px 60px',
    background: '#071f18',
    color: '#ffffff',
  },

  loadingPage: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: '#f5f6f4',
    color: '#10251e',
  },

  loadingCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '32px 24px',
    borderRadius: '24px',
    background: '#ffffff',
    boxSizing: 'border-box',
  },

  loadingTitle: {
    margin: '0 0 8px',
    fontSize: '26px',
  },

  card: {
    width: '100%',
    maxWidth: '420px',
    padding: '32px 24px',
    borderRadius: '24px',
    background: '#ffffff',
    color: '#10251e',
    boxSizing: 'border-box',
  },

  setupCard: {
    width: '100%',
    maxWidth: '560px',
    padding: '30px 22px',
    borderRadius: '24px',
    background: '#ffffff',
    color: '#10251e',
    boxSizing: 'border-box',
  },

  eyebrow: {
    margin: '0 0 12px',
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '0.14em',
    color: '#0b6b4f',
  },

  title: {
    margin: '0 0 8px',
    fontSize: '30px',
  },

  description: {
    margin: '0 0 28px',
    color: '#66736e',
    lineHeight: 1.5,
  },

  emailBox: {
    margin: '-10px 0 22px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#eef3f0',
    color: '#33463f',
    fontSize: '14px',
    fontWeight: '700',
    overflowWrap: 'anywhere',
  },

  form: {
    display: 'grid',
    gap: '18px',
  },

  formSection: {
    display: 'grid',
    gap: '14px',
    padding: '18px',
    borderRadius: '17px',
    background: '#f5f7f6',
  },

  sectionEyebrow: {
    margin: '0 0 4px',
    color: '#0b6b4f',
    fontSize: '10px',
    fontWeight: '900',
    letterSpacing: '0.12em',
  },

  sectionTitle: {
    margin: 0,
    color: '#10251e',
    fontSize: '18px',
  },

  label: {
    display: 'grid',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '700',
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
    boxSizing: 'border-box',
    padding: '14px 16px',
    border: '1px solid #d6dedb',
    borderRadius: '12px',
    background: '#ffffff',
    fontSize: '16px',
  },

  toggleField: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '11px',
    fontSize: '14px',
    cursor: 'pointer',
  },

  consentField: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '11px',
    padding: '16px',
    borderRadius: '14px',
    background: '#eef3f0',
    color: '#33463f',
    fontSize: '13px',
    fontWeight: '800',
    lineHeight: 1.5,
    cursor: 'pointer',
  },

  bodyFitBox: {
    display: 'grid',
    gap: '13px',
    padding: '16px',
    borderRadius: '14px',
    background: '#e6f0eb',
    border: '1px solid #c3d8ce',
  },

  button: {
    width: '100%',
    padding: '15px',
    border: 'none',
    borderRadius: '12px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '800',
    cursor: 'pointer',
  },

  error: {
    margin: 0,
    color: '#c43d3d',
    fontSize: '14px',
    fontWeight: '700',
    lineHeight: 1.5,
  },

  accountBar: {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px',
    borderRadius: '999px',
    background: '#ffffff',
    boxShadow:
      '0 4px 16px rgba(0, 0, 0, 0.12)',
  },

  roleBadge: {
    padding: '6px 9px',
    borderRadius: '999px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: '800',
  },

  userName: {
    maxWidth: '100px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    fontSize: '11px',
    fontWeight: '700',
  },

  logoutButton: {
    padding: '7px 10px',
    border: '1px solid #d6dedb',
    borderRadius: '999px',
    background: '#ffffff',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
  },
}

export default AuthGate