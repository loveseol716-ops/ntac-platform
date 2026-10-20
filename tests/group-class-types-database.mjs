import assert from "node:assert/strict";
import {
  CLASS_TYPES,
  blankPrograms,
  POSTER_SLOTS,
} from "../web/src/groups/classTypes.js";

export async function classTypeChecks({
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
  let tt = (await db.query("select * from group_timetable")).rows[0];
  await rpc("group_save_timetable", [[], tt.revision]);
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 35 - (day.getUTCDay() || 7) + 1);
  const ws = day.toISOString().slice(0, 10);
  const draft = {
    program_mode: "class_type",
    week_start: ws,
    title: "Seven classes",
    status: "draft",
    programs: blankPrograms(),
  };
  let w = await rpc("group_save_week", [draft]);
  const wid = w.id;
  const save = (programs, revision, extra = {}) =>
    rpc("group_save_week", [
      { ...draft, id: wid, revision, status: "published", programs, ...extra },
    ]);
  await denied(() => save(draft.programs, 1), /최소 한/);
  await denied(() => save(draft.programs.slice(1), 1), /7개/);
  await denied(
    () =>
      save(
        draft.programs.map(() => draft.programs[0]),
        1,
      ),
    /중복/,
  );
  await as("member");
  ok(
    (await db.query("select * from group_weeks where id=$1", [wid])).rows
      .length === 0,
    "typed draft private",
  );
  await denied(() => save(draft.programs, 1), /관리자/);
  await denied(
    () => db.query("select private.group_poster_slots($1)", [ids.member]),
    /permission denied/,
  );
  await denied(
    () => db.query("select private.group_save_week_days($1)", [draft]),
    /permission denied/,
  );
  await as("admin");
  const partial = draft.programs.map((p) => ({
    ...p,
    description:
      p.class_type_id === "gentle_strength" ? "Squat 10-10-8-8-8 (RIR3)" : "",
  }));
  w = await save(partial, 1);
  ok(
    w.default_timetable_loaded && w.created === 6,
    "empty timetable auto-loads poster and publishes only written type",
  );
  tt = (await db.query("select * from group_timetable")).rows[0];
  assert.deepEqual(
    tt.slots.map((s) => [s.dow, s.time, s.class_type_id]),
    POSTER_SLOTS,
  );
  assert.deepEqual(
    (
      await db.query(
        "select id,name,days from group_class_types order by sort_order",
      )
    ).rows,
    CLASS_TYPES,
  );
  await denied(
    () =>
      rpc("group_save_timetable", [
        tt.slots.map((s, i) =>
          i === 0 ? { ...s, class_type_id: "gentle_sweat" } : s,
        ),
        tt.revision,
      ]),
    /운영 요일/,
  );
  await denied(
    () =>
      rpc("group_save_timetable", [
        tt.slots.map(({ class_type_id, ...s }) => s),
        tt.revision,
      ]),
    /최신 화면/,
  );
  const full = draft.programs.map((p) => ({
    ...p,
    description: `Program:${p.class_type_id}`,
  }));
  w = await save(full, 2);
  ok(
    w.created === 20 && w.updated === 6 && !w.default_timetable_loaded,
    "rest of seven types publish without replacing timetable",
  );
  let cs = (
    await db.query(
      "select * from group_classes where week_id=$1 and archived_at is null order by starts_at",
      [wid],
    )
  ).rows;
  ok(
    cs.length === 26 &&
      cs.every((c) => c.description === `Program:${c.class_type_id}`),
    "each of 26 occurrences uses its own class type",
  );
  for (const c of cs) {
    const slot = tt.slots.find((s) => s.id === c.slot_id);
    assert.equal(slot.class_type_id, c.class_type_id);
    const local = new Date(c.starts_at.getTime() + 9 * 3600000);
    assert.equal(local.toISOString().slice(11, 16), slot.time);
    assert.equal(local.getUTCDay() || 7, slot.dow);
  }
  await as("member");
  ok(
    (await db.query("select programs from group_weeks where id=$1", [wid]))
      .rows[0].programs.length === 7,
    "member reads seven published programs",
  );
  await as("admin");
  await rpc("group_join", [cs[0].id, [ids.member]]);
  w = await save(
    full.map((p) => ({ ...p, description: "Updated" })),
    3,
  );
  ok(
    w.created === 0 && w.updated === 25 && w.kept === 1,
    "typed republish idempotent and roster snapshot retained",
  );
  ok(
    (
      await db.query("select description from group_classes where id=$1", [
        cs[0].id,
      ])
    ).rows[0].description === "Program:gentle_strength",
    "rostered occurrence retains previous prescription",
  );
  await denied(
    () =>
      rpc("group_save_week", [
        {
          ...draft,
          id: wid,
          revision: 4,
          program_mode: "day",
          days: [{ dow: 1, title: "Old client", movements: [] }],
        },
      ]),
    /최신 화면/,
  );
  await denied(() => save(full, 3), /변경/);

  // A timetable restore has new slot IDs. Replace obsolete empty occurrences,
  // but retain the rostered occurrence as a real conflict, never duplicate it.
  const restored = tt.slots.map((s) => ({ ...s, id: crypto.randomUUID() }));
  await rpc("group_save_timetable", [restored, tt.revision]);
  w = await save(full, 4);
  ok(
    w.created === 25 && w.conflicts === 1,
    "replacing schedule IDs does not erase all occurrences or duplicate roster",
  );
  ok(
    (
      await db.query(
        "select count(*)::int n from group_classes where week_id=$1 and archived_at is null",
        [wid],
      )
    ).rows[0].n === 26,
    "restored timetable preserves complete week",
  );

  // Existing timetable remains authoritative; unrelated manual classes are not overwritten.
  day.setUTCDate(day.getUTCDate() + 7);
  const nextWs = day.toISOString().slice(0, 10);
  const manualId = await rpc("group_save_class", [
    { ...payload, coach_id: ids.admin, starts_at: `${nextWs}T07:20:00+09:00` },
  ]);
  const next = await rpc("group_save_week", [
    { ...draft, week_start: nextWs, status: "published", programs: full },
  ]);
  ok(
    next.created === 25 &&
      next.conflicts === 1 &&
      !next.default_timetable_loaded,
    "manual time conflict preserved and reported",
  );
  ok(
    (
      await db.query("select week_id from group_classes where id=$1", [
        manualId,
      ])
    ).rows[0].week_id === null,
    "manual class not absorbed into weekly program",
  );
  await as("anon");
  await denied(() => rpc("group_save_week", [draft]), /permission denied/);
  await as("admin");
  console.log(
    "PASS: seven-class bundles, 26 poster slots, partial publication, permissions, concurrency, frozen records and timetable restore",
  );
}
