# Nova

A music-mixing portal. Clients upload stems, pay via Stripe, and receive
timestamped-commented mix previews; the studio uploads deliverables back
through the same portal.

## Stack

- Next.js 15 (App Router) + React 19
- Supabase (auth + Postgres + Storage)
- Stripe (checkout + webhooks)
- Resend (transactional email)
- Tailwind CSS v4
- Vitest + Testing Library

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (watch mode by default; `npx vitest run` for one-shot) |

## Environment

Copy `.env.example` to `.env.local` and fill in the values. Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, used by the Stripe webhook)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Dev-only:

- `PAYMENTS_DEV_BYPASS=true` skips Stripe and marks checkout projects as
  paid immediately. Never set in production.

## Codebase pointers

- Schema source of truth lives in [supabase/migrations/](supabase/migrations/).
  The repo may contain stale architecture docs — trust the migrations and the
  route handlers under `src/app/api/portal/`.
- API route tests follow the pattern in
  [src/test/helpers/supabaseMock.ts](src/test/helpers/supabaseMock.ts). See
  [src/app/api/portal/projects/[id]/files/route.test.ts](src/app/api/portal/projects/[id]/files/route.test.ts)
  for a good example of the chainable mock + `requireApiProfile` pattern.
- Auth guards (`requireApiUser`, `requireApiProfile`, `requireApiStudioUser`)
  and project visibility (`getProjectOrApiNotFound`) live in
  [src/lib/auth/server.ts](src/lib/auth/server.ts).
- Portal workflow state machine is in
  [src/lib/portal/workflow.ts](src/lib/portal/workflow.ts).
