import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  classTime,
  programVisibleFrom,
  seoulDate,
  shiftMonth,
  stateLabels,
  weekdays,
} from "./model.js";
import { Dialog, Program } from "./shared.jsx";
import { typeDays } from "./classTypes.js";

export default function ProgramArchive({ exercises, onWeek, onClass }) {
  const [kind, setKind] = useState("weeks"),
    [month, setMonth] = useState(""),
    [draft, setDraft] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [data, setData] = useState([]),
    [count, setCount] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(null),
    [programIndex, setProgramIndex] = useState(0),
    [loadedKey, setLoadedKey] = useState("");
  const requestKey = JSON.stringify([kind, month, query, page]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setData([]);
    setCount(0);
    const field = kind === "weeks" ? "week_start" : "starts_at";
    let request = supabase
      .from(kind === "weeks" ? "group_weeks" : "group_classes")
      .select("*", { count: "exact" })
      .order(field, { ascending: false })
      .order("id")
      .range(page * 20, page * 20 + 19);
    if (month) {
      const first = `${month}-01`,
        next = shiftMonth(first, 1);
      request = request
        .gte(field, kind === "weeks" ? first : `${first}T00:00:00+09:00`)
        .lt(field, kind === "weeks" ? next : `${next}T00:00:00+09:00`);
    }
    if (query)
      request = request.ilike("title", `%${query.replace(/[\\%_]/g, "\\$&")}%`);
    request
      .then(({ data: rows, count: total, error: err }) => {
        if (!live) return;
        setLoadedKey(JSON.stringify([kind, month, query, page]));
        if (err) setError(err.message);
        else {
          setData(rows || []);
          setCount(total || 0);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (live) {
          setLoadedKey(JSON.stringify([kind, month, query, page]));
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [kind, month, query, page]);
  const programs = selected
    ? selected.program_mode === "class_type"
      ? selected.programs
      : selected.days
    : [];
  return (
    <section className="g-archive" aria-label="운동 DB">
      <h2>운동 DB</h2>
      <p className="g-muted">
        전체 기간의 주간 프로그램과 개별 수업을 보관해요. 멤버 공개 기간이
        지나도 삭제되지 않아요.
      </p>
      <div
        className="g-view-toggle g-archive-kind"
        role="group"
        aria-label="운동 DB 분류"
      >
        <button
          aria-pressed={kind === "weeks"}
          onClick={() => {
            setKind("weeks");
            setPage(0);
          }}
        >
          주간 묶음
        </button>
        <button
          aria-pressed={kind === "classes"}
          onClick={() => {
            setKind("classes");
            setPage(0);
          }}
        >
          개별 수업
        </button>
      </div>
      <form
        className="g-archive-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft.trim());
          setPage(0);
        }}
      >
        <label>
          조회 월
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          프로그램 이름
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="이름으로 검색"
            maxLength={120}
          />
        </label>
        <button type="submit">검색</button>
        <button
          type="button"
          onClick={() => {
            setMonth("");
            setDraft("");
            setQuery("");
            setPage(0);
          }}
        >
          전체 기간
        </button>
      </form>
      {error && (
        <p className="g-error" role="alert">
          {error}
        </p>
      )}
      {loading || loadedKey !== requestKey ? (
        <p role="status">운동 DB를 불러오고 있어요.</p>
      ) : (
        <>
          <p className="g-muted">{count}개 · 최신순 · 삭제한 프로그램 포함</p>
          <div className="g-archive-list">
            {data.map((row) => {
              const date =
                kind === "weeks" ? row.week_start : seoulDate(row.starts_at);
              const archived = row.status === "archived" || row.archived_at;
              return (
                <button
                  key={row.id}
                  className="g-archive-row"
                  onClick={() => {
                    if (kind === "classes") onClass(row);
                    else {
                      setSelected(row);
                      setProgramIndex(0);
                    }
                  }}
                >
                  <span>
                    <small>
                      {date}
                      {kind === "classes"
                        ? ` · ${classTime(row.starts_at)}`
                        : " 시작 주"}
                    </small>
                    <strong>{row.title}</strong>
                  </span>
                  <span className="g-badge">
                    {archived
                      ? "삭제·보관"
                      : date < programVisibleFrom()
                        ? "멤버 공개 종료"
                        : stateLabels[row.status] || "보관"}
                  </span>
                  <span className="g-card-action">
                    {kind === "weeks" ? "내용 보기" : "수업 관리"}
                  </span>
                </button>
              );
            })}
            {!data.length && (
              <p className="g-empty">조건에 맞는 프로그램이 없어요.</p>
            )}
          </div>
          <div className="g-archive-pages">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              이전 페이지
            </button>
            <span>
              {page + 1} / {Math.max(1, Math.ceil(count / 20))}
            </span>
            <button
              disabled={(page + 1) * 20 >= count}
              onClick={() => setPage((p) => p + 1)}
            >
              다음 페이지
            </button>
          </div>
        </>
      )}
      {selected && (
        <Dialog title={selected.title} onClose={() => setSelected(null)}>
          <p className="g-muted">
            {selected.week_start} 시작 주 · 관리자 보관 프로그램
          </p>
          {!!programs?.length && (
            <label>
              수업 프로그램 선택
              <select
                value={programIndex}
                onChange={(e) => setProgramIndex(Number(e.target.value))}
              >
                {programs.map((p, i) => (
                  <option value={i} key={p.class_type_id || p.dow}>
                    {p.class_type_id
                      ? typeDays(p.class_type_id)
                      : weekdays[p.dow - 1]}{" "}
                    · {p.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {programs?.[programIndex] ? (
            <Program c={programs[programIndex]} exercises={exercises} />
          ) : (
            <p>작성된 프로그램이 없어요.</p>
          )}
          {selected.status !== "archived" && (
            <button
              className="g-primary"
              onClick={() => {
                onWeek(selected.week_start);
                setSelected(null);
              }}
            >
              해당 주 프로그램 관리
            </button>
          )}
        </Dialog>
      )}
    </section>
  );
}
