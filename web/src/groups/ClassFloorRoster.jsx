import { useState } from "react";
import { quickLifts,lastRecordedSet } from "./LastSetRecord.jsx";
import { movementLabel } from "./model.js";
export default function ClassFloorRoster({c,participants,exercises,busy,onAdd,onRecord}) {
  const [query,setQuery]=useState("");
  const movements=quickLifts(c);
  const people=participants.filter((p)=>["active","completed"].includes(p.status)&&String(p.name || "").toLowerCase().includes(query.toLowerCase()));
  return <section className="g-panel g-floor-roster" aria-label="클래스 추천 중량 및 기록">
    <div className="g-heading"><h3>참여 멤버 · {participants.filter((p)=>["active","completed"].includes(p.status)).length}명</h3>{["open","live"].includes(c.status)&&<button className="g-primary" disabled={busy} onClick={onAdd}>+ 이름 검색 · 추가</button>}</div>
    <label>참여 멤버 검색<input type="search" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="이름 검색" /></label>
    <p className="g-muted">추천 중량은 kg·바벨 포함이에요. 기준 데이터가 없으면 공백으로 표시돼요.</p>
    <div className="g-floor-table-wrap"><table className="g-floor-table"><thead><tr><th scope="col">이름</th>{movements.map((m)=><th scope="col" key={m.id}>{movementLabel(m,exercises)}<small>추천 중량</small></th>)}<th scope="col">운동 후 기록</th></tr></thead>
    <tbody>{people.map((p)=><tr key={p.id}><th scope="row">{p.name || "회원"}</th>{movements.map((m)=>{
      const weights=(p.recommendations?.[m.id]?.sets || []).map((s)=>s.weight);
      const known=weights.filter((w)=>w!=null);
      const allSame=known.length===weights.length&&new Set(known).size===1;
      const actual=lastRecordedSet(m,p);
      return <td key={m.id}><strong aria-label={known.length ? "추천 중량" : "기준 데이터 없음"}>{allSame ? `${known[0]} kg` : known.length ? weights.map((w,i)=><span className="g-floor-set" key={i}>{i+1}세트 {w==null ? "" : `${w} kg`}</span>) : ""}</strong>{actual&&<small>실제 {actual.weight}kg × {actual.reps}회{actual.rir==null ? "" : ` · RPE ${10-actual.rir}`}</small>}</td>;
    })}<td>{["live","ended"].includes(c.status)&&<button disabled={busy} onClick={()=>onRecord(p)}>{movements.some((m)=>lastRecordedSet(m,p)) ? "기록 수정" : "기록 입력"}</button>}</td></tr>)}</tbody></table></div>
    {!people.length&&<p className="g-empty">멤버가 앱에서 수업 참여를 누르거나, 이름 검색으로 추가하면 여기에 표시돼요.</p>}
  </section>;
}
