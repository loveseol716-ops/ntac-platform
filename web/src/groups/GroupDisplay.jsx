import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  classTime,
  levels,
  movementLabel,
  loadLabel,
  resultText,
  resultRows,
  sourceLabels,
} from "./model.js";
import "./Groups.css";
// A TV does not reuse an administrator's authentication session.
const client = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      storageKey: "ntac-tv-readonly",
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
export default function GroupDisplay({ token }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [updated, setUpdated] = useState(null),
    [page, setPage] = useState(0),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    let live = true,
      timer,
      request;
    const poll = async () => {
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const { data, error } = await client
          .rpc("group_display", { display_token: token })
          .abortSignal(controller.signal);
        if (error) throw error;
        if (live) {
          setData(data);
          setUpdated(Date.now());
          setError("");
        }
      } catch (e) {
        if (live) {
          setError(e.message || "연결을 확인하고 있어요.");
          if (e.code === "P0001") {
            setData(null);
            setUpdated(null);
          }
        }
      } finally {
        clearTimeout(timeout);
        if (live) timer = setTimeout(poll, 5000);
      }
    };
    poll();
    return () => {
      live = false;
      clearTimeout(timer);
      request?.abort();
    };
  }, [token]);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      setPage((p) => p + 1);
    }, 8000);
    return () => clearInterval(timer);
  }, []);
  const c = data?.class,
    m = c?.movements.find((x) => x.id === data.movement_id) || c?.movements[0],
    results = data?.kind === "results",
    rows = results
      ? resultRows(data.participants || [], m)
      : data?.participants || [],
    pages = Math.max(1, Math.ceil(rows.length / 9)),
    index = page % pages,
    stale = updated && now - updated > 20000;
  return (
    <main
      className={`group-display ${results ? "results" : "recommendations"}`}
    >
      <header>
        <div>
          <span className="tv-brand">NTAC</span>
          <span className="tv-mode">
            {results ? "TODAY’S RESULTS" : "TRAINING GUIDE"}
          </span>
        </div>
        <div className="tv-header-right">
          <span>{data?.wall || "GROUP TRAINING"}</span>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
          >
            전체 화면
          </button>
        </div>
      </header>
      {error && (
        <div className="tv-warning" role="alert">
          {stale
            ? "연결 지연 · 아래 내용은 마지막으로 확인된 화면이에요."
            : error}
        </div>
      )}
      {c ? (
        <>
          <section className="tv-title">
            <div>
              <p>
                {classTime(c.starts_at)} ·{" "}
                {c.status === "ended" ? "수업 종료" : "오늘의 수업"}
              </p>
              <h1>{c.title}</h1>
            </div>
            <div>
              <h2>{m ? movementLabel(m) : "함께하는 오늘 운동"}</h2>
              <p>
                {m?.kind === "weight"
                  ? `${m.target_reps}회 · ${loadLabel(m)} (${m.unit})`
                  : results
                    ? "확정된 동일 조건 기록만 난이도별 순위를 표시해요."
                    : "코치의 안내를 확인하세요."}
              </p>
            </div>
          </section>
          <section className="tv-grid">
            {rows.slice(index * 9, index * 9 + 9).map((p) => (
              <article key={p.id}>
                <div className="tv-person-heading">
                  <h2>{p.name}</h2>
                  <span>{levels[p.difficulty]}</span>
                </div>
                {results ? (
                  <>
                    <strong className="tv-value">
                      {m
                        ? resultText(m, p.results?.[m.id])
                        : p.status === "completed"
                          ? "운동 완료"
                          : "운동 중"}
                    </strong>
                    <p>
                      {p.rank
                        ? `${levels[p.difficulty]} ${p.rank}위`
                        : p.status === "completed"
                          ? p.finalized
                            ? "운동 완료"
                            : "코치 확인 전"
                          : "운동 중"}
                    </p>
                  </>
                ) : (
                  <>
                    <strong className="tv-value">
                      {m?.kind === "weight" ? (
                        p.recommendations?.[m.id]?.weight != null ? (
                          <>
                            {p.recommendations[m.id].weight}
                            <small>{m.unit}</small>
                          </>
                        ) : (
                          "코치 확인"
                        )
                      ) : m?.kind === "participation" ? (
                        "함께 도전"
                      ) : (
                        "프로그램 확인"
                      )}
                    </strong>
                    <p>
                      {m?.kind === "weight"
                        ? sourceLabels[p.recommendations?.[m.id]?.source]
                        : "코치 안내에 따라 진행하세요."}
                    </p>
                  </>
                )}
              </article>
            ))}
          </section>
          {!rows.length && (
            <div className="tv-empty">
              {results
                ? "오늘의 운동 결과를 기다리고 있어요."
                : "오늘 운동을 시작해 주세요."}
              <p>TV 공개에 동의한 회원의 별명과 기록이 표시돼요.</p>
            </div>
          )}
        </>
      ) : (
        <div className="tv-empty">
          <h1>READY TO TRAIN</h1>
          <p>
            {error
              ? "연결 상태를 확인해 주세요."
              : "코치가 오늘의 수업을 선택하면 시작해요."}
          </p>
        </div>
      )}
      <footer>
        <span>
          {results
            ? "나의 어제보다 한 걸음 더."
            : "추천 중량은 코치와 확인하고 시작하세요."}
        </span>
        <span>
          {pages > 1 ? `${index + 1} / ${pages} · ` : ""}
          {updated
            ? `최근 연결 ${new Date(updated).toLocaleTimeString("ko-KR")}`
            : "연결 중…"}
        </span>
      </footer>
    </main>
  );
}
