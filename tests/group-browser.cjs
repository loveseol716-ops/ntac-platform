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
const users = [
  { id: "admin", role: "owner", full_name: "설재현", ntac_enabled: true },
  { id: "member", role: "member", full_name: "김민수", ntac_enabled: false },
  { id: "second", role: "member", full_name: "이지윤", ntac_enabled: false },
].map((u) => ({
  ...u,
  email: u.id + "@example.invalid",
  membership: "PT",
  onboarding_completed: true,
}));
const movement = {
  id: "squat",
  exercise_id: "back_squat",
  label: "백 스쿼트",
  kind: "weight",
  unit: "kg",
  load_basis: "total",
  target_reps: 8,
};
const classes = [
  {
    id: "c1",
    title: "하체 스트렝스 & 컨디셔닝",
    starts_at: `${date}T10:00:00+09:00`,
    duration_minutes: 50,
    coach_id: "admin",
    description:
      "Warm-up\n가벼운 움직임 5분\n\nMain\n백 스쿼트 8회 × 3세트\n\nFinisher\n코치 안내에 따라 마무리",
    movements: [movement],
    status: "open",
    program_version: 1,
    revision: 1,
  },
];
const members = {
  member: {
    user_id: "member",
    active: true,
    nickname: "민수",
    show_on_tv: true,
  },
  second: {
    user_id: "second",
    active: true,
    nickname: "지윤",
    show_on_tv: false,
  },
};
const participants = [],
  walls = [];
let saveFail = false,
  displayTokenAuth = null;
