import assert from "node:assert/strict";

export async function recordUseChecks({ db, as, rpc, ids, ok, denied, date, payload }) {
  await as("admin");
  const exercise = await rpc("group_add_exercise", ["Record-use isolated OHP"]);
  const movement = {
    id: "ohp", exercise_id: exercise, label: "OHP", kind: "weight",
    training_type: "strength", record_use: "strength_estimate",
    target_reps: 8, unit: "kg", load_basis: "total",
    sets: [{ reps: 8, rir: 2 }], load_step: 2.5, min_load: 20,
  };
  for (const invalid of [null, true, "invalid"]) {
    await denied(() => rpc("group_save_class", [{ ...payload, movements: [{ ...movement, record_use: invalid }] }]), /기록 활용/);
  }
  const conditioning = { ...movement, training_type: "conditioning" };
  delete conditioning.sets;
  await denied(() => rpc("group_save_class", [{ ...payload, movements: [conditioning] }]), /근력 추정용/);
  await rpc("group_set_strength_max", [{ user_id: ids.second, exercise_id: exercise, weight: 100, unit: "kg", load_basis: "total", measured_on: date, basis: "measured", reason: "isolated test" }]);
  const target = await rpc("group_save_class", [{ ...payload, movements: [movement] }]);
  const mixed = await rpc("group_save_template", [{ title: "Mixed use", movements: [movement, { ...movement, id: "complex", record_use: "log_only" }] }]);
  const saved = (await db.query("select movements from group_templates where id=$1", [mixed])).rows[0].movements;
  assert.deepEqual(saved.map((m) => m.record_use), ["strength_estimate", "log_only"]);
  await db.exec("reset role");
  // Comparable records from yesterday, with a deliberately tempting newer complex.
  async function seed(use, weight, minute, finalized = true, rir = 2, dnf = false) {
    const m = { ...movement };
    if (use === undefined) delete m.record_use;
    else m.record_use = use;
    const cid = (await db.query(`insert into group_classes(title,starts_at,coach_id,created_by,status,movements)
      values('Record use fixture',($1::date::timestamp at time zone 'Asia/Seoul')-interval '1 day'+$2::int*interval '1 minute',$3,$3,'ended',$4) returning id`, [date, minute, ids.coach, JSON.stringify([m])])).rows[0].id;
    const result = { ohp: { sets: [{ weight, reps: 8, rir, dnf }] } };
    return (await db.query(`insert into group_participants(class_id,user_id,status,results,session_rpe,finalized)
      values($1,$2,'completed',$3,9,$4) returning id`, [cid, ids.second, JSON.stringify(result), finalized])).rows[0].id;
  }
  async function recommendation() {
    return (await db.query("select private.group_recommend($1,$2,'standard')->'ohp'->'sets'->0 as r", [target, ids.second])).rows[0].r;
  }
  await seed("log_only", 60, 1);
  await seed(undefined, 80, 2);
  let r = await recommendation();
  ok(r.source === "one_rm" && r.weight === 75, "log-only and unclassified results do not feed strength suggestions");
  const qualified = await seed("strength_estimate", 40, 3, false);
  ok((await recommendation()).source === "one_rm", "unconfirmed opt-in record does not contribute");
  await db.query("update group_participants set finalized=true where id=$1", [qualified]);
  r = await recommendation();
  ok(r.source === "estimated_history" && r.weight === 40 && r.high_effort_adjustment === false, "explicit confirmed actual RIR contributes; session RPE 9 does not reduce OHP load");
  const complex = await seed("log_only", 90, 4);
  await seed("strength_estimate", 100, 5, true, 2, true);
  ok((await recommendation()).source_id === qualified, "newer log-only and DNF sets cannot mask eligible history");
  await db.query("update group_classes set movements=$2 where id=$1", [target, JSON.stringify([{ ...movement, record_use: "log_only" }])]);
  ok((await recommendation()).weight === 40, "receiving a suggestion is independent of record contribution");
  await db.query("update group_participants set results=$2 where id=$1", [qualified, JSON.stringify({ ohp: { sets: [{ weight: 40, reps: 8 }] } })]);
  r = await recommendation();
  ok(r.source === "recent_set" && r.estimated_1rm === null, "missing actual RIR can reuse identical prescription but never infer max");
  await db.query("update group_classes set movements=$2 where id=$1", [target, JSON.stringify([{ ...movement, sets: [{ reps: 10, rir: 2 }] }])]);
  ok((await recommendation()).source === "one_rm", "missing actual RIR is not extrapolated to different repetitions");
  ok((await db.query("select weight from group_strength_maxes where user_id=$1 and exercise_id=$2", [ids.second, exercise])).rows[0].weight === "100", "measured max never overwritten by historical suggestions");
  await as("second");
  const history = await rpc("group_my_history");
  const logged = history.find((p) => p.id === complex);
  ok(logged.results.ohp.sets[0].weight === 90 && logged.session_rpe === 9 && logged.group_classes.movements[0].record_use === "log_only", "log-only results, RPE and classification remain visible in personal history");
  await denied(() => rpc("group_save_class", [{ ...payload, movements: [movement] }]), /코치 권한/);
  await denied(() => db.query("select private.group_recommend($1,$2,'standard')", [target, ids.second]), /permission denied/);
  await as("admin");
  await denied(() => rpc("group_save_participant", [complex, 1, { results: { ohp: { record_use: "strength_estimate", sets: [{ weight: 90, reps: 8, rir: 2 }] } } }]), /허용되지 않은 기록/);
  console.log("PASS: per-movement record use, safe legacy default, independent recommendations, confirmed RIR gate, RPE separation, history and permissions");
}
