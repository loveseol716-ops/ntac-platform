import { useState } from "react";
import { quickLifts,lastRecordedSet } from "./LastSetRecord.jsx";
import { movementLabel } from "./model.js";
export function memberMetadata(person={}) {
  const sex={male:"남",female:"여",M:"남",F:"여",남성:"남",여성:"여"}[person.sex] || (["남","여"].includes(person.sex) ? person.sex : null);
  return [sex,person.age!=null&&person.age>=0 ? `${person.age}세` : null,person.phone_suffix ? `연락처 ····${person.phone_suffix}` : null].filter(Boolean).join(" · ");
}
export default function ClassFloorRoster({c,participants,exercises,directory=[],isAdmin=false,busy,error,onAdd,onJoin,onRecord}) {
  const [query,setQuery]=useState(""),[exception,setException]=useState(false),[adding,setAdding]=useState(!participants.some((p)=>["planned","active","completed"].includes(p.status))),[exerciseId,setExerciseId]=useState(""),[setNumber,setSetNumber]=useState(0),[page,setPage]=useState(0);
  const movements=quickLifts(c);
  const people=participants.filter((p)=>["planned","active","completed"].includes(p.status));
  const canAdd=!c.archived_at&&(isAdmin ? !["draft","cancelled"].includes(c.status) : ["open","live"].includes(c.status));
  const matches=query.trim() ? directory.filter((person)=>(person.active||(isAdmin&&exception))&&person.name?.toLowerCase().includes(query.trim().toLowerCase())&&!people.some((p)=>p.user_id===person.id)).slice(0,8) : [];
  const movement=movements.find((m)=>m.id===exerciseId)||movements[0];
  const varied=movement && (movement.sets.some((s)=>s.reps!==movement.sets[0].reps||s.rir!==movement.sets[0].rir)||people.some((p)=>new Set((p.recommendations?.[movement.id]?.sets||[]).map((s)=>s.weight).filter((w)=>w!=null)).size>1));
  const setIndex=varied ? Math.min(setNumber,movement.sets.length-1) : 0;
  const pages=Math.max(1,Math.ceil(people.length/6)),currentPage=Math.min(page,pages-1),visible=people.slice(currentPage*6,currentPage*6+6);
  async function add(id){if(await onJoin?.(id,exception)){setQuery("");if(!people.some((p)=>p.user_id===id)){setPage(Math.floor(people.length/6));if(people.length>=5)setAdding(false);}}}
  return <section className="g-floor-workspace" aria-label="클래스 추천 중량 및 기록">
    <div className="g-floor-toolbar">
      <div className="g-floor-plan">{movement ? <>
        {movements.length>1 ? <label className="g-floor-select"><span className="g-sr-only">추천 운동 선택</span><select value={movement.id} onChange={(e)=>{setExerciseId(e.target.value);setSetNumber(0);}}>{movements.map((m)=><option key={m.id} value={m.id}>{movementLabel(m,exercises)}</option>)}</select></label> : <strong>{movementLabel(movement,exercises)}</strong>}
        {varied ? <label className="g-floor-select"><span className="g-sr-only">추천 세트 선택</span><select value={setIndex} onChange={(e)=>setSetNumber(Number(e.target.value))}>{movement.sets.map((s,i)=><option value={i} key={i}>{i+1}세트 · {s.reps}회 · RPE {10-s.rir}</option>)}</select></label> : <small>{movement.sets.length}세트 × {movement.sets[0].reps}회 · RPE {10-movement.sets[0].rir}</small>}
      </> : <strong>핵심 운동 없음</strong>}</div>
      <div className="g-floor-tools"><span>{people.length}명</span>{canAdd&&(onJoin ? <button className={adding ? "" : "g-primary"} disabled={busy} onClick={()=>{setAdding(!adding);setQuery("");}}>{adding ? "추가 완료" : "+ 멤버 추가"}</button> : <button className="g-primary" disabled={busy} onClick={onAdd}>+ 멤버 추가</button>)}</div>
    </div>
    {onJoin&&canAdd&&adding&&<div className="g-floor-search">
      <label><span className="g-sr-only">이름 검색해서 추가</span><input autoFocus autoComplete="off" type="search" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="추가할 멤버 이름" /></label>
      {query.trim()&&<div className="g-floor-search-results" aria-label="추가할 멤버 검색 결과">{matches.map((person)=><button type="button" key={person.id} disabled={busy} onClick={()=>add(person.id)}><span><strong>{person.name}</strong><small>{memberMetadata(person)}</small></span><b>+ 추가</b></button>)}{!matches.length&&<p>검색 결과가 없거나 이미 추가된 멤버예요.</p>}</div>}
      {isAdmin&&<details className="g-floor-exception"><summary>일회 참여 설정</summary><label className="g-check"><input type="checkbox" checked={exception} onChange={(e)=>setException(e.target.checked)} />이용 중지·미등록 회원도 이 수업에 한해 참여 허용</label></details>}
    </div>}
    {error&&<p className="g-error" role="alert">{error}</p>}
    {!movement&&<p className="g-muted">수업 프로그램에 핵심 운동을 등록해 주세요.</p>}
    <div className="g-floor-members" data-page-size="6">{visible.map((p)=>{
      const person=directory.find((x)=>x.id===p.user_id)||{},rec=movement ? p.recommendations?.[movement.id] : null;
      const weight=rec?.sets?.[setIndex]?.weight ?? (setIndex===0 ? rec?.weight : null) ?? null;
      const actual=movement ? lastRecordedSet(movement,p) : null;
      return <article className="g-floor-member" key={p.id}>
        <header><div><h3 title={p.name || person.name}>{p.name || person.name || "회원"}</h3><p title={memberMetadata(person)}>{memberMetadata(person)}</p></div><span className="g-badge">{p.status==="planned" ? "예정" : p.status==="completed" ? "저장됨" : "참여 중"}</span></header>
        <div className={`g-floor-weight${weight!=null&&String(weight).length>4 ? " is-long" : ""}`} aria-label={weight==null ? "기준 데이터 없음" : `추천 중량 ${weight} kg`}>{weight!=null&&<><b>{weight}</b><span>kg</span></>}</div>
        <p className="g-floor-actual">{actual ? `기록 ${actual.weight}kg × ${actual.reps}회${actual.rir==null ? "" : ` · RPE ${10-actual.rir}`}` : ""}</p>
        <div className="g-floor-card-actions">
          {p.status==="planned"&&["open","live","ended"].includes(c.status)&&canAdd&&onJoin&&<button disabled={busy} onClick={()=>add(p.user_id)}>참여 처리</button>}
          {!!movements.length&&(isAdmin ? !["draft","cancelled"].includes(c.status) : p.status!=="planned"&&["live","ended"].includes(c.status))&&<button disabled={busy} onClick={()=>onRecord(p)}>{movements.some((m)=>lastRecordedSet(m,p)) ? "기록 수정" : "기록 입력"}</button>}
        </div>
      </article>;
    })}</div>
    {pages>1&&<nav className="g-floor-pages" aria-label="멤버 페이지"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>이전</button><span>{currentPage+1} / {pages}</span><button disabled={currentPage===pages-1} onClick={()=>setPage(currentPage+1)}>다음</button></nav>}
    {!people.length&&<div className="g-empty">이름으로 멤버를 추가하거나, 멤버 앱에서 수업에 참여해 주세요.</div>}
    <p className="g-floor-footnote">kg · 바벨 포함 · 기준 데이터가 없으면 공백</p>
  </section>;
}
