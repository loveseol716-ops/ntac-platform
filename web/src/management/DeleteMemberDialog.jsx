import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function DeleteMemberDialog({ member, onClose, onDeleted }) {
  const ref = useRef(null), lock = useRef(false);
  const [confirmation, setConfirmation] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { if (!lock.current) onClose(); };
  return <dialog ref={ref} className="manage member-dialog" onCancel={(e) => { e.preventDefault(); close(); }}>
    <div className="section-heading"><h2>회원 계정 삭제</h2><button disabled={busy} onClick={close}>닫기</button></div>
    <p><strong>{member.full_name || "이름 미입력 회원"}</strong><br /><span className="account-delete-email">{member.email}</span></p>
    <p>삭제하면 이 계정으로 로그인하거나 NTAC·PT·그룹수업을 이용할 수 없어요. 로그인 계정은 복구할 수 없으며 기존 수업 기록은 센터에 보관돼요.</p>
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (lock.current || confirmation.trim().toLowerCase() !== member.email?.trim().toLowerCase()) return;
      lock.current = true; setBusy(true); setError("");
      try {
        const { data, error } = await supabase.functions.invoke("ntac-admin-delete-member", { body: { target_id: member.id, confirm_email: confirmation.trim() } });
        if (error) {
          let detail; try { detail = await error.context?.json(); } catch {}
          throw Error(detail?.error || "계정 삭제에 실패했어요. 다시 시도해 주세요.");
        }
        if (!data?.success) throw Error(data?.error || "삭제하지 못했어요.");
        onDeleted();
      } catch (error) { setError(error.message); }
      finally { lock.current = false; setBusy(false); }
    }}><fieldset disabled={busy}>
      <label>확인을 위해 위 회원의 이메일을 입력해 주세요<input type="email" required autoComplete="off" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="button-row"><button type="button" onClick={close}>취소</button><button className="account-delete-button" disabled={confirmation.trim().toLowerCase() !== member.email?.trim().toLowerCase()}>{busy ? "삭제 중…" : "계정 삭제"}</button></div>
    </fieldset></form>
  </dialog>;
}
