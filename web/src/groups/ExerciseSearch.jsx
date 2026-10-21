import { useRef, useState } from "react";
const aliases = { overhead_press: "OHP strict press 숄더 프레스", bench_press: "BP bench 벤치", back_squat: "BS squat 스쿼트", front_squat: "FS squat 스쿼트", deadlift: "DL dead lift", pull_up: "턱걸이 pullup" };
const normalize = (value) => value.toLowerCase().replace(/[\s_-]+/g, "");

export default function ExerciseSearch({ exercises, onSelect, exclude = [], disabled = false, label = "+ 종목 검색해서 추가" }) {
  const [query, setQuery] = useState(""), details = useRef(null);
  const matches = exercises.filter((e) => !exclude.includes(e.id) && normalize(`${e.name} ${e.id} ${aliases[e.id] || ""}`).includes(normalize(query)));
  if (disabled) return null;
  return <details className="g-exercise-search" ref={details}>
    <summary>{label}</summary>
    <label>운동 이름 검색<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="예: Overhead Press, Squat" /></label>
    <div className="g-exercise-results">
      {matches.slice(0, 12).map((e) => <button type="button" key={e.id} onClick={() => {
        onSelect(e); setQuery(""); details.current.open = false;
      }}>{e.name}<span>추가 +</span></button>)}
      {!matches.length && <p className="g-muted">일치하는 종목이 없어요. 다른 이름으로 검색해 주세요.</p>}
      {matches.length > 12 && <small>이름을 입력하면 더 빠르게 찾을 수 있어요.</small>}
    </div>
  </details>;
}
