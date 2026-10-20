import { useEffect, useState } from "react";
import { checked } from "./api.js";
import { supabase } from "../lib/supabase.js";
import { Dialog } from "./shared.jsx";
import { seoulDate } from "./model.js";
export default function StrengthMax({
  member,
  exercises,
  busy,
  error,
  onSave,
  onClose,
}) {
  const [rows, setRows] = useState([]),
    [readError, setReadError] = useState("");
  useEffect(() => {
    checked(
      supabase
        .from("group_strength_maxes")
        .select("*")
        .eq("user_id", member.id),
    )
      .then(setRows)
      .catch((e) => setReadError(e.message));
  }, [member.id]);
  return (
    <Dialog title={`${member.name}님의 스트렝스 1RM`} onClose={onClose}>
      <p className="g-muted">
        코치가 확인한 1RM 또는 추정 1RM을 등록하세요. 같은 종목·단위·총중량/한
        손 기준에서만 사용하며, 180일이 지나면 갱신이 필요해요.
      </p>
      {rows.map((r) => (
        <p key={`${r.exercise_id}/${r.unit}/${r.load_basis}`}>
          {exercises.find((x) => x.id === r.exercise_id)?.name} · {r.weight}{" "}
          {r.unit} · {r.load_basis === "each" ? "한 손" : "총중량"} ·{" "}
          {r.measured_on} ({r.basis === "measured" ? "측정" : "추정"})
        </p>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...Object.fromEntries(new FormData(e.currentTarget)),
            user_id: member.id,
          });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            종목
            <select required name="exercise_id">
              {exercises.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <div className="g-fields">
            <label>
              1RM 중량
              <input
                type="number"
                required
                min={0.25}
                max={2000}
                step="any"
                name="weight"
              />
            </label>
            <label>
              단위
              <select name="unit">
                <option>kg</option>
                <option>lb</option>
              </select>
            </label>
            <label>
              중량 기준
              <select name="load_basis">
                <option value="total">바 포함 총중량</option>
                <option value="each">덤벨 한 손 기준</option>
              </select>
            </label>
          </div>
          <div className="g-fields">
            <label>
              기준 종류
              <select name="basis">
                <option value="measured">측정한 1RM</option>
                <option value="estimated">코치가 확인한 추정 1RM</option>
              </select>
            </label>
            <label>
              측정·확인일
              <input
                type="date"
                required
                name="measured_on"
                max={seoulDate()}
                defaultValue={seoulDate()}
              />
            </label>
          </div>
          <label>
            확인 근거
            <input
              name="reason"
              required
              maxLength={300}
              placeholder="예: 이전 훈련 기록을 코치가 검토"
            />
          </label>
          {(error || readError) && (
            <p className="g-error" role="alert">
              {error || readError}
            </p>
          )}
          <button className="g-primary g-full">1RM 저장</button>
        </fieldset>
      </form>
    </Dialog>
  );
}
