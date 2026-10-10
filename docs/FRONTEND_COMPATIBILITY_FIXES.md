# Frontend compatibility repairs — 10 October 2026

Preserves current screens and direct-table workflow. Does not reintroduce the previous
large RPC migrations. No Supabase data or policy is changed by these frontend edits.

Changes:
- Signup relies on the existing handle_new_user trigger; removes redundant users insert
  and nonexistent imagee field. Confirmation flow remains unchanged.
- AdminRoute verifies getUser and looks up role by auth_id; history queries own user_id.
- History/admin receipt and bankbook viewers download authenticated blobs from private
  slips. Legacy same-project public/signed references normalize to paths; foreign or
  unsafe references fail closed. Object URLs revoke on close/unmount/sign-out/account
  change. No permanent public document URL is generated or newly saved.
- Uploads validate JPEG/PNG/WebP header, MIME and 5 MB size, use upsert:false and save
  private object paths. Existing legacy filename patterns are retained for compatibility
  with the reviewed Storage policy requirements.
- New admin itinerary images upload into public tourist_images, retaining admin RLS.
  Existing marketing images in slips are not automatically moved or made public.
- Customer payment/slip/reschedule/refund updates check changed rows. Refund bankbook
  failure stops submission. A saved refund request with failed parent status update is
  reported as partial failure, not success.
- Booking displays a Thai RLS denial. Failed traveler rollback/capacity writes report
  the existing booking ID and block another creation within that mounted page. This
  is NOT persistent idempotency; after refresh users must review history before retry.

Remaining Supabase work:
- Customer booking INSERT policy, guarded customer status updates, private Storage
  owner upload/read rules, and coordinated seat/reschedule management are still needed.
- Current direct counter writes are detected when denied; they have NOT become atomic
  or concurrency-safe. No broad customer schedule UPDATE policy is added. Once a
  guarded server-side counter mechanism is approved, replace direct browser counters
  in a focused follow-up; do not run both mechanisms or seats may increment twice.
- Current refund/booking writes are still separate operations. Reviewed database
  coordination remains necessary for all-or-nothing behavior.
- Existing admin financial flows remain unchanged. These edits do not certify all
  database transitions or replace actual multi-account integration testing.
- Auth production redirect URLs and optional Realtime publication still need checking.

Verification: test-first Node suite covers legacy path handling, unsafe references,
file validation, denied private downloads and zero-row mutation failures. Run npm test.
Production build and clean install are checked separately. No authenticated live writes
or end-to-end booking/upload were performed. Existing project has no runnable npm lint
script/dependencies; no lint success is claimed. Existing baseline ESLint config remains.
