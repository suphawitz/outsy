# Live deployment smoke test — 10 October 2026

Target: https://outsy-three.vercel.app (existing workflow).
Observed production entry asset: /assets/index-CdewYDTZ.js, matching the restored local build.
No database/schema mutations, test account creation, bookings, uploads or payments were performed.

| Check | Actual result |
| --- | --- |
| Home | Loads recommended tours; 9 observed images including logo loaded |
| Packages/direct refresh | Loads 11 packages; refresh does not produce Vercel 404 |
| Province filter | Nan filter shows 2 packages |
| Package detail PKG-MU09 | Price 1,490, itinerary and future schedule options load |
| Guest starts booking | Login-required modal then login navigation |
| Guest history | Login-required screen; no booking data displayed |
| Guest admin direct route | Redirects to login |
| Login empty submit | Browser required-field validation prevents submission |
| Signup UI | Form switches and displays name/email/password; signup NOT submitted |
| Recovery route without session | Invalid/expired-link message, no password form |
| Console | No captured errors during tested public navigation |
| Mobile 375px | Packages overflow: final document scrollWidth 672px vs viewport 375px; main content starts at x362 and ends x672. Navbar logo/login also extend beyond viewport. Recovery page width 375px |

Authenticated login, signup completion, email delivery/recovery, creating a booking,
receipt uploads, history detail and admin mutations remain UNTESTED without a test
account and explicit disposable booking authorization. Public-page success cannot
establish full system operation. Prior owner-provided policies showed admin-only
booking writes and slip uploads; this may conflict with the restored customer direct
writes, but no authenticated operation has been run to verify current behavior.

Mobile overflow is reproduced on the production page; no layout fix was made in this
testing task. No migration is required merely to host the existing frontend.
