# SQL review package — NOT APPLIED

Review the owner's schema export summarized in `docs/SCHEMA_REVIEW.md` first.
These files were syntax-checked, not executed on a database. SQL/PLpgSQL grammar
checks do not verify grants, metadata semantics, data compatibility or concurrency.
No automation invokes these migrations. Obtain explicit owner approval before use.

## Order and gates

1. `20261010_001_trusted_booking.sql`: new workflow columns, guarded legacy
   reconciliation, RPCs, removal of direct booking writes, username-only profile
   UPDATE, schedule UPDATE/DELETE via RPC only.
2. `20261010_002_private_documents.sql`: 5 MB JPEG/PNG/WebP bucket restrictions and
   owner/booking-specific Storage INSERT/SELECT. Keeps the bucket private and existing
   admin policies. No customer object UPDATE/DELETE or upsert.
3. `20261010_003_province_policy.sql`: remove the observed public ALL/true policy
   on provinces, retaining public reads and restricting writes to admins.

All files use transactions; they are one-time migrations, not rerunnable scripts.
Use a staging database first, then run the integration checks in `docs/SECURITY_TESTS.md`.
Take a database/Storage backup and review the reconciliation during a maintenance
window before applying to production. Do not deploy this frontend's workflow against
an unapproved/missing RPC and expect booking mutations to work.

001 intentionally ABORTS if ID generators are missing, statuses are unknown or
legacy reschedule/refund requests are pending, active bookings cannot be mapped to
unique package/date schedules, refund requests have duplicate pending records, or
actual reservations exceed max capacity. Do not remove the checks to force it through.
Review each affected legacy record and decide its correct status/seat/payment state.
Identity flags were not included in the owner's export; the migration checks them.
Existing active reservations are counted from bookings and booked_count is reconciled.
No booking is silently dropped. No broad customer write policy is introduced.

Legacy cancelled records are NOT assumed to have approved payments just because a
slip exists. `payment_approved` remains false unless a known paid/completed/refunded
state proves it. An administrator must review receipts/history and explicitly approve
any separate data correction before refunds/rescheduling for these legacy cancellations.
Do not infer payment approval from client data or the mere existence of a receipt.

## Trust and transition model

Every workflow RPC requires auth.uid(); ownership is always bookings.user_id.
Admin RPCs additionally require the verified private.outsy_is_admin() database helper.
SECURITY DEFINER functions use an empty search_path and qualified names, are revoked
from PUBLIC/anon and granted only to authenticated. Private mutation helpers are not
client-executable. Direct table AND old column-level writes are revoked. SELECT keeps
existing ownership/admin RLS. Schema changes add columns explicitly; none are assumed.

| Action | Allowed source | Result | Seats |
| --- | --- | --- | --- |
| create | authenticated + open future/today schedule | รอชำระเงิน | reserve atomically |
| submit_slip | รอชำระเงิน / รอตรวจสอบยอด, not approved | รอตรวจสอบยอด | unchanged |
| approve_payment (admin) | รอตรวจสอบยอด with receipt/reservation | ชำระเงินแล้ว | unchanged |
| reject_slip (admin) | รอตรวจสอบยอด, not approved | รอชำระเงิน | unchanged |
| cancel (customer) | unpaid/review/paid, before travel day | ยกเลิก or ยกเลิก (คืนเงินเต็มจำนวน) | release once |
| cancel_booking (admin) | unpaid/review/paid/reschedule | cancelled, based on approval | release once |
| cancel_schedule (admin) | schedule with no completed trip | close schedule, cancel active reservations | release atomically |
| request_reschedule | paid / refundable cancellation | ขอเปลี่ยนวันเดินทาง | unchanged; original date retained |
| approve_reschedule (admin) | pending request + valid target capacity | ชำระเงินแล้ว at new schedule | release old/reserve new atomically |
| reject_reschedule (admin) | pending request | restore prior state | unchanged |
| request_refund | refundable cancellation + approved payment + private bankbook | ส่งเรื่องขอคืนเงินแล้ว | already released |
| mark_refunded (admin) | matching pending refund | คืนเงินเรียบร้อยแล้ว | unchanged |
| reject_refund (admin) | matching pending refund | refundable cancellation, request retained | unchanged |
| complete (admin) | paid, travel day reached | ทริปเสร็จสิ้น | historical reservation retained |

No actual transfer/payment processing occurs. Refund/receipt statuses are demo review
states. Rejecting requests preserves financial records instead of deleting them.
Schedule deletion is allowed only when no booking/history/request references it.
The UI retains the existing tour-management direct writes protected by admin RLS;
booking financial/status changes use RPC exclusively.

Booking requests have (owner, request_id) uniqueness plus a payload fingerprint.
Retries with the same payload return the same reference; changed payloads with the
same ID are rejected. A transaction-level advisory lock serializes workflow mutations
for the demo, and schedule row locks protect the capacity check/update. At higher
traffic this coarse lock should be replaced by a documented consistent row-lock order.
Price comes from the locked package row, passenger count from validated travelers,
and booking/travelers/capacity writes commit or roll back together.

Unpaid reservations do not auto-expire in this scoped demo. Administrators must cancel
stale reservations. Add reviewed hold-expiration/rate-limit rules before real operation.

## Legacy private documents and public tour images

- New paths: `<auth UUID>/<booking bigint>/<slip|bookbank>/<random UUID>.<jpg|png|webp>`.
- New database values contain only private paths, even the existing `book_bank_url`
  field. No permanent public URL or signed token is persisted.
- Frontend converts same-project legacy public/authenticated/signed Storage URLs to
  paths, and downloads with the user's JWT. RLS checks the booking/refund reference.
  Customer prefix guessing alone never authorizes another customer's files.
- 002 supports the old generated unencoded public URLs/raw paths by matching stored
  references. Encoded names, foreign hosts or unusual old URLs fail closed and require
  an administrator-reviewed explicit path mapping. Do not add public SELECT as a fix.
- Inventory old values and object existence in the dashboard, map each to its booking
  owner, normalize references to paths, then optionally copy to the new namespace via
  the Storage API. Update references only after the copy is verified. Apply any data
  migration separately after review. Keep a mapping/backup for rollback.
- Private blobs are downloaded afresh on preview; object URLs are revoked when closed,
  unmounted or signed out. No browser URL navigation to legacy public documents.
- Old tour/itinerary images stored under `slips/itineraries` cannot be made public by
  loosening slips RLS. Admins must identify ONLY legitimate marketing images, copy
  them to tourist_images and update the relevant tour/itinerary reference. Never copy
  receipts or bankbooks to a public bucket. New admin tour uploads already use
  tourist_images under the verified admin-only upload policy.
- Failed uploads/requests can leave unreferenced private objects. Customer deletion is
  deliberately denied to avoid racing with receipt submission. Review old unreferenced
  objects and remove via Storage API maintenance, never SQL DELETE on storage.objects.
- Client file-header checks are UX defense; bucket MIME/size limits, Storage ownership
  policies, immutable paths and RPC checks are the server authorization boundary.
