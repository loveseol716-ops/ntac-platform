import { useState } from 'react'

import { supabase } from './lib/supabase.js'

function PasswordChangeSection() {
  const [
    currentPassword,
    setCurrentPassword,
  ] = useState('')

  const [
    newPassword,
    setNewPassword,
  ] = useState('')

  const [
    newPasswordConfirm,
    setNewPasswordConfirm,
  ] = useState('')

  const [
    changing,
    setChanging,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    if (!currentPassword) {
      setErrorMessage(
        '현재 비밀번호를 입력해 주세요.',
      )

      return
    }

    if (newPassword.length < 8) {
      setErrorMessage(
        '새 비밀번호를 8자 이상 입력해 주세요.',
      )

      return
    }

    if (
      newPassword !==
      newPasswordConfirm
    ) {
      setErrorMessage(
        '새 비밀번호가 서로 일치하지 않습니다.',
      )

      return
    }

    if (
      currentPassword ===
      newPassword
    ) {
      setErrorMessage(
        '현재 비밀번호와 다른 비밀번호를 입력해 주세요.',
      )

      return
    }

    setChanging(true)

    try {
      const {
        data: userData,
        error: userError,
      } =
        await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      const userEmail =
        userData.user?.email

      if (!userEmail) {
        throw new Error(
          '로그인 이메일을 확인하지 못했습니다.',
        )
      }

      /*
       * 현재 비밀번호가 맞는지
       * 동일한 계정으로 다시 인증한다.
       */
      const {
        error: verifyError,
      } =
        await supabase.auth
          .signInWithPassword({
            email: userEmail,
            password:
              currentPassword,
          })

      if (verifyError) {
        setErrorMessage(
          '현재 비밀번호가 일치하지 않습니다.',
        )

        return
      }

      /*
       * 현재 비밀번호 확인 후
       * 새 비밀번호로 변경한다.
       */
      const {
        error: updateError,
      } =
        await supabase.auth
          .updateUser({
            password:
              newPassword,
          })

      if (updateError) {
        throw updateError
      }

      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')

      setSuccessMessage(
        '비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해 주세요.',
      )
    } catch (error) {
      console.error(
        '비밀번호 변경 실패:',
        error,
      )

      setErrorMessage(
        error.message ||
          '비밀번호를 변경하지 못했습니다.',
      )
    } finally {
      setChanging(false)
    }
  }

  return (
    <article style={styles.card}>
      <div>
        <p style={styles.eyebrow}>
          ACCOUNT SECURITY
        </p>

        <h3 style={styles.title}>
          비밀번호 변경
        </h3>

        <p style={styles.description}>
          현재 비밀번호를 확인한 후
          새로운 비밀번호로 변경합니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={styles.form}
      >
        <label style={styles.label}>
          현재 비밀번호

          <input
            type="password"
            value={currentPassword}
            onChange={(event) =>
              setCurrentPassword(
                event.target.value,
              )
            }
            placeholder="현재 비밀번호 입력"
            autoComplete="current-password"
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          새 비밀번호

          <input
            type="password"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(
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
          새 비밀번호 확인

          <input
            type="password"
            value={
              newPasswordConfirm
            }
            onChange={(event) =>
              setNewPasswordConfirm(
                event.target.value,
              )
            }
            placeholder="새 비밀번호 다시 입력"
            autoComplete="new-password"
            minLength="8"
            required
            style={styles.input}
          />
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
          disabled={changing}
          style={{
            ...styles.button,

            opacity:
              changing ? 0.6 : 1,
          }}
        >
          {changing
            ? '변경 중...'
            : '비밀번호 변경'}
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

export default PasswordChangeSection