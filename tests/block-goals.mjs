import assert from "node:assert/strict";
import { blankPrograms, programReady } from "../web/src/groups/classTypes.js";
import { cleanProgram, editProgram, goalsForDate, previewBlockDefaults } from "../web/src/groups/blockGoals.js";

const exercises = [{ id: "overhead_press", name: "OHP" }, { id: "deadlift", name: "Deadlift" }];
const rows = [
  { block_id: "2027-b01", programs: { gentle_strength: [{ exercise_id: "overhead_press", test_reps: 5 }], bomb_strength: [{ exercise_id: "deadlift", test_reps: 1 }] } },
  { block_id: "2027-b02", programs: { gentle_strength: [{ exercise_id: "deadlift", test_reps: 3 }], bomb_strength: [] } },
];
const goals = goalsForDate(rows, "2027-01-18", "gentle_strength");
assert.equal(goals[0].exercise_id, "overhead_press");
assert.equal(goalsForDate(rows, "2027-01-18", "bomb_strength")[0].exercise_id, "deadlift");
assert.equal(goalsForDate(rows, "2027-04-05", "gentle_strength")[0].test_reps, 3);
for (const day of ["2026-10-21", "2027-03-29", "2028-01-03"]) assert.deepEqual(goalsForDate(rows, day, "gentle_strength"), []);
assert.deepEqual(goalsForDate(rows, "2027-01-18", "gentle_sweat"), []);
const original = blankPrograms().find((p) => p.class_type_id === "gentle_strength");
const preview = previewBlockDefaults(original, goals, exercises);
assert.equal(preview.movements[0].exercise_id, "overhead_press");
assert.equal(preview.movements[0].record_use, "log_only");
assert.equal(preview.movements[0].sets[0].reps, 10, "5RM goal must not prescribe 5RM to every session");
assert.equal(programReady(original), false, "preview cannot make untouched classes publishable");
assert.deepEqual(cleanProgram(preview), original);
const edited = editProgram(preview, "description", "BUILD session");
assert.equal(programReady(edited), true);
assert.equal(cleanProgram(edited).movements.length, 1);
assert.equal(cleanProgram(edited)._blockDefaultsHandled, undefined);
const removed = editProgram(edited, "movements", []);
assert.equal(previewBlockDefaults(removed, goals, exercises), removed, "never re-add a deliberately removed exercise");
assert.equal(previewBlockDefaults({ ...removed, description: "" }, goals, exercises).movements.length, 0);
assert.equal(previewBlockDefaults(edited, rows[1].programs.gentle_strength, exercises), edited, "changing date/config must not replace an authored prescription");
assert.equal(previewBlockDefaults({ ...original, description: "An existing text-only program" }, goals, exercises).movements.length, 0);
assert.equal(previewBlockDefaults(original, [{ exercise_id: "missing", test_reps: 3 }], exercises), original);
assert.notEqual(previewBlockDefaults(original, goals, exercises).movements[0].id, preview.movements[0].id, "each new lesson has independent record identifiers");
console.log("PASS: block/class/date routing, preview-only defaults, explicit removal, authored program preservation and independent record purpose");
