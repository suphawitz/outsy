# OUTSY

React + Vite frontend with Supabase Auth, database and Storage.

## Local development

Use Node.js 22. Run `npm ci`, copy `.env.example` to `.env.local`, and set the
Supabase project URL and public anon key. Run `npm run dev`.
Never put a Supabase service-role or secret key in a `VITE_` variable.

## Vercel

Import this repository with preset **Vite**, root directory **.**, install command
`npm ci`, build command `npm run build`, output directory `dist`, Node.js **22.x**.
Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel for each needed
environment before building. Redeploy after changing environment variables.
`.env.local` is local only and must not be committed.
`vercel.json` sends extensionless routes to the SPA while leaving static assets alone.

Run `npm run build` and `npm run preview` to inspect the production output locally.

## Required Supabase checks before customer launch

Run `supabase/deployment-audit.sql` in the Supabase SQL Editor (read-only).
Review RLS on users, bookings, booking_travelers, refund_requests and tour tables.
Customers must not change their role, other users' records, trusted prices,
payment approval, refund approval or schedule capacity. Admin authorization must
be enforced in database policies, not only by React routing.

Verify a database trigger creates the public user profile when email confirmation
is required: signup may have no session and the frontend profile insert can be denied.
Verify existing schema, foreign keys, constraints, admin account and sample tour data.
The repo has no authoritative schema migration to recreate the database.

Set Supabase Authentication > URL Configuration:
- Site URL: the production origin, e.g. `https://your-app.vercel.app`.
- Redirect URLs: the production `/login` and `/update-password` URLs, plus explicit
  development/preview origins as needed.
- Verify email delivery/SMTP, signup confirmation and recovery using a test account.

Storage `tourist_images` contains public tour images. Verify its read permissions.
`slips` also contains bankbook photos and receipts. Current callers use public URLs;
review bucket access and migrate all viewers to signed URLs with ownership/admin
policies before storing real sensitive files. Do not simply make the bucket private
without updating these viewers.

## Outstanding production work

- Payment QR is intentionally a demonstration, as requested. It encodes booking
  text and is not a real PromptPay payment payload. Replace it before accepting money.
- Move booking creation, trusted price calculation and seat reservation into one
  database transaction/RPC. Current browser writes can race and do not establish
  authoritative pricing. Inspect schema and policies before designing the migration.
- Verify policies with two separate customer accounts and an admin; verify one
  customer cannot read/update another booking, travelers, slips or refund request.
- Test simultaneous booking of the last seat, failed traveler writes, cancellation,
  rescheduling, payment review and refunds.
- Production build success does not certify these external services or business flows.
