process.on("uncaughtException", (e) => {
  console.error(e.message, e.where || "", e.position || "");
  process.exit(1);
});
// Isolated PostgreSQL (PGlite). No live member data or network requests.
// Run: NTAC_TEST_MODULES=/tmp/ntac-test-tools/node_modules node tests/group-auto-lifecycle.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const root = process.env.NTAC_TEST_MODULES;
const { PGlite } = await import(
  pathToFileURL(`${root}/@electric-sql/pglite/dist/index.js`)
);
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,private,public to authenticated,anon;
create table public.profiles(id uuid primary key,full_name text, email text, role text,ntac_enabled boolean default false,assigned_coach_id uuid,coach_name text,coach_care boolean,membership text,membership_status text,paid_until date,trial_ends_at timestamptz,trial_started_at timestamptz,access_override_until timestamptz);
create function public.is_ntac_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','admin')) $$;
create table public.pt_members(id uuid default gen_random_uuid(),profile_id uuid unique references public.profiles(id),active boolean,coach_id uuid);
create table public.pt_sessions(id uuid default gen_random_uuid(),status text);
create table public.pt_pass_events(id uuid default gen_random_uuid(),delta int);
create table public.workout_records(id uuid default gen_random_uuid(),user_id uuid);
grant select,update on profiles to authenticated;grant select,insert,update on pt_members to authenticated;
create function public.set_member_services(target_id uuid,enable_ntac boolean,enable_pt boolean,coach_id uuid default null) returns void language plpgsql security invoker set search_path='' as $$ begin
 if not public.is_ntac_admin() then raise exception 'admin required';end if;
 update public.profiles set ntac_enabled=enable_ntac,assigned_coach_id=coach_id where id=target_id;
 insert into public.pt_members(profile_id,active,coach_id) values(target_id,enable_pt,coach_id) on conflict(profile_id) do update set active=enable_pt,coach_id=set_member_services.coach_id;end $$;`);
await db.exec(
  fs.readFileSync(
    "supabase/migrations/20261020074200_group_classes.sql",
    "utf8",
  ),
);
for (const file of fs
  .readdirSync("supabase/migrations")
  .filter((f) => f.endsWith("_group_input_guards.sql")))
  await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
for (const file of fs
  .readdirSync("supabase/migrations")
  .filter(
    (f) =>
      f.endsWith("_group_weekly_strength.sql") ||
      f.endsWith("_group_recording_compatibility.sql") ||
      f.endsWith("_group_class_type_weeks.sql") ||
      f.endsWith("_unified_member_services.sql") ||
      f.endsWith("_group_program_visibility.sql") ||
      f.endsWith("_group_record_use.sql") ||
      f.endsWith("_group_block_goals.sql"),
  ))
  await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  coach: "10000000-0000-4000-8000-000000000002",
  other: "10000000-0000-4000-8000-000000000003",
  member: "10000000-0000-4000-8000-000000000004",
  second: "10000000-0000-4000-8000-000000000005",
  outside: "10000000-0000-4000-8000-000000000006",
};
for (const [name, id] of Object.entries(ids))
  await db.query(
    "insert into profiles(id,full_name,email,role) values($1,$2,$3,$4)",
    [
      id,
      name,
      `${name}@example.invalid`,
      name === "admin"
        ? "owner"
        : ["coach", "other"].includes(name)
          ? "coach"
          : "member",
    ],
  );
async function as(name) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[name] || "",
  ]);
  await db.exec(`set role ${name === "anon" ? "anon" : "authenticated"}`);
}
async function rpc(name, args = []) {
  const r = await db.query(
    `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
    args,
  );
  return r.rows[0].result;
}
async function denied(fn, pattern) {
  await assert.rejects(fn, pattern);
}
let checks = 0;
function ok(value, message) {
  assert(value, message);
  checks++;
}

await db.exec(
  fs.readFileSync(
    "supabase/migrations/20261021081959_group_auto_class_flow.sql",
    "utf8",
  ),
);

await as("admin");
await rpc("group_set_member", [ids.member, true]);
await rpc("group_set_member", [ids.second, true]);
const wall = await rpc("group_create_wall", ["Automatic test"]);
await db.exec("reset role");
const now = new Date((await db.query("select now() as t")).rows[0].t);
const at = (min) => new Date(now.getTime() + min * 60000).toISOString();
const movement = {
  id: "ohp",
  exercise_id: "overhead_press",
  kind: "weight",
  unit: "kg",
  load_basis: "total",
  target_reps: 5,
};
async function makeClass(mins, state = "published", duration = 50) {
  await db.exec("reset role");
  const r = await db.query(
    "insert into group_classes(title,starts_at,duration_minutes,coach_id,movements,status,created_by) values('AUTO TEST',$1,$2,$3,$4,$5,$3) returning id",
    [
      at(mins),
      duration,
      ids.coach,
      JSON.stringify([
        movement,
        { ...movement, id: "second", exercise_id: "back_squat" },
      ]),
      state,
    ],
  );
  return r.rows[0].id;
}
const running = await makeClass(-5),
  next = await makeClass(55),
  draft = await makeClass(1, "draft"),
  cancelled = await makeClass(2, "cancelled");
const phase = async (time, state = "published") =>
  (
    await db.query("select private.group_class_phase($1,$2,50,$3) as p", [
      state,
      at(0),
      at(time),
    ])
  ).rows[0].p;
for (const [m, p] of [
  [-31, "published"],
  [-30, "open"],
  [-1, "open"],
  [0, "live"],
  [49, "live"],
  [50, "ended"],
])
  ok((await phase(m)) === p, `phase boundary ${m}`);
