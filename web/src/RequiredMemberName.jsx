import { useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { needsMemberName, normalizeMemberName } from "./management/memberIdentity.js";

export default function RequiredMemberName({ onSaved, onLogout }) {
  const [name, setName] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  return <main className="manage auth-page"><section className="auth-card">
    <h1>이름을 알려주세요</h1>
    <p>회원 확인을 위해 실제 이름을 입력해 주세요. 이름을 저장하면 앱을 이용할 수 있어요.</p>
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (lock.current) return;
      const fullName = normalizeMemberName(name);
      if (needsMemberName(fullName)) { setError("실제 이름을 2~80자로 입력해 주세요."); return; }
      lock.current = true; setBusy(true); setError("");
      try {
        const { error } = await supabase.rpc("ntac_set_my_name", { full_name: fullName });
        if (error) throw error;
        onSaved();
      } catch (error) { setError(error.message || "이름을 저장하지 못했어요. 다시 시도해 주세요."); }
      finally { lock.current = false; setBusy(false); }
    }}><fieldset disabled={busy}>
      <label>이름<input autoFocus autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="실제 이름" /></label>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <button className="primary full">{busy ? "저장 중…" : "이름 저장하고 계속"}</button>
      <button type="button" className="text-action" onClick={onLogout}>로그아웃</button>
    </fieldset></form>
  </section></main>;
}
