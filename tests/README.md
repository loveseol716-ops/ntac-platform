# PT calendar and booking checks

- `pt-booking.sql`: administrative SQL transaction with ROLLBACK. Covers availability, booking retry, overlapping booking rejection, cancellation/rebooking, remaining reservation capacity, completion/undo, log visibility, and forbidden member writes. Requires an admin and two unregistered member profiles.
- `service-permissions.sql`: administrative SQL transaction with ROLLBACK. Covers PT/NTAC/both assignment, coach registration, assigned coach writes, and member/private-note isolation.
- `ux-browser.cjs`: Playwright browser tests using synthetic sessions and intercepted Supabase responses. Covers coach availability creation, calendar navigation, three-field log save, completion/undo, member booking and next appointment, mobile layout, and PT/NTAC routing.
- `npm run build` and `npm run lint` from `web`.

For browser tests, start Vite on port 5175 with `VITE_SUPABASE_URL=https://test.supabase.co` and `VITE_SUPABASE_PUBLISHABLE_KEY=test-key`. Set `CODEX_PRIMARY_RUNTIME_NODE_MODULES` to a directory with Playwright installed, and optionally `CHROMIUM_PATH` to an installed Chromium binary. Run `node tests/ux-browser.cjs` from the repository root. The script never sends data to production.

## Current flow

Admin assigns PT and coach in 관리 → 전체 회원 → 배정. Coaches open their calendar, choose a date, and set 예약 가능 시간 설정. A time range creates 60-minute slots. Members choose an open date/time and confirm their booking. Reserved sessions consume reservation capacity, but the displayed remaining balance only decreases when the coach presses 운동 완료. 완료 취소 restores that count; 예약 취소 releases the reservation. Member booking changes/cancellations are handled by the coach. Closing availability never cancels an existing booking.

Class notes have only Warm-up, Main and 특이사항, all visible to the member. Legacy assessments and structured records remain stored but are no longer exposed as editing UI. Existing private coach notes are not migrated into shared notes.

Migrations are under `supabase/migrations`; the existing database schema predates this checkout.
