import { useState } from "react";
import { SERVICES, serviceLabels } from "./memberServices.js";
export default function MemberDirectory({
  rows,
  coaches,
  loading,
  onAssign,
  onProfile,
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const matches = (row, id) =>
    id === "all" ||
    (id === "pending" ? !serviceLabels(row.services).length : row.services[id]);
  const filtered = rows.filter(
    (r) =>
      matches(r, filter) &&
      `${r.p.full_name} ${r.p.email} ${r.p.phone || ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const name = (id) => coaches.find((c) => c.id === id)?.full_name || "미배정";
  return (
    <section className="surface unified-members">
      <div className="section-heading">
        <div>
          <h2>전체 회원 · 이용 서비스</h2>
          <p className="muted">
            가입한 모든 계정이 표시돼요. PT·NTAC·그룹수업은 필요한 만큼 함께
            선택할 수 있어요.
          </p>
        </div>
        <strong>{rows.length}명</strong>
      </div>
      <nav className="service-filters" aria-label="회원 서비스 필터">
        {[
          { id: "all", label: "전체" },
          ...SERVICES,
          { id: "pending", label: "미지정" },
        ].map((s) => (
          <button
            key={s.id}
            className={filter === s.id ? "selected" : ""}
            aria-pressed={filter === s.id}
            onClick={() => setFilter(s.id)}
          >
            {s.label} <span>{rows.filter((r) => matches(r, s.id)).length}</span>
          </button>
        ))}
      </nav>
      <label>
        통합 회원 검색
        <input
          type="search"
          placeholder="이름 · 이메일 · 연락처"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="unified-member-list">
        {filtered.map(({ p, m, services }) => (
          <article className="unified-member-card" key={p.id}>
            <div className="unified-member-info">
              <div className="section-heading">
                <h3>{p.full_name || "이름 없음"}</h3>
                {p.role !== "member" && (
                  <span className="service-badge">
                    {{ owner: "대표", admin: "관리자", coach: "코치" }[
                      p.role
                    ] || p.role}
                  </span>
                )}
              </div>
              <p className="muted">
                {p.email || "이메일 없음"}
                {p.phone ? ` · ${p.phone}` : ""}
              </p>
              <div className="service-badges">
                {serviceLabels(services).length ? (
                  serviceLabels(services).map((label) => (
                    <span className="service-badge enabled" key={label}>
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="service-badge">서비스 미지정</span>
                )}
              </div>
              <p className="muted service-coaches">
                {services.ntac && (
                  <span>NTAC 코치 · {name(services.ntac_coach_id)}</span>
                )}
                {services.pt && (
                  <span>PT 코치 · {name(services.pt_coach_id)}</span>
                )}
                {services.group && <span>그룹 코치 · 수업별 배정</span>}
                {!serviceLabels(services).length &&
                  "이용 서비스를 지정하면 해당 회원 목록에 나타나요."}
              </p>
            </div>
            <div className="button-row">
              <button className="primary" onClick={() => onAssign(p, m)}>
                이용 서비스 설정
              </button>
              <button onClick={() => onProfile(p.id)}>프로필 · 비밀번호</button>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && !loading && (
        <p className="empty-inline">조건에 맞는 회원이 없습니다.</p>
      )}
    </section>
  );
}
