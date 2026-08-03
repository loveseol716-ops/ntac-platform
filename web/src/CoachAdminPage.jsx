import { useEffect, useState } from 'react'

const members = [
  {
    id: 'seol-jaehyun',
    name: '설재현',
    membership: 'NTAC COMPLETE',
    coach: '윤다원',
  },
  {
    id: 'jung-jihye',
    name: '정지혜',
    membership: 'NTAC BUILD',
    coach: '미배정',
  },
  {
    id: 'kim-hyemi',
    name: '김혜미',
    membership: 'NTAC RUN',
    coach: '미배정',
  },
]

const sessions = [
  {
    id: 'run-interval-1',
    name: '400m 인터벌',
  },
  {
    id: 'run-zone2-1',
    name: 'Zone 2 Running',
  },
  {
    id: 'build-sled-1',
    name: 'Sled Push Strength',
  },
]

const emptyForm = {
  targetPace: '',
  treadmillSpeed: '',
  targetLoad: '',
  targetRpe: '',
  coachNote: '',
}

function loadJson(key, fallback) {
  try {
    const savedValue = localStorage.getItem(key)

    return savedValue ? JSON.parse(savedValue) : fallback
  } catch {
    return fallback
  }
}

function CoachAdminPage({ onClose }) {
  const [selectedMemberId, setSelectedMemberId] =
    useState('seol-jaehyun')

  const [selectedSessionId, setSelectedSessionId] =
    useState('run-interval-1')

  const [overrides, setOverrides] = useState(() =>
    loadJson('ntac-member-overrides', {}),
  )

  const [form, setForm] = useState(emptyForm)

  const selectedMember = members.find(
    (member) => member.id === selectedMemberId,
  )

  useEffect(() => {
    const savedForm =
      overrides[selectedMemberId]?.[selectedSessionId] || {}

    setForm({
      ...emptyForm,
      ...savedForm,
    })
  }, [selectedMemberId, selectedSessionId, overrides])

  const updateForm = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSave = (event) => {
    event.preventDefault()

    const updatedOverrides = {
      ...overrides,
      [selectedMemberId]: {
        ...overrides[selectedMemberId],
        [selectedSessionId]: {
          ...form,
        },
      },
    }

    setOverrides(updatedOverrides)

    localStorage.setItem(
      'ntac-member-overrides',
      JSON.stringify(updatedOverrides),
    )

    alert('개인 프로그램이 저장되었습니다.')
  }

  const checkin =
    selectedMemberId === 'seol-jaehyun'
      ? loadJson('ntac-daily-checkin', null)
      : null

  const workoutRecords =
    selectedMemberId === 'seol-jaehyun'
      ? loadJson('ntac-workout-records', {})
      : {}

  const completedCount = Object.keys(workoutRecords).length

  return (
    <section className="coach-admin-page">
      <div className="admin-page-header">
        <button type="button" onClick={onClose}>
          ←
        </button>

        <div>
          <p>NTAC COACH</p>
          <h2>코치 관리자</h2>
        </div>
      </div>

      <div className="admin-select-grid">
        <label className="admin-field">
          멤버 선택

          <select
            value={selectedMemberId}
            onChange={(event) =>
              setSelectedMemberId(event.target.value)
            }
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          프로그램 선택

          <select
            value={selectedSessionId}
            onChange={(event) =>
              setSelectedSessionId(event.target.value)
            }
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <article className="admin-member-card">
        <div>
          <p>SELECTED ATHLETE</p>
          <h3>{selectedMember.name}</h3>
          <span>{selectedMember.membership}</span>
        </div>

        <div className="admin-coach-info">
          <span>담당 코치</span>
          <strong>{selectedMember.coach}</strong>
        </div>
      </article>

      <div className="admin-status-grid">
        <article>
          <span>오늘 체크인</span>
          <strong>{checkin ? '완료' : '미완료'}</strong>

          {checkin && (
            <p>
              컨디션 {checkin.condition} · 수면 {checkin.sleep}시간
            </p>
          )}
        </article>

        <article>
          <span>완료한 과제</span>
          <strong>{completedCount}개</strong>
          <p>현재 브라우저 기록 기준</p>
        </article>
      </div>

      <form className="admin-program-form" onSubmit={handleSave}>
        <div className="admin-form-heading">
          <p>PERSONAL PROGRAM</p>
          <h3>개인 목표 수정</h3>
        </div>

        <label className="admin-field">
          목표 페이스

          <input
            type="text"
            placeholder="예: 4:10–4:15/km"
            value={form.targetPace}
            onChange={(event) =>
              updateForm('targetPace', event.target.value)
            }
          />
        </label>

        <label className="admin-field">
          트레드밀 속도

          <input
            type="text"
            placeholder="예: 14.1–14.4km/h"
            value={form.treadmillSpeed}
            onChange={(event) =>
              updateForm('treadmillSpeed', event.target.value)
            }
          />
        </label>

        <label className="admin-field">
          목표 중량

          <input
            type="text"
            placeholder="예: Sled 150kg"
            value={form.targetLoad}
            onChange={(event) =>
              updateForm('targetLoad', event.target.value)
            }
          />
        </label>

        <label className="admin-field">
          목표 RPE

          <input
            type="text"
            placeholder="예: 8–9"
            value={form.targetRpe}
            onChange={(event) =>
              updateForm('targetRpe', event.target.value)
            }
          />
        </label>

        <label className="admin-field">
          코치 노트

          <textarea
            rows="5"
            placeholder="멤버에게 전달할 개인 피드백을 작성하세요."
            value={form.coachNote}
            onChange={(event) =>
              updateForm('coachNote', event.target.value)
            }
          />
        </label>

        <button className="admin-save-button" type="submit">
          개인 프로그램 저장
        </button>
      </form>
    </section>
  )
}

export default CoachAdminPage