import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked, loadPT } from "./api.js";
import { today } from "./model.js";
import { Packages, Assessments, SessionSummary } from "./Shared.jsx";
import "./PT.css";
export default function PTMember({ profile, onBack }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    setError("");
    setData(null);
    (async () => {
      const member = await checked(
        supabase
          .from("pt_members")
          .select("*")
          .eq("profile_id", profile.id)
          .maybeSingle(),
      );
      const records = member ? await loadPT(member.id) : null;
      if (alive) setData({ member, ...records });
    })().catch((e) => {
      if (alive) setError(e.message);
    });
    return () => {
      alive = false;
    };
  }, [profile.id, version]);
  const next = data?.sessions
    ?.filter((s) => s.status === "scheduled" && s.session_date >= today())
    .sort((a, b) =>
      `${a.session_date} ${a.start_time}`.localeCompare(
        `${b.session_date} ${b.start_time}`,
      ),
    )[0];
  return (
    <main className="pt pt-shell">
      <div className="pt-row pt-between">
        <div>
          <p className="pt-eyebrow">NOLTO PERSONAL TRAINING</p>
          <h1>{profile.full_name || "회원"}님의 PT</h1>
        </div>
        <button
          onClick={async () => {
            const { error: e } = await supabase.auth.signOut({
              scope: "local",
            });
            if (e) setError(e.message);
          }}
        >
          로그아웃
        </button>
      </div>
      {onBack && <button onClick={onBack}>NTAC로 이동</button>}
      {error && (
        <div role="alert" className="pt-error">
          {error}
          <button onClick={() => setVersion((v) => v + 1)}>
            다시 불러오기
          </button>
        </div>
      )}
      {!data && !error && <p role="status">수업 기록을 불러오는 중...</p>}
      {data && !data.member && (
        <section className="pt-card">
          <h2>코치의 PT 등록을 기다리고 있어요</h2>
          <p>
            가입한 이름과 이메일을 코치에게 알려주세요. 이용권이 등록되면
            여기에서 수업과 변화를 확인할 수 있어요.
          </p>
          <button onClick={() => setVersion((v) => v + 1)}>
            등록 상태 확인
          </button>
        </section>
      )}
      {data?.member && (
        <>
          <section className="pt-card pt-hero">
            <p>다음 수업</p>
            <h2>
              {next
                ? `${next.session_date} · ${next.start_time.slice(0, 5)}`
                : "아직 예약된 수업이 없어요"}
            </h2>
            <p>{next?.title || "다음 일정을 코치와 정해주세요."}</p>
            {data.member.goal && <p>나의 목표 · {data.member.goal}</p>}
          </section>
          <Packages packages={data.packages} sessions={data.sessions} />
          <Assessments rows={data.assessments} />
          <h2>수업 기록</h2>
          {!data.sessions.length && (
            <p className="pt-muted">첫 수업을 준비하고 있어요.</p>
          )}
          {data.sessions.map((s) => (
            <SessionSummary key={s.id} session={s} />
          ))}
        </>
      )}
    </main>
  );
}
