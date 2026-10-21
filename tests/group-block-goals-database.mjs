import assert from "node:assert/strict";

export async function blockGoalsChecks({ db, as, rpc, ids, ok, denied, payload }) {
  const programs = { gentle_strength: [{ exercise_id: "overhead_press", test_reps: 5 }, { exercise_id: "bench_press", test_reps: 3 }], bomb_strength: [{ exercise_id: "back_squat", test_reps: 1 }] };
  const goal = { block_id: "2027-b01", revision: 0, programs };
  await as("admin");
  const saved = await rpc("group_save_block_goals", [goal]);
  assert.deepEqual(saved.programs, programs);
  ok(saved.revision === 1 && saved.updated_by === ids.admin, "multiple class-specific assessment goals persist with author/revision");
  const cid = await rpc("group_save_class", [{ ...payload, class_type_id: "gentle_strength" }]);
  const before = (await db.query("select * from group_classes where id=$1", [cid])).rows[0];
  ok(before.class_type_id === "gentle_strength", "individual class has persistent class identity");
  const changed = await rpc("group_save_block_goals", [{ ...goal, revision: 1, programs: { ...programs, gentle_strength: [{ exercise_id: "deadlift", test_reps: 3 }] } }]);
  ok(changed.revision === 2, "goal update is versioned");
  assert.deepEqual((await db.query("select * from group_classes where id=$1", [cid])).rows[0], before, "goal changes never rewrite existing prescriptions/results");
  await denied(() => rpc("group_save_block_goals", [goal]), /변경됐어요/);
  await denied(() => rpc("group_save_block_goals", [{ ...goal, revision: 1 }]), /변경됐어요/);
  for (const invalid of [
    { block_id: "not-a-block" }, { programs: { gentle_strength: [], bomb_strength: [], gentle_sweat: [] } },
    { programs: { ...programs, gentle_strength: [{ exercise_id: "missing", test_reps: 5 }] } },
    { programs: { ...programs, bomb_strength: [{ exercise_id: "back_squat", test_reps: 8 }] } },
    { programs: { ...programs, bomb_strength: [{ exercise_id: "back_squat", test_reps: null }] } },
    { programs: { ...programs, gentle_strength: [programs.gentle_strength[0], programs.gentle_strength[0]] } },
  ]) await denied(() => rpc("group_save_block_goals", [{ ...goal, revision: 2, ...invalid }]), /블록|목표|종목|평가/);
  await denied(() => db.query("update group_block_goals set revision=100"), /permission denied/);
  await rpc("group_save_class", [{ ...payload, id: cid, revision: before.revision }]);
  ok((await db.query("select class_type_id from group_classes where id=$1", [cid])).rows[0].class_type_id === "gentle_strength", "legacy client editing class preserves class identity");
  await denied(() => rpc("group_save_class", [{ ...payload, class_type_id: "invalid" }]), /수업 종류/);
  await as("coach");
  ok((await db.query("select count(*)::int n from group_block_goals")).rows[0].n === 1, "coaches can read agreed block goals");
  await denied(() => rpc("group_save_block_goals", [{ ...goal, revision: 2 }]), /관리자/);
  await denied(() => db.query("select private.group_save_block_goals($1)", [JSON.stringify({ ...goal, revision: 2 })]), /관리자/);
  await as("member");
  ok((await db.query("select count(*)::int n from group_block_goals")).rows[0].n === 0, "authoring configuration hidden by member RLS");
  await denied(() => rpc("group_save_block_goals", [{ ...goal, revision: 2 }]), /관리자/);
  await as("anon");
  await denied(() => rpc("group_save_block_goals", [goal]), /permission denied/);
  await denied(() => db.query("select * from group_block_goals"), /permission denied/);
  await as("admin");
  const empty = await rpc("group_save_block_goals", [{ ...goal, revision: 2, programs: { gentle_strength: [], bomb_strength: [] } }]);
  ok(empty.revision === 3 && empty.programs.gentle_strength.length === 0, "assessment choices can be cleared without deleting history");
  console.log("PASS: shared block goals, atomic revision guards, class identity, coach/member boundaries and unchanged saved lessons");
}
