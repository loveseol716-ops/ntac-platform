import {
  useEffect,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'

import {
  loadWeeklyProgramsFromSupabase,
} from './data/weeklyPrograms.js'

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
              onboarding_completed
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

        /*
         * onboarding_completed가 false인
         * 초대 계정은 앱으로 들어가기 전에
         * 이름과 비밀번호를 설정한다.
         */
        if (
          data.onboarding_completed !==
          true
        ) {
          setSetupName(
            data.full_name || '',
          )

          setAccountSetupRequired(true)
          setAppComponent(null)

          return
        }

        setAccountSetupRequired(false)

        /*
         * App을 불러오기 전에
         * 최신 프로그램을 동기화한다.
         */
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

    if (normalizedName.length < 2) {
      setSetupError(
        '이름을 두 글자 이상 입력해 주세요.',
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
      <main style={styles.page}>
        <section style={styles.card}>
          <p style={styles.eyebrow}>
            WELCOME TO NTAC
          </p>

          <h1 style={styles.title}>
            계정 설정
          </h1>

          <p style={styles.description}>
            이름과 새 비밀번호를
            설정해 주세요.
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
                : '계정 설정 완료'}
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

  eyebrow: {
    margin: '0 0 12px',
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '0.14em',
    color: '#0b6b4f',
  },

  title: {
    margin: '0 0 8px',
    fontSize: '32px',
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

  label: {
    display: 'grid',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '700',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '14px 16px',
    border: '1px solid #d6dedb',
    borderRadius: '12px',
    fontSize: '16px',
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
    margin: '0 0 16px',
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