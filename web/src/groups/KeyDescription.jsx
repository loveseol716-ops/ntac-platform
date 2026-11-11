export default function KeyDescription({ value }) {
  return <section className="g-panel g-key-description" aria-label="관리자 전용 Key Description">
    <h3>Key Description <small>관리자 전용</small></h3>
    <p>{value || "아직 작성된 설명이 없어요. 프로그램 수정에서 의도와 목적을 추가해 주세요."}</p>
  </section>;
}
