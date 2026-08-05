import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'

function getRoleLabel(role) {
  if (role === 'owner') {
    return 'OWNER'
  }

  if (role === 'admin') {
    return '관리자'
  }

  return '멤버'
}

function AdminAccessManagement({
  onAccessChanged,
}) {
  const [profiles, setProfiles] =
    useState([])

  const [currentRole, setCurrentRole] =
    useState('')

  const [search, setSearch] =
    useState('')

  const [loading, setLoading] =
    useState(true)

  const [changingId, setChangingId] =
    useState('')

  const [errorMessage, setErrorMessage] =
    useState('')

  const filteredProfiles = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase()

    return profiles.filter((profile) => {
      const fullName =
        profile.full_name
          ?.toLowerCase() || ''

      const email =
        profile.email
          ?.toLowerCase() || ''

      return (
        !keyword ||
        fullName.includes(keyword) ||
        email.includes(keyword)
      )
    })
  }, [profiles, search])

  const loadProfiles = async () => {
    setLoading(true)
    setErrorMessage('')

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser()

    if (
      authError ||
      !authData.user
    ) {
      setErrorMessage(
        '로그인 정보를 확인하지 못했습니다.',
      )

      setLoading(false)
      return
    }

    const [
      currentProfileResult,
      profilesResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single(),

      supabase
        .from('profiles')
        .select(
          `
            id,
            email,
            full_name,
            role,
            membership,
            membership_status
          `,
        )
        .order('full_name', {
          ascending: true,
        }),
    ])

    if (currentProfileResult.error) {
      setErrorMessage(
        currentProfileResult.error.message,
      )

      setLoading(false)
      return
    }

    if (profilesResult.error) {
      setErrorMessage(
        profilesResult.error.message,
      )

      setLoading(false)
      return
    }

    setCurrentRole(
      currentProfileResult.data.role,
    )

    setProfiles(
      profilesResult.data || [],
    )

    setLoading(false)
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  const changeAdminAccess =
    async (profile) => {
      if (
        currentRole !== 'owner' ||
        profile.role === 'owner' ||
        changingId
      ) {
        return
      }

      const makeAdmin =
        profile.role !== 'admin'

      const actionText = makeAdmin
        ? '관리자 권한을 부여'
        : '관리자 권한을 해제'

      const confirmed =
        window.confirm(
          `${profile.full_name || profile.email}님에게 ${actionText}할까요?`,
        )

      if (!confirmed) {
        return
      }

      setChangingId(profile.id)
      setErrorMessage('')

      const { error } =
        await supabase.rpc(
          'set_admin_access',
          {
            target_user_id:
              profile.id,

            make_admin:
              makeAdmin,
          },
        )

      if (error) {
        console.error(
          '권한 변경 실패:',
          error,
        )

        setErrorMessage(
          error.message ||
            '권한을 변경하지 못했습니다.',
        )

        setChangingId('')
        return
      }

      setProfiles((current) =>
        current.map((item) =>
          item.id === profile.id
            ? {
                ...item,
                role: makeAdmin
                  ? 'admin'
                  : 'member',
              }
            : item,
        ),
      )

      onAccessChanged?.()

      setChangingId('')

      alert(
        makeAdmin
          ? '관리자 권한이 부여되었습니다.'
          : '관리자 권한이 해제되었습니다.',
      )
    }

  if (loading) {
    return (
      <article style={styles.card}>
        권한 정보를 불러오는 중입니다.
      </article>
    )
  }

  if (currentRole !== 'owner') {
    return (
      <article style={styles.lockedCard}>
        <span style={styles.lockedBadge}>
          OWNER ONLY
        </span>

        <h3 style={styles.title}>
          OWNER 전용 기능입니다.
        </h3>

        <p style={styles.description}>
          관리자 권한 부여와 해제는
          OWNER 계정만 가능합니다.
        </p>
      </article>
    )
  }

  return (
    <section style={styles.page}>
      <div>
        <p style={styles.eyebrow}>
          ACCESS CONTROL
        </p>

        <h3 style={styles.title}>
          관리자 권한 관리
        </h3>

        <p style={styles.description}>
          코치 계정에 관리자 권한을
          부여하거나 해제합니다.
        </p>
      </div>

      {errorMessage && (
        <article style={styles.errorCard}>
          {errorMessage}
        </article>
      )}

      <article style={styles.card}>
        <label style={styles.field}>
          이름 또는 이메일 검색

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="예: 윤다원"
            style={styles.input}
          />
        </label>

        <div style={styles.summary}>
          전체 {profiles.length}명 ·
          검색 결과{' '}
          {filteredProfiles.length}명
        </div>
      </article>

      <div style={styles.list}>
        {filteredProfiles.map(
          (profile) => {
            const isOwner =
              profile.role === 'owner'

            const isAdmin =
              profile.role === 'admin'

            const isChanging =
              changingId === profile.id

            return (
              <article
                key={profile.id}
                style={styles.profileCard}
              >
                <div style={styles.profileInfo}>
                  <div>
                    <span
                      style={
                        isOwner
                          ? styles.ownerBadge
                          : isAdmin
                            ? styles.adminBadge
                            : styles.memberBadge
                      }
                    >
                      {getRoleLabel(
                        profile.role,
                      )}
                    </span>

                    <h4 style={styles.name}>
                      {profile.full_name ||
                        '이름 미등록'}
                    </h4>

                    <p style={styles.email}>
                      {profile.email ||
                        '이메일 없음'}
                    </p>
                  </div>

                  <div style={styles.membership}>
                    {profile.membership ||
                      '상품 미설정'}
                  </div>
                </div>

                {isOwner ? (
                  <button
                    type="button"
                    disabled
                    style={styles.disabledButton}
                  >
                    OWNER 계정
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(
                      changingId,
                    )}
                    onClick={() =>
                      changeAdminAccess(
                        profile,
                      )
                    }
                    style={
                      isAdmin
                        ? styles.removeButton
                        : styles.grantButton
                    }
                  >
                    {isChanging
                      ? '변경 중...'
                      : isAdmin
                        ? '관리자 권한 해제'
                        : '관리자 권한 부여'}
                  </button>
                )}
              </article>
            )
          },
        )}
      </div>

      {filteredProfiles.length === 0 && (
        <article style={styles.card}>
          검색 결과가 없습니다.
        </article>
      )}
    </section>
  )
}

