import { useState } from "react";
import { Dialog } from "./shared.jsx";
import { blockLabel, classDirection, TRAINING_BLOCKS, trainingPosition } from "./trainingCycle.js";
import { classTypeName } from "./classTypes.js";
import { emptyBlockGoals, STRENGTH_TYPES } from "./blockGoals.js";
import ExerciseSearch from "./ExerciseSearch.jsx";

export default function BlockGoalsEditor({ date, rows, exercises, busy, error, onClose, onSave }) {
  const position = trainingPosition(date);
  const [blockId, setBlockId] = useState((position?.block || position?.nextBlock || TRAINING_BLOCKS.at(-1)).id);
  const [drafts, setDrafts] = useState({});
  const saved = rows.find((r) => r.block_id === blockId);
  const programs = drafts[blockId] || saved?.programs || emptyBlockGoals();
  const block = TRAINING_BLOCKS.find((b) => b.id === blockId);
  function setGoals(type, goals) { setDrafts((d) => ({ ...d, [blockId]: { ...programs, [type]: goals } })); }
  return <Dialog title="블록 목표 설정" onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); onSave({ block_id: blockId, revision: saved?.revision || 0, programs }); }}>
      <fieldset disabled={busy}>
        <p className="g-muted">블록 시작 전에 평가 종목을 한 번 정해 두세요. 해당 블록의 새 스트렝스 프로그램에 종목을 미리 불러와요.</p>
        <label>설정할 블록<select value={blockId} onChange={(e) => setBlockId(e.target.value)}>
          {TRAINING_BLOCKS.map((b) => <option value={b.id} key={b.id}>{blockLabel(b)}</option>)}
        </select></label>
        <p className="g-muted">{block.start} — {block.end} · {block.phases.length}주</p>
        {STRENGTH_TYPES.map((type) => <section className="g-block-settings" key={type}>
          <div className="g-heading"><h3>{classTypeName(type)}</h3><span className="g-badge">{classDirection(trainingPosition(block.start), type)?.part || "PRE-SEASON"}</span></div>
          {!programs[type].length && <p className="g-muted">평가 종목을 추가해 주세요. 여러 종목을 설정할 수 있어요.</p>}
          {programs[type].map((g, i) => <div className="g-goal-row" key={g.exercise_id}>
            <strong>{exercises.find((e) => e.id === g.exercise_id)?.name || g.exercise_id}</strong>
            <label>평가 기준<select value={g.test_reps} onChange={(e) => setGoals(type, programs[type].map((x, j) => j === i ? { ...x, test_reps: Number(e.target.value) } : x))}>
              {(type === "gentle_strength" ? [3, 5, 1, 2] : [1, 2, 3, 5]).map((n) => <option key={n} value={n}>{n}RM</option>)}
            </select></label>
            <button type="button" aria-label={`${classTypeName(type)} 평가 종목 ${i + 1} 삭제`} onClick={() => setGoals(type, programs[type].filter((_, j) => j !== i))}>삭제</button>
          </div>)}
          <ExerciseSearch exercises={exercises} exclude={programs[type].map((g) => g.exercise_id)} disabled={programs[type].length >= 8}
            label="+ 평가 종목 추가" onSelect={(e) => setGoals(type, [...programs[type], { exercise_id: e.id, test_reps: type === "gentle_strength" ? 5 : 1 }])} />
        </section>)}
        <p className="g-muted">RM은 블록 마지막의 평가 목표예요. 매 수업의 반복 수·RIR과 기록 활용 방식은 따로 정해요. 목표를 바꿔도 이미 작성한 수업은 유지돼요.</p>
        {error && <p className="g-error" role="alert">{error}</p>}
        <button className="g-primary g-full" type="submit">{busy ? "저장 중…" : `${block.name} 목표 저장`}</button>
      </fieldset>
    </form>
  </Dialog>;
}
