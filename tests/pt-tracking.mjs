import assert from "node:assert/strict";
import {
  periodFor,
  trackingStats,
  weeklyStats,
} from "../web/src/pt/tracking.js";
assert.deepEqual(periodFor("2027-01-01", "week"), {
  first: "2026-12-28",
  last: "2027-01-03",
});
assert.deepEqual(periodFor("2028-02-15", "month"), {
  first: "2028-02-01",
  last: "2028-02-29",
});
const rows = [
  { session_date: "2027-01-02", start_time: "09:00", status: "completed" },
  { session_date: "2027-01-02", start_time: "13:00", status: "completed" },
  { session_date: "2026-12-31", start_time: "10:00", status: "completed" },
  { session_date: "2027-01-03", start_time: "09:00", status: "scheduled" },
  { session_date: "2027-01-04", start_time: "09:00", status: "cancelled" },
];
const stats = trackingStats(rows, "2027-01");
assert.equal(stats.current, 2);
assert.equal(stats.days, 1);
assert.equal(stats.total, 3);
assert.equal(stats.latest.start_time, "13:00");
assert.deepEqual(stats.months.slice(-2), [
  { key: "2026-12", count: 1 },
  { key: "2027-01", count: 2 },
]);
assert.equal(trackingStats([], "2027-01").total, 0);
console.log(
  "PASS: year/leap boundaries, unique exercise days, chronological latest and completed-only totals",
);

assert.deepEqual(weeklyStats(rows, "2027-01-03").at(-1), {
  key: "2026-12-28",
  last: "2027-01-03",
  count: 3,
});
assert.equal(weeklyStats(rows, "2027-01-04").at(-1).count, 0);
