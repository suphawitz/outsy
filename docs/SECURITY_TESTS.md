# Security acceptance tests

## Scope and current evidence

Run `npm ci`, `npm run lint`, `npm test`, `npm run build` with Node 22 and public Supabase environment variables. The 20 Node tests cover path normalization/rejection, private namespaces, file type/header/size checks, Thai error mapping, authentication prerequisites, missing RPC failure, bigint IDs and rejection of client-controlled booking fields.

These are unit tests. Database integration, email delivery, mobile visual acceptance and concurrent booking are NOT verified by them. SQL grammar checks are NOT database execution. No migration has been applied by this task.

## Staging setup (after explicit migration approval)

Use an isolated project with the reviewed schema, migration order 001/002/003, synthetic data and two customer accounts A/B plus one database-assigned admin. Never promote a role through signup metadata. Create a future open schedule with capacity 1 and a known positive package price, plus another future schedule of the same package. Record initial counters. Use authenticated Supabase clients with the public key and each account's JWT; do not test customer authorization with service_role. Keep credentials out of logs/screenshots.

## Authentication

1. With Confirm email enabled, signup produces a customer profile via trigger even when signup has no session. Sign in after confirmation. With confirmation disabled, signup/session flow also works.
2. Duplicate signup, wrong password and expired recovery produce Thai UI messages without SQL details or enumeration through custom profile lookup.
3. Open a real recovery email, change password and sign in with the new password. Expired link must fail even if an older session exists.
4. As A, try `users.update({role:'admin'})` and changing auth_id/email: denied. Updating own username works. Metadata `{role:'admin'}` never grants admin access.
5. Sign out from history/detail/document/admin views: data and document blobs disappear. Back navigation cannot restore an authorized mutation.

## Ownership and direct mutation

1. Create one booking each for A/B. As A query B's booking/travelers/refund, open B's detail route and download B's slip/bankbook: no data or access. Repeat with anon; admin can review both.
2. As A directly INSERT/UPDATE/DELETE bookings, travelers and refunds: denied. Updating schedule booked_count or status directly: denied, including column-level grants.
3. Invoke admin RPC as A/anon: denied. Try to submit B's booking ID to every customer action: denied and counters unchanged.
4. Public users can read tours/schedules/provinces but cannot write provinces, tours or itineraries. Confirm admin can still manage public tour images.

## Trusted creation and concurrency

Use `outsy_create_booking({p_request:{request_id:crypto.randomUUID(),schedule_id:<ID>,customer_name:'Test A',customer_phone:'0812345678',special_diet:'',special_notes:'',travelers:[]}})` with an authenticated client. Names/phone are synthetic. JSON request is passed through Supabase `.rpc`.

1. Add owner/user_id, total_price, booking_status or booked_count to the request: reject. Stored owner is JWT user; total equals DB package price × validated passenger count.
2. Retry an identical request_id/payload: one booking, one seat reservation, same reference. Change payload with same ID: reject.
3. Submit invalid traveler/phone or closed/past/mismatched schedule: no booking, travelers or counter change. More than 10 passengers must reject.
4. Run A and B requests simultaneously with different request IDs against the last seat using `Promise.all`: exactly one succeeds; count is 1 and only one reservation exists. Repeat with groups and with cancel/reschedule racing against create.
5. Compare booked_count to sum(number_people) where seat_reserved for each schedule after every action. Never negative or above capacity. Verify rollback after any rejected action.

## Private documents

1. Upload genuine JPEG/PNG/WebP ≤5 MB to A's booking namespace and submit its object path. DB stores no public/signed URL. Preview uses authenticated download.
2. Reject oversized, renamed HTML/SVG, MIME/header mismatch and malformed/traversal/foreign-host paths in frontend. Direct upload must enforce server bucket MIME/size and ownership; client header validation is not server content scanning.
3. A cannot upload into B's namespace, overwrite existing objects, or delete a submitted object. Anon public URL cannot fetch slips. Admin can review private documents.
4. Test same-project legacy raw path and old public URL references; own owner/admin can preview, B cannot. Encoded/unusual legacy references require reviewed mapping, not relaxed public policy.
5. Close preview/sign out/change accounts during a download: no stale document remains visible. Check legacy tour marketing images separately after reviewed relocation to tourist_images.

## State transitions

1. New booking → submit slip → admin approve → paid. Reject slip returns unpaid. Approve without receipt/approve twice must not corrupt state or seats.
2. Cancel unpaid/review/paid before travel day: releases seats once; repeat cannot decrement twice. Paid cancellation is refundable; unpaid cancellation cannot request refund.
3. Request reschedule retains original date/seats until admin approval. Approval atomically moves seats only if target is valid and has capacity. Full/closed target rejects without moving old reservation. Reject restores prior status.
4. Request refund requires approved refundable booking, valid account/phone and own private bankbook. Duplicate request cannot create duplicate pending refunds. Admin mark-refunded updates both records; reject retains audit history and restores refundable state.
5. Cancel a schedule atomically cancels active reservations and releases counters, retains history and prevents new creation. Completed trip cannot be cancelled by this action. Referenced schedules cannot be deleted.
6. Invalid/out-of-order actions and cross-account actions leave all rows/counters unchanged. Verify all Thai status strings against migration transition table.

## Browser and release gate

At 375 px and desktop widths test navbar, signup/login/recovery, package detail, booking travelers/payment, history private previews and admin actions. Check no horizontal overflow, assets/route refreshes succeed, and QR visibly says simulation/not for real payment. Test production URL auth redirects after deploy. Record account roles, actions, expected/actual result and sanitized errors; do not mark release ready until database/email/browser scenarios pass.
