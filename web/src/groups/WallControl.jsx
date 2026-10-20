import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked, rpc } from "./api.js";
import { movementLabel } from "./model.js";
export default function WallControl({ currentClass, compact = false }) {
  const [walls, setWalls] = useState([]),
    [wall, setWall] = useState(""),
    [movement, setMovement] = useState(""),
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
        <h2>{compact ? "이 수업 TV 송출" : "TV 두 화면 연결"}</h2>
        {!compact && (
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
        )}
      </div>
      <p className="g-muted">
        TV 1은 추천 화면, TV 2는 결과 화면을 각각 열어요. 아이패드에서 같은
        수업을 지정하면 두 화면이 함께 바뀌어요.
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
          {currentClass && (
            <>
              <label>
                지금 보여줄 운동
                <select
                  value={movement}
                  onChange={(e) => setMovement(e.target.value)}
                >
                  <option value="">첫 번째 운동</option>
                  {currentClass.movements.map((m) => (
                    <option key={m.id} value={m.id}>
                      {movementLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="g-primary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await rpc("group_control_wall", {
                      wid: wall,
                      cid: currentClass.id,
                      mid: movement || null,
                    });
                    setMessage("두 화면에 같은 수업과 운동을 지정했어요.");
                  })
                }
              >
                이 수업을 두 화면에 송출
              </button>
            </>
          )}
          <div className="g-actions">
            <button
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await rpc("group_control_wall", { wid: wall, cid: null });
                  setMessage("TV를 대기 화면으로 바꿨어요.");
                })
              }
            >
              대기 화면으로
            </button>
            {!compact && (
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
            )}
          </div>
        </>
      ) : (
        <p className="g-empty">‘TV 연결’에서 먼저 TV 묶음을 만들어 주세요.</p>
      )}
      {!compact && (
        <p className="g-muted">
          수업 운영에서 수업을 열고 ‘이 수업을 두 화면에 송출’을 누르세요. TV에
          관리자 로그인을 할 필요는 없어요. 브라우저 실행을 지원하는 스마트 TV
          또는 HDMI 연결 기기가 필요해요.
        </p>
      )}
    </section>
  );
}
