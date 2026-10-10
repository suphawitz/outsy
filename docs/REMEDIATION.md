# OUTSY remediation report — 10 October 2026

## Outcome

Frontend remediation and separately reviewable SQL are prepared. No migration was
executed; no commit, push or deployment was performed. The app builds successfully,
but booking mutations require the approved migrations and staged integration tests
before release. Missing RPCs fail closed with a Thai message.

## Root causes and changes

| Root cause | Remediation |
| --- | --- |
| Signup inserted a profile with nonexistent imagee; email-based identity and UI roles were unreliable | Trigger-only signup profile; verified Auth user, auth_id lookup, database role check; Thai errors and recovery handling |
| Browser supplied price/owner/status and wrote booking, travelers and seats separately | Atomic RPC creation, DB price and identity, idempotent request IDs, validated travelers, locked capacity and explicit state transitions |
| Customer/admin actions directly changed financial state and counters | Owned customer RPC/admin-checked RPC; no direct mutation fallback; SQL revokes table/column grants; financial/history records retained |
| Private slips had public URL viewers; customer upload policy missing | Owner/booking namespace, private authenticated blob previews, object paths in DB, MIME/header/size checks and reviewed legacy-reference plan |
| provinces had a public ALL/true policy | Separate SQL removes the observed broad policy and restricts writes to admins |
| Build alone did not test trust boundaries | Runnable unit tests, SQL grammar checks and documented multi-account/concurrency acceptance tests |

## Changed files

- Auth: `src/client.js`, `src/pages/Login.jsx`, `src/pages/UpdatePassword.jsx`, `src/components/Navbar.jsx`, `src/components/AdminRoute.jsx`.
- Booking and admin: `src/pages/Booking.jsx`, `src/pages/BookingHistory.jsx`, `src/pages/BookingDetail.jsx`, `src/pages/AdminDashboard.jsx`; public schedule filtering in `src/pages/TourDetail.jsx`, `src/pages/TourPackages.jsx`.
- New shared boundaries: `src/lib/errors.js`, `src/lib/documents.js`, `src/lib/bookingApi.js`, `src/services/booking.js`, `src/services/documents.js`, `src/components/PrivateDocumentImage.jsx`.
- Verification: `tests/security.test.js`, `scripts/check-sql.py`, `eslint.config.js`, `package.json`, `package-lock.json`.
- Database review: `supabase/deployment-audit.sql`, three files under `supabase/migrations/`, migration README and `docs/SCHEMA_REVIEW.md`.
- Guidance: `DEPLOYMENT.md`, `README.md`, this report and `docs/SECURITY_TESTS.md`.

## Verification actually run

- Node 22.18.0 clean install: `npm ci --offline --no-audit` passed using final lockfile.
- `npm run lint`: passed, no errors or warnings.
- `npm test`: 20 passed, 0 failed.
- `npm run build`: passed, Vite 6.4.4, 101 modules transformed; public environment guard passed.
- `git diff --check`: passed.
- pglast 8.5 parsed all three SQL files, four PL/pgSQL functions and DO blocks; grammar only, no database connection/execution. Reproduce with pglast installed and `python scripts/check-sql.py`.
- Read-only public-key Auth settings and a zero-row public tour query responded HTTP 200. This does not prove customer/admin RLS or RPC correctness. The Supabase OpenAPI root returned 401, so the owner's SQL audit export is the schema source.

No end-to-end authenticated booking/payment/refund, email recovery, simultaneous last-seat
booking or mobile visual acceptance was run for this final version. No claim is made
that unit tests or SQL syntax checks establish those results. Follow SECURITY_TESTS.md.

## Release blockers and review decisions

1. Approve and test migration 001/002/003 on staging. The current supplied audit has no booking RPCs or customer Storage policies; frontend mutations therefore cannot work until installed.
2. Resolve any preflight failures from legacy statuses, missing ID generators, mismatched schedules, duplicate pending refunds or over-capacity data. Never disable checks to force migration.
3. Review cancelled legacy payment evidence and old image locations. Only proven marketing images may move to public storage. Unusual legacy document paths require explicit mapping.
4. Verify A/B/admin isolation, direct-write denial, idempotency, rollback, state transitions and last-seat concurrency against the actual database.
5. Verify Vercel environment/branch settings and Supabase production redirect URLs, confirmation/recovery emails and mobile/browser behavior.

QR remains a mock, as requested; no actual transfer/refund processing is added.
Unpaid reservations require manual cancellation; automatic expiry/rate limiting is
outside this demo scope. Workflow RPCs use a coarse transaction lock for correctness
in the demo; higher traffic needs a reviewed locking strategy. File header checks
in the browser do not replace server content scanning. See migration README for
exact transition rules, grants, legacy procedure and limitations.
