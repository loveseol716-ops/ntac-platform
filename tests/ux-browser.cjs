// Uses synthetic data and intercepts every test Supabase request; never writes to production.
const { chromium } = require(
  process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + "/playwright",
);
const assert = require("node:assert/strict");
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const profiles = [
  { id: "admin", full_name: "설재현", role: "owner", ntac_enabled: true },
  { id: "coach", full_name: "김코치", role: "coach", ntac_enabled: false },
  { id: "pt", full_name: "김민수", ntac_enabled: false },
  { id: "ntac", full_name: "이지윤", ntac_enabled: true },
  { id: "both", full_name: "박서연", ntac_enabled: true },
  { id: "pending", full_name: "정하늘", ntac_enabled: false },
].map((p) => ({
  role: "member",
  membership: "NTAC ATHLETE",
  coach_name: "김코치",
  assigned_coach_id: "coach",
  onboarding_completed: true,
  paid_until: "2020-01-01",
  trial_ends_at: "2020-01-01",
  email: `${p.id}@example.invalid`,
  ...p,
}));
const members = [
  {
    id: "m1",
    profile_id: "pt",
    coach_id: "coach",
    active: true,
    goal: "기초 체력 만들기",
    experience: "초급",
  },
  {
    id: "m2",
    profile_id: "both",
    coach_id: "coach",
    active: true,
    goal: "근력 향상",
    experience: "",
  },
];
const packages = [
  {
    id: "pk1",
    member_id: "m1",
    title: "PT 10회",
    total_sessions: 10,
    starts_on: date,
    created_at: date,
  },
  {
    id: "pk2",
    member_id: "m2",
    title: "PT 5회",
    total_sessions: 5,
    starts_on: date,
    created_at: date,
  },
];
const sessions = [
  {
    id: "s1",
    member_id: "m1",
    package_id: "pk1",
    session_date: date,
    start_time: "10:00:00",
    title: "기초 근력",
    status: "completed",
    workout: [],
    feedback: "스쿼트 자세가 안정적이에요.",
    homework: "발목 가동성 연습",
    created_at: date,
  },
  {
    id: "s2",
    member_id: "m2",
    package_id: "pk2",
    session_date: date,
    start_time: "15:00:00",
    title: "근력과 컨디셔닝",
    status: "scheduled",
    workout: [],
    feedback: "",
    homework: "",
    created_at: date,
  },
];
const fixtures = {
  profiles,
  pt_members: members,
  pt_packages: packages,
  pt_sessions: sessions,
  pt_assessments: [],
  pt_session_private: [],
  pt_templates: [],
  weekly_programs: [],
};
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      "/root/.cache/ms-playwright/chromium_headless_shell-1161/chrome-linux/headless_shell",
    headless: true,
  });
  let errors = [];
  async function open(id, width = 1200) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    });
    const user = profiles.find((p) => p.id === id);
    if (user)
      await context.addInitScript(
        ({ user }) => {
          const enc = (o) => btoa(JSON.stringify(o));
          localStorage.setItem(
            "sb-test-auth-token",
            JSON.stringify({
              access_token:
                enc({ alg: "HS256" }) +
                "." +
                enc({
                  sub: user.id,
                  exp: Math.floor(Date.now() / 1000) + 3600,
                }) +
                ".signature",
              refresh_token: "fake",
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              expires_in: 3600,
              token_type: "bearer",
              user: { id: user.id, email: user.email },
            }),
          );
        },
        { user },
      );
    await context.route("https://test.supabase.co/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.pathname.startsWith("/auth/"))
        return route.fulfill({ json: { id: user?.id, email: user?.email } });
      const table = url.pathname.split("/").pop();
      if (table === "set_member_services") {
        const p = req.postDataJSON();
        const u = profiles.find((x) => x.id === p.target_id);
        u.ntac_enabled = p.enable_ntac;
        u.assigned_coach_id = p.coach_id;
        u.coach_name =
          profiles.find((x) => x.id === p.coach_id)?.full_name || "미배정";
        let m = members.find((x) => x.profile_id === u.id);
        if (m) m.active = p.enable_pt;
        return route.fulfill({ json: null });
      }
      if (table === "pt_save_session")
        return route.fulfill({ json: req.postDataJSON().payload.id });
      let rows = structuredClone(fixtures[table] || []);
      for (const [k, v] of url.searchParams)
        if (v.startsWith("eq."))
          rows = rows.filter((r) => String(r[k]) === v.slice(3));
      if (req.headers().accept?.includes("vnd.pgrst.object"))
        return route.fulfill({ json: rows[0] || null });
      return route.fulfill({ json: rows });
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("BROWSER ERROR", e.message);
    });
    await page.goto("http://127.0.0.1:5175/ntac-platform/");
    return { page, context };
  }
  let { page, context } = await open("admin");
  await page.getByRole("heading", { name: "회원과 수업 관리" }).waitFor();
  await page.getByText("김민수", { exact: true }).first().waitFor();
  await page.screenshot({
    path: "/tmp/ntac-admin-desktop.png",
    fullPage: true,
  });
  assert.equal(await page.locator(".roster-row").count(), 2);
  await page.getByRole("button", { name: "배정", exact: true }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("combobox")
    .first()
    .selectOption("both");
  await page.getByRole("button", { name: "배정 저장" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(profiles.find((p) => p.id === "pt").ntac_enabled, true);
  profiles.find((p) => p.id === "pt").ntac_enabled = false;
  await page
    .getByRole("button", { name: "수업 관리", exact: true })
    .first()
    .click();
  await page.getByRole("heading", { name: "김민수님의 PT" }).waitFor();
  await page.getByRole("button", { name: "수업 추가", exact: true }).click();
  await page.screenshot({
    path: "/tmp/ntac-session-desktop.png",
    fullPage: true,
  });
  await context.close();
  ({ page, context } = await open("admin", 390));
  await page.getByRole("heading", { name: "회원과 수업 관리" }).waitFor();
  await page.getByText("김민수", { exact: true }).first().waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile overflow",
  );
  await page.screenshot({ path: "/tmp/ntac-admin-mobile.png", fullPage: true });
  await context.close();
  ({ page, context } = await open("pt", 390));
  await page.getByRole("heading", { name: "김민수님의 PT" }).waitFor();
  await page.getByText("스쿼트 자세가 안정적이에요.").waitFor();
  assert.equal(await page.locator(".service-switch").count(), 0);
  assert(
    !/무료체험|체험 기간|서비스 보기|월 이용료/.test(
      await page.locator("body").innerText(),
    ),
  );
  await page.screenshot({
    path: "/tmp/ntac-member-mobile.png",
    fullPage: true,
  });
  await context.close();
  ({ page, context } = await open("ntac", 390));
  await page.getByText("오늘도 훈련을 이어가세요.").waitFor();
  assert.equal(await page.locator(".service-switch").count(), 0);
  await page.getByRole("button", { name: "마이", exact: true }).click();
  await page.getByRole("heading", { name: "나의 기록" }).waitFor();
  assert(
    !/무료|체험|이용 종료일|서비스 보기|1:1|월 이용료/.test(
      await page.locator("body").innerText(),
    ),
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "/tmp/ntac-my-mobile.png", fullPage: true });
  await context.close();
  ({ page, context } = await open("both", 390));
  await page.locator(".service-switch").waitFor();
  assert.equal(await page.locator(".service-switch button").count(), 2);
  await page
    .locator(".service-switch")
    .getByRole("button", { name: "나의 PT" })
    .click();
  await page.getByRole("heading", { name: "박서연님의 PT" }).waitFor();
  await context.close();
  ({ page, context } = await open(null, 390));
  await page.getByRole("button", { name: "회원 가입", exact: true }).click();
  await page.getByRole("heading", { name: "회원 가입" }).waitFor();
  assert(!/무료|체험|가격/.test(await page.locator("body").innerText()));
  await context.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: admin roster, assignment, editor, 390px overflow, PT/NTAC/both routing, retired UI absent",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
