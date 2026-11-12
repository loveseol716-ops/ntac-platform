import { useState } from "react";
import { quickLifts,lastRecordedSet } from "./LastSetRecord.jsx";
import { movementLabel, prescriptionText } from "./model.js";
export function memberMetadata(person={}) {
  const sex={male:"남",female:"여",M:"남",F:"여",남성:"남",여성:"여"}[person.sex] || (["남","여"].includes(person.sex) ? person.sex : null);
  return [sex,person.age!=null&&person.age>=0 ? `${person.age}세` : null,person.phone_suffix ? `연락처 ····${person.phone_suffix}` : null].filter(Boolean).join(" · ");
}
export default function ClassFloorRoster({c,participants,exercises,directory=[],isAdmin=false,busy,error,onAdd,onJoin,onRecord}) {
  const [query,setQuery]=useState(""),[exception,setException]=useState(false);
  const movements=quickLifts(c);
  const people=participants.filter((p)=>["planned","active","completed"].includes(p.status));
  const canAdd=!c.archived_at&&(isAdmin ? !["draft","cancelled"].includes(c.status) : ["open","live"].includes(c.status));
  const matches=query.trim() ? directory.filter((person)=>(person.active||(isAdmin&&exception))&&person.name?.toLowerCase().includes(query.trim().toLowerCase())&&!people.some((p)=>p.user_id===person.id)).slice(0,8) : [];
  async function add(id){if(await onJoin?.(id,exception))setQuery("");}
  return <section className="g-floor-workspace" aria-label="클래스 추천 중량 및 기록">
    <div className="g-floor-toolbar"><div><strong>멤버 {people.length}명</strong><p>kg · 바벨 포함 총중량</p></div>{!onJoin&&canAdd&&<button className="g-primary" disabled={busy} onClick={onAdd}>+ 이름 검색 · 추가</button>}</div>
    {onJoin&&canAdd&&<div className="g-floor-search">
      <label>이름 검색해서 추가<input autoComplete="off" type="search" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="추가할 멤버 이름" /></label>
      {query.trim()&&<div className="g-floor-search-results" aria-label="추가할 멤버 검색 결과">{matches.map((person)=><button type="button" key={person.id} disabled={busy} onClick={()=>add(person.id)}><span><strong>{person.name}</strong><small>{memberMetadata(person)}</small></span><b>+ 추가</b></button>)}{!matches.length&&<p>검색 결과가 없거나 이미 추가된 멤버예요.</p>}</div>}
      {isAdmin&&<details className="g-floor-exception"><summary>일회 참여 설정</summary><label className="g-check"><input type="checkbox" checked={exception} onChange={(e)=>setException(e.target.checked)} />이용 중지·미등록 회원도 검색하고, 이 수업에 한해 참여 허용</label></details>}
    </div>}
    {error&&<p className="g-error" role="alert">{error}</p>}
    {!movements.length&&<p className="g-muted">등록된 핵심 운동이 없어요. 수업 프로그램에 핵심 운동을 등록하면 추천 중량이 표시돼요.</p>}
    <div className="g-floor-members">{people.map((p)=>{
      const person=directory.find((x)=>x.id===p.user_id)||{};
      return <article className="g-floor-member" key={p.id}>
        <header><span className="g-floor-avatar" aria-hidden="true">{(p.name || person.name || "회원").slice(0,1)}</span><div><h3>{p.name || person.name || "회원"}</h3><p>{memberMetadata(person)}</p></div><span className="g-badge">{p.status==="planned" ? "참여 예정" : p.status==="completed" ? "기록 저장됨" : "참여 중"}</span></header>
        {movements.map((m)=>{
          const weights=(p.recommendations?.[m.id]?.sets || []).map((s)=>s.weight),known=weights.filter((w)=>w!=null);
          const allSame=known.length===weights.length&&new Set(known).size===1;
          const actual=lastRecordedSet(m,p);
          return <div className="g-floor-lift" key={m.id}><div><strong>{movementLabel(m,exercises)}</strong><small>{m.sets.length}세트 · {prescriptionText(m)}</small></div>
            <div className="g-floor-weight" aria-label={known.length ? "추천 중량" : "기준 데이터 없음"}>{allSame ? <b>{known[0]} kg</b> : known.length ? weights.map((w,i)=><span key={i}>{i+1}세트 <b>{w==null ? "" : `${w} kg`}</b></span>) : null}</div>
            {actual&&<p className="g-floor-actual">저장 기록 · {actual.weight}kg × {actual.reps}회{actual.rir==null ? "" : ` · RPE ${10-actual.rir}`}</p>}
          </div>;
        })}
        {p.status==="planned"&&["open","live","ended"].includes(c.status)&&canAdd&&onJoin&&<button className="g-primary g-full" disabled={busy} onClick={()=>add(p.user_id)}>참여 처리</button>}
        {!!movements.length&&(isAdmin ? !["draft","cancelled"].includes(c.status) : p.status!=="planned"&&["live","ended"].includes(c.status))&&<button className="g-full" disabled={busy} onClick={()=>onRecord(p)}>{movements.some((m)=>lastRecordedSet(m,p)) ? "기록 수정" : "기록 입력"}</button>}
      </article>;
    })}</div>
    {!people.length&&<div className="g-empty">이름으로 멤버를 추가해 주세요.<br />멤버가 앱에서 직접 참여해도 여기에 표시돼요.</div>}
    <p className="g-muted">기준 데이터가 없는 추천 칸은 공백이에요. 미래 수업에 미리 추가한 멤버는 참여 예정으로 표시돼요.</p>
  </section>;
}
