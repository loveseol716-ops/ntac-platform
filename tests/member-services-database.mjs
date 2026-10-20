import assert from "node:assert/strict";
export async function serviceChecks({ db, as, rpc, ids, ok, denied }) {
  await as("admin");
  const state = async () =>
    (
      await db.query(
        `select jsonb_build_object('ntac',p.ntac_enabled,'pt',coalesce(m.active,false),'group',coalesce(g.active,false),'ntac_coach_id',p.assigned_coach_id,'pt_coach_id',m.coach_id) s from profiles p left join pt_members m on m.profile_id=p.id left join group_members g on g.user_id=p.id where p.id=$1`,
        [ids.member],
      )
    ).rows[0].s;
  const before = (
    await db.query(
      "select to_jsonb(p) as data from group_participants p where user_id=$1 order by id",
      [ids.member],
    )
  ).rows;
  let previous = await state();
  for (let bits = 0; bits < 8; bits++) {
    const values = [!!(bits & 1), !!(bits & 2), !!(bits & 4)];
    await rpc("set_member_services_v3", [
      ids.member,
      ...values,
      ids.coach,
      ids.other,
      previous,
    ]);
    const current = await state();
    assert.deepEqual([current.ntac, current.pt, current.group], values);
    assert.equal(current.ntac_coach_id, ids.coach);
    assert.equal(current.pt_coach_id, ids.other);
    await denied(
      () =>
        rpc("set_member_services_v3", [
          ids.member,
          ...values,
          ids.coach,
          ids.other,
          null,
        ]),
      /다른 화면/,
    );
    previous = current;
  }
  ok(true, "all eight independent service combinations and coaches saved");
  await denied(
    () =>
      rpc("set_member_services_v3", [
        ids.member,
        false,
        false,
        false,
        ids.member,
        null,
        previous,
      ]),
    /코치/,
  );
  assert.deepEqual(
    await state(),
    previous,
    "invalid coach never partially changes services",
  );
  await denied(
    () =>
      rpc("set_member_services_v3", [
        ids.member,
        null,
        false,
        false,
        null,
        null,
        previous,
      ]),
    /모두/,
  );
  const stale = { ...previous, group: false };
  await denied(
    () =>
      rpc("set_member_services_v3", [
        ids.member,
        false,
        false,
        false,
        null,
        null,
        stale,
      ]),
    /다른 화면/,
  );
  assert.deepEqual(
    (
      await db.query(
        "select to_jsonb(p) as data from group_participants p where user_id=$1 order by id",
        [ids.member],
      )
    ).rows,
    before,
    "service toggles preserve every group result and roster",
  );
  for (const actor of ["member", "coach", "other"]) {
    await as(actor);
    await denied(
      () =>
        rpc("set_member_services_v3", [
          ids.member,
          true,
          true,
          true,
          null,
          null,
          previous,
        ]),
      /관리자/,
    );
  }
  await as("anon");
  await denied(
    () =>
      rpc("set_member_services_v3", [
        ids.member,
        true,
        true,
        true,
        null,
        null,
        previous,
      ]),
    /permission denied/,
  );
  await as("admin");
  ok(
    (await db.query("select role from profiles where id=$1", [ids.member]))
      .rows[0].role === "member",
    "service assignment never grants staff role",
  );
  console.log(
    "PASS: unified service combinations, independent coaches, optimistic conflicts, access denials and immutable workout records",
  );
}
