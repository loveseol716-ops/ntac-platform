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
const tomorrow = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() + 86400000));
const slots = [
  {
    id: "slot1",
    coach_id: "coach",
    starts_at: `${tomorrow}T10:00:00+09:00`,
    ends_at: `${tomorrow}T11:00:00+09:00`,
    is_open: true,
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
    notes: "스쿼트 자세가 안정적이에요.",
    warm_up: "발목 모빌리티",
    main: "스쿼트",
    coach_id: "coach",
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
const applied = [];
const savedDefaults = [];
const fixtures = {
  pt_availability_defaults: savedDefaults,
  pt_slots: slots,
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
      if (table === "pt_apply_availability") {
        applied.push(req.postDataJSON());
        return route.fulfill({ json: { opened: 10 } });
      }
      if (table === "pt_availability_defaults" && req.method() === "POST") {
        savedDefaults.push(req.postDataJSON());
        return route.fulfill({ json: null });
      }
      if (table === "pt_open_slots")
        return route.fulfill({
          json: slots.filter(
            (s) =>
              s.is_open &&
              !sessions.some(
                (x) => x.slot_id === s.id && x.status !== "cancelled",
              ),
          ),
        });
      if (table === "ntac_save_profile") {
        const p = req.postDataJSON();
        Object.assign(
          profiles.find((x) => x.id === p.target_id),
          p.payload,
        );
        return route.fulfill({ json: null });
      }
      if (table === "ntac-admin-password")
        return route.fulfill({ json: { success: true } });
      if (table === "pt_save_package") {
        const p = req.postDataJSON().payload;
        const old = packages.find((x) => x.id === p.id);
        if (old) Object.assign(old, p);
        else packages.push({ ...p, created_at: date });
        return route.fulfill({ json: p.id });
      }
      if (table === "pt_change_booking") {
        const p = req.postDataJSON(),
          session = sessions.find((x) => x.id === p.sid);
        if (p.target_slot) {
          const sl = slots.find((x) => x.id === p.target_slot);
          Object.assign(session, { slot_id: sl.id, start_time: "12:00:00" });
        } else session.status = "cancelled";
        return route.fulfill({ json: p.sid });
      }
      if (table === "pt_book_slot") {
        const sl = slots.find((s) => s.id === req.postDataJSON().slot);
        const member = members.find((m) => m.profile_id === user.id);
        sessions.push({
          id: "booked",
          member_id: member.id,
          package_id: "pk1",
          coach_id: sl.coach_id,
          session_date: tomorrow,
          start_time: "10:00:00",
          status: "scheduled",
          slot_id: sl.id,
          created_at: date,
        });
        return route.fulfill({ json: "booked" });
      }
      if (table === "pt_save_simple_session") {
        const p = req.postDataJSON().payload;
        let session = sessions.find((s) => s.id === p.id);
        if (session) Object.assign(session, p);
        else
          sessions.push({
            ...p,
            status: "scheduled",
            package_id: "pk1",
            coach_id: "coach",
            created_at: date,
          });
        return route.fulfill({ json: p.id });
      }
      if (table === "pt_set_session_status") {
        const p = req.postDataJSON();
        sessions.find((s) => s.id === p.sid).status = p.new_status;
        return route.fulfill({ json: null });
      }
      if (table === "pt_slots" && req.method() === "POST") {
        slots.push(
          ...req
            .postDataJSON()
            .map((s, i) => ({ ...s, id: `newslot${i}`, is_open: true })),
        );
        return route.fulfill({ json: null });
      }
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
  await page.getByLabel("캘린더 코치").selectOption("coach");
  await page.screenshot({
    path: "/tmp/ntac-admin-desktop.png",
    fullPage: true,
  });
  assert.equal(await page.locator(".roster-row").count(), 2);
  await page.getByRole("button", { name: tomorrow, exact: true }).click();
  await page.getByText("예약 가능 시간 설정", { exact: true }).click();
  await page.getByLabel("평일 시작", { exact: true }).fill("10:00");
  await page.getByLabel("평일 종료", { exact: true }).fill("18:00");
  await page.getByRole("button", { name: "기본값 저장", exact: true }).click();
  await page
    .getByText(
      "평일·주말 기본 시간을 저장했어요. 원하는 기간을 선택해 적용해 주세요.",
    )
    .waitFor();
  assert.equal(savedDefaults[0].weekday_start, "10:00");
  await page
    .getByRole("button", { name: "선택한 주에 적용", exact: true })
    .click();
  await page
    .locator(".bulk-availability .pt-success")
    .filter({ hasText: "설정을 적용했어요." })
    .waitFor();
  assert.equal(
    new Date(applied[0].last_day) - new Date(applied[0].first_day),
    6 * 86400000,
  );
  await page.getByRole("button", { name: "월간", exact: true }).click();
  await page
    .getByRole("button", { name: "선택한 달에 적용", exact: true })
    .click();
  await page.waitForFunction(() => true);
  await page
    .locator(".bulk-availability .pt-success")
    .filter({ hasText: "설정을 적용했어요." })
    .waitFor();
  assert.equal(applied[1].first_day.slice(-2), "01");
  await page.screenshot({
    path: "/tmp/ntac-availability-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "bulk availability mobile overflow",
  );
  await page.screenshot({
    path: "/tmp/ntac-availability-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1200, height: 1000 });

  await page.setViewportSize({ width: 900, height: 1000 });
  assert(
    await page.evaluate(() =>
      [...document.querySelectorAll(".roster-row button")].every(
        (b) =>
          b.getBoundingClientRect().right <=
          b.closest(".surface").getBoundingClientRect().right - 10,
      ),
    ),
    "roster buttons overflow card at 900px",
  );
  await page
    .getByRole("button", { name: "프로필", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("이름", { exact: true })
    .fill("김민수");
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await page.getByText("프로필을 저장했어요.", { exact: true }).waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "닫기", exact: true })
    .click();
  await page.screenshot({ path: "/tmp/ntac-roster-900.png", fullPage: true });
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
  await page.getByRole("button", { name: "횟수권 등록", exact: true }).click();
  await page.getByLabel("횟수권 이름", { exact: true }).fill("재구매 10회권");
  await page.getByRole("button", { name: "횟수권 저장", exact: true }).click();
  await page.getByText("횟수권을 저장했어요.", { exact: true }).waitFor();
  assert.equal(packages.filter((p) => p.member_id === "m1").length, 2);
  await page.getByRole("button", { name: "수업 추가", exact: true }).click();
  assert.equal(await page.locator("textarea").count(), 3);
  await page.getByLabel("수업 시간").fill("08:00");
  await page.getByLabel("Warm-up", { exact: true }).fill("Ankle rock 8/8");
  await page.getByLabel("Main", { exact: true }).fill("BB SQ 10\nBike easy");
  await page.getByLabel("특이사항", { exact: true }).fill("컨디션 좋음");
  await page.screenshot({
    path: "/tmp/ntac-session-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByText("저장했어요.", { exact: true }).waitFor();
  const saved = sessions.find((s) => s.main === "BB SQ 10\nBike easy");
  assert(saved);
  const card = page.locator("article").filter({ hasText: "컨디션 좋음" });
  await card.getByRole("button", { name: "운동 완료", exact: true }).click();
  await page.getByText("운동 완료! 1회 차감했어요.").waitFor();
  assert.equal(saved.status, "completed");
  page.on("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "완료 취소", exact: true }).click();
  await page.getByText("완료를 취소하고 1회를 복구했어요.").waitFor();
  assert.equal(saved.status, "scheduled");
  assert(
    !/기능 평가|수업 힘든 정도|세트 입력/.test(
      await page.locator("body").innerText(),
    ),
  );
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
  assert.equal(
    await page
      .getByRole("button", { name: "홈", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("img", { name: "NTAC", exact: true }).waitFor();
  assert.equal(await page.locator('.pt-calendar').count(),0,'Home should not show calendar');
  await page.setViewportSize({width:390,height:844});
  assert(await page.locator('.home-book-cta').evaluate(e=>e.getBoundingClientRect().bottom<innerHeight-80),'Booking CTA above bottom navigation');
  await page.screenshot({path:'/tmp/ntac-focused-home-empty.png',fullPage:true});
  await page.setViewportSize({width:320,height:750});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px overflow');
  await page.setViewportSize({width:390,height:1000});
  await page.getByRole("button", { name: "내 프로필", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("연락처", { exact: true })
    .fill("01012345678");
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await page.getByText("프로필을 저장했어요.", { exact: true }).waitFor();
  await page.screenshot({
    path: "/tmp/ntac-profile-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "닫기", exact: true })
    .click();
  await page.getByRole("button", { name: "이용 내역", exact: true }).click();
  await page.getByRole("region", { name: "횟수권과 사용 내역" }).waitFor();
  assert.equal(await page.locator(".pass-card").count(), 2);
  await page.screenshot({
    path: "/tmp/ntac-passes-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "운동 기록", exact: true }).click();
  await page.getByRole("region", { name: "운동 통계" }).waitFor();
  await page.getByText("이번 주 운동", { exact: true }).waitFor();
  await page.getByRole("button", { name: "월간", exact: true }).click();
  await page.getByRole("button", { name: "주간", exact: true }).click();
  assert.match(
    await page
      .getByRole("button", { name: date, exact: true })
      .getAttribute("title"),
    /운동 완료 1회/,
  );
  await page.screenshot({
    path: "/tmp/ntac-tracking-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "이전 달", exact: true }).click();
  await page.getByRole("button", { name: "다음 달", exact: true }).click();
  await page.getByRole("button", { name: "수업 예약", exact: true }).click();
  await page.getByRole("button", { name: tomorrow, exact: true }).click();
  await page.getByRole("button", { name: "10:00", exact: true }).click();
  await page
    .getByRole("button", { name: "이 시간으로 예약", exact: true })
    .click();
  await page
    .getByText(`${tomorrow} 10:00 예약이 완료됐어요.`, { exact: true })
    .waitFor();
  assert.equal(sessions.find((s) => s.id === "booked").status, "scheduled");
  await page.locator(`.next-session time[datetime="${tomorrow}T10:00:00+09:00"]`).waitFor();
  await page.screenshot({path:'/tmp/ntac-focused-home-booked.png',fullPage:true});
  await page.getByRole("button",{name:"예약 관리",exact:false}).click();
  slots.push({
    id: "slot2",
    coach_id: "coach",
    starts_at: `${tomorrow}T12:00:00+09:00`,
    ends_at: `${tomorrow}T13:00:00+09:00`,
    is_open: true,
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("button", { name: "예약 변경", exact: true }).click();
  await page.getByRole("button", { name: "12:00", exact: true }).click();
  await page
    .getByRole("button", { name: "이 시간으로 변경", exact: true })
    .click();
  await page
    .getByText(`${tomorrow} 12:00 예약을 변경했어요.`, { exact: true })
    .waitFor();
  assert.equal(sessions.find((s) => s.id === "booked").slot_id, "slot2");
  await page.getByRole("button",{name:"예약 관리",exact:false}).click();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "예약 취소", exact: true }).click();
  await page
    .getByText("예약을 취소했어요. 횟수는 그대로 유지돼요.", { exact: true })
    .waitFor();
  assert.equal(sessions.find((s) => s.id === "booked").status, "cancelled");
  await page.getByRole("button", { name: date, exact: true }).click();
  assert(
    await page
      .getByRole("button", { name: "예약 취소", exact: true })
      .isDisabled(),
  );
  await page.screenshot({
    path: "/tmp/ntac-booking-refined-mobile.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("button", { name: "운동 기록", exact: true }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
  await page
    .locator(".tracked-session")
    .filter({ hasText: "10:00" })
    .getByText("운동 내용 보기", { exact: true })
    .click();
  await page
    .locator(".tracked-session")
    .getByText("스쿼트 자세가 안정적이에요.")
    .waitFor();
  await page.getByRole("button", { name: "수업 예약", exact: true }).click();
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
    "PASS: weekly/monthly settings, saved defaults, tracking calendar, simple log, completion/undo, booking and mobile routing",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
