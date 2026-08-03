import { useState } from 'react'
import './App.css'

const currentMember = {
  id: 'seol-jaehyun',
  name: '설재현',
  initials: 'SJ',
  membership: 'NTAC COMPLETE',
}

const programs = {
  run: {
    eyebrow: 'RUN PROGRAM',
    title: '주간 러닝 프로그램',
    description: '러닝 인터벌과 Zone 2 프로그램',
    sessions: [
      {
        id: 'run-interval-1',
        type: 'INTERVAL',
        title: '400m 인터벌',
        subtitle: '10km 페이스보다 10–15초 빠르게',
        targetRpe: '8–9',
        sections: [
          {
            title: 'WARM UP',
            items: [
              '4분 Easy Jog',
              '20초 Stride + 40초 Easy Recovery × 4 Rounds',
            ],
          },
          {
            title: 'MAIN',
            items: [
              '400m × 10 Sets',
              '세트 사이 60초 Easy Jog',
              '회복 구간 걷지 않기',
            ],
          },
          {
            title: 'COOL DOWN',
            items: ['5분 Easy Jog'],
          },
        ],
      },
      {
        id: 'run-zone2-1',
        type: 'ZONE 2',
        title: 'Zone 2 Running',
        subtitle: '편안한 강도로 지속하는 유산소 훈련',
        targetRpe: '3–4',
        sections: [
          {
            title: 'WARM UP',
            items: ['5분 Easy Jog'],
          },
          {
            title: 'MAIN',
            items: [
              'Zone 2 Running 40분',
              '대화가 가능한 강도 유지',
              '호흡과 리듬을 일정하게 유지',
            ],
          },
          {
            title: 'COOL DOWN',
            items: ['5분 Easy Jog 또는 Walking'],
          },
        ],
      },
    ],
  },

  build: {
    eyebrow: 'BUILD PROGRAM',
    title: '하이록스 보강 프로그램',
    description: '개인에게 필요한 근력 및 움직임 보강',
    sessions: [
      {
        id: 'build-sled-1',
        type: 'BUILD',
        title: 'Sled Push Strength',
        subtitle: '슬레드 푸시를 위한 하체 근력 보강',
        targetRpe: '7–8',
        sections: [
          {
            title: 'WARM UP',
            items: [
              'Bike 또는 Row 5분',
              'Bodyweight Squat 10회 × 2 Sets',
              'Walking Lunge 10m × 2 Sets',
            ],
          },
          {
            title: 'MAIN',
            items: [
              'Heavy Back Squat 4회 × 4 Sets',
              'Walking Lunge 10회 × 3 Sets',
              'Heavy Sled Push 15m × 4 Sets',
              '세트 사이 90–120초 휴식',
            ],
          },
          {
            title: 'COOL DOWN',
            items: [
              'Easy Walking 3분',
              'Hip Flexor Stretch',
              'Calf Stretch',
            ],
          },
        ],
      },
    ],
  },
}

/*
  현재는 개인화 기능 확인을 위한 샘플 값입니다.
  추후 코치 관리자 페이지와 Supabase에서 수정할 수 있게 연결합니다.
*/
const memberOverrides = {
  'seol-jaehyun': {
    'run-interval-1': {
      targetPace: '4:10–4:15/km',
      treadmillSpeed: '14.1–14.4km/h',
      targetRpe: '8–9',
      coachNote:
        '마지막 2세트까지 동일한 자세와 속도를 유지하세요. 현재 수치는 기능 확인용 샘플입니다.',
    },

    'run-zone2-1': {
      targetPace: '개인 Zone 2 페이스',
      treadmillSpeed: '심박수 기준으로 조절',
      targetRpe: '3–4',
      coachNote:
        '속도보다 호흡과 심박수 유지가 우선입니다.',
    },

    'build-sled-1': {
      targetLoad: '현재 수행 가능한 무게 기준',
      targetRpe: '7–8',
      coachNote:
        '슬레드 푸시에서 상체 각도와 짧은 보폭을 유지하세요.',
    },
  },
}

