# PT management checks

- `pt-database.sql`: run through an administrative Postgres connection. Uses existing profile IDs for transaction-local fixtures and ends in ROLLBACK. Covers completion retry, package limit, cancellation reversal, owner/other-member reads, private-note isolation, and forbidden member writes. Requires an admin and two member profiles.
- `pt-ui.mjs`: from `web`, run `NTAC_TEST_MODULES=/path/to/node_modules node ../tests/pt-ui.mjs` with jsdom installed at that path. Uses fake in-memory Supabase responses; never calls production. Covers member selection, workout template, controlled inputs, saving, refreshed balances, and member summaries.
- `npm run build` and `npm run lint` from `web`.

Production migrations were applied with Supabase MCP and are recorded under `supabase/migrations`. Existing schema predates this checkout; these files are additive changes, not a full database baseline.

PT onboarding: sign up using PT 회원 가입; coach opens 마이 → 관리자 → PT 관리, enrolls the existing account, adds a package and schedules a session. Existing NTAC members can also be enrolled without changing their membership. Completed sessions count once toward the associated package; reverting to scheduled/cancelled restores the count. PT data is admin-written, owner-readable; private notes and templates are admin-only.
