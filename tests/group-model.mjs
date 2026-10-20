import assert from "node:assert/strict";
import {
  resultRows,
  resultText,
  groupStats,
  nullableNumber,
  seoulDate,
  calendarRange,
  calendarDates,
  shiftMonth,
} from "../web/src/groups/model.js";
import { blankPrograms, programsForDay } from "../web/src/groups/classTypes.js";

assert.deepEqual(calendarRange("2026-10-20"), ["2026-09-28", "2026-11-02"]);
assert.deepEqual(calendarRange("2026-10-20", "week"), [
  "2026-10-19",
  "2026-10-26",
]);
assert.deepEqual(calendarRange("2026-03-01"), ["2026-02-23", "2026-04-06"]);
assert.deepEqual(calendarRange("2027-02-01"), ["2027-02-01", "2027-03-01"]);
assert.equal(
  calendarDates("2024-02-10").filter((d) => d === "2024-02-29").length,
  1,
);
assert.equal(shiftMonth("2026-12-31", 1), "2027-01-01");
assert.equal(shiftMonth("2026-03-31", -1), "2026-02-01");
const programWeek = {
  status: "published",
  program_mode: "class_type",
  programs: blankPrograms().map((p) => ({ ...p, description: "운동 계획" })),
};
assert.deepEqual(
  Array.from({ length: 7 }, (_, i) =>
    programsForDay(programWeek, i + 1).map((p) => p.class_type_id),
  ),
  [
    ["gentle_strength", "bomb_sweat"],
    ["gentle_sweat", "bomb_strength"],
    ["gentle_sweat", "bomb_strength"],
    ["you_in"],
    ["gentle_strength", "bomb_sweat"],
    ["nolto_team"],
    ["no_more_weak"],
  ],
);
assert.deepEqual(programsForDay({ ...programWeek, status: "draft" }, 1), []);
assert.deepEqual(
  programsForDay({ ...programWeek, programs: blankPrograms() }, 1),
  [],
);
assert.deepEqual(
  programsForDay(
    { status: "published", days: [{ dow: 2, description: "기존 프로그램" }] },
    2,
  ),
  [{ dow: 2, description: "기존 프로그램" }],
);
console.log(
  "PASS: month/week bounds, leap day, year navigation and all seven weekday programs independent of class occurrences",
);
const m = { id: "x", kind: "weight", target_reps: 8, unit: "kg" };
const row = (id, weight, reps, extra = {}) => ({
  id,
  status: "completed",
  difficulty: "standard",
  finalized: true,
  results: { x: { weight, reps } },
  ...extra,
});
let rows = resultRows(
  [
    row("a", 50, 8),
    row("b", 55, 8),
    row("c", 55, 8),
    row("wrong-reps", 60, 7),
    row("unconfirmed", 80, 8, { finalized: false }),
    row("other-level", 40, 8, { difficulty: "foundation" }),
  ],
  m,
);
assert.equal(rows.find((r) => r.id === "b").rank, 1);
assert.equal(rows.find((r) => r.id === "c").rank, 1);
assert.equal(rows.find((r) => r.id === "a").rank, 3);
assert.equal(rows.find((r) => r.id === "wrong-reps").rank, null);
assert.equal(rows.find((r) => r.id === "unconfirmed").rank, null);
assert.equal(rows.find((r) => r.id === "other-level").rank, 1);
rows = resultRows(
  [
    { ...row("a"), results: { x: { rounds: 2, reps: 100 } } },
    { ...row("b"), results: { x: { rounds: 3, reps: 0 } } },
  ],
  { id: "x", kind: "rounds" },
);
assert.equal(rows[0].id, "b");
assert.equal(nullableNumber(""), null);
assert.equal(resultText(m, { weight: 0, reps: 8 }), "0 kg × 8회");
assert.equal(seoulDate("2026-10-20T16:00:00Z"), "2026-10-21");
assert.deepEqual(
  groupStats([
    {
      status: "completed",
      group_classes: { starts_at: "2026-10-20T01:00:00Z" },
    },
    {
      status: "completed",
      group_classes: { starts_at: "2026-10-20T03:00:00Z" },
    },
    { status: "active", group_classes: { starts_at: "2026-10-20T03:00:00Z" } },
    {
      status: "completed",
      group_classes: { starts_at: "2026-10-20T03:00:00Z", status: "cancelled" },
    },
  ]),
  { sessions: 2, days: 1 },
);
console.log(
  "PASS: comparable ranks, ties, null versus zero, AMRAP ordering, Seoul date and completed-only counts",
);

const strength = {
  ...m,
  training_type: "strength",
  sets: [
    { reps: 10, rir: 3 },
    { reps: 8, rir: 3 },
  ],
};
const setRow = (id, sets) => ({ ...row(id), results: { x: { sets } } });
rows = resultRows(
  [
    setRow("full", [
      { weight: 50, reps: 10 },
      { weight: 60, reps: 8 },
    ]),
    setRow("partial", [{ weight: 80, reps: 10 }, {}]),
    setRow("wrong", [
      { weight: 80, reps: 9 },
      { weight: 80, reps: 8 },
    ]),
  ],
  strength,
);
assert.equal(rows.find((r) => r.id === "full").rank, 1);
assert.equal(rows.find((r) => r.id === "partial").rank, null);
assert.equal(rows.find((r) => r.id === "wrong").rank, null);
assert.match(
  resultText(strength, { sets: [{ weight: 50, reps: 10 }, {}] }),
  /1\/2세트/,
);
console.log(
  "PASS: strength ranks require all prescribed sets and matching repetitions",
);
