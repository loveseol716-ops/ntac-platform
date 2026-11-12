import { useEffect, useRef, useState } from "react";
import { rpc } from "./api.js";
import { CORE_LIFTS } from "./coreLifts.js";
import { classTime, seoulDate, participantLabels, resultText } from "./model.js";

export function TrainingHistoryRows({ records }) {
  return <div className="g-training-history-list">{records.map((record) => {
    const c=record.group_classes;
    return <article className="g-panel g-training-history-card" key={record.id}>
      <div className="g-heading"><div><small>{seoulDate(c.starts_at)} · {classTime(c.starts_at)}</small><h3>{c.title}</h3></div><span className="g-badge">{participantLabels[record.status] || record.status}</span></div>
      {c.movements.map((m)=>{
        const summary=record.last_sets?.[m.id];
        const sets=record.results?.[m.id]?.sets?.map((s,i)=>({...s,index:i+1})).filter((s)=>s.weight!=null&&s.reps!=null&&!s.dnf) || [];
        return <div className="g-history-lift" key={m.id}><strong>{m.label || m.exercise_id}</strong>
          {summary ? <p>마지막 완료 {summary.set_index}세트 · <b>{summary.weight} kg × {summary.reps}회</b> · 운동 RPE {summary.rpe}</p>
          : sets.length ? sets.map((s)=><p key={s.index}>{s.index}세트 · <b>{s.weight} {m.unit} × {s.reps}회</b>{s.rir==null ? "" : ` · 운동 RPE ${10-s.rir}`}</p>)
          : <p>{m.training_type === "strength" ? "저장한 세트 기록이 없어요." : resultText(m,record.results?.[m.id])}</p>}
        </div>;
      })}
      {!c.movements.length && <p className="g-muted">참여한 수업이에요. 저장한 운동 기록은 아직 없어요.</p>}
      {record.session_rpe!=null&&<p>수업 전체 RPE <b>{record.session_rpe}/10</b></p>}
      {record.note&&<details><summary>메모 보기</summary><p className="g-program-text">{record.note}</p></details>}
    </article>;
  })}</div>;
}

export default function MemberTrainingHistory({ member }) {
  const [filter,setFilter]=useState(""),[page,setPage]=useState({records:[],total:0,completed:0,has_more:false}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[version,setVersion]=useState(0);
  const generation=useRef(0),lock=useRef(false);
  useEffect(()=>{
    const current=++generation.current;
    lock.current=false;setLoading(true);setError("");setPage({records:[],total:0,completed:0,has_more:false});
    rpc("group_training_history",{target_user_id:member?.id || null,exercise_id_filter:filter || null,history_offset:0})
      .then((data)=>{if(current===generation.current)setPage(data);})
      .catch((e)=>{if(current===generation.current)setError(e.message);})
      .finally(()=>{if(current===generation.current)setLoading(false);});
    return ()=>{generation.current++;};
  },[member?.id,filter,version]);
  async function loadMore(){
    if(lock.current)return;lock.current=true;const current=generation.current;setLoading(true);setError("");
    try{const data=await rpc("group_training_history",{target_user_id:member?.id || null,exercise_id_filter:filter || null,history_offset:page.records.length});if(current===generation.current)setPage((old)=>({...data,records:[...old.records,...data.records.filter((r)=>!old.records.some((x)=>x.id===r.id))]}));}
    catch(e){if(current===generation.current)setError(e.message);}
    finally{if(current===generation.current){setLoading(false);lock.current=false;}}
  }
  return <section aria-label={member ? `${member.name} 운동 기록` : "나의 운동 기록 DB"}>
    <div className="g-heading"><h2>{member ? `${member.name || "회원"}님의 운동 기록` : "나의 운동 기록"}</h2><button onClick={()=>setVersion((v)=>v+1)} disabled={loading}>새로고침</button></div>
    <p className="g-muted">참여한 수업과 저장한 중량·반복 수·RPE를 모아 볼 수 있어요.</p>
    <label>운동 종목<select value={filter} onChange={(e)=>setFilter(e.target.value)}><option value="">전체 수업</option>{CORE_LIFTS.map((e)=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
    <div className="g-summary"><span><b>{page.total}</b> 참여 기록</span><span><b>{page.completed}</b> 완료한 수업</span></div>
    {error&&<p role="alert" className="g-error">{error}<button onClick={()=>setVersion((v)=>v+1)}>다시 불러오기</button></p>}
    <TrainingHistoryRows records={page.records} />
    {loading&&<p role="status" className="g-muted">기록을 불러오고 있어요.</p>}
    {!loading&&!error&&!page.records.length&&<p className="g-empty">{filter ? "이 종목으로 저장한 기록이 없어요." : "참여한 수업과 운동 기록이 여기에 쌓여요."}</p>}
    {page.has_more&&<button className="g-full" disabled={loading} onClick={loadMore}>이전 기록 더 보기</button>}
  </section>;
}
