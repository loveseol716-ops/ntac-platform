const { chromium, webkit } = require(
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
const weeks = [],
  timetable = { id: true, revision: 1, slots: [] },
  maxes = [];
const participants = [],
  walls = [];
let saveFail = false,
  displayTokenAuth = null;
const requests = [];
(async () => {
  const browser = await (
    process.env.BROWSER === "webkit" ? webkit : chromium
  ).launch({
    executablePath:
      process.env.BROWSER === "webkit" ? undefined : process.env.CHROMIUM_PATH,
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
      if (table === "group_timetable") return reply(timetable);
      if (table === "group_weeks")
        return reply(
          weeks.filter(
            (w) =>
              w.status !== "archived" &&
              w.week_start === url.searchParams.get("week_start")?.slice(3),
          ),
        );
      if (table === "group_save_timetable") {
        timetable.slots = body.payload;
        timetable.revision++;
        return reply(null);
      }
      if (table === "group_strength_maxes") return reply(maxes);
      if (table === "group_set_strength_max") {
        maxes.push(body.payload);
        return reply(null);
      }
      if (table === "group_save_week") {
        const w = {
          ...body.payload,
          id: body.payload.id || "week1",
          revision: (body.payload.revision || 0) + 1,
        };
        const index = weeks.findIndex((x) => x.id === w.id);
        if (index < 0) weeks.push(w);
        else weeks[index] = w;
        if (w.status === "published")
          for (const slot of timetable.slots) {
            const d =
              w.program_mode === "class_type"
                ? w.programs.find(
                    (p) =>
                      p.class_type_id === slot.class_type_id &&
                      (p.description?.trim() || p.movements?.length),
                  )
                : w.days.find((d) => d.dow === slot.dow);
            if (!d) continue;
            const at = new Date(`${w.week_start}T${slot.time}:00+09:00`);
            at.setUTCDate(at.getUTCDate() + slot.dow - 1);
            if (
              !classes.some((c) => c.week_id === w.id && c.slot_id === slot.id)
            )
              classes.push({
                ...d,
                id: "wc" + classes.length,
                week_id: w.id,
                slot_id: slot.id,
                starts_at: at.toISOString(),
                duration_minutes: slot.duration_minutes,
                coach_id: slot.coach_id,
                status: "published",
                recording_version: 2,
                revision: 1,
              });
          }
        return reply({ id: w.id, created: 1, updated: 0, kept: 0 });
      }
      if (table === "group_remove_program") {
        if (body.kind === "week")
          weeks.find((w) => w.id === body.target_id).status = "archived";
        if (body.kind === "class") {
          const c = classes.find((c) => c.id === body.target_id);
          c.archived_at = new Date().toISOString();
          c.status = c.status === "ended" ? "ended" : "cancelled";
        }
        return reply(null);
      }
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
        const c = classes.find((c) => c.id === body.cid),
          prev = participants.find(
            (p) => p.class_id === body.cid && p.user_id === id,
          );
        if (prev?.status === "planned" && !body.user_ids)
          prev.status = "active";
        for (const uid of body.user_ids || [id])
          if (
            !participants.some(
              (p) => p.class_id === body.cid && p.user_id === uid,
            )
          )
            participants.push({
              id: "p-" + uid + "-" + body.cid,
              class_id: body.cid,
              user_id: uid,
              name: users.find((u) => u.id === uid).full_name,
              status: c.status === "published" ? "planned" : "active",
              difficulty: "standard",
              revision: 1,
              finalized: false,
              results: {},
              recommendations: Object.fromEntries(
                c.movements.map((m) => [
                  m.id,
                  m.training_type === "strength"
                    ? {
                        weight: 67.5,
                        source: "one_rm",
                        sets: m.sets.map((s, i) => ({
                          ...s,
                          weight: i < 2 ? 67.5 : 72.5,
                          source: "one_rm",
                        })),
                      }
                    : { weight: 40, source: "coach_baseline" },
                ]),
              ),
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
              squat: {
                weight: 30 + i * 2.5,
                source: "coach_baseline",
                sets: classes[0].movements[0].sets?.map((s) => ({
                  ...s,
                  weight: 67.5,
                  source: "one_rm",
                })),
              },
            },
            results: {
              squat: {
                weight: 30 + i * 2.5,
                reps: 8,
                sets: classes[0].movements[0].sets?.map((s) => ({
                  weight: 67.5,
                  reps: s.reps,
                  rir: 3,
                })),
              },
            },
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
      if (table === "group_classes")
        return reply(
          classes.filter(
            (c) =>
              !c.archived_at &&
              new Date(c.starts_at) >=
                new Date(url.searchParams.get("starts_at")?.slice(4) || 0) &&
              (!url.searchParams.getAll("starts_at")[1] ||
                new Date(c.starts_at) <
                  new Date(url.searchParams.getAll("starts_at")[1].slice(3))),
          ),
        );
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
  ({ page, context } = await open("admin", 1024, 1366));
  await page.getByRole("heading", { name: "PT 관리", exact: true }).waitFor();
  await page
    .getByRole("navigation", { name: "관리 메뉴", exact: true })
    .getByRole("button", { name: "그룹수업", exact: true })
    .click();
  await page
    .getByRole("button", { name: "주간 프로그램", exact: true })
    .click();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const controls = await page
      .locator(".g-week-nav button, .g-week-nav input")
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        }),
      );
    assert(
      controls.every((r) => r.x >= 0 && r.right <= width),
      `admin date navigation fits ${width}`,
    );
    assert(
      controls.every((r, i) =>
        controls.every(
          (q, j) =>
            i === j ||
            r.right <= q.x + 1 ||
            q.right <= r.x + 1 ||
            r.bottom <= q.y + 1 ||
            q.bottom <= r.y + 1,
        ),
      ),
      `admin date field and buttons do not overlap ${width}`,
    );
  }
  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.getByRole("button", { name: /^다음 주/ }).click();
  await page.getByRole("button", { name: "반복 시간표 설정" }).click();
  dialog = page.getByRole("dialog");
  assert.equal(await dialog.locator(".g-schedule-slot").count(), 6);
  for (const width of [1024, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      `timetable fits ${width}`,
    );
    assert(
      await dialog
        .locator("input,select")
        .evaluateAll((els) =>
          els.every(
            (el) =>
              el.getBoundingClientRect().right <=
              document.querySelector("dialog[open]").getBoundingClientRect()
                .right -
                8,
          ),
        ),
      `timetable fields fit ${width}`,
    );
  }
  await page.setViewportSize({ width: 1024, height: 1366 });
  await dialog
    .getByRole("button", { name: "시간표 저장", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(timetable.slots.length, 26);
  assert.deepEqual(
    timetable.slots
      .filter((s) => s.dow >= 4 && s.dow !== 5)
      .map((s) => [s.dow, s.time, s.class_type_id]),
    [
      [4, "19:30", "you_in"],
      [6, "10:00", "nolto_team"],
      [7, "10:00", "no_more_weak"],
    ],
  );
  await page.getByRole("button", { name: "+ 이번 주 프로그램 만들기" }).click();
  dialog = page.getByRole("dialog");
  assert.equal(await dialog.locator(".g-type-picker button").count(), 7);
  await dialog.getByRole("button", { name: /^GENTLE STRENGTH/ }).click();
  await dialog.getByRole("button", { name: "+ 핵심 운동 추가" }).click();
  await dialog.getByLabel("표준 종목").selectOption("back_squat");
  assert.equal(
    await dialog.getByLabel("운동 1 1세트 반복 수").inputValue(),
    "10",
  );
  assert.equal(await dialog.getByLabel("운동 1 5세트 RIR").inputValue(), "3");
  await dialog.getByRole("button", { name: /^GENTLE SWEAT/ }).click();
  await dialog.getByLabel("오늘의 프로그램").fill("컨디셔닝 테스트 프로그램");
  await dialog.getByRole("button", { name: /^GENTLE STRENGTH/ }).click();
  assert.equal(await dialog.getByLabel("운동 1 5세트 RIR").inputValue(), "3");
  for (const width of [1024, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      `weekly editor fits ${width}`,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `weekly body fits ${width}`,
    );
  }
  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.screenshot({
    path: "/tmp/ntac-seven-programs.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "저장 · 멤버 공개 · 캘린더 반영" })
    .click();
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(
    weeks[0].programs
      .find((p) => p.class_type_id === "gentle_strength")
      .movements[0].sets.map((s) => s.reps),
    [10, 10, 8, 8, 8],
  );
  assert.equal(classes.filter((c) => c.week_id).length, 12);
  await page.getByRole("button", { name: "수업 운영", exact: true }).click();
  await page
    .getByRole("button", { name: /GENTLE STRENGTH/ })
    .first()
    .waitFor();
  await page.screenshot({
    path: "/tmp/ntac-week-calendar.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: /GENTLE STRENGTH/ })
    .first()
    .click();
  await page.getByRole("button", { name: "참가자 추가", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/이지윤/).check();
  await dialog.getByRole("button", { name: "1명 참가 등록" }).click();
  await dialog.waitFor({ state: "hidden" });
  const wc = classes.find((c) => c.week_id),
    wp = participants.find((p) => p.class_id === wc.id);
  assert.equal(wp.status, "planned");
  await page
    .getByRole("button", { name: "회원 · 기준 중량", exact: true })
    .click();
  await page
    .locator(".g-member-row")
    .filter({ hasText: "이지윤" })
    .getByRole("button", { name: "1RM 설정" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("1RM 중량").fill("100");
  await dialog.getByLabel("확인 근거").fill("테스트 측정");
  await dialog.getByRole("button", { name: "1RM 저장" }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(maxes.length, 1);
  await context.close();
  ({ page, context } = await open("second", 390, 900));
  await page.getByRole("heading", { name: "이지윤님의 오늘 운동" }).waitFor();
  await page
    .getByRole("button", { name: "주간 프로그램", exact: true })
    .click();
  // Plans without class occurrences must still appear, including past weekdays.
  weeks[0].programs.forEach((p) => {
    if (!p.description && !p.movements.length) p.description = "주간 운동 계획";
  });
  await page.getByRole("button", { name: "다음 주", exact: true }).click();
  await page.locator(".g-program-choices button").first().waitFor();
  assert.equal(await page.locator(".g-program-day").count(), 7);
  assert.equal(await page.locator(".g-program-choices button").count(), 11);
  for (const width of [1920, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1080 });
    assert(
      await page
        .locator(".g-program-week")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      `whole program week fits ${width}`,
    );
    assert(
      await page
        .locator(".g-program-choices button")
        .evaluateAll((els) =>
          els.every((el) => el.scrollWidth <= el.clientWidth),
        ),
      `program names fit ${width}`,
    );
    const rects = await page.locator(".g-program-day").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
    assert(
      rects.every((r, i) =>
        rects.every(
          (q, j) =>
            i === j ||
            r.x + r.width <= q.x + 1 ||
            q.x + q.width <= r.x + 1 ||
            r.y + r.height <= q.y + 1 ||
            q.y + q.height <= r.y + 1,
        ),
      ),
      `weekday panels do not overlap ${width}`,
    );
    if (width === 390 || width === 1920)
      await page.screenshot({
        path: `/tmp/ntac-program-week-${width}.png`,
        fullPage: true,
      });
  }
  await page
    .locator(".g-program-day")
    .first()
    .getByRole("button", { name: /GENTLE STRENGTH/ })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByText(/10–10–8–8–8회/).waitFor();
  assert(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    "program detail fits phone",
  );
  await dialog.getByRole("button", { name: "이 날짜 수업 보기" }).click();
  await page.locator(".g-selected-classes .g-class-card").first().waitFor();
  assert.equal(
    await page
      .locator(".g-month-day[aria-pressed=true]")
      .getAttribute("data-date"),
    weeks[0].week_start,
  );
  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1080 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `member body fits ${width}`,
    );
    const cells = await page.locator(".g-month-day").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
        };
      }),
    );
    assert(
      cells.length >= 28 && cells.length <= 42 && cells.length % 7 === 0,
      "complete month grid",
    );
    assert(
      cells.slice(0, 7).every((c) => Math.abs(c.y - cells[0].y) < 1),
      `seven weekdays on one row ${width}`,
    );
    assert(
      cells.every((r, i) =>
        cells.every(
          (q, j) =>
            i === j ||
            r.right <= q.x + 1 ||
            q.right <= r.x + 1 ||
            r.bottom <= q.y + 1 ||
            q.bottom <= r.y + 1,
        ),
      ),
      `calendar cells do not overlap ${width}`,
    );
    if (width <= 390)
      assert(
        cells.at(-1).bottom - cells[0].y <= 400,
        `month is compact ${width}`,
      );
    assert(
      await page
        .locator(".g-class-card")
        .evaluateAll((els) =>
          els.every((el) => el.scrollWidth <= el.clientWidth),
        ),
      `class cards fit ${width}`,
    );
    assert(
      await page
        .locator(".g-clock")
        .evaluateAll((els) =>
          els.every(
            (el) =>
              el.getBoundingClientRect().height <
              parseFloat(getComputedStyle(el).lineHeight) * 1.2,
          ),
        ),
      `time stays on one line ${width}`,
    );
    const nav = await page
      .locator(".g-calendar-toolbar button")
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        }),
      );
    assert(
      nav.every((r, i) =>
        nav.every(
          (q, j) =>
            i === j ||
            r.right <= q.x + 1 ||
            q.right <= r.x + 1 ||
            r.bottom <= q.y + 1 ||
            q.bottom <= r.y + 1,
        ),
      ),
      `calendar controls do not overlap ${width}`,
    );
    if (width === 1920 || width === 390)
      await page.screenshot({
        path: `/tmp/ntac-calendar-${width}.png`,
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("button", { name: "주간", exact: true }).click();
  assert.equal(await page.locator(".g-month-day").count(), 7);
  await page.getByRole("button", { name: "월간", exact: true }).click();
  await page.getByRole("button", { name: "다음 달", exact: true }).click();
  await page.locator(".g-month-calendar[aria-busy=false]").waitFor();
  assert.equal(
    await page.locator(".g-selected-classes .g-class-card").count(),
    0,
    "no stale class cards after month change",
  );
  await page.getByRole("button", { name: "이전 달", exact: true }).click();
  await page
    .locator(`.g-month-day[data-date="${weeks[0].week_start}"]`)
    .click();
  await page
    .locator(".g-selected-classes")
    .getByRole("button", { name: /GENTLE STRENGTH/ })
    .first()
    .click();
  await page.getByText("참가 예정이에요.", { exact: false }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "기록 입력", exact: true }).count(),
    0,
  );
  // Advance mocked class lifecycle; production timing/eligibility is covered by PostgreSQL tests.
  wc.status = "open";
  await page.reload();
  await page
    .getByRole("button", { name: "주간 프로그램", exact: true })
    .click();
  await page.getByRole("button", { name: "다음 주", exact: true }).click();
  await page
    .locator(".g-program-day")
    .first()
    .getByRole("button", { name: /GENTLE STRENGTH/ })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "이 날짜 수업 보기" })
    .click();
  await page
    .locator(".g-selected-classes")
    .getByRole("button", { name: /GENTLE STRENGTH/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "오늘 운동 시작", exact: true })
    .click();
  await page.getByRole("button", { name: "기록 입력", exact: true }).click();
  dialog = page.getByRole("dialog");
  assert.equal(
    await dialog
      .getByLabel("백 스쿼트 1세트 실제 중량 (kg)", { exact: true })
      .inputValue(),
    "",
  );
  await dialog
    .getByRole("button", { name: "1세트 추천대로 수행", exact: true })
    .click();
  await dialog.getByLabel("백 스쿼트 1세트 실제 RIR (선택)").fill("3");
  await dialog.getByRole("button", { name: "운동 완료", exact: true }).click();
  await dialog.getByRole("alert").filter({ hasText: "RPE" }).waitFor();
  await dialog.getByLabel("수업 전체 RPE", { exact: true }).selectOption("7");
  saveFail = true;
  await dialog.getByRole("button", { name: "운동 완료", exact: true }).click();
  await dialog
    .getByRole("alert")
    .filter({ hasText: "저장 테스트 오류" })
    .waitFor();
  assert.equal(
    await dialog
      .getByLabel("백 스쿼트 1세트 실제 중량 (kg)", { exact: true })
      .inputValue(),
    "67.5",
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "/tmp/ntac-strength-record.png",
    fullPage: true,
  });
  saveFail = false;
  await dialog.getByRole("button", { name: "운동 완료", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(wp.session_rpe, 7);
  assert.equal(wp.results[wc.movements[0].id].sets[0].rir, 3);
  assert.equal(wp.results[wc.movements[0].id].sets[1].weight, undefined);
  await context.close();
  ({ page, context } = await open("admin", 1024, 1366));
  await page.getByRole("heading", { name: "PT 관리", exact: true }).waitFor();
  await page
    .getByRole("navigation", { name: "관리 메뉴", exact: true })
    .getByRole("button", { name: "그룹수업", exact: true })
    .click();
  await page.getByRole("button", { name: /^다음 주/ }).click();
  await page
    .getByRole("button", { name: /GENTLE STRENGTH/ })
    .first()
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "프로그램 삭제", exact: true })
    .click();
  await page
    .getByText("수업 프로그램을 삭제했어요.", { exact: true })
    .waitFor();
  assert(wc.archived_at);
  assert.equal(wp.session_rpe, 7);
  await context.close();
  console.log(
    "PASS: weekly program publication/calendar, planned roster, 1RM entry, 5-set actual inputs, final RPE, failure retention and deletion UI",
  );
  classes[0].movements = [{ ...wc.movements[0], id: "squat" }];
  for (const kind of ["r", "s"]) {
    ({ page, context } = await open(
      null,
      1920,
      1080,
      "#display=" + kind.repeat(72),
    ));
    await page.locator(".tv-grid article").first().waitFor();
    if (kind === "r")
      assert.equal(await page.locator(".tv-set-values > span").count(), 45);
    assert(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
      "set TV fits 1080p",
    );
    assert(
      await page
        .locator(".tv-value")
        .evaluateAll((els) =>
          els.every((el) => el.scrollWidth <= el.clientWidth),
        ),
      "strength text fits each TV card",
    );
    await page.screenshot({
      path: `/tmp/ntac-strength-tv-${kind}.png`,
      fullPage: true,
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: member join, actual-only inputs, save failure retention, completion, admin bulk join, finalize, create/publish, two TV links, anonymous TV auth and mobile/1080p layout",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
