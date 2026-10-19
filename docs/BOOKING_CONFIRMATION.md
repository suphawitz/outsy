# Booking confirmation and custom reporting dates

Updated 2026-10-19.

## Booking timing

The red “ไปหน้าชำระเงิน” button validates the local form and chosen schedule, then changes the local step only. It does not create bookings, travelers, storage objects, or seat-counter updates. Back/navigation before confirming payment leaves no booking in the database.

The blue “แจ้งชำระเงินเสร็จสิ้น” button validates the slip first, checks the authenticated user and latest schedule/capacity, then performs the existing booking/traveler/counter writes, uploads the receipt and updates the booking to pending review. No new policies, migration, RPC or schema changes are required.

A progress ref blocks concurrent submissions and reuses a completed booking and uploaded slip if a subsequent payment step fails, rather than creating another booking on an in-page retry. If booking creation fails after a known ID but before completing related writes, another creation is blocked and the user is directed to support. Going back is disabled after a known booking exists. The payment page displays no booking ID before confirmation.

The existing multi-request Supabase flow is not an atomic transaction. The in-memory retry checkpoint is scoped to the mounted page; it is not cross-reload idempotency or a database-level seat reservation lock. Existing permissions and partial-failure behavior still apply. No real payment, upload, booking or cancellation was made during QA.

## Dashboard dates

The existing month/all dropdown now includes “เลือกช่วงวันที่”. Two native calendar inputs select inclusive start/end dates. Reversed or incomplete ranges display validation and disable export. Summary values, package/province reports, and CSV use creation dates in Asia/Bangkok. In custom-range mode the monthly chart also counts only dates inside that range; a year selector appears if the range spans years. Existing month-mode annual-chart behavior remains unchanged.

## Validation

- Unit tests: slip required before writes, payment write ordering, retry reuse, calendar range validation/inclusive boundaries, and range-limited monthly totals.
- Isolated browser fixture: red button zero writes; Back zero writes; confirm without slip zero writes; confirm with valid synthetic PNG creates exactly one booking, one counter update, one upload and one payment status update, reaching success.
- A 19–23 October fixture included the start day and the last second of the end day in Bangkok, excluding the next day's first instant. Both summary and monthly chart reported two bookings, confirmed value 500 and pending-review value 1,000.
- Custom range layout checked at 320/375/768/1440px without document overflow.
- `npm test`: 35 passed; production build passed; `git diff --check` passed.
