import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from './lib/supabase.js'

const servicePlans = [
  {
    id: 'NTAC RUN',
    price: '39,000원',
    label: 'RUN TRAINING',
    description:
      '개인 기준 페이스 기반 러닝 프로그램과 런트레이너.',
  },
  {
    id: 'NTAC BUILD',
    price: '79,000원',
    label: 'HYROX BUILD',
    description:
      'RUN 전체 기능과 하이록스 중심 근력·보강 프로그램.',
  },
  {
    id: 'NTAC COMPLETE',
    price: '119,000원',
    label: 'ONLINE + COMMUNITY',
    description:
      'RUN + BUILD와 정기 하이록스 커뮤니티 클래스를 함께 이용.',
  },
  {
    id: 'NTAC ATHLETE',
    price: '189,000원',
    label: 'FULL COACH CARE',
    description:
      'COMPLETE 전체 기능에 주간 코치 리포트, 월 1회 1:1 세션과 담당 코치 관리.',
  },
  {
    id: 'NTAC COMMUNITY',
    price: '89,000원',
    label: 'OFFLINE CLASS',
    description:
      '함께 하이록스 종목과 레이스 형식 훈련을 경험하는 커뮤니티 클래스.',
  },
]

function getTodayKey() {
  const now = new Date()
  const offset =
    now.getTimezoneOffset() * 60000

  return new Date(
    now.getTime() - offset,
  )
    .toISOString()
    .slice(0, 10)
}

function getTrialDaysLeft(
  trialEndsAt,
) {
  if (!trialEndsAt) {
    return null
  }

  const today = new Date(
    `${getTodayKey()}T00:00:00`,
  )

  const end = new Date(
    `${trialEndsAt}T00:00:00`,
  )

  const diff = Math.floor(
    (end.getTime() -
      today.getTime()) /
      86400000,
  )

  return Math.max(0, diff + 1)
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  return new Date(
    `${String(value).slice(0, 10)}T00:00:00`,
  ).toLocaleDateString('ko-KR')
}