const requests = [];
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
  });
  let errors = [];
  async function open(id, width = 390, height = 900, hash = "") {
    const context = await browser.newContext({ viewport: { width, height } });
    const user = users.find((u) => u.id === id);
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
              user,
            }),
          );
        },
        { user },
      );
    await context.route("https://test.supabase.co/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        table = url.pathname.split("/").pop(),
        body = req.method() === "POST" ? req.postDataJSON() : null;
      requests.push(table);
      if (url.pathname.includes("/auth/"))
        return route.fulfill({ json: user || {} });
      const reply = (data) => route.fulfill({ json: data });
      if (table === "group_bootstrap")
        return reply({
          member: members[id] || null,
          has_history: participants.some((p) => p.user_id === id),
        });
      if (table === "group_directory")
        return reply(
          users.map((u) => ({
            id: u.id,
            name: u.full_name,
            email: u.email,
            role: u.role,
            active: !!members[u.id]?.active,
          })),
        );
      if (table === "group_set_member") {
        members[body.target_id] = {
          ...(members[body.target_id] || {}),
          active: body.enabled,
        };
        return reply(null);
      }
      if (table === "group_detail")
        return reply({
          class: classes.find((c) => c.id === body.cid),
          can_manage: id === "admin",
          participants: participants.filter(
            (p) =>
              p.class_id === body.cid && (id === "admin" || p.user_id === id),
          ),
        });
      if (table === "group_join") {
        for (const uid of body.user_ids || [id])
          if (
            !participants.some(
              (p) => p.class_id === body.cid && p.user_id === uid,
            )
          )
            participants.push({
              id: "p-" + uid,
              class_id: body.cid,
              user_id: uid,
              name: users.find((u) => u.id === uid).full_name,
              status: "active",
              difficulty: "standard",
              revision: 1,
              finalized: false,
              results: {},
              recommendations: {
                squat: { weight: 40, source: "coach_baseline" },
              },
              ...{
                nickname: members[uid]?.nickname,
                show_on_tv: members[uid]?.show_on_tv,
              },
            });
        return reply({ added: 1, existing: 0 });
      }
      if (table === "group_save_participant") {
        if (saveFail)
          return route.fulfill({
            status: 400,
            json: { message: "저장 테스트 오류" },
          });
        const p = participants.find((p) => p.id === body.pid);
        if (p.revision !== body.expected_revision)
          return route.fulfill({
            status: 400,
            json: { message: "다른 기기에서 기록이 바뀌었어요." },
          });
        Object.assign(p, body.payload, { revision: p.revision + 1 });
        return reply(null);
      }
      if (table === "group_save_class") {
        const cid = body.payload.id || "c" + (classes.length + 1);
        classes.push({
          ...body.payload,
          id: cid,
          status: "draft",
          revision: 1,
          program_version: 1,
        });
        return reply(cid);
      }
      if (table === "group_set_class_status") {
        const c = classes.find((c) => c.id === body.cid);
        c.status = body.next_status;
        c.revision++;
        return reply(null);
      }
      if (table === "group_create_wall") {
        const w = { id: "w1", title: "메인 운동장" };
        walls.push(w);
        return reply({
          ...w,
          recommendations: "r".repeat(72),
          results: "s".repeat(72),
        });
      }
      if (table === "group_control_wall") {
        Object.assign(
          walls.find((w) => w.id === body.wid),
          { class_id: body.cid, movement_id: body.mid },
        );
        return reply(null);
      }
      if (table === "group_display") {
        displayTokenAuth = req.headers().authorization;
        return reply({
          kind: body.display_token.startsWith("s")
            ? "results"
            : "recommendations",
          wall: "메인 운동장",
          class: classes[0],
          movement_id: "squat",
          participants: Array.from({ length: 10 }, (_, i) => ({
            id: "tv" + i,
            name: [
              "민수",
              "지윤",
              "서연",
              "재현",
              "예진",
              "민호",
              "하늘",
              "도윤",
              "지호",
              "수빈",
            ][i],
            difficulty: i % 3 === 0 ? "foundation" : "standard",
            status: "completed",
            finalized: true,
            recommendations: {
              squat: { weight: 30 + i * 2.5, source: "coach_baseline" },
            },
            results: { squat: { weight: 30 + i * 2.5, reps: 8 } },
          })),
        });
      }
      if (table === "profiles") {
        const uid = url.searchParams.get("id")?.slice(3);
        const rows = uid ? users.filter((u) => u.id === uid) : users;
        return reply(req.headers().accept?.includes("object") ? rows[0] : rows);
      }
      if (table === "pt_members")
        return reply(req.headers().accept?.includes("object") ? null : []);
      if (table === "group_classes") return reply(classes);
      if (table === "group_participants")
        return reply(
          participants
            .filter((p) => p.user_id === id)
            .map((p) => ({
              ...p,
              group_classes: classes.find((c) => c.id === p.class_id),
            })),
        );
      if (table === "group_exercises")
        return reply([
          { id: "back_squat", name: "백 스쿼트" },
          { id: "rowing", name: "로잉" },
        ]);
      if (table === "group_walls") return reply(walls);
      return reply([]);
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5175/ntac-platform/" + hash);
    return { page, context };
  }
  let { page, context } = await open("member");
  await page.getByRole("heading", { name: "김민수님의 오늘 운동" }).waitFor();
  assert.equal(
    await page.getByRole("navigation", { name: "이용 프로그램" }).count(),
    0,
  );
  await page.getByRole("button", { name: /하체 스트렝스/ }).click();
  await page
    .getByRole("button", { name: "오늘 운동 시작", exact: true })
    .click();
  await page.getByRole("button", { name: "기록 입력", exact: true }).waitFor();
  assert.equal(participants.length, 1);
  await page.screenshot({ path: "/tmp/ntac-group-member.png", fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile no horizontal overflow",
  );
  await page.getByRole("button", { name: "기록 입력", exact: true }).click();
  let dialog = page.getByRole("dialog");
  assert.equal(
    await dialog.getByLabel("백 스쿼트 kg").inputValue(),
    "",
    "recommendation must not prefill actual result",
  );
  await dialog.getByLabel("백 스쿼트 kg").fill("42.5");
  await dialog.getByLabel("백 스쿼트 실제 반복 수").fill("8");
  saveFail = true;
  await dialog.getByRole("button", { name: "운동 완료", exact: true }).click();
  await dialog
    .getByRole("alert")
    .filter({ hasText: "저장 테스트 오류" })
    .waitFor();
  assert.equal(await dialog.getByLabel("백 스쿼트 kg").inputValue(), "42.5");
  assert.equal(participants[0].status, "active");
  saveFail = false;
  await dialog.getByRole("button", { name: "운동 완료", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(participants[0].status, "completed");
  assert.equal(participants[0].results.squat.weight, 42.5);
  assert(!requests.includes("pt_set_session_status"));
  await context.close();
  ({ page, context } = await open("admin", 1200));
  await page.getByRole("heading", { name: "PT 관리", exact: true }).waitFor();
  await page
    .getByRole("navigation", { name: "관리 메뉴", exact: true })
    .getByRole("button", { name: "그룹수업", exact: true })
    .click();
  await page.getByRole("button", { name: /하체 스트렝스/ }).click();
  await page.getByRole("button", { name: "참가자 추가", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/이지윤/).check();
  await dialog.getByRole("button", { name: "1명 참가 등록" }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(participants.length, 2);
  await page.screenshot({ path: "/tmp/ntac-group-admin.png", fullPage: true });
  const card = page.locator(".g-person").filter({ hasText: "김민수" });
  await card.getByRole("button", { name: "기록 · 추천 조정" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "완료 · 기록 확정" })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert(participants[0].finalized);
  await page.getByRole("button", { name: "← 수업 목록", exact: true }).click();
  await page.getByRole("button", { name: "+ 수업 만들기" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("수업명", { exact: true }).fill("새 스트렝스 수업");
  await dialog
    .getByLabel("오늘의 프로그램", { exact: true })
    .fill("오늘 프로그램");
  await dialog.getByRole("button", { name: "+ 핵심 운동 추가" }).click();
  await dialog.getByLabel("표준 종목").selectOption("back_squat");
  await dialog
    .getByRole("button", { name: "프로그램 저장", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(classes.length, 2);
  await page
    .getByRole("button", { name: "프로그램 공개", exact: true })
    .click();
  await page
    .getByRole("button", { name: "참가 접수 열기", exact: true })
    .waitFor();
  assert.equal(classes[1].status, "published");
  await page.getByRole("button", { name: "TV 연결", exact: true }).click();
  page.once("dialog", (d) => d.accept("메인 운동장"));
  await page.getByRole("button", { name: "+ TV 연결 만들기" }).click();
  await page.getByLabel("TV 1 · 추천 중량 링크").waitFor();
  assert.match(
    await page.getByLabel("TV 2 · 결과 보드 링크").inputValue(),
    /#display=ssss/,
  );
  await context.close();
  ({ page, context } = await open(
    "admin",
    1920,
    1080,
    "#display=" + "r".repeat(72),
  ));
  await page.getByText("TRAINING GUIDE", { exact: true }).waitFor();
  await page.locator(".tv-grid article").first().waitFor();
  assert.equal(await page.locator(".tv-grid article").count(), 9);
  assert.equal(
    displayTokenAuth,
    "Bearer test-key",
    "TV must not reuse staff JWT",
  );
  await page.screenshot({
    path: "/tmp/ntac-group-tv-recommendations.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
    "TV fits 1080p",
  );
  await context.close();
  ({ page, context } = await open(
    null,
    1920,
    1080,
    "#display=" + "s".repeat(72),
  ));
  await page.getByText("TODAY’S RESULTS", { exact: true }).waitFor();
  await page.locator(".tv-grid article").first().waitFor();
  await page.screenshot({
    path: "/tmp/ntac-group-tv-results.png",
    fullPage: true,
  });
  await context.close();
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: member join, actual-only inputs, save failure retention, completion, admin bulk join, finalize, create/publish, two TV links, anonymous TV auth and mobile/1080p layout",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
