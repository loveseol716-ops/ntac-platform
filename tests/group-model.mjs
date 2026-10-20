import assert from "node:assert/strict";
import {
  resultRows,
  resultText,
  groupStats,
  nullableNumber,
  seoulDate,
} from "../web/src/groups/model.js";
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
