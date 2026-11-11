import { useEffect, useState } from "react";
import { seoulDate } from "./model.js";
import { blockLabel, classDirection, PHASES, positionLabel, shortTrainingDate, TRAINING_BLOCKS, trainingPosition, trainingWeeks } from "./trainingCycle.js";
import { HYROX_RULES } from "./hyroxCycle.js";
import { PRESEASON_CYCLE, PRESEASON_ASSESSMENTS } from "./preseasonCycle.js";
import { classTypeName } from "./classTypes.js";
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
    {position.weekPlan && <p>{position.weekPlan.title} · {position.weekPlan.load}</p>}
    {position.block?.quarter && <p>{position.block.year} · {position.block.quarter}분기{direction?.part ? ` · ${direction.part}` : ""}</p>}
    {direction && <p className="g-cycle-context-goal">{direction.goal} <span>{direction.focus}</span></p>}
    {direction?.prescription && <p>{direction.prescription}</p>}
    <TrainingDemand direction={direction} />
    {position.block?.id === PRESEASON_CYCLE.id && <PreseasonAssessments classType={classType} />}
    {position.weekPlan?.note && <p>{position.weekPlan.note}</p>}
    {position.state === "planning" && <p>{PHASES.preparation.description}</p>}
  </aside>;
}

export function TrainingWeekFocus({ position }) {
  if (!position?.weekPlan) return null;
  return <div className="g-cycle-week-focus">
    <p className="g-cycle-eyebrow">{position.stage ? `블록 ${position.stage.number} · ${position.stage.title}` : "PRE-SEASON · 이번 주 방향"}</p>
    <h3>{position.week}주차 · {position.weekPlan.title}</h3>
    <p>{shortTrainingDate(position.weekStart)}–{shortTrainingDate(position.weekEnd)} · {position.weekPlan.load}</p>
    {position.weekPlan.note && <p className="g-cycle-note">{position.weekPlan.note}</p>}
  </div>;
}

