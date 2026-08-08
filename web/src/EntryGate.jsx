import {
  useEffect,
  useState,
} from 'react'

import AuthGate from './AuthGate.jsx'
import MembershipFunnelLayer from './MembershipFunnelLayer.jsx'
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

function getAppUrl() {
  return new URL(
    import.meta.env.BASE_URL,
    window.location.origin,
  ).toString()
}

function EntryGate() {
  const [session, setSession] =
    useState(undefined)

  const [sessionProfile, setSessionProfile] =
    useState(undefined)

  const [SelfTrialApp, setSelfTrialApp] =
    useState(null)

  const [view, setView] =
    useState('welcome')

  const [signupForm, setSignupForm] =
    useState({
      fullName: '',
      email: '',
      phone: '',
      trainingGoal: '',
      referrerName: '',
      password: '',
      passwordConfirm: '',
      privacyConsent: false,
    })

  const [signupLoading, setSignupLoading] =
    useState(false)

  const [signupError, setSignupError] =
    useState('')

  const [signupMessage, setSignupMessage] =
    useState('')

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      const { data, error } =
        await supabase.auth.getSession()

      if (!mounted) {
        return
      }

      if (error) {
        console.error(
          '초기 세션 확인 실패:',
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
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const prepareSessionProfile =
      async () => {
        if (!session?.user?.id) {
          setSessionProfile(null)
          setSelfTrialApp(null)
          return
        }

        setSessionProfile(undefined)

        try {
          const {
            data,
            error,
          } = await supabase
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
              trial_started_at,
              trial_ends_at,
              access_override_until,
              signup_source,
              referrer_name
            `)
            .eq('id', session.user.id)
            .single()

          if (error) {
            throw error
          }

          if (!mounted) {
            return
          }

          setSessionProfile(data)

          if (
            data.signup_source ===
            'self_trial'
          ) {
            try {
              await loadWeeklyProgramsFromSupabase()
            } catch (programError) {
              console.error(
                '프로그램 동기화 실패:',
                programError,
              )
            }

            const appModule =
              await import('./App.jsx')

            if (mounted) {
              setSelfTrialApp(
                () => appModule.default,
              )
            }
          } else {
            setSelfTrialApp(null)
          }
        } catch (error) {
          console.error(
            '로그인 프로필 확인 실패:',
            error,
          )

          if (mounted) {
            setSessionProfile(null)
            setSelfTrialApp(null)
          }
        }
      }

    prepareSessionProfile()

    return () => {
      mounted = false
    }
  }, [session?.user?.id])

  const handleSelfTrialLogout =
    async () => {
      const { error } =
        await supabase.auth.signOut({
          scope: 'local',
        })

      if (error) {
        alert(
          '로그아웃에 실패했습니다.',
        )
        return
      }

      window.location.reload()
    }

  const updateSignupForm = (
    name,
    value,
  ) => {
    setSignupForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSignup = async (
    event,
  ) => {
    event.preventDefault()

    const fullName =
      signupForm.fullName.trim()

    const normalizedEmail =
      signupForm.email
        .trim()
        .toLowerCase()

    const normalizedPhone =
      signupForm.phone.replace(
        /[^0-9]/g,
        '',
      )

    const referrerName =
      signupForm.referrerName.trim()

    setSignupError('')
    setSignupMessage('')

    if (fullName.length < 2) {
      setSignupError(
        '이름을 두 글자 이상 입력해 주세요.',
      )
      return
    }

    if (
      normalizedPhone.length < 10 ||
      normalizedPhone.length > 11
    ) {
      setSignupError(
        '휴대전화 번호를 정확하게 입력해 주세요.',
      )
      return
    }

    if (!signupForm.trainingGoal) {
      setSignupError(
        '운동 목표를 선택해 주세요.',
      )
      return
    }

    if (
      signupForm.password.length < 8
    ) {
      setSignupError(
        '비밀번호를 8자 이상 입력해 주세요.',
      )
      return
    }

    if (
      signupForm.password !==
      signupForm.passwordConfirm
    ) {
      setSignupError(
        '비밀번호가 서로 일치하지 않습니다.',
      )
      return
    }

    if (!signupForm.privacyConsent) {
      setSignupError(
        '개인정보 수집 및 이용에 동의해 주세요.',
      )
      return
    }

    setSignupLoading(true)

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password:
            signupForm.password,
          options: {
            emailRedirectTo:
              getAppUrl(),
            data: {
              full_name: fullName,
              phone: normalizedPhone,
              training_goal:
                signupForm.trainingGoal,
              referrer_name:
                referrerName,
              signup_source:
                'self_trial',
              privacy_consent: true,
            },
          },
        })

      if (error) {
        throw error
      }

      if (data.session) {
        setSignupMessage(
          '계정이 생성되었습니다. NTAC를 준비하고 있습니다.',
        )
        return
      }

      setSignupMessage(
        '계정이 생성되었습니다. 이메일 인증 메일을 확인한 뒤 로그인해 주세요.',
      )
    } catch (error) {
      console.error(
        '셀프 회원가입 실패:',
        error,
      )

      const message =
        String(error?.message || '')

      if (
        message
          .toLowerCase()
          .includes('already')
      ) {
        setSignupError(
          '이미 가입된 이메일입니다. 기존 계정으로 로그인해 주세요.',
        )
      } else {
        setSignupError(
          message ||
            '계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
        )
      }
    } finally {
      setSignupLoading(false)
    }
  }

  if (session === undefined) {
    return (
      <main style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <p style={styles.eyebrow}>
            NTAC PLATFORM
          </p>

          <h2 style={styles.title}>
            NTAC를 준비하고 있습니다.
          </h2>
        </div>
      </main>
    )
  }

  if (session) {
    if (sessionProfile === undefined) {
      return (
        <main style={styles.loadingPage}>
          <div style={styles.loadingCard}>
            <p style={styles.eyebrow}>
              NTAC PLATFORM
            </p>

            <h2 style={styles.title}>
              계정을 확인하고 있습니다.
            </h2>
          </div>
        </main>
      )
    }

    if (
      sessionProfile?.signup_source ===
      'self_trial'
    ) {
      if (!SelfTrialApp) {
        return (
          <main style={styles.loadingPage}>
            <div style={styles.loadingCard}>
              <p style={styles.eyebrow}>
                NTAC PLATFORM
              </p>

              <h2 style={styles.title}>
                프로그램을 준비하고 있습니다.
              </h2>
            </div>
          </main>
        )
      }

      return (
        <>
          <div style={styles.accountBar}>
            <span style={styles.userName}>
              {sessionProfile.full_name ||
                sessionProfile.email}
            </span>

            <button
              type="button"
              onClick={handleSelfTrialLogout}
              style={styles.logoutButton}
            >
              로그아웃
            </button>
          </div>

          <SelfTrialApp
            profile={sessionProfile}
          />

          <MembershipFunnelLayer />
        </>
      )
    }

    return (
      <>
        <AuthGate />
        <MembershipFunnelLayer />
      </>
    )
  }

  if (view === 'login') {
    return (
      <>
        <AuthGate />

        <button
          type="button"
          onClick={() =>
            setView('welcome')
          }
          style={styles.backFloatingButton}
        >
          ← 처음으로
        </button>
      </>
    )
  }

  if (view === 'signup') {
    return (
      <main style={styles.signupPage}>
        <section style={styles.signupCard}>
          <button
            type="button"
            onClick={() => {
              setView('welcome')
              setSignupError('')
              setSignupMessage('')
            }}
            style={styles.backButton}
          >
            ← 돌아가기
          </button>

          <p style={styles.eyebrow}>
            7-DAY FREE TRIAL
          </p>

          <h1 style={styles.title}>
            NTAC를 직접 경험해보세요.
          </h1>

          <p style={styles.description}>
            계정을 만든 뒤 7일 무료체험을 시작하면 RUN과 HYROX BUILD를 이용할 수 있습니다. 자동 결제는 없습니다.
          </p>

          <div style={styles.trialSummary}>
            <strong>
              NTAC BUILD · 7일 무료
            </strong>
            <span>
              RUN + 런트레이너 + HYROX BUILD
            </span>
          </div>

          <form
            onSubmit={handleSignup}
            style={styles.form}
          >
            <label style={styles.label}>
              이름
              <input
                type="text"
                value={
                  signupForm.fullName
                }
                onChange={(event) =>
                  updateSignupForm(
                    'fullName',
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
              이메일
              <input
                type="email"
                value={signupForm.email}
                onChange={(event) =>
                  updateSignupForm(
                    'email',
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
              휴대전화 번호
              <input
                type="tel"
                value={signupForm.phone}
                onChange={(event) =>
                  updateSignupForm(
                    'phone',
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
              가장 중요한 운동 목표
              <select
                value={
                  signupForm.trainingGoal
                }
                onChange={(event) =>
                  updateSignupForm(
                    'trainingGoal',
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
              추천인
              <input
                type="text"
                value={
                  signupForm.referrerName
                }
                onChange={(event) =>
                  updateSignupForm(
                    'referrerName',
                    event.target.value,
                  )
                }
                placeholder="추천인이 있다면 이름 입력 (선택)"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              비밀번호
              <input
                type="password"
                value={
                  signupForm.password
                }
                onChange={(event) =>
                  updateSignupForm(
                    'password',
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
                  signupForm.passwordConfirm
                }
                onChange={(event) =>
                  updateSignupForm(
                    'passwordConfirm',
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

            <label style={styles.consentField}>
              <input
                type="checkbox"
                checked={
                  signupForm.privacyConsent
                }
                onChange={(event) =>
                  updateSignupForm(
                    'privacyConsent',
                    event.target.checked,
                  )
                }
                required
              />

              <span>
                개인정보 수집 및 이용에 동의합니다.
                <small>
                  입력 정보는 회원 식별, 체험 운영 및 훈련 서비스 제공을 위해 사용됩니다.
                </small>
              </span>
            </label>

            {signupError && (
              <p style={styles.errorBox}>
                {signupError}
              </p>
            )}

            {signupMessage && (
              <p style={styles.successBox}>
                {signupMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={signupLoading}
              style={{
                ...styles.primaryButton,
                opacity: signupLoading
                  ? 0.6
                  : 1,
              }}
            >
              {signupLoading
                ? '계정 만드는 중...'
                : '계정 만들기'}
            </button>

            {signupMessage && (
              <button
                type="button"
                onClick={() =>
                  setView('login')
                }
                style={styles.secondaryButton}
              >
                로그인으로 이동
              </button>
            )}
          </form>
        </section>
      </main>
    )
  }

  return (
    <main style={styles.welcomePage}>
      <section style={styles.heroCard}>
        <p style={styles.eyebrowLight}>
          NOLTO TRAINING ATHLETE CLUB
        </p>

        <h1 style={styles.heroTitle}>
          HYROX를 위한 훈련을
          {' '}
          더 체계적으로.
        </h1>

        <p style={styles.heroDescription}>
          개인 페이스 기반 RUN, 런트레이너, HYROX BUILD 프로그램을 7일 동안 무료로 경험해보세요.
        </p>

        <div style={styles.featureGrid}>
          <div style={styles.featureCard}>
            <span>RUN</span>
            <strong>개인 페이스 기반</strong>
          </div>

          <div style={styles.featureCard}>
            <span>BUILD</span>
            <strong>HYROX 보강</strong>
          </div>

          <div style={styles.featureCard}>
            <span>7 DAYS</span>
            <strong>무료 · 자동결제 없음</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setView('signup')
          }
          style={styles.heroButton}
        >
          7일 무료체험 시작하기
        </button>

        <button
          type="button"
          onClick={() =>
            setView('login')
          }
          style={styles.heroSecondaryButton}
        >
          기존 계정 로그인
        </button>
      </section>
    </main>
  )
}

const styles = {
  welcomePage: {
    minHeight: '100dvh',
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
    padding: '24px',
    background:
      'linear-gradient(155deg, #061d16 0%, #0b3d2e 68%, #11563f 100%)',
    color: '#ffffff',
  },

  heroCard: {
    width: '100%',
    maxWidth: '480px',
    boxSizing: 'border-box',
    padding: '34px 26px',
    borderRadius: '28px',
    background:
      'rgba(255, 255, 255, 0.06)',
    border:
      '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow:
      '0 30px 90px rgba(0, 0, 0, 0.24)',
  },

  eyebrowLight: {
    margin: '0 0 14px',
    color: '#99cfb7',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '0.13em',
  },

  heroTitle: {
    margin: 0,
    fontSize: '36px',
    lineHeight: 1.16,
    letterSpacing: '-0.05em',
  },

  heroDescription: {
    margin: '18px 0 0',
    color: '#d5e6df',
    fontSize: '15px',
    lineHeight: 1.65,
  },

  featureGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, minmax(0, 1fr))',
    gap: '8px',
    marginTop: '25px',
  },

  featureCard: {
    display: 'grid',
    gap: '5px',
    padding: '12px 9px',
    borderRadius: '14px',
    background:
      'rgba(255, 255, 255, 0.08)',
    border:
      '1px solid rgba(255, 255, 255, 0.08)',
  },

  heroButton: {
    width: '100%',
    minHeight: '54px',
    marginTop: '25px',
    border: 'none',
    borderRadius: '15px',
    background: '#ffffff',
    color: '#0b3d2e',
    fontSize: '15px',
    fontWeight: 900,
    cursor: 'pointer',
  },

  heroSecondaryButton: {
    width: '100%',
    minHeight: '48px',
    marginTop: '9px',
    border:
      '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '14px',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  signupPage: {
    minHeight: '100dvh',
    display: 'flex',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: '26px 18px 60px',
    background: '#071f18',
  },

  signupCard: {
    width: '100%',
    maxWidth: '520px',
    boxSizing: 'border-box',
    padding: '28px 22px',
    borderRadius: '26px',
    background: '#ffffff',
    color: '#10251e',
  },

  loadingPage: {
    minHeight: '100dvh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    background: '#071f18',
  },

  loadingCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '28px',
    borderRadius: '22px',
    background: '#ffffff',
  },

  eyebrow: {
    margin: '0 0 9px',
    color: '#0b6b4f',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.13em',
  },

  title: {
    margin: 0,
    color: '#10251e',
    fontSize: '28px',
    lineHeight: 1.25,
    letterSpacing: '-0.04em',
  },

  description: {
    margin: '12px 0 22px',
    color: '#697872',
    fontSize: '14px',
    lineHeight: 1.65,
  },

  trialSummary: {
    display: 'grid',
    gap: '5px',
    marginBottom: '20px',
    padding: '16px',
    borderRadius: '16px',
    background: '#edf5f1',
    color: '#17352c',
  },

  form: {
    display: 'grid',
    gap: '15px',
  },

  label: {
    display: 'grid',
    gap: '7px',
    color: '#33463f',
    fontSize: '13px',
    fontWeight: 800,
  },

  input: {
    width: '100%',
    minWidth: 0,
    minHeight: '48px',
    boxSizing: 'border-box',
    padding: '12px 14px',
    border: '1px solid #d5dfdb',
    borderRadius: '12px',
    background: '#ffffff',
    color: '#10251e',
    fontSize: '15px',
  },

  consentField: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '14px',
    borderRadius: '13px',
    background: '#f1f4f2',
    color: '#43554e',
    fontSize: '12px',
    fontWeight: 800,
    lineHeight: 1.55,
    cursor: 'pointer',
  },

  primaryButton: {
    width: '100%',
    minHeight: '51px',
    border: 'none',
    borderRadius: '13px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 900,
    cursor: 'pointer',
  },

  secondaryButton: {
    width: '100%',
    minHeight: '47px',
    border: '1px solid #d7dfdc',
    borderRadius: '13px',
    background: '#ffffff',
    color: '#33463f',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },

  backButton: {
    margin: '0 0 20px',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: '#597069',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  backFloatingButton: {
    position: 'fixed',
    left: '14px',
    top: '14px',
    zIndex: 20000,
    padding: '8px 11px',
    border: '1px solid #d9e1de',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#17352c',
    fontSize: '11px',
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow:
      '0 5px 18px rgba(0, 0, 0, 0.12)',
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

  userName: {
    maxWidth: '120px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    color: '#17352c',
    fontSize: '11px',
    fontWeight: 800,
  },

  logoutButton: {
    padding: '7px 10px',
    border: '1px solid #d6dedb',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#17352c',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  errorBox: {
    margin: 0,
    padding: '12px',
    borderRadius: '11px',
    background: '#fff0f0',
    color: '#b52d2d',
    fontSize: '12px',
    fontWeight: 800,
    lineHeight: 1.5,
  },

  successBox: {
    margin: 0,
    padding: '12px',
    borderRadius: '11px',
    background: '#eaf5ef',
    color: '#0b6b4f',
    fontSize: '12px',
    fontWeight: 800,
    lineHeight: 1.5,
  },
}

export default EntryGate
