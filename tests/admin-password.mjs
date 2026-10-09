import assert from "node:assert/strict";
import { passwordHandler } from "../supabase/functions/ntac-admin-password/handler.js";
let role = "member",
  targetRole = "member",
  calls = 0;
const client = {
  auth: {
    getUser: async (t) =>
      t === "valid" ? { data: { user: { id: "actor" } } } : { error: "bad" },
    admin: {
      updateUserById: async () => {
        calls++;
        return {};
      },
    },
  },
  from: () => ({
    select: () => ({
      eq: (_, id) => ({
        single: async () => ({
          data: { role: id === "actor" ? role : targetRole },
        }),
      }),
    }),
  }),
};
const handler = passwordHandler(
  () => client,
  () => "server-only-test-value",
);
const body = {
  target_id: "11111111-1111-4111-a111-111111111111",
  password: "new-secret-test-only",
};
const req = (token = "valid", payload = body) =>
  new Request("http://test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
assert.equal((await handler(req("invalid"))).status, 401);
assert.equal((await handler(req())).status, 403);
role = "coach";
assert.equal((await handler(req())).status, 403);
role = "admin";
assert.equal(
  (await handler(req("valid", { ...body, password: "short" }))).status,
  400,
);
targetRole = "owner";
assert.equal((await handler(req())).status, 403);
assert.equal(calls, 0);
targetRole = "member";
const result = await handler(req());
assert.equal(result.status, 200);
assert.equal(calls, 1);
assert.deepEqual(await result.json(), { success: true });
console.log(
  "PASS: invalid session, member/coach denial, protected staff account, password validation, admin member update",
);