export default function TrainingJourney({ date }) {
  const today = useSeoulToday();
  const position = trainingPosition(date || today);
  if (!position) return null;
  const block = position.block || position.nextBlock;
  const weeks = trainingWeeks(block);
  const preseason = block?.id === PRESEASON_CYCLE.id;
  const upcoming = position.state === "preparation" || (position.state === "transition" && !!position.nextBlock);
  const phaseGroups = block?.stages || weeks.reduce((groups, week) => {
    const last = groups[groups.length - 1];
    if (last?.phase === week.phase && !preseason) last.end = week.number;
    else groups.push({ phase: week.phase, start: week.number, end: week.number, ...(preseason ? { title: `${PHASES[week.phase].name}${week.number >= 5 ? (week.number === 5 ? " ①" : " ②") : ""}`, description: week.plan.note } : {}) });
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
      {position.state === "planning" && <p>{PHASES.preparation.description}</p>}
    </div>
    {weeks.length > 0 && <ol className="g-cycle-track" style={{ "--cycle-weeks": weeks.length }} aria-label={upcoming ? "예정된 블록의 흐름" : positionLabel(position)}>
      {weeks.map((week) => <li key={week.number} data-phase={week.phase} data-state={position.week === week.number ? "current" : !upcoming && week.end < position.day ? "past" : "future"} aria-current={position.week === week.number ? "step" : undefined} aria-label={`${week.number}주차 ${PHASES[week.phase].name}${position.week === week.number ? " · 현재" : ""}`}><span>{week.number}</span></li>)}
    </ol>}
    <TrainingWeekFocus position={position} />
    {position.weekPlan && <div className="g-cycle-class-section">
      <h3>이번 블록의 수업별 훈련 기준</h3>
      <p className="g-cycle-note">위의 주간 조정 기준에 맞춰 진행해요. 실제 운동 종목과 구성은 수업 프로그램에서 확인해 주세요.</p>
      <div className="g-cycle-class-grid">{["gentle_strength", "bomb_strength", "gentle_sweat", "bomb_sweat", ...(preseason ? [] : ["nolto_team"])].map((type) => {
        const direction = classDirection(position, type);
        return <article className="g-cycle-class-card" key={type}>
          <h4>{direction.name}</h4><strong>{direction.goal}</strong>
          <p className="g-cycle-prescription">{direction.prescription}</p><p>{direction.focus}</p><TrainingDemand direction={direction} />
        </article>;
      })}</div>
    </div>}
    {!!phaseGroups.length && <div className="g-cycle-flow">
      <h3>{block?.stages ? "하이록스까지 12주 흐름" : upcoming ? "다음 블록의 흐름" : "이번 블록의 흐름"}</h3>
      <div className="g-cycle-phase-list">{phaseGroups.map((group) => {
        const current = position.state === "active" && position.week >= group.start && position.week <= group.end;
        return <div key={`${group.phase}-${group.start}`} data-phase={group.phase} className={current ? "is-current" : ""}><span className="g-cycle-phase-dot" aria-hidden="true" /><div><strong>{group.title || PHASES[group.phase].name}{current && <em>현재</em>}</strong><p>{group.description || PHASES[group.phase].description}</p></div><span>{group.start === group.end ? group.start : `${group.start}–${group.end}`}주</span></div>;
      })}</div>
      {!block?.stages && <p className="g-cycle-note">마지막 두 주는 SWEAT → STRENGTH 순서로 평가해요. 종목과 기준은 각 수업에서 안내해요.</p>}
    </div>}
    {position.weekPlan && <>
      <details className="g-cycle-details"><summary>전체 {weeks.length}주 계획 보기</summary>
        <ol className="g-cycle-week-list">{weeks.map((week) => <li key={week.number} aria-current={position.week === week.number ? "step" : undefined}>
          <div><strong>{week.number}주차 · {week.plan.title}</strong><span>{shortTrainingDate(week.start)}–{shortTrainingDate(week.end)}{position.week === week.number ? " · 현재" : ""}</span></div>
          <p>{week.plan.load}</p>{week.plan.saturday && <p>토요일 · {week.plan.saturday}</p>}{week.plan.note && <p>{week.plan.note}</p>}
        </li>)}</ol>
      </details>
      {!preseason && <details className="g-cycle-details"><summary>훈련 강도와 회복 기준</summary><ul>{HYROX_RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
        <p className="g-cycle-note">주간 부하는 최근 3~4주 개인 기록과 함께 살펴봐요. 한 가지 비율만으로 위험 여부를 판단하지 않아요.</p>
      </details>}
    </>}
    {(position.block?.id === "2026-hyrox" || preseason || position.nextBlock?.id === PRESEASON_CYCLE.id) && <PreseasonOverview /> }
    <div className="g-cycle-year-section">
      <h3>2027년, 네 번의 블록</h3>
      <div className="g-cycle-year" aria-label="2027년 블록 일정">{TRAINING_BLOCKS.filter((b) => b.year === 2027).map((b) => <div key={b.id} className={position.block?.id === b.id ? "is-current" : ""}><strong>{b.quarter}분기 · {b.name}</strong><span>{shortTrainingDate(b.start)}–{shortTrainingDate(b.end)}</span></div>)}</div>
      <p className="g-cycle-note">정규 블록은 각 12주예요. 블록 사이와 추석 조정 주간은 별도로 운영해요.</p>
    </div>
    <p className="g-cycle-note">주차는 우리가 함께하는 프로그램의 진행 위치예요. 개인 출석 횟수와는 달라요.</p>
  </section>;
}


export function TrainingDemand({ direction }) {
  if (!direction?.demand) return null;
  return <div className="g-training-demand" aria-label="클래스별 계획 부하">
    {[["중량·운동 강도", direction.demand.intensity], ["볼륨", direction.demand.volume]].map(([label, value]) => <span key={label} data-level={value}>{label} <strong>{value}</strong></span>)}
  </div>;
}

export function PreseasonAssessments({ classType }) {
  const events = PRESEASON_ASSESSMENTS.filter((event) => !classType || event.classType === classType);
  if (!events.length) return null;
  return <details className="g-cycle-details"><summary>평가 일정 · WOD · 수행 기준</summary>
    <div className="g-cycle-class-grid">{events.map((event) => <article className="g-cycle-class-card" key={event.id}>
      <h4>{event.week}주차 · {classTypeName(event.classType)}</h4><strong>{event.title}</strong>
      <p className="g-cycle-prescription">{event.format}</p>
      {event.movements && <ol className="g-assessment-movements">{event.movements.map((movement) => <li key={movement}>{movement}</li>)}</ol>}
      <p>{event.protocol}</p><p>확인할 기록 · {event.record}</p>
    </article>)}</div>
    <p className="g-cycle-note">세부 측정일·유효 반복 기준·개인별 스케일·시도 횟수와 휴식은 코치가 공개 프로그램에서 안내해요. 지금은 프로그램 확인용이며 앱 기록 입력은 필요 없어요.</p>
  </details>;
}

function PreseasonOverview() {
  return <div className="g-cycle-next">
    <strong>PRE-SEASON · 11.23–1.3 · 6주</strong>
    <p>11.16–11.22 회복·준비 → 11.23 프리시즌 시작 → 1.4 정규 블록 시작</p>
    <p>훈련 흐름과 평가 운영을 시험하고, 다음 시즌과 비교할 첫 기준 기록을 확보해요.</p>
    <details className="g-cycle-details"><summary>프리시즌 6주 운영표</summary>
      <ol className="g-cycle-week-list">{trainingWeeks(PRESEASON_CYCLE).map((week) => <li key={week.number}>
        <div><strong>{week.number}주차 · {PHASES[week.phase].name}{week.number >= 5 ? (week.number === 5 ? " ①" : " ②") : ""}</strong><span>{shortTrainingDate(week.start)}–{shortTrainingDate(week.end)}</span></div>
        <p>{week.plan.title}</p><p>{week.plan.load}</p><p>{week.plan.note}</p>
      </li>)}</ol>
      <p className="g-cycle-note">reps·RPE는 메인 근력 운동의 작성 기준이에요. 클린은 기술·속도 중심으로 별도 구성하며, 카디오·메트콘에 같은 반복 수를 적용하지 않아요. 목표 반복과 동작 기준을 충족하고 목표 RPE 안에 들어오면 중량을 조절해요.</p>
    </details>
    <PreseasonAssessments />
    <p className="g-cycle-note">주차 안내는 날짜에 맞춰 자동 전환돼요. 실제 수업 프로그램은 관리자가 작성·공개한 내용만 표시돼요.</p>
  </div>;
}
