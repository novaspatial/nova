# CLAUDE.md

Guidance for agents working in the **NovaSpatial** repo — a Next.js 15 (App Router) + React 19 site and **client portal** for a Dolby Atmos mixing studio, on Supabase, Stripe, and Resend, deployed to Vercel. Clients commission a mix, upload stems, review mixes with timestamped comments, and download deliverables.

- **How the system works:** `ARCHITECTURE.md` (structure, routing, auth/RLS, storage, payments).
- **What words mean:** `CONTEXT.md` (glossary + business values — use these exact terms).

## Commands

```bash
npm run dev      # next dev
npm run build    # next build
npm run lint     # eslint .
npm test         # vitest (watch). Use `npx vitest run` for a single CI-style pass.
npx vitest run src/lib/portal/workflow.test.ts   # run one test file
```

## Conventions

- **TypeScript 5 strict**; path alias `@/*` → `src/*`. Prettier: single quotes, no semicolons, Tailwind classes sorted by `prettier-plugin-tailwindcss`. ESLint extends `next/core-web-vitals` + `next/typescript` (flat config).
- **Tailwind v4** — themed via `@theme {}` in `src/styles/tailwind.css`; there is **no `tailwind.config.js`**.
- **UI house style:** custom primitives in `src/components/ui/`, Headless UI, Heroicons + lucide-react, Framer Motion, React Aria / React Stately for accessible interactions. Components PascalCase, hooks `useX`, lib/utils camelCase; portal domain types in `src/types/portal.ts`.
- **API route handlers** export `GET`/`POST`/`PATCH`/`DELETE`, take `(request, { params })`, and return `NextResponse.json(...)`. Gate every handler and page with the helpers in `src/lib/auth/server.ts` (inventory: ARCHITECTURE §Auth & authorization).
- **Status codes** — the canonical vocabulary: `400` validation, `401` unauthenticated, `402` stem upload before payment, `403` wrong role, `404` not found / not visible, `409` concurrent status change or duplicate slug, `429` rate limit, `500` misconfig, `503` Supabase unreachable.
- **Pick the right Supabase client:** the server client (`@/lib/supabase/supabaseServer`) for anything tied to a signed-in user so RLS applies; the browser client in client components; `createServiceClient()` only for sessionless system writes, since it bypasses RLS (ARCHITECTURE §Supabase clients).
- **Authorization is RLS-first.** Postgres RLS in the migrations is the enforcement floor; app-layer role checks are defense-in-depth and give clean error codes. Never rely on an app check alone — add or adjust the RLS policy too.
- **Change domain seams, not their call sites:**
  - pricing, add-on/welcome/CA-tax constants — `src/lib/stripe/pricing.ts` (`computeOrderPrice`; the homepage calculator and the charge quote through this one function)
  - discount codes — `src/lib/portal/orderDiscount.ts`
  - payment-claim CAS — `src/lib/portal/paymentClaim.ts`
  - lifecycle transitions — `src/lib/portal/workflow.ts` (`canTransition`)
  - storage / signed-URL choreography — `src/lib/portal/storage.ts` + `uploadRunner.ts`
  - retention purge — `src/lib/portal/retentionPurge.ts`
  - transactional email — `src/lib/email/`

## Testing

Vitest + jsdom + Testing Library; `globals: true` and jest-dom matchers via `vitest.setup.ts`. Tests are co-located `*.test.ts(x)` across routes, lib, hooks, and components, covering happy paths and error cases (auth failures, 503s, validation).

No test touches the network, but only the **browser** client is mocked globally (`vitest.setup.ts`). A route test must mock the server client itself — `vi.mock('@/lib/supabase/supabaseServer', …)`, as all 26 existing ones do — and build the fake with `src/test/helpers/supabaseMock.ts` (`createSupabaseMock`, `createChainMock`, `createMockRequest`). Stripe and DNS are likewise mocked per test. `vitest.config.ts` aliases `server-only` to a stub; setup stubs `ResizeObserver` (Headless UI needs it).

## Environment

