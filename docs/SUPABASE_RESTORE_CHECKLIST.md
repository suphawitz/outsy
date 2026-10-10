# Restore existing OUTSY workflow — review only

Verified read-only against project sihfjdpefsozabdhwucd on 10 October 2026.
No SQL or settings changes have been applied. Local and Vercel using the same Supabase
project/JWT encounter the same policies; deployment does not create different RLS.
Historical local success does not prove today's policies were the same.

## Required changes/checks

| Area | Verified current state | Necessary action |
| --- | --- | --- |
| Booking creation | authenticated table INSERT grant exists; RLS permits writes only for database admin | Add customer INSERT policy tied to auth.uid(), initial unpaid state, real package/schedule and DB price. Draft ../supabase/review/allow-customer-booking-insert.sql addresses this error only |
| Customer booking updates | Admin-only writes | Allow own receipt submission, reschedule/refund requests through guarded mutations; protect owner, price, passenger count, package and admin-only approval states. A bare owner UPDATE policy cannot protect columns/transitions and is insufficient |
| Booking rollback | Frontend deletes newly created booking when traveler insert fails; admin-only DELETE | Provide constrained rollback or handle booking/travelers atomically. Do not allow arbitrary deletion of paid/history records |
| Travelers | Owner SELECT/INSERT policies already exist; identity generator exists | Keep existing ownership policies; verify insert with a test booking. No need to invent another traveler table |
| Schedule capacity | Admin-only UPDATE; frontend customer writes booked_count directly and ignores errors | Maintain counters through a guarded database operation/trigger or focused RPC and stop client-managed counter writes. Owner booking policy alone will not fix counters. Do not grant all customers arbitrary schedule UPDATE |
| Rescheduling | Frontend changes travel_date; admin approves status only | Coordinated old/new schedule capacity and tour_date_id updates are required; cannot be fixed solely by granting UPDATE |
| Refunds | Owner INSERT/SELECT already exist; frontend updates parent booking separately | Keep ownership; guard initial pending status and approved refund eligibility, and coordinate parent status with request. Verify authenticated sequence permission if serial-ID error occurs |
| Slip upload | Customer INSERT/SELECT/UPDATE policies absent; bucket private | Add owner/booking-specific INSERT/read policies for current paths: slip_<booking>_<timestamp>.*, slips/slip_<booking>_<timestamp>.*, bookbank/bb_<booking>_<timestamp>.*. Match booking owner server-side; existing objects must not be overwritten by another customer |
| Slip display | Frontend calls getPublicUrl; bucket private | Keep private; small frontend change to authenticated download or short-lived signed URL, including history/admin/bankbook viewers. SELECT policy alone does not make a public URL work |
| Admin marketing images | Admin uploads itinerary images into slips and uses public URLs | Upload public marketing images to tourist_images; existing marketing-only files require reviewed copy/reference update. Never expose the whole slips bucket |
| Signup/profile | handle_new_user trigger already creates customer profile; users has no imagee | Remove redundant frontend users insert/imagee. Do not grant public profile INSERT or add unused imagee just to hide that error |
| Admin identity | DB helper uses users.auth_id and role; old AdminRoute searches email | Verify existing admin profile maps to its Auth UUID. Small frontend auth_id lookup avoids email mismatch; never grant admin through signup metadata |
| Realtime | Publication includes users, provinces, Tour_Schedules only | Add bookings/refund_requests if auto-refresh is desired; no need to publish unrelated sensitive tables |
| Auth URLs | Dashboard URL settings not read in this audit | Authentication → URL Configuration: production Site URL https://outsy-three.vercel.app; allow /login and /update-password plus needed localhost URLs; verify SMTP/email provider |
| Vercel/local env | Must use same project, public key and account for comparison | Compare project URL (never send secret keys), clear stale sessions and sign in again. Do not use service_role in frontend |
| IDs | bookings, travelers, schedules, users already identity | No schema changes to these generators needed |
| Tours/admin policies | Public read + admin write policies already present | Keep existing policies; verify admin actions with a test account |

## Draft SQL boundaries

The accompanying INSERT policy adds customer-owned creation with initial state, price,
schedule and basic capacity checks. It does not update existing bookings or counters.
It is NOT a complete restoration and is NOT last-seat concurrency protection. Review
before applying once; repeated creation with the same policy name errors. Policy
rollback does not delete bookings created after application. Do not run the old large
remediation migrations as part of this checklist.

Do not use ALL/true policies, disable RLS, expose slips publicly, promote customers to
admin or embed service_role to get around errors. Owner UPDATE alone still permits
payment/price tampering unless guarded. Preserving the existing screens is possible,
but several small frontend/database mutation adjustments are required for safe full
operation. No database-only setting can make getPublicUrl read private objects.

## Realtime SQL for separate review (not applied)

BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='bookings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='refund_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.refund_requests;
  END IF;
END $$;
COMMIT;

Publication changes affect notifications, not stored rows. Keep RLS active and confirm
Realtime subscriptions only deliver permitted data. This is optional for manual refresh.

## Acceptance before declaring restored

Use one test customer and admin: create booking (with/without travelers), verify actual
seat increment, upload/preview slip, admin approve/reject, reschedule with correct old/new
counters, cancelled/refundable booking → bankbook/refund request → admin resolution.
Use customer B to confirm inability to read/update A's bookings/documents. Test last
seat concurrently. Check Console/Network; missing UPDATE policy can return 0 rows
without an error, so verify stored state rather than only success toasts.

Sources:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/buckets/fundamentals
