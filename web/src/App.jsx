import { useState } from 'react'
import './App.css'

const workouts = [
  {
    type: 'RUN',
    title: '러닝 인터벌',
    description: '400m × 10 Sets',
    status: '오늘의 훈련',
  },
  {
    type: 'ZONE 2',
    title: 'Zone 2 Running',
    description: '40분 지속주',
    status: '이번 주 과제',
  },
  {
    type: 'BUILD',
    title: '하이록스 보강',
    description: 'Sled Push Strength',
    status: '개인 과제',
  },
]

function HomePage({ moveToTraining }) {
  return (
    <>
      <section className="welcome">
        <p>안녕하세요, 설재현님</p>
        <h2>오늘도 훈련을 이어가세요.</h2>
        <span>NTAC COMPLETE</span>
      </section>

      <section className="checkin-card">
        <div>
          <p className="section-label">DAILY CHECK-IN</p>
          <h3>오늘 컨디션은 어떤가요?</h3>
          <p>훈련 전 컨디션을 기록해 주세요.</p>
        </div>

        <button onClick={() => alert('체크인 화면은 다음 단계에서 만들 예정입니다.')}>
          체크인하기
        </button>
      </section>

      <section className="progress-section">
        <div className="section-title">
          <h3>이번 주 진행률</h3>
          <strong>3 / 5</strong>
        </div>

        <div className="progress-bar">
          <div className="progress-value" />
        </div>
      </section>

      <section>
        <div className="section-title">
          <h3>나의 트레이닝</h3>
          <button className="text-button" onClick={moveToTraining}>
            전체보기
          </button>
        </div>

        <div className="workout-list">
          {workouts.map((workout) => (
            <article className="workout-card" key={workout.title}>
              <div className="workout-type">{workout.type}</div>

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

function TrainingPage() {
  return (
    <section className="sub-page">
      <div className="page-heading">
        <p>WEEK 1</p>
        <h2>나의 트레이닝</h2>
        <span>구독 중인 프로그램만 확인할 수 있습니다.</span>
      </div>

      <div className="feature-list">
        <article className="feature-card">
          <div className="feature-card-top">
            <span className="access-badge">이용 가능</span>
            <strong>RUN</strong>
          </div>
          <h3>주간 러닝 프로그램</h3>
          <p>러닝 인터벌과 Zone 2 프로그램</p>
          <button>프로그램 보기</button>
        </article>

        <article className="feature-card">
          <div className="feature-card-top">
            <span className="access-badge">이용 가능</span>
            <strong>BUILD</strong>
          </div>
          <h3>하이록스 보강 프로그램</h3>
          <p>개인에게 필요한 근력 및 움직임 보강</p>
          <button>프로그램 보기</button>
        </article>

        <article className="feature-card locked">
          <div className="feature-card-top">
            <span className="locked-badge">추후 제공</span>
            <strong>COACH CARE</strong>
          </div>
          <h3>담당 코치 피드백</h3>
          <p>훈련 기록을 바탕으로 담당 코치가 직접 관리합니다.</p>
          <button disabled>준비 중</button>
        </article>
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
        onClick={() => alert('클래스 신청 기능은 다음 단계에서 연결합니다.')}
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

function MyPage() {
  return (
    <section className="sub-page">
      <div className="page-heading">
        <p>MY NTAC</p>
        <h2>마이페이지</h2>
        <span>나의 이용 상품과 관리 현황을 확인합니다.</span>
      </div>

      <article className="membership-card">
        <p>현재 이용 상품</p>
        <h3>NTAC COMPLETE</h3>
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
          <strong>60%</strong>
        </div>
      </div>

      <article className="coach-card">
        <p>COACH CARE</p>
        <h3>더 세밀한 코칭이 필요하신가요?</h3>
        <span>담당 코치가 컨디션과 수행 기록을 확인하고 관리합니다.</span>
        <button>서비스 알아보기</button>
      </article>
    </section>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('home')

  const renderPage = () => {
    if (activeTab === 'training') return <TrainingPage />
    if (activeTab === 'community') return <CommunityPage />
    if (activeTab === 'my') return <MyPage />

    return <HomePage moveToTraining={() => setActiveTab('training')} />
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
          SJ
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
    </div>
  )
}

export default App