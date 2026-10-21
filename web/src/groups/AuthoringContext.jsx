import { PhaseBadge } from "./TrainingJourney.jsx";
import { blockLabel, classDirection, PHASES, trainingPosition, trainingWeeks } from "./trainingCycle.js";
import { classTypeName } from "./classTypes.js";
import { STRENGTH_TYPES } from "./blockGoals.js";

export default function AuthoringContext({ date, classType, goals = [], exercises = [], loading = false, error = "" }) {
  const position = trainingPosition(date), direction = classDirection(position, classType);
  if (!position) return <aside className="g-cycle-context">{date} · 등록된 블록 일정이 없어요.</aside>;
  const weeks = trainingWeeks(position.block);
  return <aside className="g-author-context" data-phase={position.phase} aria-label="작성 중인 프로그램의 위치">
    <div className="g-cycle-heading">
      <div><p className="g-cycle-eyebrow">작성할 수업 기준 · {date}</p>
        <strong>{position.block ? blockLabel(position.block) : position.label}</strong></div>
      {position.week && <span className="g-cycle-count"><strong>{position.week}</strong> / {position.total}주차</span>}
    </div>
    <div className="g-author-phase"><PhaseBadge position={position} /><span>{direction?.part}</span></div>
    {!!weeks.length && <ol className="g-cycle-track" style={{ "--cycle-weeks": weeks.length }} aria-label="블록 주차 진행">
      {weeks.map((w) => <li key={w.number} data-phase={w.phase}
        data-state={w.number === position.week ? "current" : w.end < date ? "past" : "future"}
        aria-current={w.number === position.week ? "step" : undefined}
        title={`${w.number}주차 · ${PHASES[w.phase].name} · ${w.start}–${w.end}`}>{w.number}</li>)}
    </ol>}
    <p className="g-author-focus">{position.state === "paused" ? `${position.label} · ${position.next.start}부터 ${position.next.number}주차 재개` : PHASES[position.phase].description}</p>
    {position.nextBlock && <p className="g-muted">다음 블록 · {blockLabel(position.nextBlock)} · {position.nextBlock.start} 시작</p>}
    {STRENGTH_TYPES.includes(classType) && position.block && <div className="g-block-targets">
      <small>{classTypeName(classType)} · 이번 블록 평가 목표</small>
      {loading ? <p>목표 불러오는 중…</p> : error ? <p role="alert">블록 목표를 불러오지 못했어요. 다시 열어 주세요.</p>
        : goals.length ? <div className="g-goal-chips">{goals.map((g) => <span key={g.exercise_id}>{exercises.find((e) => e.id === g.exercise_id)?.name || g.exercise_id} <b>{g.test_reps}RM</b></span>)}</div>
          : <p>아직 정하지 않았어요. 주간 프로그램의 ‘블록 목표 설정’에서 등록할 수 있어요.</p>}
    </div>}
  </aside>;
}
