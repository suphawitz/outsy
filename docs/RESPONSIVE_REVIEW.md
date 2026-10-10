# Responsive layout review

Reviewed on 2026-10-10. This change covers all nine routed pages, the shared navbar, loading and not-found views. It keeps the existing booking, authentication and database operations.

## Changes

- Mobile navigation uses two rows, with space for account and admin controls.
- Sidebars and page columns stack on tablets; forms and cards stack on phones.
- Package filters can be expanded on mobile/tablet, and province choices wrap.
- Home search, traveler fields, booking status steps and admin navigation adapt to narrow screens.
- Calendar keeps seven columns. Dialogs fit the viewport and scroll internally.
- Mobile input fonts avoid automatic zoom; controls have suitable touch sizes.

## Validation

- Browser layout checks on Home, TourPackages, TourDetail, Booking, BookingHistory, BookingDetail, Login, UpdatePassword and AdminDashboard at 320, 375, 768 and 1440px: document width stays within the viewport.
- Additional checks: expanded package filters; login/signup/forgot views; extra traveler fields; refund and reschedule dialogs; admin schedules, package creation, calendar, reschedule and refunds, including refund details.
- Protected routes were rendered using a temporary, local, read-only fixture server that bundles the actual components. Fixture writes are disabled; no authentication bypass or fixture is included in the app.
- Public package page was also checked on the normal Vite dev server with live Supabase reads at 375px.
- `npm test`: 13 passed. `npm run build`: passed. `git diff --check`: passed.
- The repository has no configured runnable lint script. Visual checks do not confirm production booking writes or Supabase RLS permissions.

No Supabase migrations, settings or production records were changed for this review.
