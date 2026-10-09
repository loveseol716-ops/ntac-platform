import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { checked } from "./pt/api.js";
export default function ProfileDialog({
  targetId,
  isAdmin = false,
  onClose,
  onSaved,
}) {
  const ref = useRef(null),
    lock = useRef(false);
  const [profile, setProfile] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  useEffect(() => {
    ref.current?.showModal();
    let live = true;
    checked(
      supabase
        .from("profiles")
        .select(
          "id,full_name,email,phone,sex,birth_date,training_goal,training_experience,role",
        )
        .eq("id", targetId)
        .single(),
    )
      .then((p) => live && setProfile(p))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [targetId]);
  async function act(fn, msg) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(msg);
      return true;
    } catch (e) {
      setError(e.message || "변경하지 못했어요.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <dialog
      ref={ref}
      className="manage member-dialog profile-dialog"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="section-heading">
        <h2>{isAdmin ? "회원 프로필" : "내 프로필"}</h2>
        <button onClick={close} disabled={busy}>
          닫기
        </button>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success-banner">
          {message}
        </p>
      )}
      {!profile ? (
        <p>프로필을 불러오는 중…</p>
      ) : (
        <>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act(
                  () =>
                    checked(
                      supabase.rpc("ntac_save_profile", {
                        target_id: targetId,
                        payload: profile,
                      }),
                    ),
                  "프로필을 저장했어요.",
                )
              )
                onSaved?.();
            }}
          >
            <fieldset disabled={busy}>
              <label>
                이름
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={profile.full_name || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, full_name: e.target.value })
                  }
                />
              </label>
              <label>
                로그인 이메일
                <input readOnly value={profile.email || ""} />
              </label>
              <label>
                연락처
                <input
                  type="tel"
                  autoComplete="tel"
                  value={profile.phone || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value })
                  }
                />
              </label>
              <div className="profile-two">
                <label>
                  생년월일
                  <input
                    type="date"
                    value={profile.birth_date || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, birth_date: e.target.value })
                    }
                  />
                </label>
                <label>
                  성별
                  <select
                    value={profile.sex || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, sex: e.target.value })
                    }
                  >
                    <option value="">선택 안 함</option>
                    <option value="male">남성</option>
                    <option value="female">여성</option>
                  </select>
                </label>
              </div>
              <label>
                운동 목표
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={profile.training_goal || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, training_goal: e.target.value })
                  }
                />
              </label>
              <label>
                운동 경험
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={profile.training_experience || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      training_experience: e.target.value,
                    })
                  }
                />
              </label>
              <button className="primary full">
                {busy ? "저장 중…" : "프로필 저장"}
              </button>
            </fieldset>
          </form>
          {(!isAdmin || profile.role === "member") && (
            <details className="password-settings">
              <summary>비밀번호 변경</summary>
              <p className="muted">
                {isAdmin
                  ? "회원이 사용할 새 비밀번호를 설정합니다. 기존 비밀번호는 표시되지 않아요."
                  : "새 비밀번호를 12자 이상 입력해 주세요."}
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (password !== confirm) {
                    setError("비밀번호가 일치하지 않습니다.");
                    return;
                  }
                  if (
                    await act(async () => {
                      if (isAdmin) {
                        const { data, error } = await supabase.functions.invoke(
                          "ntac-admin-password",
                          { body: { target_id: targetId, password } },
                        );
                        if (error) {
                          let detail;
                          try {
                            detail = await error.context?.json();
                          } catch {}
                          throw Error(
                            detail?.error ||
                              "비밀번호를 변경하지 못했어요. 관리자 권한과 로그인 상태를 확인해 주세요.",
                          );
                        }
                        if (!data?.success)
                          throw Error(data?.error || "변경하지 못했어요.");
                      } else
                        await checked(supabase.auth.updateUser({ password }));
                    }, "비밀번호를 변경했어요.")
                  ) {
                    setPassword("");
                    setConfirm("");
                  }
                }}
              >
                <fieldset disabled={busy}>
                  <label>
                    새 비밀번호
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                  <label>
                    새 비밀번호 확인
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </label>
                  <button className="primary full">비밀번호 변경하기</button>
                </fieldset>
              </form>
            </details>
          )}
        </>
      )}
    </dialog>
  );
}
