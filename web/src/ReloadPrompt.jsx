import {
  useRegisterSW,
} from 'virtual:pwa-register/react'

import './ReloadPrompt.css'

const UPDATE_INTERVAL =
  60 * 1000

function ReloadPrompt() {
  const {
    needRefresh: [
      needRefresh,
      setNeedRefresh,
    ],

    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(
      swUrl,
      registration,
    ) {
      if (!registration) {
        return
      }

      const checkForUpdate =
        async () => {
          if (
            registration.installing ||
            !navigator.onLine
          ) {
            return
          }

          try {
            const response =
              await fetch(swUrl, {
                cache: 'no-store',

                headers: {
                  'cache':
                    'no-store',

                  'cache-control':
                    'no-cache',
                },
              })

            if (response.ok) {
              await registration.update()
            }
          } catch (error) {
            console.warn(
              '업데이트 확인 실패:',
              error,
            )
          }
        }

      setInterval(
        checkForUpdate,
        UPDATE_INTERVAL,
      )

      window.addEventListener(
        'focus',
        checkForUpdate,
      )
    },

    onRegisterError(error) {
      console.error(
        '서비스워커 등록 실패:',
        error,
      )
    },
  })

  if (!needRefresh) {
    return null
  }

  return (
    <aside
      className="update-prompt"
      role="dialog"
      aria-live="polite"
    >
      <div>
        <span>NEW VERSION</span>

        <strong>
          새 버전이 있습니다.
        </strong>

        <p>
          최신 기능을 적용하려면
          업데이트해 주세요.
        </p>
      </div>

      <div className="update-prompt-actions">
        <button
          className="update-later-button"
          type="button"
          onClick={() =>
            setNeedRefresh(false)
          }
        >
          나중에
        </button>

        <button
          className="update-now-button"
          type="button"
          onClick={() =>
            updateServiceWorker(true)
          }
        >
          지금 업데이트
        </button>
      </div>
    </aside>
  )
}

export default ReloadPrompt