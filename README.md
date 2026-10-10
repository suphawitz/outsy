# OUTSY

React + Vite frontend with Supabase Auth, database and Storage. Use Node 22.

## Development

Run `npm ci`, copy `.env.example` to `.env.local` and configure the project URL and
public anon key. Never expose service_role/secret keys in VITE variables.
Run `npm run dev`; verify with `npm run lint`, `npm test`, `npm run build`.

## Deployment and database review

See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel settings and Supabase checks.
The frontend now requires trusted booking RPCs and private Storage policies from the
[review package](supabase/migrations/README.md). These draft migrations have NOT
been executed. Review against the actual schema, obtain explicit approval, test on
staging, then coordinate production migration/deployment. There is no insecure direct
write fallback if an RPC is missing. These migrations modify an existing verified
schema; they are not a fresh database bootstrap.

Signup profiles come from the database trigger, roles from public.users by auth_id,
and booking ownership from auth.uid(). Booking creation/prices/capacity/transitions
use trusted RPCs. Receipts/bankbooks use authenticated private downloads; public
marketing images belong in tourist_images. QR remains a labelled simulation.

See [remediation report](docs/REMEDIATION.md), [schema review](docs/SCHEMA_REVIEW.md)
and [acceptance tests](docs/SECURITY_TESTS.md). Build/unit success does not verify
external Auth, Storage or booking concurrency; those require staged integration tests.
