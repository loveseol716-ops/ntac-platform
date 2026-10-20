import assert from "node:assert/strict";
export async function weeklyChecks({
  db,
  as,
  rpc,
  ids,
  ok,
  denied,
  date,
  payload,
}) {
  await as("admin");
  const strength = {
    id: "strength-squat",
    exercise_id: "back_squat",
    label: "Back SQ",
    kind: "weight",
    training_type: "strength",
    target_reps: 10,
    unit: "kg",
    load_basis: "total",
    sets: [10, 10, 8, 8, 8].map((reps) => ({ reps, rir: 3 })),
    load_step: 2.5,
    min_load: 20,
  };
  const conditioning = {
    ...strength,
    id: "conditioning",
    training_type: "conditioning",
  };
  delete conditioning.sets;
  const today = new Date(`${date}T12:00:00Z`),
    daysToMonday = 8 - (today.getUTCDay() || 7),
    ws = new Date(today.getTime() + daysToMonday * 86400000)
      .toISOString()
      .slice(0, 10);
  const slots = [
    {
      id: "20000000-0000-4000-8000-000000000001",
      dow: 1,
      time: "10:00",
      duration_minutes: 50,
      coach_id: ids.coach,
    },
    {
      id: "20000000-0000-4000-8000-000000000002",
      dow: 1,
      time: "18:00",
      duration_minutes: 50,
      coach_id: ids.coach,
    },
  ];
  await denied(() => rpc("group_save_timetable", [slots, null]), /변경/);
  await rpc("group_save_timetable", [slots, 1]);
  await denied(
    () =>
      rpc("group_save_timetable", [
        [...slots, { ...slots[0], id: "20000000-0000-4000-8000-000000000003" }],
        2,
      ]),
    /중복/,
  );
  const wp = {
    week_start: ws,
    title: "주간 테스트",
    days: [
      {
        dow: 1,
        title: "월요일 Back SQ",
        description: "10-10-8-8-8 (RIR3)",
        movements: [strength, conditioning],
      },
    ],
    status: "draft",
  };
  let w = await rpc("group_save_week", [wp]);
  let wid = w.id;
  await as("member");
  ok(
    (await db.query("select * from group_weeks where id=$1", [wid])).rows
      .length === 0,
    "draft week private",
  );
  await denied(() => rpc("group_save_timetable", [slots, 2]), /관리자/);
  await as("admin");
  w = await rpc("group_save_week", [
    { ...wp, id: wid, revision: 1, status: "published" },
  ]);
  ok(w.created === 2, "weekly publication creates matching slots");
  let cs = (
    await db.query(
      "select * from group_classes where week_id=$1 order by starts_at",
      [wid],
    )
  ).rows;
  assert.equal(cs[0].starts_at.toISOString(), `${ws}T01:00:00.000Z`);
  await as("member");
  ok(
    (await db.query("select * from group_weeks where id=$1", [wid])).rows
      .length === 1,
    "member reads published week",
  );
  await denied(() => rpc("group_join", [cs[0].id]), /오늘 참가/);
  await as("other");
  await denied(
    () => rpc("group_join", [cs[0].id, [ids.member]]),
    /오늘 참가|담당/,
  );
  await as("coach");
  await rpc("group_join", [cs[0].id, [ids.member]]);
  await rpc("group_join", [cs[0].id, [ids.member]]);
  let planned = (await rpc("group_detail", [cs[0].id])).participants[0];
  ok(planned.status === "planned", "future roster not counted as started");
  await denied(
    () =>
      rpc("group_save_participant", [
        planned.id,
        planned.revision,
        { session_rpe: 7, status: "completed" },
      ]),
    /먼저 오늘 운동/,
  );
  await as("admin");
  w = await rpc("group_save_week", [
    {
      ...wp,
      id: wid,
      revision: 2,
      status: "published",
      days: [{ ...wp.days[0], title: "수정 프로그램" }],
    },
  ]);
  ok(
    w.created === 0 && w.updated === 1 && w.kept === 1,
    "republish idempotent and rostered program frozen",
  );
  cs = (
    await db.query(
      "select * from group_classes where week_id=$1 order by starts_at",
      [wid],
    )
  ).rows;
  ok(
    cs[0].title === "월요일 Back SQ" && cs[1].title === "수정 프로그램",
    "snapshot program retained",
  );
  await denied(
    () => rpc("group_remove_program", ["class", cs[0].id, null]),
    /변경/,
  );
  await rpc("group_remove_program", ["class", cs[1].id, cs[1].revision]);
  await rpc("group_save_week", [
    { ...wp, id: wid, revision: 3, status: "published" },
  ]);
  ok(
    (
      await db.query(
        "select * from group_classes where week_id=$1 and archived_at is null",
        [wid],
      )
    ).rows.length === 1,
    "deleted occurrence never resurrects on publish",
  );
  await rpc("group_remove_program", ["week", wid, 4]);
  ok(
    (
      await db.query("select status from group_participants where id=$1", [
        planned.id,
      ])
    ).rows[0].status === "cancelled",
    "week removal cancels planned roster",
  );
  await as("member");
  ok(
    (await rpc("group_detail", [cs[0].id])).participants[0].id === planned.id,
    "removed class keeps own history",
  );
  await as("admin");
  const replacement = await rpc("group_save_week", [wp]);
  ok(replacement.id !== wid, "archived week can be replaced");
  const template = await rpc("group_save_template", [wp.days[0]]);
  await rpc("group_remove_program", ["template", template]);
  ok(
    !!(
      await db.query("select archived_at from group_templates where id=$1", [
        template,
      ])
    ).rows[0].archived_at,
    "template removal archives",
  );
  await rpc("group_set_strength_max", [
    {
      user_id: ids.member,
      exercise_id: "back_squat",
      weight: 100,
      unit: "kg",
      load_basis: "total",
      measured_on: date,
      basis: "measured",
      reason: "test",
    },
  ]);
  await as("second");
  ok(
    (
      await db.query("select * from group_strength_maxes where user_id=$1", [
        ids.member,
      ])
    ).rows.length === 0,
    "1RM own/admin RLS",
  );
  await denied(
    () => rpc("group_set_strength_max", [{ user_id: ids.second }]),
    /관리자/,
  );
  await as("admin");
  const c1 = await rpc("group_save_class", [
    {
      ...payload,
      starts_at: `${date}T00:01:00+09:00`,
      movements: [strength, conditioning],
    },
  ]);
  await rpc("group_set_class_status", [c1, "published", 1]);
  await rpc("group_set_class_status", [c1, "open", 2]);
  await as("member");
  await rpc("group_join", [c1]);
  let p = (await rpc("group_detail", [c1])).participants[0];
  assert.deepEqual(
    p.recommendations[strength.id].sets.map((s) => s.weight),
    [67.5, 67.5, 72.5, 72.5, 72.5],
  );
  ok(
    p.recommendations.conditioning.source === "program" &&
      p.recommendations.conditioning.weight === null,
    "only strength automatically recommends",
  );
  await denied(
    () =>
      rpc("group_save_participant", [
        p.id,
        p.revision,
        { status: "completed" },
      ]),
    /RPE/,
  );
  await denied(
    () =>
      rpc("group_save_participant", [
        p.id,
        p.revision,
        { results: { [strength.id]: { sets: [{}] } } },
      ]),
    /세트 수/,
  );
  const results = {
    [strength.id]: {
      sets: strength.sets.map((s, i) => ({
        weight: i < 2 ? 70 : 72.5,
        reps: s.reps,
        rir: 3,
      })),
    },
  };
  await denied(
    () =>
      rpc("group_save_participant", [p.id, p.revision, { session_rpe: 11 }]),
    /RPE/,
  );
  await rpc("group_save_participant", [
    p.id,
    p.revision,
    { results, session_rpe: 7, status: "completed" },
  ]);
  await as("coach");
  p = (await rpc("group_detail", [c1])).participants[0];
  await rpc("group_save_participant", [p.id, p.revision, { finalized: true }]);
  await as("admin");
  const c2 = await rpc("group_save_class", [
    { ...payload, starts_at: `${date}T00:02:00+09:00`, movements: [strength] },
  ]);
  await rpc("group_set_class_status", [c2, "published", 1]);
  await rpc("group_set_class_status", [c2, "open", 2]);
  await as("member");
  await rpc("group_join", [c2]);
  p = (await rpc("group_detail", [c2])).participants[0];
  ok(
    p.recommendations[strength.id].sets[0].source === "estimated_history" &&
      p.recommendations[strength.id].sets[0].weight === 70,
    "confirmed actual sets and RIR feed next recommendation",
  );
  await as("coach");
  await rpc("group_save_participant", [
    p.id,
    p.revision,
    {
      recommendations: { [strength.id]: [60, 60, 62.5, 62.5, 62.5] },
      reason: "오늘 자세 조정",
    },
  ]);
  p = (await rpc("group_detail", [c2])).participants[0];
  assert.deepEqual(
    p.recommendations[strength.id].sets.map((s) => s.weight),
    [60, 60, 62.5, 62.5, 62.5],
  );
  await as("admin");
  const wall = await rpc("group_create_wall", ["strength TV"]);
  await rpc("group_control_wall", [wall.id, c2, strength.id]);
  await as("anon");
  const screen = await rpc("group_display", [wall.recommendations]);
  ok(
    screen.participants[0].recommendations[strength.id].sets.length === 5,
    "TV receives all 5 recommended sets",
  );
  ok(
    !JSON.stringify(screen).includes("source_id") &&
      !JSON.stringify(screen).includes("session_rpe") &&
      !JSON.stringify(screen).includes("오늘 자세"),
    "TV does not leak provenance, RPE or coach reasons",
  );
  await denied(() => rpc("group_save_week", [wp]), /permission denied/);
  await as("admin");
  await rpc("group_set_class_status", [c1, "ended", 3]);
  await rpc("group_remove_program", ["class", c1, 4]);
  await as("member");
  const historical = await rpc("group_detail", [c1]);
  ok(
    historical.class.status === "ended" &&
      historical.participants[0].session_rpe === 7 &&
      historical.participants[0].results[strength.id].sets.length === 5,
    "completed record and RPE survive program deletion",
  );
  await as("admin");
  console.log(
    "PASS: weekly scheduling, scoped roster, archive/history, set-specific 1RM/history recommendations, RPE and sanitized TV",
  );
}
