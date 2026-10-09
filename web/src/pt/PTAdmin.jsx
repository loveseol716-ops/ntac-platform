import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { checked, loadPT, saveSession } from "./api.js";
import { blankSession, starterWorkout, statusLabels, today } from "./model.js";
import { Assessments, Packages } from "./Shared.jsx";
import "./PT.css";
const Field = ({ label, ...props }) => (
  <label>
    {label}
    <input {...props} />
  </label>
);
const Text = ({ label, ...props }) => (
  <label>
    {label}
    <textarea {...props} />
  </label>
);
export default function PTAdmin({ initialMemberId = "", isAdmin = true }) {
  const [panel, setPanel] = useState("sessions");
  const [profiles, setProfiles] = useState([]),
    [members, setMembers] = useState([]),
    [templates, setTemplates] = useState([]);
  const memberId = initialMemberId;
  const [data, setData] = useState(null),
    [draft, setDraft] = useState(null);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const lock = useRef(false);
  const member = members.find((m) => m.id === memberId);
  const person = profiles.find((p) => p.id === member?.profile_id);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      checked(
        supabase
          .from("profiles")
          .select("id,full_name,email,membership")
          .order("full_name"),
      ),
      checked(supabase.from("pt_members").select("*").order("created_at")),
      checked(
        supabase
          .from("pt_templates")
          .select("*")
          .order("created_at", { ascending: false }),
      ),
    ])
      .then(([p, m, t]) => {
        if (alive) {
          setProfiles(p);
          setMembers(m);
          setTemplates(t);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [version]);
  useEffect(() => {
    let alive = true;
    setData(null);
    setDraft(null);
    if (memberId)
      loadPT(memberId, true)
        .then((v) => {
          if (alive) setData(v);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [memberId, version]);
  async function act(fn) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage("저장했습니다.");
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message || "저장하지 못했습니다.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function patch(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  function exercise(i, k, v) {
    setDraft((d) => ({
      ...d,
      workout: d.workout.map((w, j) => (j === i ? { ...w, [k]: v } : w)),
    }));
  }
  const upcoming =
    data?.sessions
      .filter((s) => s.status === "scheduled" && s.session_date >= today())
      .sort((a, b) =>
        `${a.session_date} ${a.start_time}`.localeCompare(
          `${b.session_date} ${b.start_time}`,
        ),
      ) || [];
  return (
    <section className="pt">
      <div className="pt-row pt-between">
        <div>
          <p className="pt-eyebrow">PERSONAL TRAINING</p>
          <h1>{person?.full_name || "회원"}님의 PT</h1>
        </div>
        <button
          disabled={busy || !!draft}
          onClick={() => setVersion((v) => v + 1)}
        >
          새로고침
        </button>
      </div>
      {error && (
        <p role="alert" className="pt-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="pt-success">
          {message}
        </p>
      )}
      {loading && <p>회원 목록을 불러오는 중...</p>}
      <fieldset disabled={busy}>
        {memberId && !data && <p>회원 기록을 불러오는 중...</p>}
        {data && (
          <>
            <div className="compact-stats">
              <div>
                <span>남은 횟수</span>
                <strong>
                  {data.packages.reduce((n, p) => n + p.total_sessions, 0) -
                    data.sessions.filter((s) => s.status === "completed")
                      .length}
                  회
                </strong>
              </div>
              <div>
                <span>최근 출석</span>
                <strong>
                  {data.sessions
                    .find((s) => s.status === "completed")
                    ?.session_date.slice(5)
                    .replace("-", ".") || "—"}
                </strong>
              </div>
              <div>
                <span>다음 수업</span>
                <strong>
                  {upcoming[0]?.session_date.slice(5).replace("-", ".") || "—"}
                </strong>
              </div>
            </div>
            <nav className="sub-tabs" aria-label="회원 관리 항목">
              {[
                ["sessions", "수업 기록"],
                ["assessment", "기능 평가"],
                ...(isAdmin ? [["settings", "회원·이용권"]] : []),
              ].map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  disabled={!!draft}
                  className={panel === id ? "selected" : ""}
                  onClick={() => setPanel(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {panel === "settings" && isAdmin && (
              <>
                <details className="pt-card">
                  <summary>목표·운동 경험 수정</summary>
                  <form
                    key={memberId + version}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      act(() =>
                        checked(
                          supabase
                            .from("pt_members")
                            .update({
                              goal: f.get("goal"),
                              experience: f.get("experience"),
                            })
                            .eq("id", memberId),
                        ),
                      );
                    }}
                  >
                    <Field
                      label="목표"
                      name="goal"
                      defaultValue={member.goal}
                    />
                    <Field
                      label="운동 경험"
                      name="experience"
                      defaultValue={member.experience}
                    />
                    <button>회원 정보 저장</button>
                  </form>
                </details>
                <Packages packages={data.packages} sessions={data.sessions} />
                <details className="pt-card">
                  <summary>이용권 추가</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const f = new FormData(form);
                      act(async () => {
                        await checked(
                          supabase.from("pt_packages").insert({
                            member_id: memberId,
                            title: f.get("title"),
                            total_sessions: Number(f.get("total")),
                            starts_on: f.get("start"),
                            expires_on: null,
                          }),
                        );
                        form.reset();
                      });
                    }}
                  >
                    <Field
                      label="이용권 이름"
                      name="title"
                      required
                      defaultValue="PT 10회"
                    />
                    <div className="pt-grid">
                      <Field
                        label="등록 횟수"
                        name="total"
                        type="number"
                        min="1"
                        max="1000"
                        step="1"
                        defaultValue="10"
                        required
                      />
                      <Field
                        label="시작일"
                        name="start"
                        type="date"
                        defaultValue={today()}
                        required
                      />
                    </div>
                    <button className="primary">이용권 등록</button>
                  </form>
                </details>
              </>
            )}
            {panel === "sessions" && (
              <>
                <div className="pt-row pt-between">
                  <h2>수업 기록</h2>
                  <button
                    className="primary"
                    disabled={!!draft || !data.packages.length}
                    onClick={() =>
                      setDraft(blankSession(memberId, data.packages.at(-1)?.id))
                    }
                  >
                    수업 추가
                  </button>
                </div>
                {!data.packages.length && (
                  <p className="pt-muted">
                    이용권을 먼저 추가하면 수업을 기록할 수 있어요.
                  </p>
                )}
                {draft && (
                  <form
                    className="pt-card"
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(async () => {
                        await saveSession(draft);
                        setDraft(null);
                      });
                    }}
                  >
                    <h2>수업 작성</h2>
                    <p className="pt-muted">
                      저장된 수업과 피드백은 회원에게 보입니다. 비공개 메모는
                      코치만 볼 수 있어요.
                    </p>
                    <label>
                      이용권
                      <select
                        required
                        value={draft.package_id}
                        disabled={data.sessions.some((s) => s.id === draft.id)}
                        onChange={(e) => patch("package_id", e.target.value)}
                      >
                        {data.packages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} · {p.starts_on}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="pt-grid">
                      <Field
                        label="수업 날짜 (한국 시간)"
                        type="date"
                        required
                        value={draft.session_date}
                        onChange={(e) => patch("session_date", e.target.value)}
                      />
                      <Field
                        label="시작 시간"
                        type="time"
                        required
                        value={draft.start_time}
                        onChange={(e) => patch("start_time", e.target.value)}
                      />
                    </div>
                    <Field
                      label="수업 이름"
                      value={draft.title}
                      required
                      onChange={(e) => patch("title", e.target.value)}
                    />
                    <label>
                      템플릿 불러오기
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const t = templates.find(
                            (t) => t.id === e.target.value,
                          );
                          if (
                            e.target.value &&
                            window.confirm(
                              "현재 운동 항목을 템플릿으로 바꿀까요?",
                            )
                          )
                            patch(
                              "workout",
                              structuredClone(t?.workout || starterWorkout),
                            );
                          e.target.value = "";
                        }}
                      >
                        <option value="">템플릿 선택</option>
                        <option value="starter">초급자 기초 · 오늘 구성</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {draft.workout.map((w, i) => (
                      <details className="pt-exercise" key={i}>
                        <summary>
                          {w.block} · {w.name}
                        </summary>
                        <Field
                          label="블록 / 시간 / 라운드"
                          value={w.block}
                          onChange={(e) => exercise(i, "block", e.target.value)}
                        />
                        <Field
                          label="운동 이름"
                          required
                          value={w.name}
                          onChange={(e) => exercise(i, "name", e.target.value)}
                        />
                        <Field
                          label="목표 횟수 / RPE"
                          value={w.target}
                          onChange={(e) =>
                            exercise(i, "target", e.target.value)
                          }
                        />
                        <Field
                          label="측정 조건 / 동작 버전"
                          value={w.condition}
                          onChange={(e) =>
                            exercise(i, "condition", e.target.value)
                          }
                        />
                        <div className="pt-sets">
                          {w.sets.map((v, j) => (
                            <Field
                              key={j}
                              label={`${j + 1}세트`}
                              placeholder="예: 15kg × 10, RPE 5"
                              value={v}
                              onChange={(e) =>
                                exercise(
                                  i,
                                  "sets",
                                  w.sets.map((x, k) =>
                                    j === k ? e.target.value : x,
                                  ),
                                )
                              }
                            />
                          ))}
                        </div>
                        <div className="pt-row">
                          <button
                            type="button"
                            onClick={() => exercise(i, "sets", [...w.sets, ""])}
                          >
                            세트 추가
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              patch(
                                "workout",
                                draft.workout.filter((_, j) => j !== i),
                              )
                            }
                          >
                            운동 제거
                          </button>
                        </div>
                      </details>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        patch("workout", [
                          ...draft.workout,
                          {
                            block: "",
                            name: "",
                            target: "",
                            condition: "",
                            sets: ["", "", ""],
                          },
                        ])
                      }
                    >
                      운동 추가
                    </button>
                    <Field
                      label="수업 전체 힘든 정도 (0~10)"
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={draft.session_rpe ?? ""}
                      onChange={(e) => patch("session_rpe", e.target.value)}
                    />
                    <Text
                      label="회원에게 전할 피드백"
                      value={draft.feedback}
                      onChange={(e) => patch("feedback", e.target.value)}
                    />
                    <Text
                      label="다음 수업 전 과제"
                      value={draft.homework}
                      onChange={(e) => patch("homework", e.target.value)}
                    />
                    <Text
                      label="코치 비공개 메모 · 컨디션 / 주의사항 / 다음 계획"
                      value={draft.private_note}
                      onChange={(e) => patch("private_note", e.target.value)}
                    />
                    <label>
                      수업 상태
                      <select
                        value={draft.status}
                        onChange={(e) => patch("status", e.target.value)}
                      >
                        {Object.entries(statusLabels).map(([v, t]) => (
                          <option key={v} value={v}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="pt-muted">
                      완료 상태만 1회 사용으로 계산합니다. 예약·취소로 변경하면
                      해당 1회가 복구됩니다.
                    </p>
                    <div className="pt-row">
                      <button className="primary">수업 저장</button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("저장하지 않고 닫을까요?"))
                            setDraft(null);
                        }}
                      >
                        닫기
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const title = window.prompt(
                            "저장할 템플릿 이름",
                            draft.title,
                          );
                          if (!title?.trim()) return;
                          setError("");
                          try {
                            const t = await checked(
                              supabase
                                .from("pt_templates")
                                .insert({
                                  title: title.trim(),
                                  workout: draft.workout.map((w) => ({
                                    ...w,
                                    sets: w.sets.map(() => ""),
                                  })),
                                })
                                .select()
                                .single(),
                            );
                            setTemplates((v) => [t, ...v]);
                            setMessage("템플릿을 저장했습니다.");
                          } catch (e) {
                            setError(e.message);
                          }
                        }}
                      >
                        구성을 템플릿으로 저장
                      </button>
                    </div>
                  </form>
                )}
                {!data.sessions.length && (
                  <p className="pt-muted">아직 수업 기록이 없습니다.</p>
                )}
                {data.sessions.map((s) => (
                  <article className="pt-card" key={s.id}>
                    <div className="pt-row pt-between">
                      <span>
                        {s.session_date} · {s.start_time.slice(0, 5)}
                      </span>
                      <span className="pt-badge">{statusLabels[s.status]}</span>
                    </div>
                    <h3>{s.title}</h3>
                    <p className="pt-muted">{s.feedback || "피드백 미작성"}</p>
                    <div className="pt-row">
                      <button
                        disabled={!!draft}
                        onClick={() =>
                          setDraft({
                            ...s,
                            session_rpe: s.session_rpe ?? "",
                            private_note:
                              data.notes.find((n) => n.session_id === s.id)
                                ?.note || "",
                          })
                        }
                      >
                        보기 / 수정
                      </button>
                      <button
                        disabled={!!draft}
                        onClick={() =>
                          setDraft({
                            ...blankSession(memberId, s.package_id),
                            title: s.title,
                            workout: structuredClone(s.workout).map((w) => ({
                              ...w,
                              sets: w.sets.map(() => ""),
                            })),
                          })
                        }
                      >
                        이전 구성 복사
                      </button>
                    </div>
                  </article>
                ))}
              </>
            )}
            {panel === "assessment" && (
              <>
                <Assessments rows={data.assessments} />
                <details className="pt-card">
                  <summary>기능 평가 기록 추가</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget,
                        f = new FormData(form);
                      act(async () => {
                        await checked(
                          supabase.from("pt_assessments").insert({
                            member_id: memberId,
                            assessed_on: f.get("date"),
                            metric: f.get("metric").trim(),
                            side: f.get("side"),
                            value: Number(f.get("value")),
                            unit: f.get("unit").trim(),
                            conditions: f.get("conditions").trim(),
                          }),
                        );
                        form.reset();
                      });
                    }}
                  >
                    <Field
                      label="평가 날짜"
                      type="date"
                      name="date"
                      defaultValue={today()}
                      required
                    />
                    <Field
                      label="테스트 이름"
                      name="metric"
                      list="pt-metrics"
                      required
                    />
                    <datalist id="pt-metrics">
                      {[
                        "Knee-to-wall",
                        "한 발 서기",
                        "인클라인 푸시업",
                        "스쿼트 8회 중량",
                        "고정 강도 걷기 RPE",
                      ].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </datalist>
                    <div className="pt-grid">
                      <label>
                        측정 부위
                        <select name="side">
                          <option>해당 없음</option>
                          <option>좌</option>
                          <option>우</option>
                        </select>
                      </label>
                      <Field
                        label="측정값"
                        name="value"
                        type="number"
                        min="0"
                        step="any"
                        required
                      />
                      <Field
                        label="단위 (cm / 초 / 회 / kg / RPE)"
                        name="unit"
                        required
                      />
                    </div>
                    <Text
                      label="측정 조건 (바 높이 / 깊이 / 속도 등)"
                      name="conditions"
                    />
                    <button className="primary">평가 저장</button>
                  </form>
                </details>
              </>
            )}
          </>
        )}
      </fieldset>
    </section>
  );
}