ok(
  (await phase(0, "draft")) === "draft" &&
    (await phase(0, "cancelled")) === "cancelled",
  "unpublished and cancelled never start",
);
const selected = async (m) =>
  (await db.query("select private.group_display_class($1) as id", [at(m)]))
    .rows[0].id;
ok((await selected(0)) === running, "active lesson takes priority");
ok(
  (await selected(40)) === running,
  "active lesson is not preempted by next arrivals",
);
ok((await selected(46)) === next, "next waiting roster after previous ends");
ok((await selected(55)) === next, "automatic next class start");
await as("member");
await rpc("group_set_privacy", ["Member screen", true]);
await rpc("group_join", [running]);
ok(
  (await rpc("group_detail", [running])).class.status === "live",
  "detail reflects server time",
);
const pid = (await rpc("group_detail", [running])).participants[0].id;
await rpc("group_join", [running]);
ok(
  (await rpc("group_detail", [running])).participants.length === 1,
  "repeat entry is idempotent",
);
await denied(() => rpc("group_join", [next]), /30분/);
await denied(() => rpc("group_join", [draft]), /30분/);
await denied(() => rpc("group_join", [cancelled]), /30분/);
await denied(() => rpc("group_join", [running, [ids.second]]), /담당 코치/);
await as("other");
await denied(() => rpc("group_join", [running, [ids.second]]), /담당 코치/);
await as("coach");
await rpc("group_join", [running, [ids.second]]);
let rows = (await rpc("group_detail", [running])).participants;
ok(
  rows.every((p) => p.status === "active"),
  "coach entry is immediate without starting class",
);
await as("anon");
const tv = await rpc("group_display", [wall.recommendations]);
ok(
  tv.class.id === running && tv.automatic && tv.participants.length === 1,
  "unassigned TV follows schedule and respects privacy",
);
ok(
  tv.participants[0].name === "Member screen",
  "visible name is member-controlled",
);
ok(
  !JSON.stringify(tv).includes("@example.invalid") &&
    !JSON.stringify(tv).includes("exception_access"),
  "TV does not leak private data",
);
const results = await rpc("group_display", [wall.results]);
ok(
  results.class.id === tv.class.id &&
    results.movement_id === tv.movement_id &&
    results.participants[0].id === tv.participants[0].id,
  "both screens show the same class, movement and arrival",
);
await denied(() => rpc("group_display", ["x".repeat(72)]), /해제됐거나/);
await denied(
  () => db.query("select private.group_display_class()"),
  /permission denied/,
);
await as("member");
let own = (await rpc("group_detail", [running])).participants[0];
await rpc("group_save_participant", [
  pid,
  own.revision,
  {
    status: "completed",
    results: { ohp: { weight: 30, reps: 5 } },
    session_rpe: 7,
  },
]);
ok(
  (await rpc("group_detail", [running])).participants[0].results.ohp.weight ===
    30,
  "recording accepts scheduled live classes with stored published state",
);
await denied(
  () =>
    rpc("group_save_participant", [pid, own.revision, { status: "active" }]),
  /다른 기기/,
);
await db.exec("reset role");
await db.query("update group_classes set starts_at=$1 where id=$2", [
  at(-60),
  running,
]);
await as("member");
own = (await rpc("group_detail", [running])).participants[0];
await rpc("group_save_participant", [
  pid,
  own.revision,
  { note: "after scheduled end" },
]);
ok(
  (await rpc("group_detail", [running])).class.status === "ended",
  "automatic scheduled end",
);
await db.exec("reset role");
await db.query("update group_classes set starts_at=$1 where id=$2", [
  at(-1500),
  running,
]);
await as("member");
own = (await rpc("group_detail", [running])).participants[0];
await denied(
  () => rpc("group_save_participant", [pid, own.revision, { note: "late" }]),
  /수정 기간/,
);
const future = await makeClass(150);
await as("coach");
await rpc("group_join", [future, [ids.second]]);
ok(
  (await rpc("group_detail", [future])).participants[0].status === "planned",
  "future plan never fabricates attendance",
);
await db.exec("reset role");
await db.query("update group_classes set starts_at=$1 where id=$2", [
  at(20),
  future,
]);
await as("second");
ok(
  (await rpc("group_detail", [future])).participants[0].status === "planned",
  "planned stays planned until explicit arrival",
);
await rpc("group_join", [future]);
let plan = (await rpc("group_detail", [future])).participants[0];
ok(plan.status === "active", "pre-class self entry without staff action");
await denied(
  () =>
    rpc("group_save_participant", [
      plan.id,
      plan.revision,
      { status: "completed" },
    ]),
  /시작 이후/,
);
await db.exec("reset role");
const snapshot = (
  await db.query("select status from group_participants where id=$1", [plan.id])
).rows[0].status;
ok(snapshot === "active", "clock never auto-completes a member");
await as("admin");
await rpc("group_control_wall", [wall.id, null, null, true]);
await as("anon");
await denied(() => rpc("group_display", [wall.results]), /해제됐거나/);
await db.exec("reset role");
ok(
  (await db.query("select count(*)::int n from pt_sessions")).rows[0].n === 0,
  "no PT sessions touched",
);
ok(
  (await db.query("select count(*)::int n from pt_pass_events")).rows[0].n ===
    0,
  "no pass ledger touched",
);
console.log(
  `PASS: ${checks} automatic lifecycle, screen selection, joining, record window, privacy and permissions checks`,
);
await db.close();
