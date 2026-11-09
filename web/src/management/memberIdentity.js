export const normalizeMemberName = (value) => String(value || "").replace(/\s+/gu, " ").trim();
export function needsMemberName(value) {
  const name = normalizeMemberName(value);
  return name.length < 2 || name.length > 80 || !/\p{L}/u.test(name) ||
    ["이름없음", "회원", "unknown", "undefined", "null"].includes(name.replace(/\s/gu, "").toLowerCase());
}