There is no `.env.example` (deliberately deleted) — this list is canonical. `NEXT_PUBLIC_` vars are client-exposed; the rest are server-only.

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `SUPABASE_SERVICE_ROLE_KEY` (secret).
- **Stripe:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Email:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_INBOX_TO` (optional — unset stores inquiries but skips the notification email).
- **Site/ops:** `NEXT_PUBLIC_SITE_URL` (canonical origin for metadata, sitemap, and pings; the CSP builder falls back to Vercel's build-time system vars when unset); `CSP_MODE` (optional — `report-only` unless set to `enforce`); `INDEXNOW_KEY` (echoed at `/indexnow-key.txt`; unset disables pings); `CRON_SECRET` (bearer auth for the crons, which fail closed without it).
- **Observability:** `NEXT_PUBLIC_SENTRY_DSN` (optional — unset means every Sentry entry point no-ops and errors only reach the console; setting it needs no code change). All reporting goes through `src/lib/observability/report.ts`; money-path metadata mismatches alert via `alertMoneyPathAnomaly`.
- **Local only:** `PAYMENTS_DEV_BYPASS=true` skips Stripe and creates paid $0 projects. `isPaymentsDevBypassEnabled` refuses it on **any Vercel deploy, preview included** — the single Supabase project means preview writes to the production database — and under bare `NODE_ENV=production` off Vercel (#45). Smoke-test deploys with a Stripe test card instead.

> Never put a personal email address in code, config, or docs. Use `noreply@nova-spatial.com` / `contact@nova-spatial.com`.

## Database & migrations

- Plain SQL in `supabase/migrations/`, named `YYYYMMDD_description.sql`. Read chronologically — later files override earlier constraints, and same-day files apply alphabetically. Apply via the Supabase CLI / MCP; migrations do **not** run in CI.
- Every migration that adds a table also enables RLS and defines its policies; storage buckets are created here too. When changing schema, update the RLS policies and `src/types/portal.ts` together.
- Sensitive writes use one **fence pattern**: `SECURITY DEFINER` triggers that pass service contexts and studio profiles, else raise `42501`. Match it when adding a fence — the full family is in ARCHITECTURE §Auth & authorization.

## Deploy / CI

Vercel. CI (`.github/workflows/main.yml`) runs install → lint → vitest → build on push/PR to `main`. The CSP ships **Report-Only** until `CSP_MODE=enforce`; it compiles at build time, so the flip needs a redeploy, and violations post to `/api/csp-report` and are logged. Two crons, both gated by `CRON_SECRET`: `/api/cron/purge-delivered` (daily 06:00 UTC, 90-day retention) and `/api/cron/sweep-orphans` (daily 06:30 UTC). Details: ARCHITECTURE §Cron jobs and §Build & deploy notes.

## Agent skills

- **Issue tracker** — issues and PRDs live in novaspatial/nova's GitHub Issues, via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`. (The tracker was cleared 2026-07-30 for a fresh start.)
- **Triage labels** — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.
- **Domain docs** — `CONTEXT.md` at the repo root; ADRs land in `docs/adr/`. See `docs/agents/domain.md`.

## Deliberate residuals — decisions, not bugs

Don't "fix" these without a new ruling:

- A deep-linked `?code=` prefills without auto-applying, so the form quote reads undiscounted until Apply. The charge re-validates and is correct.
- Abandoned pending checkouts hold coupon capacity until deleted — there is no sweep (accepted; the orphan sweep deliberately never touches `projects`).
- Rush has **no availability gate**; refunds, revision tracking, and post-order extras are **manual** (CONTEXT: Add-on).
- The live T&C deliberately omits the stem-prep-guide link — see the guard comment in `terms/page.tsx`, and bump `TERMS_VERSION` on material changes. The guide itself is `UploadPrep.tsx` on the client dashboard.
- The dormant `first_mix_discount` profile flag survives only as the no-code fallback for the welcome offer.
- Only the Stripe webhook and the payment-status poll claim via `claimProjectPayment`; the dev-bypass inserts a born-paid row directly. All three send the receipt.
- The CSP stays Report-Only until the enforce flip is made deliberately — `CSP_MODE` is the lever, `/api/csp-report` the evidence.
