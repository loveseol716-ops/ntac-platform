import assert from "node:assert/strict";
import { passwordHandler } from "../supabase/functions/ntac-admin-password/handler.js";
// Reproduce production ACLs: service_role has no profiles SELECT permission.
let role = "member",
  targetRole = "member",
  calls = 0,
  lookupError = false;
const handler = passwordHandler(
  (url, key, opts) => {
    assert.equal(url, "https://test.invalid");
    const privileged = key === "server-only-key";
    if (privileged)
      assert.equal(
        opts.global,
        undefined,
        "Auth Admin must not inherit member bearer",
      );
    else {
      assert.equal(key, "public-key");
      assert.equal(opts.global.headers.Authorization, "Bearer valid");
    }
    return {
      auth: {
        getUser: async () => ({ data: { user: { id: "actor" } } }),
        admin: {
          updateUserById: async (id, payload) => {
            assert(privileged);
            assert.equal(id, body.target_id);
            assert.equal(payload.password, body.password);
            calls++;
            return {};
          },
        },
      },
      from: () => ({
        select: () => ({
          eq: (_, id) => ({
            single: async () =>
              privileged
                ? { error: { code: "42501" } }
                : lookupError
                  ? { error: { code: "test" } }
                  : { data: { role: id === "actor" ? role : targetRole } },
          }),
        }),
      }),
    };
  },
  (key) =>
    ({
      SUPABASE_URL: "https://test.invalid",
      SUPABASE_ANON_KEY: "public-key",
      SUPABASE_SERVICE_ROLE_KEY: "server-only-key",
    })[key],
);
const body = {
  target_id: "11111111-1111-4111-a111-111111111111",
  password: "new-secret-test-only",
};
const req = (payload = body) =>
  new Request("https://test.invalid", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
assert.equal(
  (await handler(new Request("https://test.invalid", { method: "POST" })))
    .status,
  401,
);
assert.equal((await handler(req())).status, 403);
role = "coach";
assert.equal((await handler(req())).status, 403);
role = "admin";
assert.equal((await handler(req({ ...body, password: "short" }))).status, 400);
targetRole = "owner";
assert.equal((await handler(req())).status, 403);
assert.equal(calls, 0);
targetRole = "member";
lookupError = true;
const failure = await handler(req());
assert.equal(failure.status, 503);
assert(!JSON.stringify(await failure.json()).includes("권한이 필요"));
lookupError = false;
for (const r of ["admin", "owner"]) {
  role = r;
  const result = await handler(req());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { success: true });
}
assert.equal(calls, 2);
// A rejected/expired token never reaches profile queries or password mutation.
const invalid = passwordHandler(
  () => ({
    auth: { getUser: async () => ({ error: { message: "invalid" } }) },
  }),
  () => "test",
);
assert.equal((await invalid(req())).status, 401);
console.log(
  "PASS: production service_role ACL regression, caller-scoped lookups, owner/admin password change, invalid-session/member/coach/staff-target denials, truthful lookup errors",
);
