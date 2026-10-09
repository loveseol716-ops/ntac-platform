import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { checked } from "./pt/api.js";
import { today } from "./pt/model.js";
import ProfileDialog from "./ProfileDialog.jsx";
import { currentBalance } from "./pt/passes.js";
import PTAdmin from "./pt/PTAdmin.jsx";
import CoachCalendar from "./pt/CoachCalendar.jsx";
import "./management/Management.css";
const WeeklyProgramAdmin = lazy(() => import("./WeeklyProgramAdmin.jsx"));
const PersonalProgramAdmin = lazy(() => import("./PersonalProgramAdmin.jsx"));
const WeeklyAthleteReportAdmin = lazy(
  () => import("./WeeklyAthleteReportAdmin.jsx"),
);
const CommunityAdmin = lazy(() => import("./CommunityAdmin.jsx"));
const AdminAccessManagement = lazy(() => import("./AdminAccessManagement.jsx"));
const isStaff = (p) => ["owner", "admin", "coach"].includes(p?.role);
function getPTStats(member, packages, sessions) {
  const completed = sessions
    .filter((s) => s.member_id === member.id && s.status === "completed")
    .sort((a, b) => b.session_date.localeCompare(a.session_date));
  const packs = packages.filter((p) => p.member_id === member.id);
  const next = sessions
    .filter(
      (s) =>
        s.member_id === member.id &&
        s.status === "scheduled" &&
        s.session_date >= today(),
    )
    .sort((a, b) =>
      `${a.session_date} ${a.start_time}`.localeCompare(
        `${b.session_date} ${b.start_time}`,
      ),
    )[0];
  return {
    used: completed.length,
    remaining: currentBalance(packs, sessions),
    last: completed[0]?.session_date,
    next,
    packs: packs.length,
  };
}
function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog className="manage member-dialog" ref={ref} onCancel={onClose}>
      <div className="section-heading">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="닫기">
          닫기
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function CoachAdminPage({
  profile: initialProfile,
  onClose,
  initialArea = "pt",
}) {
  const [profile, setProfile] = useState(initialProfile),
    [tab, setTab] = useState(initialArea),
    [ntacTab, setNtacTab] = useState("members");
  const [profiles, setProfiles] = useState([]),
    [members, setMembers] = useState([]),
    [packages, setPackages] = useState([]),
    [sessions, setSessions] = useState([]);
  const [query, setQuery] = useState(""),
    [coachFilter, setCoachFilter] = useState("all"),
    [registering, setRegistering] = useState(false),
    [registrationQuery, setRegistrationQuery] = useState(""),
    [selected, setSelected] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today()),
    [startNew, setStartNew] = useState(false);
  const [editing, setEditing] = useState(null),
    [profileEditing, setProfileEditing] = useState(null),
    [service, setService] = useState(""),
    [coach, setCoach] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  const lock = useRef(false),
    admin = ["owner", "admin"].includes(profile?.role);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    (async () => {
      let p = initialProfile;
      if (!p) {
        const { data } = await supabase.auth.getUser();
        p = await checked(
          supabase.from("profiles").select("*").eq("id", data.user.id).single(),
        );
      }
      if (!isStaff(p)) throw Error("관리 권한이 없습니다.");
      const [ps, ms, pk, ss] = await Promise.all([
        checked(
          supabase
            .from("profiles")
            .select(
              "id,full_name,email,phone,role,ntac_enabled,assigned_coach_id,coach_name",
            )
            .order("full_name"),
        ),
        checked(supabase.from("pt_members").select("*")),
        checked(supabase.from("pt_packages").select("*")),
        checked(
          supabase
            .from("pt_sessions")
            .select(
              "id,member_id,package_id,session_date,start_time,status,title,coach_id,duration_minutes",
            )
            .order("session_date", { ascending: false }),
        ),
      ]);
      if (live) {
        setProfile(p);
        setProfiles(ps);
        setMembers(ms);
        setPackages(pk);
        setSessions(ss);
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
  }, [initialProfile, version]);
  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1),
      timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const coaches = profiles.filter(isStaff);
  const rows = useMemo(
    () =>
      profiles.map((p) => {
        const m = members.find((m) => m.profile_id === p.id);
        return { p, m, stats: m ? getPTStats(m, packages, sessions) : null };
      }),
    [profiles, members, packages, sessions],
  );
  const filtered = rows.filter(({ p, m }) => {
    if (isStaff(p)) return false;
    if (tab === "pt" && !m?.active) return false;
    if (tab === "ntac" && !p.ntac_enabled) return false;
    if (
      query &&
      !`${p.full_name} ${p.email} ${p.phone || ""}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
      return false;
    if (
      coachFilter !== "all" &&
      ((tab === "pt" ? m?.coach_id : p.assigned_coach_id) || "none") !==
        coachFilter
    )
      return false;
    return true;
  });
  function edit(p, m) {
    setEditing(p);
    setService(
      m?.active
        ? p.ntac_enabled
          ? "both"
          : "pt"
        : p.ntac_enabled
          ? "ntac"
          : "none",
    );
    setCoach(
      (tab === "pt" ? m?.coach_id : p.assigned_coach_id) ||
        p.assigned_coach_id ||
        "",
    );
    setError("");
  }
  async function save(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await checked(
        supabase.rpc("set_member_services", {
          target_id: editing.id,
          enable_ntac: ["ntac", "both"].includes(service),
          enable_pt: ["pt", "both"].includes(service),
          coach_id: coach || null,
        }),
      );
      setEditing(null);
      setMessage("이용 프로그램과 담당 코치를 저장했어요.");
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (selected)
    return (
      <div className="manage management-layout">
        <button
          className="back-link"
          onClick={() => {
            setSelected(null);
            setVersion((v) => v + 1);
          }}
        >
          PT 목록으로
        </button>
        <PTAdmin
          initialMemberId={selected}
          isAdmin={admin}
          initialDate={selectedDate}
          startNew={startNew}
        />
      </div>
    );
  return (
    <main className="manage management-layout">
      {profileEditing && (
        <ProfileDialog
          targetId={profileEditing}
          isAdmin
          onClose={() => setProfileEditing(null)}
          onSaved={() => setVersion((v) => v + 1)}
        />
      )}
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{admin ? "COACH WORKSPACE" : "MY MEMBERS"}</p>
          <h1>
            {tab === "pt"
              ? "PT 관리"
              : tab === "ntac"
                ? "NTAC 관리"
                : "운영 설정"}
          </h1>
          <p className="workspace-description">
            {tab === "pt"
              ? "개인 수업 일정과 회원별 횟수권을 관리하세요."
              : tab === "ntac"
                ? "NTAC 회원의 프로그램과 훈련 리포트를 관리하세요."
                : "코치 계정과 관리자 권한을 설정하세요."}
          </p>
        </div>
        <div className="button-row">
          {onClose && <button onClick={onClose}>닫기</button>}
          <button disabled={loading} onClick={() => setVersion((v) => v + 1)}>
            새로고침
          </button>
        </div>
      </header>
      <nav className="workspace-tabs" aria-label="관리 메뉴">
        {[
          ["pt", "PT 관리"],
          ...(admin
            ? [
                ["ntac", "NTAC 관리"],
                ["staff", "운영 설정"],
              ]
            : []),
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "selected" : ""}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              setCoachFilter("all");
              setMessage("");
              setError("");
              setQuery("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && !editing && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-banner" role="status">
          {message}
        </p>
      )}
      {loading && <p role="status">최신 기록을 확인하고 있어요.</p>}
      {tab === "pt" && profile && (
        <CoachCalendar
          profile={profile}
          coaches={coaches}
          sessions={sessions}
          members={members}
          profiles={profiles}
          onSelect={(id, date, newSession = false) => {
            setSelectedDate(date);
            setStartNew(newSession);
            setSelected(id);
          }}
        />
      )}
      {tab === "ntac" && admin && (
        <nav className="sub-tabs" aria-label="NTAC 관리 메뉴">
          {[
            ["members", "NTAC 회원"],
            ["programs", "주간 프로그램"],
            ["personal", "개인 프로그램"],
            ["reports", "주간 리포트"],
            ["community", "커뮤니티"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={ntacTab === id ? "selected" : ""}
              onClick={() => setNtacTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {(tab === "pt" || (tab === "ntac" && ntacTab === "members")) && (
        <section
          className={`surface member-roster ${tab === "ntac" ? "ntac-roster" : ""}`}
        >
          <div className="section-heading">
            <h2>
              {tab === "pt" ? "PT 회원" : "NTAC 회원"}{" "}
              <span className="muted">{filtered.length}</span>
            </h2>
            {admin && (
              <button
                onClick={() => {
                  setRegistrationQuery("");
                  setRegistering(true);
                }}
              >
                {tab === "pt" ? "PT 회원 등록" : "NTAC 회원 등록"}
              </button>
            )}
          </div>
          <div className="filter-row">
            <label className="search-field">
              <span className="sr-only">회원 검색</span>
              <input
                placeholder="이름 · 연락처 · 이메일 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {admin && (
              <label>
                <span className="sr-only">담당 코치 필터</span>
                <select
                  value={coachFilter}
                  onChange={(e) => setCoachFilter(e.target.value)}
                >
                  <option value="all">모든 코치</option>
                  <option value="none">코치 미배정</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || c.email}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="roster-head">
            <span>회원</span>
            <span>담당 코치</span>
            {tab === "pt" && (
              <>
                <span>최근 출석</span>
                <span>PT 잔여</span>
              </>
            )}
            <span>관리</span>
          </div>
          <div className="roster-list">
            {filtered.map(({ p, m, stats }) => (
              <article key={p.id} className="roster-row">
                <div className="member-identity">
                  <strong>{p.full_name || "이름 없음"}</strong>
                  <span className="muted">
                    {[p.ntac_enabled ? "NTAC" : null, m?.active ? "PT" : null]
                      .filter(Boolean)
                      .join(" · ") || "등록 대기"}
                    {isStaff(p) ? " · 코치" : ""}
                  </span>
                </div>
                <div data-label="담당 코치">
                  {coaches.find(
                    (c) =>
                      c.id ===
                      (tab === "pt" ? m?.coach_id : p.assigned_coach_id),
                  )?.full_name ||
                    p.coach_name ||
                    "미배정"}
                </div>
                {tab === "pt" && (
                  <>
                    <div data-label="최근 출석">
                      {stats?.last || "기록 없음"}
                    </div>
                    <div data-label="PT 잔여">
                      <strong
                        className={stats?.remaining <= 2 ? "low-balance" : ""}
                      >
                        {stats?.packs ? `${stats.remaining}회` : "—"}
                      </strong>
                      {stats?.packs > 0 && (
                        <small className="muted">
                          누적 {stats.used}회 출석
                        </small>
                      )}
                    </div>
                  </>
                )}
                <div className="button-row">
                  {tab === "pt" && m?.active && (
                    <button
                      className="primary"
                      onClick={() => {
                        setSelectedDate(today());
                        setStartNew(false);
                        setSelected(m.id);
                      }}
                    >
                      수업 관리
                    </button>
                  )}
                  {admin && (
                    <>
                      <button onClick={() => setProfileEditing(p.id)}>
                        프로필
                      </button>
                      <button onClick={() => edit(p, m)}>배정</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && !loading && (
            <p className="empty-inline">조건에 맞는 회원이 없습니다.</p>
          )}
        </section>
      )}
      {tab === "ntac" && ntacTab !== "members" && admin && (
        <section className="surface">
          <div className="legacy-panel">
            <Suspense fallback={<p>불러오는 중...</p>}>
              {ntacTab === "programs" && <WeeklyProgramAdmin />}
              {ntacTab === "personal" && <PersonalProgramAdmin />}
              {ntacTab === "reports" && <WeeklyAthleteReportAdmin />}
              {ntacTab === "community" && <CommunityAdmin />}
            </Suspense>
          </div>
        </section>
      )}
      {tab === "staff" && admin && (
        <>
          <section className="surface">
            <h2>등록된 코치</h2>
            <p className="muted">
              코치는 배정된 PT 회원의 수업과 운동 기록을 관리합니다. 회원 배정은
              관리자만 할 수 있습니다.
            </p>
            {coaches.map((c) => (
              <div className="staff-row" key={c.id}>
                <strong>{c.full_name || c.email}</strong>
                <span>
                  {c.role === "owner"
                    ? "대표"
                    : c.role === "admin"
                      ? "관리자"
                      : "코치"}
                </span>
                <span>
                  {
                    members.filter((m) => m.active && m.coach_id === c.id)
                      .length
                  }
                  명 담당
                </span>
              </div>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                const f = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  await checked(
                    supabase.rpc("register_pt_coach", {
                      target_id: f.get("coach"),
                    }),
                  );
                  setVersion((v) => v + 1);
                  setMessage(
                    "코치로 등록했어요. PT 관리 또는 NTAC 관리에서 회원을 배정하세요.",
                  );
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="filter-row">
                <label>
                  코치로 등록할 계정
                  <select name="coach" required>
                    <option value="">가입된 계정 선택</option>
                    {profiles
                      .filter((p) => p.role === "member")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} · {p.email}
                        </option>
                      ))}
                  </select>
                </label>
                <button disabled={busy}>코치 등록</button>
              </div>
            </form>
          </section>
          {profile.role === "owner" && (
            <details className="surface">
              <summary>관리자 권한 설정</summary>
              <Suspense fallback={<p>불러오는 중...</p>}>
                <AdminAccessManagement />
              </Suspense>
            </details>
          )}
        </>
      )}
      {registering && (
        <Modal
          title={tab === "pt" ? "PT 회원 등록" : "NTAC 회원 등록"}
          onClose={() => setRegistering(false)}
        >
          <p className="muted">
            가입된 계정을 선택해 이용 프로그램과 코치를 배정하세요.
          </p>
          <label>
            가입 회원 검색
            <input
              value={registrationQuery}
              onChange={(e) => setRegistrationQuery(e.target.value)}
              placeholder="이름 · 연락처 · 이메일"
            />
          </label>
          <div className="registration-list">
            {rows
              .filter(
                ({ p, m }) =>
                  !isStaff(p) &&
                  (tab === "pt" ? !m?.active : !p.ntac_enabled) &&
                  `${p.full_name} ${p.email} ${p.phone || ""}`
                    .toLowerCase()
                    .includes(registrationQuery.toLowerCase()),
              )
              .map(({ p, m }) => (
                <button
                  key={p.id}
                  onClick={() => {
                    edit(p, m);
                    setService(
                      tab === "pt"
                        ? p.ntac_enabled
                          ? "both"
                          : "pt"
                        : m?.active
                          ? "both"
                          : "ntac",
                    );
                    setRegistering(false);
                  }}
                >
                  <strong>{p.full_name || "이름 없음"}</strong>
                  <span>{p.email}</span>
                </button>
              ))}
          </div>
          <p className="muted">
            목록에 없는 회원은 먼저 회원 가입을 진행해 주세요.
          </p>
        </Modal>
      )}
      {editing && (
        <Modal
          title={`${editing.full_name || "회원"} 배정`}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <label>
                이용 프로그램
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  <option value="none">등록 대기</option>
                  <option value="pt">PT만</option>
                  <option value="ntac">NTAC만</option>
                  <option value="both">PT + NTAC</option>
                </select>
              </label>
              <label>
                담당 코치
                <select
                  value={coach}
                  onChange={(e) => setCoach(e.target.value)}
                >
                  <option value="">미배정</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || c.email}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                회원에게는 지정된 프로그램만 표시됩니다. PT 횟수권의 사용 기간은
                별도로 설정합니다.
              </p>
              {error && (
                <p role="alert" className="error-banner">
                  {error}
                </p>
              )}
              <button className="primary full">
                {busy ? "저장 중..." : "배정 저장"}
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
    </main>
  );
}
