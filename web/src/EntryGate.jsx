import { lazy, Suspense, useEffect, useState } from "react";
import ProfileDialog from "./ProfileDialog.jsx";
import NTACLogo from "./NTACLogo.jsx";
import AuthGate from "./AuthGate.jsx";
import PTMember from "./pt/PTMember.jsx";
import { supabase } from "./lib/supabase.js";
import { loadWeeklyProgramsFromSupabase } from "./data/weeklyPrograms.js";
import "./management/Management.css";
const App = lazy(() => import("./App.jsx"));
const Management = lazy(() => import("./CoachAdminPage.jsx"));
function availableViews(profile, ptMember) {
  const views = [];
  if (["owner", "admin", "coach"].includes(profile?.role))
    return ["management"];
  if (profile?.ntac_enabled) views.push("ntac");
  if (ptMember?.active) views.push("pt");
  return views;
}
export default function EntryGate() {
  const [session, setSession] = useState(undefined),
    [profile, setProfile] = useState(null),
    [ptMember, setPTMember] = useState(null);
  const [view, setView] = useState("welcome"),
    [mode, setMode] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [recovery, setRecovery] = useState(
      window.location.hash.includes("type=recovery"),
    );
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (live) {
        setSession(data.session);
        if (error) setError(error.message);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let live = true;
    if (!session?.user?.id) {
      setProfile(null);
      setPTMember(null);
      setMode("");
      return;
    }
    setLoading(true);
    setError("");
    (async () => {
      const { data: p, error: e } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (e) throw e;
      const { data: m, error: me } = await supabase
        .from("pt_members")
        .select("*")
        .eq("profile_id", session.user.id)
        .maybeSingle();
      if (me) throw me;
      if (p.ntac_enabled || ["owner", "admin"].includes(p.role))
        await loadWeeklyProgramsFromSupabase();
      if (live) {
        setProfile(p);
        setPTMember(m);
        const views = availableViews(p, m);
        setMode((current) =>
          views.includes(current) ? current : views[0] || "",
        );
      }
    })()
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [session?.user?.id, refresh]);
  async function logout() {
    const { error: e } = await supabase.auth.signOut({ scope: "local" });
    if (e) setError(e.message);
    else {
      setView("welcome");
      setRecovery(false);
    }
  }
  async function signup(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error: e } = await supabase.auth.signUp({
        email: f.get("email").trim(),
        password: f.get("password"),
        options: {
          emailRedirectTo: new URL(
            import.meta.env.BASE_URL,
            window.location.origin,
          ).toString(),
          data: {
            full_name: f.get("name").trim(),
            phone: f.get("phone"),
            signup_source: "member",
            privacy_consent: true,
          },
        },
      });
      if (e) throw e;
      if (!data.session)
        setNotice(
          "가입 확인 이메일을 보냈어요. 이메일 인증 후 로그인해 주세요.",
        );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (recovery) return <AuthGate />;
  if (session === undefined || loading)
    return (
      <div className="manage center-state">
        <span className="brand-word">
          <NTACLogo />
        </span>
        <p role="status">회원 정보를 불러오고 있어요.</p>
      </div>
    );
  if (session) {
    if (error || !profile)
      return (
        <div className="manage center-state">
          <h1>정보를 불러오지 못했어요</h1>
          <p role="alert">{error}</p>
          <button onClick={() => setRefresh((v) => v + 1)}>다시 시도</button>
          <button onClick={logout}>로그아웃</button>
        </div>
      );
    const views = availableViews(profile, ptMember),
      labels = {
        management: ["owner", "admin"].includes(profile.role)
          ? "관리"
          : "담당 회원",
        ntac: "NTAC",
        pt: "나의 PT",
      };
    return (
      <div
        className={`member-shell ${mode === "management" ? "wide-shell" : ""}`}
      >
        <header className="account-header">
          <a className="brand-word" href={import.meta.env.BASE_URL}>
            <NTACLogo />
          </a>
          <div className="account-actions">
            <button onClick={() => setProfileOpen(true)} aria-label="내 프로필">
              {profile.full_name || "회원"} <span aria-hidden="true">›</span>
            </button>
            <button onClick={logout}>로그아웃</button>
          </div>
        </header>
        {profileOpen && (
          <ProfileDialog
            targetId={profile.id}
            onClose={() => setProfileOpen(false)}
            onSaved={() => {
              supabase
                .from("profiles")
                .select("*")
                .eq("id", profile.id)
                .single()
                .then(({ data }) => {
                  if (data) setProfile(data);
                });
            }}
          />
        )}
        {views.length > 1 && (
          <nav className="service-switch" aria-label="이용 프로그램">
            {views.map((v) => (
              <button
                key={v}
                className={mode === v ? "selected" : ""}
                aria-pressed={mode === v}
                onClick={() => {
                  setMode(v);
                  window.scrollTo(0, 0);
                }}
              >
                {labels[v]}
              </button>
            ))}
          </nav>
        )}
        {!views.length ? (
          <section className="manage empty-state">
            <h1>가입이 완료됐어요</h1>
            <p>
              관리자가 이용 프로그램과 담당 코치를 지정하면 시작할 수 있어요.
            </p>
            <button onClick={() => setRefresh((v) => v + 1)}>
              등록 상태 확인
            </button>
          </section>
        ) : (
          <Suspense
            fallback={<p className="center-state">화면을 불러오는 중...</p>}
          >
            {mode === "management" && <Management profile={profile} />}
            {mode === "ntac" && <App profile={profile} />}
            {mode === "pt" && <PTMember profile={profile} embedded />}
          </Suspense>
        )}
      </div>
    );
  }
  if (view === "login")
    return (
      <>
        <AuthGate />
        <div className="login-footer">
          <button onClick={() => setView("welcome")}>처음으로</button>
          <button
            onClick={() => {
              setError("");
              setView("signup");
            }}
          >
            회원 가입
          </button>
        </div>
      </>
    );
  return (
    <main className="manage auth-page">
      <section className="auth-card">
        <span className="brand-word">
          <NTACLogo />
        </span>
        {view === "welcome" ? (
          <>
            <p className="eyebrow">YOUR TRAINING, IN ONE PLACE</p>
            <h1>
              꾸준함을
              <br />
              함께 기록해요.
            </h1>
            <p>
              수업, 훈련 기록, 코치 피드백을
              <br />
              한곳에서 확인하세요.
            </p>
            <button className="primary full" onClick={() => setView("login")}>
              로그인
            </button>
            <button className="full" onClick={() => setView("signup")}>
              회원 가입
            </button>
          </>
        ) : (
          <>
            <button className="text-action" onClick={() => setView("welcome")}>
              돌아가기
            </button>
            <h1>회원 가입</h1>
            <p>기존 계정이 있다면 그대로 로그인해 주세요.</p>
            <form onSubmit={signup}>
              <fieldset disabled={busy}>
                <label>
                  이름
                  <input
                    name="name"
                    autoComplete="name"
                    minLength="2"
                    required
                  />
                </label>
                <label>
                  이메일
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  연락처
                  <input name="phone" type="tel" autoComplete="tel" required />
                </label>
                <label>
                  비밀번호
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength="8"
                    required
                  />
                </label>
                <label>
                  비밀번호 확인
                  <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength="8"
                    required
                  />
                </label>
                <label className="check-line">
                  <input type="checkbox" required />
                  회원 식별 및 훈련 관리에 필요한 개인정보 수집·이용에
                  동의합니다.
                </label>
                <button className="primary full">
                  {busy ? "가입 중..." : "계정 만들기"}
                </button>
              </fieldset>
            </form>
            {notice && <p role="status">{notice}</p>}
          </>
        )}
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
