import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(new URL("../web/package.json", import.meta.url));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createServer } = await import(require.resolve("vite"));
process.env.VITE_SUPABASE_URL = "https://test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-key";
const server = await createServer({ root: new URL("../web", import.meta.url).pathname, server: { middlewareMode: true }, appType: "custom" });
try {
  const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
  const Name = (await server.ssrLoadModule("/src/RequiredMemberName.jsx")).default;
  const Delete = (await server.ssrLoadModule("/src/management/DeleteMemberDialog.jsx")).default;
  const Directory = (await server.ssrLoadModule("/src/management/MemberDirectory.jsx")).default;
  const name = render(Name, {});
  assert(name.includes("이름을 알려주세요") && name.includes("required=\"\"") && name.includes("maxLength=\"80\""));
  assert(!name.includes("나중에") && !name.includes("건너뛰기"));
  const member = { id: "member", email: "member@example.invalid", role: "member", full_name: "" };
  const deletion = render(Delete, { member });
  assert(deletion.includes("회원 계정 삭제") && deletion.includes("member@example.invalid") && deletion.includes("disabled=\"\""));
  assert(deletion.includes("복구할 수 없으며") && deletion.includes("수업 기록"));
  const directory = render(Directory, { rows: [{ p: member, services: {} }, { p: { ...member, id: "owner", role: "owner", full_name: "설재현" }, services: {} }], coaches: [], onDelete() {} });
  assert.equal((directory.match(/>계정 삭제</g) || []).length, 1);
  assert(directory.includes("이름 입력 필요") && directory.includes("이름 미입력"));
  console.log("PASS: required name form without skip; irreversible deletion warning, disabled confirmation and member-only deletion controls");
} finally { await server.close(); }
