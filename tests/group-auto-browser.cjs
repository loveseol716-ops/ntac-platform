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
const frozen = new Date(`${date}T15:29:59+09:00`).getTime();
classes[0].starts_at = `${date}T16:00:00+09:00`;
classes[0].status = "published";
let screenClass = classes[0];
const addDate = (d, n) =>
  new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86400000)
    .toISOString()
    .slice(0, 10);
const monday = addDate(
  date,
  -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7),
);
const cutoff = addDate(monday, -7);
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
    const context = await browser.newContext({
      viewport: { width, height },
      timezoneId: "Asia/Seoul",
    });
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
      if (table === "group_display") {
        return reply({
          kind: body.display_token.startsWith("s")
            ? "results"
            : "recommendations",
          wall: "메인 운동장",
          class: screenClass,
          movement_id: screenClass.movements[0]?.id,
          movement_index: 0,
          automatic: true,
          participants: participants
            .filter(
              (p) =>
                p.class_id === screenClass.id && members[p.user_id]?.show_on_tv,
            )
            .map((p) => ({ ...p, name: members[p.user_id].nickname })),
        });
      }
      if (table === "group_timetable") return reply(timetable);
      if (table === "group_weeks") {
        const exact = url.searchParams.get("week_start")?.startsWith("eq.");
        let data = weeks.filter(
          (w) =>
            (!exact ||
              w.week_start === url.searchParams.get("week_start").slice(3)) &&
            (!url.searchParams.has("status") || w.status !== "archived") &&
            (id === "admin" || w.week_start >= cutoff),
        );
        const search = url.searchParams.get("title");
        if (search)
          data = data.filter((w) => w.title.includes(search.slice(7, -1)));
        return route.fulfill({
          json: data,
          headers: {
            "access-control-expose-headers": "content-range",
            "content-range": `0-${Math.max(0, data.length - 1)}/${data.length}`,
          },
        });
      }
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
          program_visible_from: cutoff,
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
              status: "active",
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
      if (table === "group_classes") {
        const ranges = url.searchParams.getAll("starts_at");
        const data = classes.filter(
          (c) =>
            (!url.searchParams.has("archived_at") || !c.archived_at) &&
            (id === "admin" || c.starts_at.slice(0, 10) >= cutoff) &&
            ranges.every((v) =>
              v.startsWith("gte.")
                ? new Date(c.starts_at) >= new Date(v.slice(4))
                : new Date(c.starts_at) < new Date(v.slice(3)),
            ),
        );
        return route.fulfill({
          json: data,
          headers: {
            "access-control-expose-headers": "content-range",
            "content-range": `0-${Math.max(0, data.length - 1)}/${data.length}`,
          },
        });
      }
      if (table === "group_participants" || table === "group_my_history")
        return reply(
          participants
            .filter((p) => p.user_id === id)
            .map((p) => ({
              ...p,
              group_classes: (() => {
                const c = classes.find((c) => c.id === p.class_id);
                return {
                  ...c,
                  program_hidden: c.starts_at.slice(0, 10) < cutoff,
                  description: undefined,
                  movements: c.movements.map(
                    ({ id, label, kind, unit, exercise_id }) => ({
                      id,
                      label,
                      kind,
                      unit,
                      exercise_id,
                    }),
                  ),
                };
              })(),
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
    await page.clock.install({ time: new Date(frozen) });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5175/ntac-platform/" + hash);
    return { page, context };
  }

  let { page, context } = await open("member", 390, 900);
  page.setDefaultTimeout(12000);
  await page.getByRole("button", { name: /하체 스트렝스/ }).click();
  assert.equal(
    await page.getByRole("button", { name: "수업 참여", exact: true }).count(),
    0,
  );
  await page.clock.fastForward(2000);
  await page.getByRole("button", { name: "수업 참여", exact: true }).waitFor();
  await page.getByRole("button", { name: "수업 참여", exact: true }).click();
  await page.getByRole("button", { name: "기록 입력", exact: true }).waitFor();
  assert.equal(participants[0].status, "active");
  assert.equal(
    await page
      .getByRole("button", { name: "운동 마무리 · RPE", exact: true })
      .count(),
    0,
  );
  await page.clock.fastForward(30 * 60000);
  assert.equal(
    await page.locator(".g-heading .g-badge").first().innerText(),
    "진행 중",
  );
  await page.screenshot({ path: "/tmp/ntac-auto-member.png", fullPage: true });
  await context.close();
  ({ page, context } = await open("admin", 390, 900));
  page.setDefaultTimeout(12000);
  await page
    .getByRole("navigation", { name: "관리 메뉴", exact: true })
    .getByRole("button", { name: "그룹수업", exact: true })
    .click();
  await page.getByRole("button", { name: /하체 스트렝스/ }).click();
  await page.clock.fastForward(2000);
  await page.getByRole("button", { name: "멤버 입장", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", {
        name: /^(참가 접수 열기|수업 시작|수업 종료|이 수업을 두 화면에 송출)$/,
      })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "템플릿 저장", exact: true })
      .isVisible(),
    false,
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `admin fits ${width}`,
    );
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `/tmp/ntac-auto-admin-${width}.png`,
        fullPage: true,
      });
  }
  await page.getByRole("button", { name: "멤버 입장", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(/이지윤/).check();
  await dialog.getByRole("button", { name: "1명 입장", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(participants.length, 2);
  assert(participants.every((p) => p.status === "active"));
  await page.getByRole("button", { name: "TV 연결", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "대기 화면으로" }).count(),
    0,
  );
  assert.equal(await page.getByRole("button", { name: /송출/ }).count(), 0);
  await page.screenshot({
    path: "/tmp/ntac-auto-tv-setup.png",
    fullPage: true,
  });
  await context.close();
  for (const token of ["r".repeat(72), "s".repeat(72)]) {
    ({ page, context } = await open(null, 1920, 1080, "#display=" + token));
    page.setDefaultTimeout(12000);
    await page.getByRole("heading", { name: "민수", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("heading", { name: "지윤", exact: true }).count(),
      0,
      "private member stays hidden",
    );
    await page.screenshot({
      path: `/tmp/ntac-auto-tv-${token[0]}.png`,
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
    const previous = screenClass;
    screenClass = {
      ...classes[0],
      id: "next-auto",
      title: "다음 수업 자동 전환",
      status: "live",
    };
    await page.clock.fastForward(6000);
    await page
      .getByRole("heading", { name: "다음 수업 자동 전환", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("heading", { name: "민수", exact: true }).count(),
      0,
      "old roster cleared after automatic switch",
    );
    screenClass = previous;
    await context.close();
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: arrival/start clock boundaries, one-tap member and coach entry, no lifecycle or TV controls, private names, TV polling and responsive layouts",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
