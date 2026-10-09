# PT management checks

- `pt-database.sql`: administrative SQL transaction ending in ROLLBACK. Checks completion retry, package limits, cancellation reversal, and member/private-note isolation.
- `service-permissions.sql`: administrative SQL transaction ending in ROLLBACK. Checks PT/NTAC/both assignment, coach registration, assigned coach writes, and forbidden cross-member access.
- `pt-ui.mjs`: from `web`, run `NTAC_TEST_MODULES=/path/to/node_modules node ../tests/pt-ui.mjs` with jsdom available. Checks template, controlled inputs, session save, balance refresh and private-note exclusion using fake responses.
- `ux-browser.cjs`: run with Playwright and a local Vite server using test Supabase environment variables. Synthetic sessions and intercepted responses cover assignment, mobile overflow, service routing and removal of retired UI. See the script for runtime paths.
- `npm run build` and `npm run lint` from `web`.

Migrations are recorded under `supabase/migrations`. Existing schema predates this checkout; these files are additive changes, not a full baseline.

New accounts wait for admin assignment. In 관리 → 전체 회원 → 배정, select PT, NTAC or both and the responsible coach. Register coaches in 코치·권한. PT 관리 shows latest attendance, upcoming sessions and remaining counts; member details contain session records, assessments and package settings. Assigned programs have no access expiry. Completed PT sessions count once toward their package; reverting to scheduled/cancelled restores the count. Only administrators change service assignments, coaches and packages. Assigned coaches manage their own PT members; private notes remain hidden from members.
