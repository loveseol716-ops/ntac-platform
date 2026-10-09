import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked, loadPT } from "./api.js";
import { today } from "./model.js";
import { Packages, Assessments, SessionSummary } from "./Shared.jsx";
import "./PT.css";
export default function PTMember({ profile }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [tab, setTab] = useState("home");
  useEffect(() => {
    let alive = true;
    setError("");
    (async () => {
      const member = await checked(
        supabase
          .from("pt_members")
          .select("*")
          .eq("profile_id", profile.id)
          .maybeSingle(),
      );
      const records = member?.active ? await loadPT(member.id) : null;
      if (alive) setData({ member, ...records });
    })().catch((e) => {
      if (alive) setError(e.message);
    });
    return () => {
      alive = false;
    };
  }, [profile.id, version]);
  const completed =
      data?.sessions?.filter((s) => s.status === "completed") || [],
    remaining =
      (data?.packages || []).reduce((n, p) => n + p.total_sessions, 0) -
      completed.length;
  const next = data?.sessions
    ?.filter((s) => s.status === "scheduled" && s.session_date >= today())
    .sort((a, b) =>
      `${a.session_date} ${a.start_time}`.localeCompare(
        `${b.session_date} ${b.start_time}`,
      ),
    )[0];
  return (
    <main className="pt pt-shell">
      <header className="member-intro">
        <p>PERSONAL TRAINING</p>
        <h1>{profile.full_name || "회원"}님의 PT</h1>
        <p>담당 코치 · {profile.coach_name || "미배정"}</p>
      </header>
      {error && (
        <p role="alert" className="pt-error">
          {error}
          <button onClick={() => setVersion((v) => v + 1)}>
            다시 불러오기
          </button>
        </p>
      )}
      {!data && !error && <p role="status">기록을 불러오는 중...</p>}
      {data && !data.member?.active && (
        <section className="pt-card">
          <h2>PT 등록을 기다리고 있어요</h2>
          <p>관리자가 PT를 배정하면 수업 기록을 볼 수 있어요.</p>
          <button onClick={() => setVersion((v) => v + 1)}>
            등록 상태 확인
          </button>
        </section>
      )}
      {data?.member?.active && (
        <>
          <section className="compact-stats summary-strip">
            <div>
              <span>남은 수업</span>
              <strong>{remaining}회</strong>
            </div>
            <div>
              <span>출석 완료</span>
              <strong>{completed.length}회</strong>
            </div>
            <div>
              <span>최근 출석</span>
              <strong>
                {completed[0]?.session_date.slice(5).replace("-", ".") || "—"}
              </strong>
            </div>
          </section>
          <nav className="sub-tabs detail-tabs" aria-label="PT 메뉴">
            {[
              ["home", "요약"],
              ["history", "수업 기록"],
              ["assessment", "나의 변화"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "selected" : ""}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="member-content">
            {tab === "home" && (
              <>
                <section className="pt-card pt-hero">
                  <p>다음 수업</p>
                  <h2>
                    {next
                      ? `${next.session_date} · ${next.start_time.slice(0, 5)}`
                      : "다음 일정을 정해주세요"}
                  </h2>
                  <p>
                    {next?.title ||
                      "코치와 다음 수업 일정을 정하면 여기에 표시돼요."}
                  </p>
                  {data.member.goal && <p>목표 · {data.member.goal}</p>}
                </section>
                {completed[0] &&
                  (completed[0].feedback || completed[0].homework) && (
                    <section className="pt-card">
                      <h2>최근 코치 피드백</h2>
                      <pre>{completed[0].feedback}</pre>
                      {completed[0].homework && (
                        <>
                          <h3>다음 수업 전 할 일</h3>
                          <pre>{completed[0].homework}</pre>
                        </>
                      )}
                    </section>
                  )}
                <details className="pt-card">
                  <summary>등록한 수업 횟수</summary>
                  <Packages packages={data.packages} sessions={data.sessions} />
                </details>
              </>
            )}
            {tab === "history" && (
              <>
                {!data.sessions.length && (
                  <p className="pt-muted">첫 수업을 준비하고 있어요.</p>
                )}
                {data.sessions.map((s) => (
                  <SessionSummary key={s.id} session={s} />
                ))}
              </>
            )}
            {tab === "assessment" && <Assessments rows={data.assessments} />}
          </div>
        </>
      )}
    </main>
  );
}
