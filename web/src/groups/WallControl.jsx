import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked, rpc } from "./api.js";
export default function WallControl() {
  const [walls, setWalls] = useState([]),
    [wall, setWall] = useState(""),
    [links, setLinks] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const data = await checked(
      supabase
        .from("group_walls")
        .select("*")
        .order("updated_at", { ascending: false }),
    );
    setWalls(data);
    setWall((w) => w || data[0]?.id || "");
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function act(fn) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const url = (token) =>
    `${location.origin}${import.meta.env.BASE_URL}#display=${token}`;
  return (
    <section className="g-panel">
      <div className="g-heading">
        <h2>TV 자동 연결</h2>
        {
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                const title = prompt(
                  "TV 묶음 이름을 입력하세요.",
                  "메인 운동장",
                );
                if (!title) return;
                const result = await rpc("group_create_wall", {
                  wall_title: title,
                });
                setLinks(result);
                setWall(result.id);
              })
            }
          >
            + TV 연결 만들기
          </button>
        }
      </div>
      <p className="g-muted">
        TV 1은 추천 중량, TV 2는 멤버 기록을 보여줘요. 처음 한 번 연결해 두면
        시간표에 맞춰 수업이 자동으로 바뀌어요.
      </p>
      {error && (
        <p role="alert" className="g-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="g-success">
          {message}
        </p>
      )}
      {links && (
        <div className="g-tv-links">
          <p>
            아래 링크를 각 TV의 브라우저·웹 앱 실행 기기에 한 번씩 열어 주세요.
            링크는 이 화면에서만 제공되며 90일 동안 유효해요.
          </p>
          {[
            ["recommendations", "TV 1 · 추천 중량"],
            ["results", "TV 2 · 결과 보드"],
          ].map(([k, label]) => (
            <div key={k}>
              <strong>{label}</strong>
              <div className="g-actions">
                <a href={url(links[k])} target="_blank" rel="noreferrer">
                  화면 열기 ↗
                </a>
                <button
                  onClick={() =>
                    navigator.clipboard
                      .writeText(url(links[k]))
                      .then(() => setMessage(`${label} 링크를 복사했어요.`))
                      .catch(() => setError("아래 링크를 직접 복사해 주세요."))
                  }
                >
                  링크 복사
                </button>
              </div>
              <input
                readOnly
                aria-label={`${label} 링크`}
                value={url(links[k])}
                onFocus={(e) => e.target.select()}
              />
            </div>
          ))}
        </div>
      )}
      {walls.length ? (
        <>
          <label>
            TV 묶음
            <select value={wall} onChange={(e) => setWall(e.target.value)}>
              {walls.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </label>
          <p className="g-auto-flow">
            자동 송출 중 · 시작 30분 전 입장 명단 · 정시 수업 전환 · 핵심 운동
            자동 순환
          </p>
          <details className="g-class-options">
            <summary>연결 관리</summary>
            <div className="g-actions">
              {
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "이 TV 묶음의 연결 링크를 해제할까요? 다시 연결하려면 새 링크가 필요해요.",
                      )
                    )
                      act(async () => {
                        await rpc("group_control_wall", {
                          wid: wall,
                          cid: null,
                          revoke_link: true,
                        });
                        setMessage("TV 연결을 해제했어요.");
                      });
                  }}
                >
                  연결 해제
                </button>
              }
            </div>
          </details>
        </>
      ) : (
        <p className="g-empty">‘TV 연결’에서 먼저 TV 묶음을 만들어 주세요.</p>
      )}
      {
        <p className="g-muted">
          다음 수업 입장이 시작되기 전까지 이전 수업의 화면을 유지해요. 핵심
          운동이 여러 개면 20초마다 순환하고, 참가·기록은 약 5초마다 갱신돼요.
          TV 공개 설정을 켠 회원의 이름과 기록만 표시돼요.
        </p>
      }
    </section>
  );
}
