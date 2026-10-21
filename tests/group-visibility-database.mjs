export async function visibilityChecks({ db, as, rpc, ids, ok, denied }) {
  await db.exec("reset role");
  const cutoff = (
    await db.query("select private.group_program_visible_from()::text as day")
  ).rows[0].day;
  const rows = (
    await db.query(
      `insert into public.group_classes(title,starts_at,coach_id,created_by,status,description,movements)
    select title,starts, $1,$1,'ended','OLD PRIVATE PROGRAM', '[{"id":"hist","exercise_id":"back_squat","label":"백 스쿼트","kind":"weight","unit":"kg","sets":[{"reps":10,"rir":3}]}]'::jsonb
    from (values ('cutoff-1s',($2::date::timestamp at time zone 'Asia/Seoul')-interval '1 second'),
    ('cutoff', $2::date::timestamp at time zone 'Asia/Seoul'),
    ('old-joined',($2::date::timestamp at time zone 'Asia/Seoul')-interval '14 days')) v(title,starts) returning id,title`,
      [ids.coach, cutoff],
    )
  ).rows;
  const old = rows.find((r) => r.title === "old-joined").id,
    recent = rows.find((r) => r.title === "cutoff").id;
  await db.query(
    `insert into public.group_participants(class_id,user_id,status,results,session_rpe)
    values($1,$2,'completed','{"hist":{"sets":[{"weight":60,"reps":8,"rir":2}]}}',7)`,
    [old, ids.member],
  );
  const weekIds = (
    await db.query(
      `insert into group_weeks(week_start,title,created_by,status,days)
    select d,'visibility fixture',$1,'published','[{"dow":1,"description":"OLD PRIVATE PROGRAM"}]'
    from (values($2::date-interval '14 days'),($2::date)) v(d)
    on conflict(week_start) where status<>'archived' do update set status='published' returning id,week_start::text`,
      [ids.admin, cutoff],
    )
  ).rows;
  await db.query("update group_members set active=true where user_id=$1", [
    ids.member,
  ]);
  await as("member");
  const accessible = (
    await db.query("select id from group_classes where id=any($1::uuid[])", [
      rows.map((r) => r.id),
    ])
  ).rows;
  ok(
    accessible.length === 1 && accessible[0].id === recent,
    "member window starts exactly last Monday 00:00 Seoul, including own old class denial",
  );
  await denied(() => rpc("group_detail", [old]), /권한/);
  const weeks = (
    await db.query("select id from group_weeks where id=any($1::uuid[])", [
      weekIds.map((w) => w.id),
    ])
  ).rows;
  ok(weeks.length === 1, "member cannot query older weekly programs");
  const history = await rpc("group_my_history");
  const record = history.find((r) => r.class_id === old);
  ok(
    record?.results.hist.sets[0].weight === 60 &&
      record.session_rpe === 7 &&
      record.group_classes.program_hidden,
    "own old actual results and RPE remain available",
  );
  ok(
    !JSON.stringify(record).includes("OLD PRIVATE PROGRAM") &&
      !("sets" in record.group_classes.movements[0]) &&
      !("recommendations" in record),
    "history does not expose old descriptions, prescribed sets or recommendations",
  );
  ok(
    (await rpc("group_bootstrap")).program_visible_from === cutoff,
    "UI cutoff comes from server",
  );
  await as("second");
  ok(
    !(await rpc("group_my_history")).some((r) => r.class_id === old),
    "cannot access another member history",
  );
  await as("coach");
  ok(
    (await rpc("group_detail", [old])).class.description ===
      "OLD PRIVATE PROGRAM",
    "assigned coach can still inspect old class",
  );
  await as("other");
  await denied(() => rpc("group_detail", [old]), /권한/);
  await as("admin");
  ok(
    (await rpc("group_detail", [old])).class.description ===
      "OLD PRIVATE PROGRAM",
    "admin archive retains full old program",
  );
  ok(
    (
      await db.query("select id from group_weeks where id=any($1::uuid[])", [
        weekIds.map((w) => w.id),
      ])
    ).rows.length === 2,
    "admin reads every week",
  );
  const wall = await rpc("group_create_wall", ["visibility test"]);
  await rpc("group_control_wall", [wall.id, old, "hist", false]);
  await as("anon");
  ok(
    (await rpc("group_display", [wall.results])).class === null,
    "wall token cannot expose expired program",
  );
  await denied(() => rpc("group_my_history"), /permission denied/);
  await db.exec("reset role");
  await db.query("update group_members set active=false where user_id=$1", [
    ids.member,
  ]);
  await as("member");
  ok(
    (await rpc("group_my_history")).some((r) => r.class_id === old),
    "inactive member keeps own records",
  );
}
