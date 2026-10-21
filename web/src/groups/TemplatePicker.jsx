import { useState } from "react";

export default function TemplatePicker({ templates, loading = false, error = "", hasContent, onApply }) {
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const template = templates.find((t) => t.id === selected);
  return (
    <div className="g-template-picker">
      <label>
        저장한 템플릿 불러오기
        <select value={selected} disabled={loading || !!error || !templates.length}
          onChange={(e) => { setSelected(e.target.value); setMessage(""); }}>
          <option value="">{loading ? "불러오는 중…" : error ? "목록을 불러오지 못했어요" : templates.length ? `템플릿 선택 (${templates.length}개)` : "저장한 템플릿 없음"}</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </label>
      <button type="button" disabled={!template || loading || !!error} onClick={() => {
        if (hasContent && !confirm("현재 선택한 수업의 운동 내용을 템플릿으로 바꿀까요? 다른 수업은 유지돼요.")) return;
        onApply({ ...structuredClone(template), movements: template.movements.map((m) => ({ ...structuredClone(m), id: crypto.randomUUID() })) });
        setMessage(`‘${template.title}’ 내용을 불러왔어요. 확인 후 프로그램을 저장해 주세요.`);
      }}>불러오기</button>
      <p className="g-muted">{templates.length ? "선택한 수업의 프로그램과 핵심 운동에 적용돼요." : "수업 운영 → 수업 선택 → ‘템플릿 저장’으로 추가할 수 있어요. 주간 임시 저장과는 별개예요."}</p>
      {message && <p className="g-success" role="status">{message}</p>}
    </div>
  );
}
