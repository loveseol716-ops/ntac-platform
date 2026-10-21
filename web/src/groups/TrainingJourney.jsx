import { useEffect, useState } from "react";
import { seoulDate } from "./model.js";
import { blockLabel, classDirection, PHASES, positionLabel, shortTrainingDate, TRAINING_BLOCKS, trainingPosition, trainingWeeks } from "./trainingCycle.js";
import "./TrainingJourney.css";

function useSeoulToday() {
  const [today, setToday] = useState(seoulDate());
  useEffect(() => {
    const refresh = () => setToday(seoulDate());
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return today;
}

export function PhaseBadge({ position }) {
  if (!position) return null;
  return <span className="g-cycle-badge" data-phase={position.phase}>{position.assessment ? `${position.assessment.toUpperCase()} 평가` : PHASES[position.phase].name}<span>{position.label}</span></span>;
}

export function TrainingPositionBar({ date, onOpen }) {
  const today = useSeoulToday();
  const position = trainingPosition(date || today);
  if (!position) return null;
  return <button type="button" className="g-cycle-location" data-phase={position.phase} onClick={onOpen} aria-label={`트레이닝 여정 자세히 보기: ${positionLabel(position)}`}>
    <span className="g-cycle-location-copy">
      <span>현재 위치{position.block?.quarter ? ` · ${position.block.year} ${position.block.quarter}분기` : ""}</span>
      <strong>{position.block?.name || position.label}{position.week ? ` · ${position.week}/${position.total}주차` : ""}</strong>
    </span>
    <span className="g-cycle-badge">{PHASES[position.phase].name}</span>
    <span className="g-cycle-location-arrow" aria-hidden="true">›</span>
  </button>;
}

export function TrainingContext({ date, classType, label = "선택한 수업의 위치" }) {
  const position = trainingPosition(date), direction = classDirection(position, classType);
  if (!position) return null;
  return <aside className="g-cycle-context" data-phase={position.phase} aria-label={label}>
    <div className="g-cycle-context-top"><span>{label}</span><strong>{positionLabel(position)}</strong></div>
    {position.block?.quarter && <p>{position.block.year} · {position.block.quarter}분기{direction?.part ? ` · ${direction.part}` : ""}</p>}
    {direction && <p className="g-cycle-context-goal">{direction.goal} <span>{direction.focus}</span></p>}
  </aside>;
}

export default function TrainingJourney({ date }) {
  const today = useSeoulToday();
  const position = trainingPosition(date || today);
  if (!position) return null;
  const block = position.block || position.nextBlock;
  const weeks = trainingWeeks(block);
  const upcoming = position.state === "preparation" || (position.state === "transition" && !!position.nextBlock);
  const phaseGroups = weeks.reduce((groups, week) => {
    const last = groups[groups.length - 1];
    if (last?.phase === week.phase) last.end = week.number;
    else groups.push({ phase: week.phase, start: week.number, end: week.number });
    return groups;
  }, []);
  return <section className="g-training-journey" data-phase={position.phase} aria-label="우리의 트레이닝 여정">
    <div className="g-cycle-heading">
      <div><p className="g-cycle-eyebrow">NOLTO 2.0 · 우리의 트레이닝 여정</p><h2>{position.state === "active" ? blockLabel(block) : position.label}</h2></div>
      {position.week && <span className="g-cycle-count"><strong>{position.week}</strong> / {position.total}주차</span>}
    </div>
    <div className="g-cycle-status">
      {position.state === "active" && <PhaseBadge position={position} />}
      {upcoming && <p>{shortTrainingDate(block.start)} 시작 · {block.name}{block.quarter ? ` · ${block.quarter}분기` : ""}</p>}
      {position.state === "paused" && <p>{blockLabel(block)} · {shortTrainingDate(position.next.start)}부터 {position.next.number}/{position.total}주차를 이어가요.</p>}
      {position.state === "transition" && !block && <p>회복과 기술 연습으로 다음 시즌을 준비해요.</p>}
      {position.state === "unplanned" && <p>{PHASES.unplanned.description}</p>}
    </div>
    {weeks.length > 0 && <ol className="g-cycle-track" style={{ "--cycle-weeks": weeks.length }} aria-label={upcoming ? "예정된 블록의 흐름" : positionLabel(position)}>
      {weeks.map((week) => <li key={week.number} data-phase={week.phase} data-state={position.week === week.number ? "current" : !upcoming && week.end < position.day ? "past" : "future"} aria-current={position.week === week.number ? "step" : undefined} aria-label={`${week.number}주차 ${PHASES[week.phase].name}${position.week === week.number ? " · 현재" : ""}`}><span>{week.number}</span></li>)}
    </ol>}
    {!!phaseGroups.length && <div className="g-cycle-flow">
      <h3>{upcoming ? "다음 블록의 흐름" : "이번 블록의 흐름"}</h3>
      <div className="g-cycle-phase-list">{phaseGroups.map((group) => <div key={group.phase} data-phase={group.phase} className={position.phase === group.phase && position.state === "active" ? "is-current" : ""}><span className="g-cycle-phase-dot" aria-hidden="true" /><div><strong>{PHASES[group.phase].name}{position.phase === group.phase && position.state === "active" && <em>현재</em>}</strong><p>{PHASES[group.phase].description}</p></div><span>{group.start === group.end ? group.start : `${group.start}–${group.end}`}주</span></div>)}</div>
      {block?.id === "2026-preseason" && <p className="g-cycle-note">8주 프리시즌은 정규 12주 과정의 5~12주차 흐름을 경험하는 기간이에요.</p>}
      <p className="g-cycle-note">마지막 두 주는 SWEAT → STRENGTH 순서로 평가해요. 종목과 기준은 각 수업에서 안내해요.</p>
    </div>}
    <div className="g-cycle-year-section">
      <h3>2027년, 네 번의 블록</h3>
      <div className="g-cycle-year" aria-label="2027년 블록 일정">{TRAINING_BLOCKS.filter((b) => b.year === 2027).map((b) => <div key={b.id} className={position.block?.id === b.id ? "is-current" : ""}><strong>{b.quarter}분기 · {b.name}</strong><span>{shortTrainingDate(b.start)}–{shortTrainingDate(b.end)}</span></div>)}</div>
      <p className="g-cycle-note">정규 블록은 각 12주예요. 블록 사이와 추석 조정 주간은 별도로 운영해요.</p>
    </div>
    <p className="g-cycle-note">주차는 우리가 함께하는 프로그램의 진행 위치예요. 개인 출석 횟수와는 달라요.</p>
  </section>;
}
