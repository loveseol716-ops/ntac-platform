import {
  useEffect,
  useState,
} from 'react'

import { supabase } from './lib/supabase'

function SupabaseConnectionTest() {
  const [status, setStatus] =
    useState('연결 확인 중...')

  const [hasError, setHasError] =
    useState(false)

  useEffect(() => {
    const checkConnection = async () => {
      const { data, error } =
        await supabase
          .from('connection_test')
          .select('message')
          .order('id', {
            ascending: false,
          })
          .limit(1)

      if (error) {
        console.error(error)
        setHasError(true)
        setStatus(
          `연결 실패: ${error.message}`,
        )
        return
      }

      setStatus(
        data?.[0]?.message ||
          '데이터가 없습니다.',
      )
    }

    checkConnection()
  }, [])

  return (
    <article
      className={`feature-card ${
        hasError ? 'locked' : ''
      }`}
      style={{ marginBottom: '20px' }}
    >
      <div className="feature-card-top">
        <strong>SUPABASE STATUS</strong>

        <span
          className={
            hasError
              ? 'locked-badge'
              : 'access-badge'
          }
        >
          {hasError ? 'ERROR' : 'CONNECTED'}
        </span>
      </div>

      <h3>{status}</h3>

      <p>
        Supabase 데이터베이스 연결 상태를
        확인합니다.
      </p>
    </article>
  )
}

export default SupabaseConnectionTest