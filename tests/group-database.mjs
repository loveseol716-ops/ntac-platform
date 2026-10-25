process.on("uncaughtException", (e) => {
  console.error(e.message, e.where || "", e.position || "");
  process.exit(1);
});
// Isolated PostgreSQL (PGlite). No live member data or network requests.
// Run: NTAC_TEST_MODULES=/tmp/ntac-test-tools/node_modules node tests/group-database.mjs
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
await as("admin");
await rpc("group_set_member", [ids.member, true]);
await rpc("group_set_member", [ids.second, true]);
const movement = {
  id: "squat",
  exercise_id: "back_squat",
  label: "백 스쿼트",
  kind: "weight",
  unit: "kg",
  load_basis: "total",
  target_reps: 8,
};
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const payload = {
  title: "DB 테스트 수업",
  starts_at: `${date}T00:01:00+09:00`,
  duration_minutes: 50,
  coach_id: ids.coach,
  description: "test",
  movements: [movement],
};
const cid = await rpc("group_save_class", [payload]);
await rpc("group_set_baseline", [
  {
    user_id: ids.member,
    exercise_id: "back_squat",
    target_reps: 8,
    unit: "kg",
    load_basis: "total",
    difficulty: "standard",
    weight: 40,
    reason: "코치 기준",
  },
]);
await as("member");
ok(
  (await db.query("select * from group_classes")).rows.length === 0,
  "draft hidden",
);
await denied(() => rpc("group_join", [cid]), /오늘 참가/);
await denied(() => rpc("group_set_member", [ids.outside, true]), /관리자/);
await denied(
  () =>
    db.query("insert into group_participants(class_id,user_id) values($1,$2)", [
      cid,
      ids.member,
    ]),
  /permission denied/,
);
await as("other");
await denied(() => rpc("group_detail", [cid]), /권한/);
await denied(
  () => rpc("group_set_class_status", [cid, "published", 1]),
  /담당/,
);
await as("coach");
await rpc("group_set_class_status", [cid, "published", 1]);
await rpc("group_set_class_status", [cid, "open", 2]);
await denied(() => rpc("group_join", [cid, [ids.outside], true]), /관리자/);
await as("outside");
await denied(() => rpc("group_join", [cid, null, null]), /그룹 이용 권한/);
await as("member");
await rpc("group_join", [cid]);
await rpc("group_join", [cid]);
let detail = await rpc("group_detail", [cid]);
let p = detail.participants[0];
ok(detail.participants.length === 1, "repeated join deduplicated");
ok(
  p.recommendations.squat.weight === 40 &&
    p.recommendations.squat.source === "coach_baseline",
  "baseline snapshot",
);
await rpc("group_set_privacy", ["민수", true]);
await denied(
  () => rpc("group_save_participant", [p.id, null, { status: "completed" }]),
  /다른 기기/,
);
await denied(
  () =>
    rpc("group_save_participant", [
      p.id,
      p.revision,
      { recommendations: { squat: 80 }, reason: "member override" },
    ]),
  /코치/,
);
await rpc("group_save_participant", [
  p.id,
  p.revision,
  {
    session_rpe: 7,
    status: "completed",
    results: { squat: { weight: 42.5, reps: 8 } },
  },
]);
await denied(
  () =>
    rpc("group_save_participant", [
      p.id,
      p.revision,
      { session_rpe: 7, status: "completed" },
    ]),
  /다른 기기/,
);
p = (await rpc("group_detail", [cid])).participants[0];
ok(
  p.status === "completed" && p.results.squat.weight === 42.5,
  "actual result separate from recommendation",
);
await as("second");
await rpc("group_join", [cid]);
let other = (await rpc("group_detail", [cid])).participants[0];
ok(
  (await db.query("select * from group_participants")).rows.length === 1,
  "member RLS isolation",
);
await denied(
  () =>
    rpc("group_save_participant", [p.id, p.revision, { status: "cancelled" }]),
  /본인/,
);
await rpc("group_save_participant", [
  other.id,
  other.revision,
  { session_rpe: 7, status: "completed" },
]);
ok(
  Object.keys((await rpc("group_detail", [cid])).participants[0].results)
    .length === 0,
  "completion without results keeps null/missing",
);
await as("coach");
await rpc("group_join", [cid, [ids.member, ids.second]]);
detail = await rpc("group_detail", [cid]);
ok(detail.participants.length === 2, "coach + self join deduplicated");
await denied(
  () => rpc("group_save_class", [{ ...payload, id: cid, revision: 3 }]),
  /고정/,
);
await rpc("group_save_participant", [p.id, p.revision, { finalized: true }]);
await as("member");
p = (await rpc("group_detail", [cid])).participants[0];
await denied(
  () =>
    rpc("group_save_participant", [p.id, p.revision, { note: "edit locked" }]),
  /수정 기간/,
);
await as("admin");
let wall = await rpc("group_create_wall", ["테스트 TV"]);
await rpc("group_control_wall", [wall.id, cid, "squat", false]);
await as("anon");
let display = await rpc("group_display", [wall.recommendations]);
ok(display.participants.length === 1, "TV opt-in only");
ok(display.participants[0].name === "민수", "TV nickname only");
ok(
  !JSON.stringify(display).includes(ids.member) &&
    !JSON.stringify(display).includes("@example.invalid"),
  "TV no member identity/contact",
);
ok(
  !("note" in display.participants[0]) &&
    !("source_id" in display.participants[0].recommendations.squat),
  "TV no notes or history IDs",
);
await denied(() => rpc("group_display", ["x".repeat(72)]), /해제|만료/);
await denied(
  () => db.query("select * from group_participants"),
  /permission denied/,
);
await denied(() => rpc("group_join", [cid]), /permission denied/);
await as("coach");
await rpc("group_set_class_status", [cid, "ended", 3]);
await as("member");
await denied(() => rpc("group_join", [cid]), /오늘 참가/);
await as("admin");
await rpc("group_set_member", [ids.member, false]);
await as("member");
ok(
  (await rpc("group_bootstrap")).has_history,
  "expired enrollment retains own history",
);
await as("admin");
// Unclassified historical results remain readable but cannot influence a new suggestion.
const later = { ...payload, starts_at: `${date}T23:00:00+09:00` };
const next = await rpc("group_save_class", [later]);
await rpc("group_set_class_status", [next, "published", 1]);
await rpc("group_set_class_status", [next, "open", 2]);
await rpc("group_set_member", [ids.member, true]);
await as("member");
await rpc("group_join", [next]);
const np = (await rpc("group_detail", [next])).participants[0];
ok(
  np.recommendations.squat.weight === 40 &&
    np.recommendations.squat.source === "coach_baseline",
  "unclassified legacy record excluded; coach baseline retained",
);
await as("admin");
const changed = await rpc("group_save_class", [
  { ...later, movements: [{ ...movement, target_reps: 12 }] },
]);
await rpc("group_set_class_status", [changed, "published", 1]);
await rpc("group_set_class_status", [changed, "open", 2]);
await as("member");
await rpc("group_join", [changed]);
ok(
  (await rpc("group_detail", [changed])).participants[0].recommendations.squat
    .weight === null,
  "different rep target cannot reuse weight",
);
await as("admin");
await rpc("group_control_wall", [wall.id, null, null, true]);
await as("anon");
await denied(() => rpc("group_display", [wall.results]), /해제|만료/);
await as("admin");
await rpc("set_member_services_v2", [
  ids.member,
  true,
  true,
  ids.other,
  ids.coach,
]);
const prof = (
    await db.query("select * from profiles where id=$1", [ids.member])
  ).rows[0],
  pt = (
    await db.query("select * from pt_members where profile_id=$1", [ids.member])
  ).rows[0];
