import assert from "node:assert/strict";
import { passUsage, currentBalance } from "../web/src/pt/passes.js";
const p1 = {
    id: "first",
    total_sessions: 10,
    starts_on: "2026-01-01",
    expires_on: "2026-02-01",
  },
  p2 = {
    id: "second",
    total_sessions: 10,
    starts_on: "2026-02-02",
    expires_on: "2026-05-01",
  };
const sessions = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  package_id: "first",
  status: "completed",
}));
sessions.push(
  { package_id: "second", status: "completed" },
  { package_id: "second", status: "scheduled" },
  { package_id: "second", status: "cancelled" },
);
assert.equal(passUsage(p1, sessions, "2026-02-03").state, "사용 완료");
assert.equal(currentBalance([p1, p2], sessions, "2026-02-03"), 9);
assert.equal(passUsage(p2, sessions, "2026-02-03").available, 8);
assert.equal(currentBalance([p2], sessions, "2026-05-02"), 0);
assert.equal(passUsage(p2, sessions, "2026-05-02").remaining, 9);
assert.equal(passUsage(p2, sessions, "2026-05-01").available, 8);
console.log(
  "PASS: renewed passes, reservations, expired balance, inclusive last day",
);