const homeWorkouts = [
  {
    type: 'RUN',
    title: '러닝 인터벌',
    description: '400m × 10 Sets',
    status: '오늘의 훈련',
    programId: 'run',
  },
  {
    type: 'ZONE 2',
    title: 'Zone 2 Running',
    description: '40분 지속주',
    status: '이번 주 과제',
    programId: 'run',
  },
  {
    type: 'BUILD',
    title: '하이록스 보강',
    description: 'Sled Push Strength',
    status: '개인 과제',
    programId: 'build',
  },
]

const assignmentIds = [
  'run-interval-1',
  'run-zone2-1',
  'build-sled-1',
]

function getPersonalizedSession(session, memberId) {
  const override = memberOverrides[memberId]?.[session.id]

  return {
    ...session,
    ...override,
    sections: override?.sections || session.sections,
    isPersonalized: Boolean(override),
  }
}

function CheckinPage({ onClose, onComplete }) {
  const [form, setForm] = useState({
    condition: 3,
    sleep: '',
    soreness: 3,
    stress: 3,
    pain: '없음',
    painArea: '',
    message: '',
  })

  const updateForm = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const checkin = {
      ...form,
      date: new Date().toLocaleDateString('ko-KR'),
      completedAt: new Date().toISOString(),
    }

    localStorage.setItem(
      'ntac-daily-checkin',
      JSON.stringify(checkin),
    )

    onComplete(checkin)
  }

  return (
    <div className="checkin-page">
      <div className="checkin-header">
        <button type="button" onClick={onClose}>
          ←
        </button>

        <div>
          <p>DAILY CHECK-IN</p>
          <h2>오늘의 컨디션</h2>
        </div>
      </div>

      <form className="checkin-form" onSubmit={handleSubmit}>
        <label>
          오늘 컨디션
          <span>{form.condition} / 5</span>
        </label>

        <input
          type="range"
          min="1"
          max="5"
          value={form.condition}
          onChange={(event) =>
            updateForm('condition', Number(event.target.value))
          }
        />

        <label>
          수면시간
          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            placeholder="예: 7.5"
            value={form.sleep}
            onChange={(event) =>
              updateForm('sleep', event.target.value)
            }
            required
          />
        </label>

        <label>
          근육통
          <span>{form.soreness} / 5</span>
        </label>

        <input
          type="range"
          min="1"
          max="5"
          value={form.soreness}
          onChange={(event) =>
            updateForm('soreness', Number(event.target.value))
          }
        />

        <label>
          스트레스
          <span>{form.stress} / 5</span>
        </label>

        <input
          type="range"
          min="1"
          max="5"
          value={form.stress}
          onChange={(event) =>
            updateForm('stress', Number(event.target.value))
          }
        />

        <label>
          통증 여부
          <select
            value={form.pain}
            onChange={(event) =>
              updateForm('pain', event.target.value)
            }
          >
            <option value="없음">없음</option>
            <option value="가벼움">가벼움</option>
            <option value="훈련 조절 필요">
              훈련 조절 필요
            </option>
          </select>
        </label>

        {form.pain !== '없음' && (
          <label>
            통증 부위
            <input
              type="text"
              placeholder="예: 오른쪽 어깨"
              value={form.painArea}
              onChange={(event) =>
                updateForm('painArea', event.target.value)
              }
              required
            />
          </label>
        )}

        <label>
          코치에게 전달할 내용
          <textarea
            rows="4"
            placeholder="오늘 컨디션이나 참고할 내용을 적어주세요."
            value={form.message}
            onChange={(event) =>
              updateForm('message', event.target.value)
            }
          />
        </label>

        <button className="checkin-submit" type="submit">
          체크인 완료
        </button>
      </form>
    </div>
  )
}

