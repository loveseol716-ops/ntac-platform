import { useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked } from "./api.js";
import { today } from "./model.js";
import { passUsage, orderedPasses } from "./passes.js";
import { koreaDate, koreaTime } from "./dates.js";
const eventLabels = {
  purchase: "횟수권 등록",
  terms_changed: "횟수권 정보 수정",
  completed: "운동 완료 · 1회 사용",
  restored: "완료 취소 · 1회 복구",
  cancelled: "예약 취소 · 차감 없음",
  reserved: "수업 예약 · 차감 없음",
  rescheduled: "예약 변경 · 차감 없음",
};
export default function PassLedger({
  packages,
  sessions,
  memberId,
  editable = false,
  onSaved,
}) {
  const [draft, setDraft] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [events, setEvents] = useState({}),
    [eventErrors, setEventErrors] = useState({});
  const lock = useRef(false),
    all = orderedPasses(packages);
  function edit(p) {
    setError("");
    const end = new Date(`${today()}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 29);
    setDraft(
      p
        ? { ...p, editing: true, reason: "" }
        : {
            id: crypto.randomUUID(),
            member_id: memberId,
            title: "PT 10회",
            total_sessions: 10,
            purchased_on: today(),
            starts_on: today(),
            expires_on: end.toISOString().slice(0, 10),
            editing: false,
          },
    );
  }
  async function save(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await checked(supabase.rpc("pt_save_package", { payload: draft }));
      setDraft(null);
      setEvents({});
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function loadEvents(id) {
    try {
      const rows = await checked(
        supabase
          .from("pt_pass_events")
          .select("*")
          .eq("package_id", id)
          .order("id", { ascending: false }),
      );
      setEvents((v) => ({ ...v, [id]: rows }));
      setEventErrors((v) => ({ ...v, [id]: "" }));
    } catch (e) {
      setEventErrors((v) => ({ ...v, [id]: e.message }));
    }
  }
  return (
    <section className="pass-ledger" aria-label="횟수권과 사용 내역">
      <div className="pt-row pt-between">
        <div>
          <h2>횟수권과 사용 내역</h2>
          <p className="pt-muted">
            구매부터 마지막 수업까지, 횟수권별로 확인하세요.
          </p>
        </div>
        {editable && (
          <button className="pt-primary" onClick={() => edit()} disabled={busy}>
            횟수권 등록
          </button>
        )}
      </div>
      {error && (
        <p className="pt-error" role="alert">
          {error}
        </p>
      )}
      {draft && (
        <form className="pt-card pass-editor" onSubmit={save}>
          <h3>{draft.editing ? "횟수권 수정" : "새 횟수권 등록"}</h3>
          <fieldset disabled={busy}>
            <label>
              횟수권 이름
              <input
                required
                maxLength={80}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <div className="pt-two">
              <label>
                구매 횟수
                <input
                  required
                  type="number"
                  min="1"
                  max="1000"
                  value={draft.total_sessions}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      total_sessions: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                구매일
                <input
                  required
                  type="date"
                  value={draft.purchased_on || draft.starts_on}
                  onChange={(e) =>
                    setDraft({ ...draft, purchased_on: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="pt-two">
              <label>
                사용 시작일
                <input
                  required
                  type="date"
                  value={draft.starts_on}
                  onChange={(e) =>
                    setDraft({ ...draft, starts_on: e.target.value })
                  }
                />
              </label>
              <label>
                사용 종료일
                <input
                  type="date"
                  required={!!draft.expires_on}
                  disabled={!draft.expires_on}
                  min={draft.starts_on}
                  value={draft.expires_on || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, expires_on: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="toggle-line">
              <input
                type="checkbox"
                checked={!draft.expires_on}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    expires_on: e.target.checked ? "" : draft.starts_on,
                  })
                }
              />
              기간 제한 없음
            </label>
            <p className="pt-muted">
              종료일 당일까지 사용할 수 있어요. 재구매는 기존 횟수를 수정하지
              않고 새 횟수권으로 등록하세요.
            </p>
            {draft.editing && (
              <label>
                변경 사유
                <input
                  required
                  minLength={2}
                  maxLength={300}
                  value={draft.reason}
                  onChange={(e) =>
                    setDraft({ ...draft, reason: e.target.value })
                  }
                />
              </label>
            )}
            <div className="pt-row">
              <button className="pt-primary">
                {busy ? "저장 중…" : "횟수권 저장"}
              </button>
              <button type="button" onClick={() => setDraft(null)}>
                닫기
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {!all.length && <p className="pt-muted">등록된 횟수권이 없어요.</p>}
      {[...all].reverse().map((p) => {
        const u = passUsage(p, sessions),
          number = all.findIndex((x) => x.id === p.id) + 1;
        return (
          <article className="pt-card pass-card" key={p.id}>
            <div className="pt-row pt-between">
              <span className="pass-number">
                {number}번째 구매 ·{" "}
                {p.purchased_on || p.created_at.slice(0, 10)}
              </span>
              <span
                className={`pt-badge ${u.state === "사용 중" ? "badge-done" : ""}`}
              >
                {u.state}
              </span>
            </div>
            <h3>{p.title}</h3>
            <div className="pass-balance">
              <strong>
                {u.remaining}
                <small>회</small>
              </strong>
              <span>
                {u.state === "기간 만료" ? "만료된 잔여 횟수" : "남은 횟수"}
              </span>
            </div>
            <progress
              value={u.used}
              max={p.total_sessions}
              aria-label={`${number}번째 횟수권 사용 ${u.used}/${p.total_sessions}회`}
            />
            <div className="pass-counts">
              <span>
                구매 <b>{p.total_sessions}회</b>
              </span>
              <span>
                사용 <b>{u.used}회</b>
              </span>
              <span>
                예약 <b>{u.reserved}회</b>
              </span>
            </div>
            <p className="pass-period">
              {p.starts_on} ~ {p.expires_on || "기간 제한 없음"}
            </p>
            {u.state === "사용 중" && (
              <p className="pt-muted">
                예약 {u.reserved}회를 제외하고 {u.available}회 추가 예약 가능
              </p>
            )}
            <details className="pass-history">
              <summary>수업별 사용 내역 · {u.rows.length}건</summary>
              {!u.rows.length && (
                <p className="pt-muted">아직 사용 내역이 없어요.</p>
              )}
              {[...u.rows]
                .sort((a, b) =>
                  (a.session_date + a.start_time).localeCompare(
                    b.session_date + b.start_time,
                  ),
                )
                .map((s) => (
                  <div className="ledger-row" key={s.id}>
                    <span>
                      <strong>{s.session_date}</strong>
                      <small>{s.start_time.slice(0, 5)}</small>
                    </span>
                    <span
                      className={s.status === "completed" ? "ledger-debit" : ""}
                    >
                      {s.status === "completed"
                        ? "−1회 · 운동 완료"
                        : s.status === "cancelled"
                          ? "0회 · 예약 취소"
                          : "0회 · 예약 중"}
                    </span>
                  </div>
                ))}
            </details>
            <details
              className="pass-history"
              onToggle={(e) => {
                if (e.currentTarget.open) loadEvents(p.id);
              }}
            >
              <summary>변경 이력</summary>
              {eventErrors[p.id] && <p role="alert">{eventErrors[p.id]}</p>}
              {!events[p.id] && !eventErrors[p.id] && (
                <p className="pt-muted">불러오는 중…</p>
              )}
              {events[p.id]?.length === 0 && (
                <p className="pt-muted">
                  변경 이력 도입 전 기록은 위 수업별 내역에서 확인할 수 있어요.
                </p>
              )}
              {events[p.id]?.map((e) => (
                <div className="ledger-row" key={e.id}>
                  <span>
                    <strong>{eventLabels[e.kind] || e.kind}</strong>
                    <small>
                      {koreaDate(e.created_at)} {koreaTime(e.created_at)}
                    </small>
                    {e.details?.reason && (
                      <small>사유 · {e.details.reason}</small>
                    )}
                    {e.kind === "terms_changed" && (
                      <small>
                        {e.details.before.total_sessions}회 →{" "}
                        {e.details.after.total_sessions}회 · 종료일{" "}
                        {e.details.before.expires_on || "무기한"} →{" "}
                        {e.details.after.expires_on || "무기한"}
                      </small>
                    )}
                  </span>
                  <b>{e.delta < 0 ? "−1회" : e.delta > 0 ? "+1회" : ""}</b>
                </div>
              ))}
            </details>
            {editable && (
              <button className="pass-edit" onClick={() => edit(p)}>
                기간·횟수 수정
              </button>
            )}
          </article>
        );
      })}
    </section>
  );
}