function MembershipFunnelLayer() {
  const [profile, setProfile] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [startingTrial, setStartingTrial] =
    useState(false)

  const [planModalOpen, setPlanModalOpen] =
    useState(false)

  const [selectedPlan, setSelectedPlan] =
    useState('NTAC BUILD')

  const [inquiryMessage, setInquiryMessage] =
    useState('')

  const [inquirySending, setInquirySending] =
    useState(false)

  const [inquirySuccess, setInquirySuccess] =
    useState('')

  const [adminPanelOpen, setAdminPanelOpen] =
    useState(false)

  const [adminInquiries, setAdminInquiries] =
    useState([])

  const [adminProfiles, setAdminProfiles] =
    useState(new Map())

  const [adminLoading, setAdminLoading] =
    useState(false)

  const loadProfile = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser()

      if (
        userError ||
        !userData.user
      ) {
        setProfile(null)
        return
      }

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
          paid_until,
          trial_started_at,
          trial_ends_at,
          access_override_until,
          referrer_name,
          signup_source
        `)
        .eq('id', userData.user.id)
        .single()

      if (error) {
        throw error
      }

      setProfile(data)
    } catch (error) {
      console.error(
        '멤버십 퍼널 정보 조회 실패:',
        error,
      )

      setErrorMessage(
        error.message ||
          '체험 정보를 확인하지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const isAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'owner'

  const trialDaysLeft = useMemo(
    () =>
      getTrialDaysLeft(
        profile?.trial_ends_at,
      ),
    [profile?.trial_ends_at],
  )

  const isTrialReady =
    profile?.role === 'member' &&
    profile?.signup_source ===
      'self_trial' &&
    profile?.membership_status ===
      'paused' &&
    !profile?.trial_started_at

  const isTrialActive =
    profile?.role === 'member' &&
    Boolean(profile?.trial_ends_at) &&
    String(profile.trial_ends_at) >=
      getTodayKey() &&
    !profile?.paid_until

  const isTrialExpired =
    profile?.role === 'member' &&
    Boolean(profile?.trial_started_at) &&
    Boolean(profile?.trial_ends_at) &&
    String(profile.trial_ends_at) <
      getTodayKey() &&
    !profile?.paid_until

  const startTrial = async () => {
    if (startingTrial) {
      return
    }

    setStartingTrial(true)
    setErrorMessage('')

    try {
      const { error } =
        await supabase.rpc(
          'start_my_build_trial',
        )

      if (error) {
        throw error
      }

      window.location.reload()
    } catch (error) {
      console.error(
        '무료체험 시작 실패:',
        error,
      )

      setErrorMessage(
        error.message ||
          '무료체험을 시작하지 못했습니다.',
      )
    } finally {
      setStartingTrial(false)
    }
  }

  const sendInquiry = async () => {
    if (
      inquirySending ||
      !selectedPlan
    ) {
      return
    }

    setInquirySending(true)
    setErrorMessage('')
    setInquirySuccess('')

    try {
      const { error } =
        await supabase
          .from('purchase_inquiries')
          .insert({
            user_id: profile.id,
            desired_membership:
              selectedPlan,
            message:
              inquiryMessage.trim() ||
              null,
            status: 'NEW',
          })

      if (error) {
        throw error
      }

      setInquirySuccess(
        `${selectedPlan} 구매 문의가 접수되었습니다. 담당 코치가 확인 후 연락드릴게요.`,
      )
      setInquiryMessage('')
    } catch (error) {
      console.error(
        '구매 문의 접수 실패:',
        error,
      )

      if (error?.code === '23505') {
        setInquirySuccess(
          `${selectedPlan} 문의가 이미 접수되어 있습니다. 담당 코치가 확인 후 연락드릴게요.`,
        )
        setErrorMessage('')
      } else {
        setErrorMessage(
          error.message ||
            '구매 문의를 접수하지 못했습니다.',
        )
      }
    } finally {
      setInquirySending(false)
    }
  }

  const loadAdminInquiries = async () => {
    if (!isAdmin) {
      return
    }

    setAdminLoading(true)
    setErrorMessage('')

    try {
      const {
        data: inquiries,
        error: inquiryError,
      } = await supabase
        .from('purchase_inquiries')
        .select(`
          id,
          user_id,
          desired_membership,
          message,
          status,
          created_at,
          updated_at
        `)
        .order('created_at', {
          ascending: false,
        })

      if (inquiryError) {
        throw inquiryError
      }

      const userIds = [
        ...new Set(
          (inquiries || [])
            .map((row) => row.user_id)
            .filter(Boolean),
        ),
      ]

      let profileMap = new Map()

      if (userIds.length > 0) {
        const {
          data: profiles,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            email,
            phone,
            membership,
            referrer_name
          `)
          .in('id', userIds)

        if (profileError) {
          throw profileError
        }

        profileMap = new Map(
          (profiles || []).map(
            (item) => [item.id, item],
          ),
        )
      }

      setAdminInquiries(
        inquiries || [],
      )
      setAdminProfiles(profileMap)
    } catch (error) {
      console.error(
        '구매 문의 조회 실패:',
        error,
      )

      setErrorMessage(
        error.message ||
          '구매 문의를 불러오지 못했습니다.',
      )
    } finally {
      setAdminLoading(false)
    }
  }

  const openAdminPanel = async () => {
    setAdminPanelOpen(true)
    await loadAdminInquiries()
  }

  const updateInquiryStatus = async (
    inquiryId,
    status,
  ) => {
    try {
      const { error } =
        await supabase
          .from('purchase_inquiries')
          .update({ status })
          .eq('id', inquiryId)

      if (error) {
        throw error
      }

      setAdminInquiries((current) =>
        current.map((item) =>
          item.id === inquiryId
            ? {
                ...item,
                status,
              }
            : item,
        ),
      )
    } catch (error) {
      alert(
        `상태 변경 실패\n${
          error.message ||
          '알 수 없는 오류'
        }`,
      )
    }
  }

  const newInquiryCount =
    adminInquiries.filter(
      (item) => item.status === 'NEW',
    ).length

  if (loading || !profile) {
    return null
  }

  return (
    <>
      {isTrialReady && (
        <div style={styles.overlay}>
          <article style={styles.startCard}>
            <span style={styles.badge}>
              READY TO START
            </span>

            <h2 style={styles.startTitle}>
              7일 NTAC BUILD 무료체험
            </h2>

            <p style={styles.startText}>
              무료체험을 시작하는 순간부터 7일 동안 RUN, 런트레이너와 HYROX BUILD 프로그램이 열립니다.
            </p>

            <div style={styles.startFeatures}>
              <span>✓ 자동 결제 없음</span>
              <span>✓ 1인 1회 무료체험</span>
              <span>✓ Coach Care / Community 제외</span>
            </div>

            {errorMessage && (
              <p style={styles.errorBox}>
                {errorMessage}
              </p>
            )}

            <button
              type="button"
              disabled={startingTrial}
              onClick={startTrial}
              style={styles.startButton}
            >
              {startingTrial
                ? '체험 시작 중...'
                : '7일 무료체험 시작'}
            </button>
          </article>
        </div>
      )}

      {isTrialActive && (
        <button
          type="button"
          onClick={() =>
            setPlanModalOpen(true)
          }
          style={styles.trialPill}
        >
          BUILD 무료체험{' '}
          <strong>
            D-{trialDaysLeft}
          </strong>
        </button>
      )}

      {isTrialExpired && (
        <article style={styles.expiredCard}>
          <span style={styles.expiredEyebrow}>
            TRIAL COMPLETE
          </span>

          <strong style={styles.expiredTitle}>
            7일 체험이 종료되었습니다.
          </strong>

          <p style={styles.expiredText}>
            운동 기록은 그대로 보관됩니다. 원하는 서비스를 선택하면 이어서 이용할 수 있습니다.
          </p>

          <button
            type="button"
            onClick={() =>
              setPlanModalOpen(true)
            }
            style={styles.expiredButton}
          >
            서비스 선택 · 구매 문의
          </button>
        </article>
      )}

      {!isAdmin &&
        profile?.signup_source ===
          'self_trial' &&
        !isTrialReady &&
        !isTrialExpired && (
          <button
            type="button"
            onClick={() =>
              setPlanModalOpen(true)
            }
            style={styles.serviceButton}
          >
            서비스
          </button>
        )}

      {planModalOpen && !isAdmin && (
        <div style={styles.modalOverlay}>
          <section style={styles.modal}>
            <div style={styles.modalHead}>
              <div>
                <p style={styles.modalEyebrow}>
                  NTAC MEMBERSHIP
                </p>

                <h3 style={styles.modalTitle}>
                  원하는 서비스를 선택하세요.
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPlanModalOpen(false)
                }
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            {isTrialActive && (
              <div style={styles.trialInfo}>
                현재 BUILD 무료체험 중 · {formatDate(
                  profile.trial_ends_at,
                )}까지
              </div>
            )}

            <div style={styles.planList}>
              {servicePlans.map((plan) => {
                const isSelected =
                  selectedPlan === plan.id

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() =>
                      setSelectedPlan(
                        plan.id,
                      )
                    }
                    style={{
                      ...styles.planCard,
                      ...(isSelected
                        ? styles.planCardSelected
                        : {}),
                    }}
                  >
                    <div style={styles.planHead}>
                      <div>
                        <span style={styles.planLabel}>
                          {plan.label}
                        </span>
                        <strong style={styles.planName}>
                          {plan.id}
                        </strong>
                      </div>

                      <strong style={styles.planPrice}>
                        {plan.price}
                      </strong>
                    </div>

                    <p style={styles.planDescription}>
                      {plan.description}
                    </p>
                  </button>
                )
              })}
            </div>

            <label style={styles.messageField}>
              코치에게 전달할 내용
              <textarea
                rows="3"
                value={inquiryMessage}
                onChange={(event) =>
                  setInquiryMessage(
                    event.target.value,
                  )
                }
                placeholder="궁금한 점이나 상담받고 싶은 내용을 적어주세요. (선택)"
                style={styles.textarea}
              />
            </label>

            {errorMessage && (
              <p style={styles.errorBox}>
                {errorMessage}
              </p>
            )}

            {inquirySuccess && (
              <p style={styles.successBox}>
                {inquirySuccess}
              </p>
            )}

            <button
              type="button"
              disabled={inquirySending}
              onClick={sendInquiry}
              style={styles.inquiryButton}
            >
              {inquirySending
                ? '문의 접수 중...'
                : `${selectedPlan} 구매 문의하기`}
            </button>
          </section>
        </div>
      )}

      {isAdmin && (
        <button
          type="button"
          onClick={openAdminPanel}
          style={styles.adminButton}
        >
          구매 문의
          {newInquiryCount > 0 && (
            <span style={styles.adminCount}>
              {newInquiryCount}
            </span>
          )}
        </button>
      )}

      {adminPanelOpen && isAdmin && (
        <div style={styles.modalOverlay}>
          <section style={styles.adminModal}>
            <div style={styles.modalHead}>
              <div>
                <p style={styles.modalEyebrow}>
                  SALES INQUIRIES
                </p>
                <h3 style={styles.modalTitle}>
                  NTAC 구매 문의
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setAdminPanelOpen(false)
                }
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            {adminLoading ? (
              <p>문의 내역을 불러오는 중...</p>
            ) : (
              <div style={styles.adminList}>
                {adminInquiries.map(
                  (inquiry) => {
                    const member =
                      adminProfiles.get(
                        inquiry.user_id,
                      ) || {}

                    return (
                      <article
                        key={inquiry.id}
                        style={styles.adminInquiryCard}
                      >
                        <div style={styles.adminInquiryHead}>
                          <div>
                            <strong>
                              {member.full_name ||
                                member.email ||
                                '멤버'}
                            </strong>
                            <span style={styles.adminMeta}>
                              {member.phone || '-'} · 추천인 {member.referrer_name || '-'}
                            </span>
                          </div>

                          <span style={styles.statusBadge}>
                            {inquiry.status}
                          </span>
                        </div>

                        <strong style={styles.requestPlan}>
                          {inquiry.desired_membership}
                        </strong>

                        {inquiry.message && (
                          <p style={styles.requestMessage}>
                            {inquiry.message}
                          </p>
                        )}

                        <div style={styles.statusButtons}>
                          {[
                            'NEW',
                            'CONTACTED',
                            'COMPLETED',
                            'CANCELLED',
                          ].map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                updateInquiryStatus(
                                  inquiry.id,
                                  status,
                                )
                              }
                              style={{
                                ...styles.statusButton,
                                ...(inquiry.status ===
                                status
                                  ? styles.statusButtonActive
                                  : {}),
                              }}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </article>
                    )
                  },
                )}

                {adminInquiries.length === 0 && (
                  <article style={styles.emptyCard}>
                    아직 구매 문의가 없습니다.
                  </article>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 30000,
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
    padding: '20px',
    background:
      'rgba(5, 24, 18, 0.82)',
    backdropFilter: 'blur(8px)',
  },

  startCard: {
    width: '100%',
    maxWidth: '420px',
    boxSizing: 'border-box',
    padding: '28px 22px',
    borderRadius: '25px',
    background: '#ffffff',
    color: '#10251e',
    boxShadow:
      '0 28px 80px rgba(0, 0, 0, 0.28)',
  },

  badge: {
    display: 'inline-block',
    padding: '6px 9px',
    borderRadius: '999px',
    background: '#dfeee7',
    color: '#0b6b4f',
    fontSize: '9px',
    fontWeight: 900,
    letterSpacing: '0.1em',
  },

  startTitle: {
    margin: '12px 0 8px',
    color: '#10251e',
    fontSize: '26px',
    letterSpacing: '-0.04em',
  },

  startText: {
    margin: 0,
    color: '#687770',
    fontSize: '13px',
    lineHeight: 1.65,
  },

  startFeatures: {
    display: 'grid',
    gap: '7px',
    marginTop: '17px',
    padding: '15px',
    borderRadius: '14px',
    background: '#f1f5f3',
    color: '#33463f',
    fontSize: '12px',
    fontWeight: 800,
  },

  startButton: {
    width: '100%',
    minHeight: '52px',
    marginTop: '18px',
    border: 'none',
    borderRadius: '14px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 900,
    cursor: 'pointer',
  },

  trialPill: {
    position: 'fixed',
    left: '14px',
    top: '14px',
    zIndex: 9500,
    padding: '9px 12px',
    border: 'none',
    borderRadius: '999px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow:
      '0 6px 18px rgba(11, 61, 46, 0.24)',
  },

  expiredCard: {
    position: 'fixed',
    left: '50%',
    bottom: '22px',
    zIndex: 15000,
    width: 'calc(100% - 28px)',
    maxWidth: '420px',
    boxSizing: 'border-box',
    transform: 'translateX(-50%)',
    padding: '18px',
    borderRadius: '18px',
    background: '#ffffff',
    border: '1px solid #e5d7d2',
    boxShadow:
      '0 18px 45px rgba(0, 0, 0, 0.18)',
  },

  expiredEyebrow: {
    color: '#9b4a3f',
    fontSize: '9px',
    fontWeight: 900,
    letterSpacing: '0.1em',
  },

  expiredTitle: {
    display: 'block',
    marginTop: '6px',
    color: '#17352c',
    fontSize: '17px',
  },

  expiredText: {
    margin: '7px 0 13px',
    color: '#687770',
    fontSize: '12px',
    lineHeight: 1.55,
  },

  expiredButton: {
    width: '100%',
    minHeight: '45px',
    border: 'none',
    borderRadius: '12px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 900,
    cursor: 'pointer',
  },

  serviceButton: {
    position: 'fixed',
    right: '14px',
    bottom: '82px',
    zIndex: 9000,
    minWidth: '70px',
    minHeight: '42px',
    border: 'none',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#0b3d2e',
    fontSize: '11px',
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow:
      '0 8px 24px rgba(0, 0, 0, 0.14)',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 40000,
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
    padding: '18px',
    background:
      'rgba(5, 24, 18, 0.78)',
    backdropFilter: 'blur(7px)',
  },

  modal: {
    width: '100%',
    maxWidth: '460px',
    maxHeight: 'calc(100dvh - 36px)',
    overflowY: 'auto',
    boxSizing: 'border-box',
    padding: '22px',
    borderRadius: '23px',
    background: '#ffffff',
    color: '#10251e',
  },

  adminModal: {
    width: '100%',
    maxWidth: '820px',
    maxHeight: 'calc(100dvh - 36px)',
    overflowY: 'auto',
    boxSizing: 'border-box',
    padding: '24px',
    borderRadius: '23px',
    background: '#f5f7f6',
    color: '#10251e',
  },

  modalHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '14px',
  },

  modalEyebrow: {
    margin: '0 0 5px',
    color: '#0b6b4f',
    fontSize: '9px',
    fontWeight: 900,
    letterSpacing: '0.11em',
  },

  modalTitle: {
    margin: 0,
    color: '#17352c',
    fontSize: '21px',
    letterSpacing: '-0.03em',
  },

  closeButton: {
    display: 'grid',
    placeItems: 'center',
    width: '36px',
    height: '36px',
    border: '1px solid #dce3e0',
    borderRadius: '50%',
    background: '#ffffff',
    color: '#41534c',
    fontSize: '21px',
    cursor: 'pointer',
  },

  trialInfo: {
    marginTop: '15px',
    padding: '11px 12px',
    borderRadius: '12px',
    background: '#eaf5ef',
    color: '#0b6b4f',
    fontSize: '11px',
    fontWeight: 800,
  },

  planList: {
    display: 'grid',
    gap: '9px',
    marginTop: '16px',
  },

  planCard: {
    width: '100%',
    padding: '15px',
    border: '1px solid #dce5e1',
    borderRadius: '15px',
    background: '#ffffff',
    color: '#17352c',
    textAlign: 'left',
    cursor: 'pointer',
  },

  planCardSelected: {
    border: '2px solid #0b3d2e',
    background: '#edf5f1',
  },

  planHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
  },

  planLabel: {
    display: 'block',
    color: '#0b6b4f',
    fontSize: '8px',
    fontWeight: 900,
    letterSpacing: '0.1em',
  },

  planName: {
    display: 'block',
    marginTop: '4px',
    fontSize: '15px',
  },

  planPrice: {
    fontSize: '16px',
  },

  planDescription: {
    margin: '8px 0 0',
    color: '#66766f',
    fontSize: '11px',
    lineHeight: 1.55,
  },

  messageField: {
    display: 'grid',
    gap: '7px',
    marginTop: '16px',
    color: '#33463f',
    fontSize: '12px',
    fontWeight: 800,
  },

  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px',
    border: '1px solid #d5dfdb',
    borderRadius: '12px',
    resize: 'vertical',
    font: 'inherit',
  },

  inquiryButton: {
    width: '100%',
    minHeight: '49px',
    marginTop: '14px',
    border: 'none',
    borderRadius: '13px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },

  errorBox: {
    margin: '12px 0 0',
    padding: '11px',
    borderRadius: '11px',
    background: '#fff0f0',
    color: '#b52d2d',
    fontSize: '11px',
    fontWeight: 800,
    lineHeight: 1.5,
  },

  successBox: {
    margin: '12px 0 0',
    padding: '11px',
    borderRadius: '11px',
    background: '#eaf5ef',
    color: '#0b6b4f',
    fontSize: '11px',
    fontWeight: 800,
    lineHeight: 1.5,
  },

  adminButton: {
    position: 'fixed',
    left: '18px',
    bottom: '18px',
    zIndex: 16000,
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    minHeight: '44px',
    padding: '0 14px',
    border: 'none',
    borderRadius: '999px',
    background: '#0b3d2e',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow:
      '0 8px 24px rgba(0, 0, 0, 0.18)',
  },

  adminCount: {
    display: 'grid',
    placeItems: 'center',
    minWidth: '20px',
    height: '20px',
    padding: '0 4px',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#0b3d2e',
    fontSize: '9px',
  },

  adminList: {
    display: 'grid',
    gap: '11px',
    marginTop: '18px',
  },

  adminInquiryCard: {
    padding: '16px',
    borderRadius: '15px',
    background: '#ffffff',
    border: '1px solid #dfe6e3',
  },

  adminInquiryHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },

  adminMeta: {
    display: 'block',
    marginTop: '4px',
    color: '#74817c',
    fontSize: '10px',
  },

  statusBadge: {
    padding: '5px 8px',
    borderRadius: '999px',
    background: '#edf2ef',
    color: '#52635c',
    fontSize: '9px',
    fontWeight: 900,
  },

  requestPlan: {
    display: 'block',
    marginTop: '12px',
    color: '#0b3d2e',
    fontSize: '14px',
  },

  requestMessage: {
    margin: '7px 0 0',
    color: '#64746d',
    fontSize: '11px',
    lineHeight: 1.55,
  },

  statusButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '12px',
  },

  statusButton: {
    minHeight: '31px',
    padding: '0 9px',
    border: '1px solid #dbe3df',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#64746d',
    fontSize: '9px',
    fontWeight: 900,
    cursor: 'pointer',
  },

  statusButtonActive: {
    border: '1px solid #0b3d2e',
    background: '#0b3d2e',
    color: '#ffffff',
  },

  emptyCard: {
    padding: '24px',
    borderRadius: '15px',
    background: '#ffffff',
    color: '#71807a',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 800,
  },
}

export default MembershipFunnelLayer
