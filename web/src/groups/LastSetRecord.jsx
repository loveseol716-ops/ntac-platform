import { useState } from "react";
import { Dialog } from "./shared.jsx";
import { isCoreLift } from "./coreLifts.js";
import { movementLabel } from "./model.js";
export const quickLifts = (c) => (c?.movements || []).filter((m) => isCoreLift(m.exercise_id) && m.training_type === "strength" && m.unit === "kg" && m.load_basis === "total");
export function lastRecordedSet(m, p) {
  const summary=p.last_sets?.[m.id];
  if (summary) return {weight:summary.weight,reps:summary.reps,rir:10-summary.rpe,index:summary.set_index};
  return (p.results?.[m.id]?.sets || []).map((s,i) => ({...s,index:i+1})).filter((s) => s.weight != null && s.reps != null && !s.dnf).at(-1);
}
export function lastSetEntries(movements, rows) {
  return movements.flatMap((m) => {
    const row=rows[m.id];
    if (!row || (row.weight === "" && row.rpe === "")) return [];
    if (row.weight === "" || row.rpe === "" || row.reps === "") throw new Error("입력한 운동의 중량·반복 수·RPE를 모두 확인해 주세요.");
    return [{movement_id:m.id,set_index:Number(row.index),weight:Number(row.weight),reps:Number(row.reps),rpe:Number(row.rpe)}];
  });
}
export default function LastSetRecord({participant:p,c,exercises,busy,error,onSave,onClose}) {
  const movements=quickLifts(c);
  const [rows,setRows]=useState(() => Object.fromEntries(movements.map((m) => {
    const actual=lastRecordedSet(m,p);
    return [m.id,{index:actual?.index || m.sets.length,weight:actual?.weight ?? "",reps:actual?.reps ?? m.sets.at(-1).reps,rpe:actual?.rir == null ? "" : 10-actual.rir}];
  })));
  const [validation,setValidation]=useState("");
  const set=(id,key,value)=>setRows((prev)=>({...prev,[id]:{...prev[id],[key]:value}}));
  return <Dialog title={`${p.name || "나의"} 운동 기록`} onClose={onClose}>
    <form onSubmit={(e)=>{e.preventDefault();try{const entries=lastSetEntries(movements,rows);if(!entries.length)throw new Error("최소 한 운동의 실제 중량과 RPE를 입력해 주세요.");setValidation("");onSave(entries);}catch(e){setValidation(e.message);}}}>
      <fieldset disabled={busy}>
        <p className="g-muted">운동마다 마지막으로 완료한 세트만 남겨 주세요. 입력하지 않은 운동은 저장하지 않아요.</p>
        {movements.map((m)=> <section className="g-record-movement" key={m.id}>
          <h3>{movementLabel(m,exercises)}</h3>
          <div className="g-fields g-last-set-fields">
            <label>실제 중량 (kg · 바벨 포함)<input aria-label={`${m.label} 실제 중량`} inputMode="decimal" type="number" min="0.01" max="2000" step="any" value={rows[m.id].weight} onChange={(e)=>set(m.id,"weight",e.target.value)} placeholder="실제 수행 중량" /></label>
            <label>운동 RPE<input aria-label={`${m.label} 운동 RPE`} inputMode="decimal" type="number" min="1" max="10" step="0.5" value={rows[m.id].rpe} onChange={(e)=>set(m.id,"rpe",e.target.value)} placeholder="1–10" /></label>
          </div>
          <details><summary>반복 수·완료 세트 확인 · {rows[m.id].index}세트 × {rows[m.id].reps}회</summary>
            <div className="g-fields"><label>실제 반복 수<input type="number" min="1" max="30" value={rows[m.id].reps} onChange={(e)=>set(m.id,"reps",e.target.value)} /></label>
              <label>마지막 완료 세트<select value={rows[m.id].index} onChange={(e)=>{set(m.id,"index",e.target.value);set(m.id,"reps",m.sets[Number(e.target.value)-1].reps);}}>{m.sets.map((_,i)=><option key={i} value={i+1}>{i+1}세트</option>)}</select></label></div>
          </details>
        </section>)}
        {(error || validation) && <p className="g-error" role="alert">{error || validation}</p>}
        <button className="g-primary g-full" disabled={!movements.length}>기록 저장</button>
        <p className="g-muted">저장한 최근 중량·반복 수·운동별 RPE를 다음 수업 추천에 반영해요.</p>
      </fieldset>
    </form>
  </Dialog>;
}