ok(
  prof.assigned_coach_id === ids.other && pt.coach_id === ids.coach,
  "independent coaches",
);
await (
  await import("./group-weekly-database.mjs")
).weeklyChecks({ db, as, rpc, ids, ok, denied, date, payload });
await (
  await import("./group-class-types-database.mjs")
).classTypeChecks({ db, as, rpc, ids, ok, denied, date, payload });
await (
  await import("./member-services-database.mjs")
).serviceChecks({ db, as, rpc, ids, ok, denied });
await (
  await import("./group-visibility-database.mjs")
).visibilityChecks({ db, as, rpc, ids, ok, denied });
await (await import("./group-record-use-database.mjs")).recordUseChecks({ db, as, rpc, ids, ok, denied, date, payload });
await (await import("./group-block-goals-database.mjs")).blockGoalsChecks({ db, as, rpc, ids, ok, denied, payload });
await db.exec("reset role");
for (const table of ["pt_sessions", "pt_pass_events", "workout_records"])
  ok(
    (await db.query(`select count(*)::int as n from ${table}`)).rows[0].n === 0,
    `group actions never write ${table}`,
  );
console.log(
  `PASS: ${checks} assertions plus permission/concurrency denials; isolated PostgreSQL group lifecycle, recommendation, RLS, TV privacy, PT isolation`,
);
await db.exec(fs.readFileSync("tests/group-record-use-production-smoke.sql", "utf8"));
await db.exec(fs.readFileSync("tests/group-block-goals-production-smoke.sql", "utf8"));
console.log("PASS: hosted rollback scripts against isolated PostgreSQL");
await db.exec(fs.readFileSync("supabase/migrations/20261021081959_group_auto_class_flow.sql", "utf8"));
await db.exec(fs.readFileSync("supabase/migrations/20261025120515_group_week_publication_controls.sql", "utf8"));
await db.exec(fs.readFileSync("tests/group-week-publication-production-smoke.sql", "utf8"));
console.log("PASS: week unpublish, republish, deletion, member RLS, direct RPC guards and retained history");
await db.close();
