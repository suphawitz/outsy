# Admin overview

The default “ภาพรวม Dashboard” tab under `/admin` was added on 2026-10-12 and simplified following user review.

## Current contents

- A time selector: choose a calendar month/year, or all bookings through today. The default is the current month. There is no package filter.
- Four metrics: bookings, confirmed booking value, pending payment value and pending review value.
- Current work queues linked to existing payment review, payment follow-up, date-change and refund tabs.
- Deduplicated pending/completed refunds.
- Ranked packages for the selected period, expandable beyond the first five.

Removed after review: the four traveler/customer/average/confirmation-ratio cards; booking trends and status charts; financial status breakdown; future departures; category demand; package catalog; recent bookings; data-quality panel.

## Data and access

Read-only SELECTs use existing `bookings`, `Tour_Packages`, `refund_requests` and `provinces` tables, the existing signed-in admin session and RLS policies. No schema, policy, setting, migration, RPC, privileged key or new dependency is required. The overview no longer fetches departure data, customer names/emails or traveler identities.

Ordered pagination checks exact counts and duplicate IDs. Failed/incomplete reads hide totals and show an error rather than reporting zero. Reads reflect rows visible to the admin and are not an atomic multi-table snapshot; refresh after concurrent edits.

Calendar-month bounds include the complete selected month, including leap-year February. Booking dates use Asia/Bangkok. “All” includes creation dates through today. Confirmed value includes current paid/completed bookings only; cancellation/refund requests are excluded. A completed refund takes priority over duplicate pending requests. Refund value is estimated from the booking's recorded total once per booking.

Work queues and refund summaries use all current data and do not change with the selected booking month. Package ranking uses the selected month. The dashboard does not claim accounting revenue, profit, actual refund transfer amounts or historical payment events.

## Verification

`npm test`: 29 passed. `npm run build` and `git diff --check`: passed.

Browser QA used actual components with a temporary local read-only fixture client: month selection, all selection, absence of removed sections and package filtering, and document widths at 320/375/768/1440px. Fixtures and auth substitution are not included in the app. Real authenticated reads require signing in as an admin at `/admin`.

## Added report charts

Following the supplied reference image, retain the existing four top cards and add:

- Top five packages by active booking count for the selected period (horizontal bars accommodate long names on phones).
- Province donut based on passenger counts in active bookings, joined through each package's primary province_id and provinces.provincename. Multi-province tours count once under their primary province. Unmapped IDs appear as “ไม่ระบุจังหวัด”; they are not inferred from tour names.
- Twelve-month confirmed booking value and booking count chart for the selected calendar year. A month filter sets the chart year, while “all” offers a year selector. The monthly chart intentionally shows the full year, independently of the selected month.
- Accessible expandable data tables and UTF-8 CSV export containing the current top packages, all province totals and the selected year's monthly values. No customer identities are exported.

Browser checks covered all four responsive widths, month/all state and the monthly data table. Export was downloaded successfully to the normal Downloads folder; parsed CSV values matched the synthetic fixture's province totals and September/October values. Browser download-event tracking timed out, so the saved file was verified directly. No Supabase settings or records were changed.
