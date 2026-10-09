// From web: NTAC_TEST_MODULES=/path/to/node_modules node ../tests/pt-ui.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(new URL("../web/package.json", import.meta.url));
const { JSDOM } = require(process.env.NTAC_TEST_MODULES + "/jsdom");
const dom = new JSDOM('<div id="root"></div>', {
  url: "http://localhost/ntac-platform/",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
});
window.confirm = () => true;
const React = require("react"),
  { createRoot } = require("react-dom/client"),
  { act } = React;
process.env.VITE_SUPABASE_URL = "https://test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-key";
const { createServer } = await import(
  "../web/node_modules/vite/dist/node/index.js"
);
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { supabase } = await server.ssrLoadModule("/src/lib/supabase.js");
  const { today } = await server.ssrLoadModule("/src/pt/model.js");
  const db = {
    profiles: [
      {
        id: "u1",
        full_name: "테스트 회원",
        email: "test@example.invalid",
        membership: "PT",
      },
    ],
    pt_members: [
      { id: "m1", profile_id: "u1", goal: "기초 체력", experience: "", active: true },
    ],
    pt_packages: [
      {
        id: "p1",
        member_id: "m1",
        title: "PT 10회",
        total_sessions: 10,
        starts_on: today(),
        expires_on: null,
      },
    ],
    pt_sessions: [],
    pt_session_private: [],
    pt_assessments: [],
    pt_templates: [],
  };
  let saved;
  supabase.from = (table) => {
    let filters = [],
      one = false;
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        filters.push([k, v]);
        return q;
      },
      order() {
        return q;
      },
      single() {
        one = true;
        return q;
      },
      maybeSingle() {
        one = true;
        return q;
      },
      then(resolve) {
        let rows = db[table].filter((r) =>
          filters.every(([k, v]) => r[k] === v),
        );
        return Promise.resolve({
          data: one ? rows[0] || null : rows,
          error: null,
        }).then(resolve);
      },
    };
    return q;
  };
  supabase.rpc = async (name, { payload }) => {
    saved = payload;
    db.pt_sessions = [{ ...payload, created_at: new Date().toISOString() }];
    db.pt_session_private = [
      { session_id: payload.id, member_id: "m1", note: payload.private_note },
    ];
    return { data: payload.id, error: null };
  };
  const PTAdmin = (await server.ssrLoadModule("/src/pt/PTAdmin.jsx")).default;
  const PTMember = (await server.ssrLoadModule("/src/pt/PTMember.jsx")).default;
  const root = createRoot(document.getElementById("root"));
  await act(async () => {
    root.render(React.createElement(PTAdmin, { initialMemberId: "m1", isAdmin: true }));
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.match(document.body.textContent, /10회/);
  const btn = (text) =>
    [...document.querySelectorAll("button")].find(
      (b) => b.textContent === text,
    );
  await act(async () => btn("수업 추가").click());
  assert.match(document.body.textContent, /Half Kneeling Ankle Rock/);
  assert.match(document.body.textContent, /DB Man Maker/);
  const labelInput = (text) =>
    [...document.querySelectorAll("label")]
      .find((l) => l.textContent.startsWith(text))
      .querySelector("input,textarea,select");
  async function setValue(e, value) {
    await act(async () => {
      const proto =
        e.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(e, value);
      e.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  }
  await setValue(labelInput("회원에게 전할 피드백"), "자세가 안정적입니다.");
  await setValue(labelInput("코치 비공개 메모"), "SECRET COACH NOTE");
  const status = labelInput("수업 상태");
  await act(async () => {
    status.value = "completed";
    status.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await act(async () => {
    btn("수업 저장")
      .closest("form")
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.equal(saved.status, "completed");
  assert.equal(saved.workout.length, 10);
  assert.equal(saved.package_id, "p1");
  assert.equal(saved.feedback, "자세가 안정적입니다.");
  assert.equal(saved.private_note, "SECRET COACH NOTE");
  assert.match(document.body.textContent, /9회/);
  await act(async () => {
    root.render(React.createElement(PTMember, { profile: db.profiles[0] }));
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.match(document.body.textContent, /자세가 안정적입니다/);
  assert.doesNotMatch(document.body.textContent, /SECRET COACH NOTE/);
  assert.match(document.body.textContent, /9회/);
  await act(async () => root.unmount());
  console.log(
    "PASS: admin member detail, template, input, session save, refreshed balance, member summary",
  );
} finally {
  await server.close();
}

process.exit(0);