const styles = {
  page: {
    display: 'grid',
    gap: '18px',
  },

  card: {
    display: 'grid',
    gap: '14px',
    padding: '20px',
    borderRadius: '18px',
    background: '#ffffff',
  },

  lockedCard: {
    display: 'grid',
    gap: '10px',
    padding: '22px',
    borderRadius: '18px',
    background: '#f2f4f3',
    border: '1px solid #dce2df',
  },

  errorCard: {
    padding: '15px',
    borderRadius: '14px',
    background: '#fff0f0',
    color: '#b52d2d',
    fontSize: '13px',
    fontWeight: '800',
  },

  eyebrow: {
    margin: '0 0 6px',
    color: '#0b6b4f',
    fontSize: '11px',
    fontWeight: '900',
    letterSpacing: '0.12em',
  },

  title: {
    margin: 0,
    color: '#10251e',
    fontSize: '23px',
  },

  description: {
    margin: 0,
    color: '#66736e',
    fontSize: '14px',
    lineHeight: 1.6,
  },

  lockedBadge: {
    width: 'fit-content',
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#dfe6e3',
    color: '#586760',
    fontSize: '11px',
    fontWeight: '900',
  },

  field: {
    display: 'grid',
    gap: '8px',
    color: '#33463f',
    fontSize: '13px',
    fontWeight: '800',
  },

  input: {
    width: '100%',
    minHeight: '46px',
    boxSizing: 'border-box',
    padding: '11px 13px',
    border: '1px solid #d6dedb',
    borderRadius: '12px',
    background: '#ffffff',
    fontSize: '14px',
  },

  summary: {
    color: '#66736e',
    fontSize: '12px',
    fontWeight: '800',
  },

  list: {
    display: 'grid',
    gap: '12px',
  },

  profileCard: {
    display: 'grid',
    gap: '16px',
    padding: '18px',
    borderRadius: '17px',
    background: '#ffffff',
    border: '1px solid #e1e7e4',
  },

  profileInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },

  ownerBadge: {
    display: 'inline-block',
    padding: '5px 9px',
    borderRadius: '999px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: '900',
  },

  adminBadge: {
    display: 'inline-block',
    padding: '5px 9px',
    borderRadius: '999px',
    background: '#dcece5',
    color: '#0b6b4f',
    fontSize: '10px',
    fontWeight: '900',
  },

  memberBadge: {
    display: 'inline-block',
    padding: '5px 9px',
    borderRadius: '999px',
    background: '#edf0ef',
    color: '#65716c',
    fontSize: '10px',
    fontWeight: '900',
  },

  name: {
    margin: '10px 0 3px',
    color: '#10251e',
    fontSize: '17px',
  },

  email: {
    margin: 0,
    color: '#74807b',
    fontSize: '12px',
  },

  membership: {
    color: '#52625b',
    fontSize: '11px',
    fontWeight: '800',
    textAlign: 'right',
  },

  grantButton: {
    minHeight: '46px',
    border: 'none',
    borderRadius: '12px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  removeButton: {
    minHeight: '46px',
    border: '1px solid #dfb4b4',
    borderRadius: '12px',
    background: '#ffffff',
    color: '#b52d2d',
    fontSize: '13px',
    fontWeight: '900',
    cursor: 'pointer',
  },

  disabledButton: {
    minHeight: '46px',
    border: 'none',
    borderRadius: '12px',
    background: '#e4e8e6',
    color: '#8a948f',
    fontSize: '13px',
    fontWeight: '900',
  },
}

export default AdminAccessManagement