function HomePage({
  openCheckin,
  todayCheckin,
  completedCount,
  totalAssignments,
  progressPercent,
  openProgram,
  moveToTraining,
}) {
  return (
    <>
      <section className="welcome">
        <p>안녕하세요, {currentMember.name}님</p>
        <h2>오늘도 훈련을 이어가세요.</h2>
        <span>{currentMember.membership}</span>
      </section>

      <section className="checkin-card">
        <div>
          <p className="section-label">DAILY CHECK-IN</p>

          {todayCheckin ? (
            <>
              <h3>오늘 체크인이 완료됐어요.</h3>
              <p>
                컨디션 {todayCheckin.condition}점 · 수면{' '}
                {todayCheckin.sleep}시간
              </p>
            </>
          ) : (
            <>
              <h3>오늘 컨디션은 어떤가요?</h3>
              <p>훈련 전 컨디션을 기록해 주세요.</p>
            </>
          )}
        </div>

        <button onClick={openCheckin}>
          {todayCheckin ? '다시 기록' : '체크인하기'}
        </button>
      </section>

      <section className="progress-section">
        <div className="section-title">
          <h3>이번 주 진행률</h3>

          <strong>
            {completedCount} / {totalAssignments}
          </strong>
        </div>

        <div className="progress-bar">
          <div
            className="progress-value"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </section>

      <section>
        <div className="section-title">
          <h3>나의 트레이닝</h3>

          <button
            className="text-button"
            onClick={moveToTraining}
          >
            전체보기
          </button>
        </div>

        <div className="workout-list">
          {homeWorkouts.map((workout) => (
            <article
              className="workout-card"
              key={workout.title}
              onClick={() => openProgram(workout.programId)}
            >
              <div className="workout-type">
                {workout.type}
              </div>

              <div className="workout-info">
                <p>{workout.status}</p>
                <h4>{workout.title}</h4>
                <span>{workout.description}</span>
              </div>

              <button className="arrow-button">›</button>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

function TrainingPage({
  openProgram,
  completedCount,
  totalAssignments,
}) {
  return (
    <section className="sub-page">
      <div className="page-heading">
        <p>WEEK 1</p>
        <h2>나의 트레이닝</h2>

        <span>
          이번 주 {completedCount} / {totalAssignments} 완료
        </span>
      </div>

      <div className="feature-list">
        <article className="feature-card">
          <div className="feature-card-top">
            <span className="access-badge">이용 가능</span>
            <strong>RUN</strong>
          </div>

          <h3>주간 러닝 프로그램</h3>
          <p>러닝 인터벌과 Zone 2 프로그램</p>

          <button onClick={() => openProgram('run')}>
            프로그램 보기
          </button>
        </article>

        <article className="feature-card">
          <div className="feature-card-top">
            <span className="access-badge">이용 가능</span>
            <strong>BUILD</strong>
          </div>

          <h3>하이록스 보강 프로그램</h3>
          <p>개인에게 필요한 근력 및 움직임 보강</p>

          <button onClick={() => openProgram('build')}>
            프로그램 보기
          </button>
        </article>

        <article className="feature-card locked">
          <div className="feature-card-top">
            <span className="locked-badge">추후 제공</span>
            <strong>COACH CARE</strong>
          </div>

          <h3>담당 코치 피드백</h3>
          <p>훈련 기록을 바탕으로 담당 코치가 관리합니다.</p>

          <button disabled>준비 중</button>
        </article>
      </div>
    </section>
  )
}

function PersonalPlan({ session }) {
  if (!session.isPersonalized) {
    return null
  }

  return (
    <div className="personal-plan">
      <div className="personal-plan-head">
        <div>
          <p>PERSONAL TARGET</p>
          <h4>{currentMember.name}님의 개인 목표</h4>
        </div>

        <span>개인화 적용</span>
      </div>

      <div className="personal-grid">
        {session.targetPace && (
          <div className="personal-item">
            <span>목표 페이스</span>
            <strong>{session.targetPace}</strong>
          </div>
        )}

        {session.treadmillSpeed && (
          <div className="personal-item">
            <span>트레드밀 속도</span>
            <strong>{session.treadmillSpeed}</strong>
          </div>
        )}

        {session.targetLoad && (
          <div className="personal-item">
            <span>목표 중량</span>
            <strong>{session.targetLoad}</strong>
          </div>
        )}

        <div className="personal-item">
          <span>목표 RPE</span>
          <strong>{session.targetRpe}</strong>
        </div>
      </div>

      {session.coachNote && (
        <div className="coach-note">
          <span>COACH NOTE</span>
          <p>{session.coachNote}</p>
        </div>
      )}
    </div>
  )
}

function ProgramDetailPage({
  program,
  records,
  onBack,
  onComplete,
}) {
  const [rpeValues, setRpeValues] = useState({})

  const completeSession = (sessionId) => {
    const selectedRpe = rpeValues[sessionId]

    if (!selectedRpe) {
      alert('실제 수행 RPE를 선택해 주세요.')
      return
    }

    onComplete(sessionId, Number(selectedRpe))
  }

  return (
    <section className="program-detail">
      <div className="detail-header">
        <button className="back-button" onClick={onBack}>
          ←
        </button>

        <div>
          <p>{program.eyebrow}</p>
          <h2>{program.title}</h2>
        </div>
      </div>

      <p className="detail-description">
        {program.description}
      </p>

      <div className="session-list">
        {program.sessions.map((commonSession) => {
          const session = getPersonalizedSession(
            commonSession,
            currentMember.id,
          )

          const record = records[session.id]
          const isCompleted = Boolean(record)

          return (
            <article
              className={`session-card ${
                isCompleted ? 'completed' : ''
              }`}
              key={session.id}
            >
              <div className="session-top">
                <span className="session-tag">
                  {session.type}
                </span>

                {isCompleted && (
                  <span className="done-badge">완료</span>
                )}
              </div>

              <h3>{session.title}</h3>

              <p className="session-subtitle">
                {session.subtitle}
              </p>

              <PersonalPlan session={session} />

              <div className="training-sections">
                {session.sections.map((section) => (
                  <section
                    className="training-section"
                    key={section.title}
                  >
                    <div className="training-section-title">
                      <span>{section.title}</span>
                    </div>

                    <div className="training-items">
                      {section.items.map((item) => (
                        <div className="training-item" key={item}>
                          <span className="training-dot" />
                          <p>{item}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              {isCompleted ? (
                <div className="completed-record">
                  <span>실제 수행 RPE</span>
                  <strong>{record.rpe}</strong>
                </div>
              ) : (
                <>
                  <label className="rpe-field">
                    실제 수행 RPE

                    <select
                      value={rpeValues[session.id] || ''}
                      onChange={(event) =>
                        setRpeValues((current) => ({
                          ...current,
                          [session.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">선택</option>

                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
                        (value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <button
                    className="complete-button"
                    onClick={() =>
                      completeSession(session.id)
                    }
                  >
                    운동 완료
                  </button>
                </>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function CommunityPage() {
  return (
    <section className="sub-page">
      <div className="page-heading">
        <p>NTAC COMMUNITY</p>
        <h2>토요일 커뮤니티</h2>
        <span>함께 훈련하고 서로의 성장을 확인합니다.</span>
      </div>

      <article className="community-card">
        <div className="date-box">
          <strong>08</strong>
          <span>AUG</span>
        </div>

        <div className="community-info">
          <p>토요일 12:00–14:00</p>
          <h3>NTAC Weekly Training</h3>
          <span>놀토짐 오프라인 커뮤니티 클래스</span>
        </div>
      </article>

      <button
        className="primary-button"
        onClick={() =>
          alert('클래스 신청 기능은 다음 단계에서 연결합니다.')
        }
      >
        참석 신청하기
      </button>

      <div className="attendance-card">
        <span>이번 달 참석 현황</span>
        <strong>0 / 4회</strong>
      </div>
    </section>
  )
}

function MyPage({ progressPercent }) {
  return (
    <section className="sub-page">
      <div className="page-heading">
        <p>MY NTAC</p>
        <h2>마이페이지</h2>
        <span>나의 이용 상품과 관리 현황을 확인합니다.</span>
      </div>

      <article className="membership-card">
        <p>현재 이용 상품</p>
        <h3>{currentMember.membership}</h3>
        <span>러닝 + 보강 + 토요일 커뮤니티</span>
      </article>

      <div className="status-list">
        <div className="status-row">
          <span>멤버십 상태</span>
          <strong>이용 중</strong>
        </div>

        <div className="status-row">
          <span>담당 코치</span>
          <strong>미배정</strong>
        </div>

        <div className="status-row">
          <span>이번 주 수행률</span>
          <strong>{progressPercent}%</strong>
        </div>
      </div>

      <article className="coach-card">
        <p>COACH CARE</p>
        <h3>더 세밀한 코칭이 필요하신가요?</h3>

        <span>
          담당 코치가 컨디션과 수행 기록을 확인하고
          관리합니다.
        </span>

        <button>서비스 알아보기</button>
      </article>
    </section>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [checkinOpen, setCheckinOpen] = useState(false)

  const [todayCheckin, setTodayCheckin] = useState(() => {
    const savedCheckin = localStorage.getItem(
      'ntac-daily-checkin',
    )

    if (!savedCheckin) return null

    try {
      const parsedCheckin = JSON.parse(savedCheckin)
      const today = new Date().toLocaleDateString('ko-KR')

      return parsedCheckin.date === today
        ? parsedCheckin
        : null
    } catch {
      return null
    }
  })

  const [workoutRecords, setWorkoutRecords] = useState(() => {
    const savedRecords = localStorage.getItem(
      'ntac-workout-records',
    )

    if (!savedRecords) return {}

    try {
      return JSON.parse(savedRecords)
    } catch {
      return {}
    }
  })

  const completedCount = assignmentIds.filter(
    (id) => workoutRecords[id],
  ).length

  const totalAssignments = assignmentIds.length

  const progressPercent = Math.round(
    (completedCount / totalAssignments) * 100,
  )

  const completeWorkout = (sessionId, rpe) => {
    setWorkoutRecords((current) => {
      const updatedRecords = {
        ...current,
        [sessionId]: {
          rpe,
          completedAt: new Date().toISOString(),
        },
      }

      localStorage.setItem(
        'ntac-workout-records',
        JSON.stringify(updatedRecords),
      )

      return updatedRecords
    })
  }

  const renderPage = () => {
    if (activeTab === 'training') {
      return (
        <TrainingPage
          openProgram={setSelectedProgram}
          completedCount={completedCount}
          totalAssignments={totalAssignments}
        />
      )
    }

    if (activeTab === 'community') {
      return <CommunityPage />
    }

    if (activeTab === 'my') {
      return <MyPage progressPercent={progressPercent} />
    }

    return (
      <HomePage
        openCheckin={() => setCheckinOpen(true)}
        todayCheckin={todayCheckin}
        completedCount={completedCount}
        totalAssignments={totalAssignments}
        progressPercent={progressPercent}
        openProgram={setSelectedProgram}
        moveToTraining={() => setActiveTab('training')}
      />
    )
  }

  if (selectedProgram) {
    return (
      <div className="app">
        <ProgramDetailPage
          program={programs[selectedProgram]}
          records={workoutRecords}
          onBack={() => setSelectedProgram(null)}
          onComplete={completeWorkout}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="brand-caption">NOLTO TRAINING</p>
          <h1>NTAC</h1>
        </div>

        <button
          className="profile-button"
          onClick={() => setActiveTab('my')}
        >
          {currentMember.initials}
        </button>
      </header>

      <main>{renderPage()}</main>

      <nav className="bottom-nav">
        <button
          className={activeTab === 'home' ? 'active' : ''}
          onClick={() => setActiveTab('home')}
        >
          홈
        </button>

        <button
          className={activeTab === 'training' ? 'active' : ''}
          onClick={() => setActiveTab('training')}
        >
          트레이닝
        </button>

        <button
          className={activeTab === 'community' ? 'active' : ''}
          onClick={() => setActiveTab('community')}
        >
          커뮤니티
        </button>

        <button
          className={activeTab === 'my' ? 'active' : ''}
          onClick={() => setActiveTab('my')}
        >
          마이
        </button>
      </nav>

      {checkinOpen && (
        <CheckinPage
          onClose={() => setCheckinOpen(false)}
          onComplete={(checkin) => {
            setTodayCheckin(checkin)
            setCheckinOpen(false)
          }}
        />
      )}
    </div>
  )
}

export default App