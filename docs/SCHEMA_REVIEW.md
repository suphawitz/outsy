# Schema and policy review — 2026-10-10

Source: owner-provided `outsy_audit` JSON from the read-only SQL audit in this chat.
The anonymous OpenAPI endpoint returned 401. Public tour REST and Auth settings
returned 200 using the local public key. No customer records were fetched.
The supplied SQL export, rather than anonymous introspection or old README, is the
basis for the draft migrations. Live migrations have not been executed.

Verified existing fields relevant to the changes:
- users: user_id bigint PK, auth_id uuid unique, username/email/role varchar; no imagee.
- bookings: booking_id bigint PK, user_id uuid FK auth.users, package_id varchar,
  tour_date_id bigint (no schedule FK), travel_date/old_travel_date varchar,
  customer_name/email/phone varchar, number_people integer, total_price numeric,
  booking_status/slip/special_diet varchar, special_notes text, created_at timestamptz.
- booking_travelers: traveler_id bigint PK, booking_id bigint FK, full_name/phone text.
- Tour_Packages: package_id varchar PK, price bigint, max_people integer, status varchar.
- Tour_Schedules: schedule_id bigint PK, package_id varchar FK, travel_date date,
  min_capacity/max_capacity/booked_count integer, status varchar; unique package/date.
- refund_requests: id integer sequence PK, booking_id bigint FK, customer_name,
  bank_name/account_no/account_name/email/phone/book_bank_url/status text.
- Bigint column defaults were null in the export; identity flags were not exported.
  Migration 001 explicitly verifies the two required ID generators and aborts if absent.

Verified policies/state:
- Auth trigger uses public.handle_new_user() to create customer profiles in public.users.
- private.outsy_is_admin() reads the database role by auth.uid(); fixed empty search_path.
- Profile SELECT is owner/admin; UPDATE RLS only checks ownership, not column permissions.
  Migration additionally revokes table/column writes and grants username UPDATE only.
- Customer booking writes denied; customer travelers/refunds INSERT still permitted.
  Migration removes those INSERT policies and revokes direct writes, including column grants.
- Tour reads public, writes admin-only. Schedule UPDATE/DELETE will be RPC-only.
- slips private; only admin Storage policies exist. No customer document policy exists yet.
- tourist_images public and has admin-only write policies.
- provinces still has a public ALL/true policy named All; separate migration removes it.

New schema (explicit additions, not assumed existing columns): bookings.request_id,
request_fingerprint, requested_schedule_id, status_before_request, seat_reserved,
payment_approved, two unique indexes and capacity/passenger constraints.
Legacy normalization/counter reconciliation is guarded and must be reviewed first.
