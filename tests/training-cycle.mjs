import assert from "node:assert/strict";
import { addDays } from "../web/src/groups/model.js";
import { classDirection, trainingClass, trainingDate, trainingPosition, trainingWeeks, TRAINING_BLOCKS } from "../web/src/groups/trainingCycle.js";

// Operational boundaries, not simply a restatement of the phase array.
assert.equal(trainingPosition("2026-08-23"), null);
assert.equal(trainingPosition("2026-08-24").week, 1);
assert.equal(trainingPosition("2026-09-14").phase, "reset");
assert.equal(trainingPosition("2026-10-12").phase, "reset");
const current = trainingPosition("2026-10-22");
assert.equal(current.block.id, "2026-hyrox");
assert.equal(current.week, 9);
assert.equal(current.total, 12);
assert.equal(current.stage.number, 3);
assert.equal(current.weekStart, "2026-10-19");
assert.equal(current.weekEnd, "2026-10-25");
assert.match(current.weekPlan.title, /혼합 종목 연결/);
assert.equal(trainingPosition("2026-10-26").week, 10);
assert.equal(trainingPosition("2026-11-01").week, 10);
assert.equal(trainingPosition("2026-11-02").week, 11);
assert.equal(trainingPosition("2026-11-02").phase, "rehearsal");
assert.equal(trainingPosition("2026-11-02").assessment, null);
assert.equal(trainingPosition("2026-11-09").week, 12);
assert.equal(trainingPosition("2026-11-15").phase, "taper");
assert.equal(trainingPosition("2026-11-15").assessment, null);
assert.match(trainingPosition("2026-11-15").weekPlan.load, /40~50%/);
for (const day of ["2026-11-16", "2026-12-14", "2026-12-21", "2026-12-28", "2027-01-03"]) {
  const pending = trainingPosition(day);
  assert.equal(pending.state, "planning");
  assert.equal(pending.block, null, "unconfirmed preseason must not run or inherit goal drafts");
  assert.equal(pending.week, null);
}
assert.equal(trainingPosition("2027-01-04").block.number, 1);
assert.equal(trainingPosition("2027-01-04").week, 1);
assert.equal(trainingPosition("2027-01-18").phase, "build");
assert.equal(trainingPosition("2027-03-28").week, 12);
assert.equal(trainingPosition("2027-03-29").state, "transition");
assert.equal(trainingPosition("2027-04-05").block.number, 2);
assert.equal(trainingPosition("2027-09-12").week, 10);
assert.equal(trainingPosition("2027-09-13").state, "paused");
assert.equal(trainingPosition("2027-09-13").week, null);
assert.equal(trainingPosition("2027-09-19").next.start, "2027-09-20");
assert.equal(trainingPosition("2027-09-20").week, 11);
assert.equal(trainingPosition("2027-09-20").assessment, "sweat");
assert.equal(trainingPosition("2027-10-03").week, 12);
assert.equal(trainingPosition("2027-10-03").block.quarter, 3);
assert.equal(trainingPosition("2027-10-04").block.quarter, 4);
assert.equal(trainingPosition("2027-12-26").week, 12);
assert.equal(trainingPosition("2027-12-27").state, "transition");
assert.equal(trainingPosition("2028-01-02").state, "transition");
assert.equal(trainingPosition("2028-01-03").state, "unplanned");

// Korea midnight must work for visitors whose device timezone differs.
assert.equal(trainingPosition("2026-10-18T14:59:59Z").week, 8);
assert.equal(trainingPosition("2026-10-18T15:00:00Z").week, 9);
assert.equal(trainingPosition("2026-11-15T14:59:59Z").week, 12);
assert.equal(trainingPosition("2026-11-15T15:00:00Z").state, "planning");
assert.equal(trainingDate("2027-02-30"), null);
assert.equal(trainingDate("not-a-date"), null);
assert.equal(trainingPosition(""), null);

// Every planned training day maps once to a valid week; 2027 has 48 training weeks.
let regularWeeks = 0;
for (const block of TRAINING_BLOCKS) {
  const weeks = trainingWeeks(block);
  if (block.planning) { assert.equal(weeks.length, 0); continue; }
  if (block.year === 2027) regularWeeks += weeks.length;
  assert.equal(weeks.at(-1).end, block.end);
  for (const week of weeks) {
    for (let i = 0; i < 7; i++) {
      const p = trainingPosition(addDays(week.start, i));
      assert.equal(p.block.id, block.id);
      assert.equal(p.week, week.number);
      assert.equal(p.state, "active");
    }
  }
}
assert.equal(regularWeeks, 48);

const first = trainingPosition("2027-01-18"), second = trainingPosition("2027-04-05");
assert.equal(classDirection(first, "gentle_strength").part, "UPPER");
assert.equal(classDirection(first, "bomb_strength").part, "LOWER");
assert.equal(classDirection(second, "gentle_strength").part, "LOWER");
assert.equal(classDirection(second, "bomb_strength").part, "UPPER");
assert.equal(classDirection(first, "gentle_sweat").part, null);
assert.equal(classDirection(trainingPosition("2026-11-02"), "gentle_strength").part, null);
assert.match(classDirection(current, "gentle_strength").prescription, /3세트 × 5~8회/);
assert.match(classDirection(current, "bomb_strength").prescription, /3~4세트 × 3~5회/);
assert.match(classDirection(current, "bomb_sweat").prescription, /4~8분 혼합/);
assert.match(classDirection(current, "nolto_team").prescription, /팀별 페이스/);
assert.match(classDirection(trainingPosition("2026-10-26"), "nolto_team").prescription, /분할 시뮬레이션/);
assert.match(classDirection(trainingPosition("2026-11-02"), "nolto_team").prescription, /80~90%/);
assert.equal(classDirection(current, "you_in"), null, "do not invent unprovided class prescriptions");
assert.equal(classDirection(first, "you_in"), null);
assert.match(classDirection(trainingPosition("2027-03-15"), "gentle_strength").focus, /부담을 조절/);
assert.match(classDirection(trainingPosition("2027-03-15"), "gentle_sweat").focus, /성장을 확인/);
assert.match(classDirection(trainingPosition("2027-03-22"), "bomb_strength").focus, /성장을 확인/);
assert.match(classDirection(trainingPosition("2027-03-22"), "bomb_sweat").focus, /부담을 조절/);
assert.equal(trainingClass({ class_type_id: "bomb_strength", title: "GENTLE STRENGTH" }), "bomb_strength");
assert.equal(trainingClass({ title: "GENTLE STRENGTH" }), "gentle_strength");
assert.equal(trainingClass({ title: "처음 운동" }), null);
console.log("PASS: HYROX week 9 anchor, all 12 weeks, taper, pending preseason, Seoul midnight, class guides and existing 2027 boundaries");
