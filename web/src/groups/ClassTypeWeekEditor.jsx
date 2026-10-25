import { useState } from "react";
import { Dialog } from "./shared.jsx";
import { programVisibleFrom } from "./model.js";
import ProgramFields from "./ProgramFields.jsx";
import AuthoringContext from "./AuthoringContext.jsx";
import TemplatePicker from "./TemplatePicker.jsx";
import { cleanProgram, goalsForDate } from "./blockGoals.js";
import {
  CLASS_TYPES,
  blankPrograms,
  programReady,
  typeDays,
} from "./classTypes.js";
export default function ClassTypeWeekEditor({
  current,
  blockGoals = [],
  exercises,
  templates,
  templatesLoading,
  templatesError,
  busy,
  error,
  onUnpublish,
  onDelete,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    ...current,
    programs: blankPrograms().map(
      (p) =>
        current.programs?.find((x) => x.class_type_id === p.class_type_id) || p,
    ),
  });
  const [selected, setSelected] = useState(CLASS_TYPES[0].id),
    [validation, setValidation] = useState("");
  const p = form.programs.find((x) => x.class_type_id === selected),
    type = CLASS_TYPES.find((x) => x.id === selected),
    ready = form.programs.filter(programReady).length;
  const goals = goalsForDate(blockGoals, form.week_start, selected);
  function setProgram(value) {
    setForm((f) => ({
      ...f,
      programs: f.programs.map((x) =>
        x.class_type_id === selected ? value : x,
      ),
    }));
  }
  return (
    <Dialog title="한 주의 수업 프로그램" onClose={onClose}>
      <form
        className="g-week-editor"
        onSubmit={(e) => {
          e.preventDefault();
          const status = e.nativeEvent.submitter?.value || form.status;
          if (status === "published" && !ready) {
            setValidation("최소 한 수업의 프로그램을 작성해 주세요.");
            return;
          }
          setValidation("");
          onSave({ ...form, programs: form.programs.map(cleanProgram), program_mode: "class_type", status });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            주간 프로그램 이름
            <input
              required
              maxLength={120}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <div className="g-heading">
            <p>{form.week_start} 시작 주</p>
            <span className="g-badge">{ready}/7 수업 작성</span>
          </div>
          <p className="g-muted">
            각 수업을 한 번씩 작성하면 같은 주의 해당 요일·시간에 함께 적용돼요.
            작성한 수업부터 공개할 수 있어요.
          </p>
          <div className="g-type-picker" aria-label="작성할 수업 선택">
            {CLASS_TYPES.map((t) => (
              <button
                type="button"
                aria-pressed={selected === t.id}
                className={selected === t.id ? "selected" : ""}
                key={t.id}
                onClick={() => setSelected(t.id)}
              >
                <strong>{t.name}</strong>
                <small>
                  {typeDays(t.id)} ·{" "}
                  {programReady(
                    form.programs.find((p) => p.class_type_id === t.id),
                  )
                    ? "작성됨"
                    : "작성 전"}
                </small>
              </button>
            ))}
          </div>
          <section className="g-type-edit">
            <p className="g-kicker">{typeDays(selected)}요일 자동 배치</p>
            <h3>{type.name}</h3>
            {programReady(p) && <button type="button" className="g-danger" onClick={() => {
              if (confirm(`${type.name} 내용을 비울까요? 저장하면 반영돼요.`)) {
                setProgram({ ...p, description: "", movements: [], _blockDefaultsHandled: true });
                setValidation("");
              }
            }}>이 수업 내용 비우기</button>}
            <AuthoringContext date={form.week_start} week classType={selected} goals={goals} exercises={exercises} />
            <TemplatePicker key={selected} templates={templates} loading={templatesLoading} error={templatesError} hasContent={programReady(p)}
              onApply={(t) => setProgram({ ...p, description: t.description, movements: t.movements, _blockDefaultsHandled: true })} />
            <ProgramFields form={p} onChange={setProgram} goals={goals} exercises={exercises} hideTitle />
          </section>
          {(error || validation) && (
            <p className="g-error" role="alert">
              {error || validation}
            </p>
          )}
          <p className="g-muted">
            내용을 비워둔 수업은 공개되지 않아요. 이미 참가 등록되거나 시작한
            수업은 기존 프로그램을 유지해요.
          </p>
          <div className="g-actions">
            {onUnpublish && <button type="button" onClick={onUnpublish}>공개 취소</button>}
            {onDelete && <button type="button" className="g-danger" onClick={onDelete}>주간 프로그램 삭제</button>}
            {form.status !== "published" && (
              <button value="draft">임시 저장</button>
            )}
            <button className="g-primary" value="published">
              {form.week_start < programVisibleFrom()
                ? "관리자 보관본 저장"
                : "저장 · 멤버 공개 · 캘린더 반영"}
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
