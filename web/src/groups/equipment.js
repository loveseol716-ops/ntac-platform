export function loadingText(set) {
  if (set?.weight == null || set.bar_weight == null) return "";
  const plates=(set.plates_per_side||[]).map((p)=>`${p.kg}${p.count>1 ? `×${p.count}` : ""}`).join(" + ");
  return `바벨 ${set.bar_weight}kg · ${plates ? `한쪽 ${plates}kg` : "플레이트 없음"}`;
}
