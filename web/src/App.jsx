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

function App() {
  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="brand-caption">NOLTO TRAINING</p>
          <h1>NTAC</h1>
        </div>

        <button className="profile-button">SJ</button>
      </header>

      <main>
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

          <button>체크인하기</button>
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
            <button className="text-button">전체보기</button>
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
      </main>

      <nav className="bottom-nav">
        <button className="active">홈</button>
        <button>트레이닝</button>
        <button>커뮤니티</button>
        <button>마이</button>
      </nav>
    </div>
  )
}

export default App