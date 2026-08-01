# CLAUDE.md

Guidance for agents working in the **NovaSpatial** repo.

NovaSpatial is a Next.js 15 (App Router) + React 19 site and **client portal** for a Dolby Atmos mixing studio, backed by Supabase (Postgres, Auth, Storage), Stripe (payments), and Resend (email), deployed on Vercel. Clients commission a mix, upload stems, review mixes with timestamped comments, and download deliverables.

- **Architecture:** see `ARCHITECTURE.md` (system structure, data flow, auth, storage, payments).
- **Domain language:** see `CONTEXT.md` (glossary — use these exact terms).
- **Audio is native to Supabase.** `project_files.file_type` is `stem | master_ref | mix`.

## Commands

```bash
npm run dev      # next dev
npm run build    # next build
npm run lint     # eslint .
npm test         # vitest (watch). Use `npx vitest run` for a single CI-style pass.
npx vitest run src/lib/portal/workflow.test.ts   # run one test file
```

## Stack

- **Next.js 15** App Router, **React 19**, **TypeScript 5** (strict).
- **Tailwind CSS v4** — configured via `@theme {}` in `src/styles/tailwind.css`; there is **no `tailwind.config.js`**. Prettier sorts classes (`prettier-plugin-tailwindcss`).
- **UI house style:** custom primitives in `src/components/ui/`, Headless UI, Heroicons + lucide-react, Framer Motion; React Aria / React Stately for accessible interactions.
- **Backend:** `@supabase/ssr` + `@supabase/supabase-js`. **Payments:** Stripe SDKs. **Email:** Resend. **Markdown (blog):** react-markdown + remark-gfm + rehype-sanitize (+ rehype-slug, rehype-unwrap-images). **Analytics:** Vercel Analytics + Speed Insights, mounted in `src/app/layout.tsx`.

## Conventions

- **TypeScript** is strict; path alias `@/*` → `src/*`.
- **Prettier:** single quotes, no semicolons. ESLint extends `next/core-web-vitals` + `next/typescript` (flat config).
- **API route handlers** export `GET`/`POST`/`PATCH`/`DELETE`, take `(request, { params })`, and return `NextResponse.json(...)`. Gate every handler with the helpers in `src/lib/auth/server.ts` (`requireApiUser` / `requireApiProfile` / `requireApiStudioUser`, plus `requireProjectChild` for project-scoped child rows; pages use `requirePageUser` / `requirePageProfile` / `requirePageStudioUser`). Use consistent status codes: `400` validation, `401` unauth, `403` wrong role, `404` not found, `500` misconfig, `503` Supabase unreachable.
- **Supabase client choice matters:** use the **server** client (`@/lib/supabase/supabaseServer`) for anything tied to a signed-in user so RLS applies; use the **browser** client in client components; reserve the **service-role** client (`supabaseService`) for sessionless server contexts (e.g. the Stripe webhook) — it bypasses RLS.
- **Authorization is RLS-first.** Postgres RLS in the migrations is the enforcement floor; app-layer role checks are defense-in-depth. Don't rely on app checks alone — add/adjust the RLS policy too.
- **Components** are PascalCase; hooks are `useX`; lib/utils are camelCase. Portal domain types live in `src/types/portal.ts`.
- **Domain seams** (change these, not their call sites): pricing + add-on/welcome/CA-tax constants in `src/lib/stripe/pricing.ts` (`computeOrderPrice` — the homepage calculator and checkout quote from the same function); discount codes in `src/lib/portal/orderDiscount.ts` (service-role reserve/restore/consume RPCs); the payment-claim CAS in `src/lib/portal/paymentClaim.ts`; lifecycle transitions in `src/lib/portal/workflow.ts` (`canTransition`); storage/signed-URL choreography in `src/lib/portal/storage.ts` + `uploadRunner.ts`; retention purge in `src/lib/portal/retentionPurge.ts`; transactional email in `src/lib/email/`.

## Testing

- Vitest + jsdom + Testing Library; `globals: true` and jest-dom matchers via `vitest.setup.ts`. Tests are **co-located** as `*.test.ts(x)` (72 files / ~860 tests across routes, lib, hooks, components).
- Supabase is mocked globally in setup and built with `src/test/helpers/supabaseMock.ts` (`createSupabaseMock`, `createChainMock`, `createMockRequest`). Tests mock external deps (Supabase, Stripe, DNS) — no real network. `vitest.config.ts` aliases `server-only` to a stub; setup stubs `ResizeObserver` (Headless UI needs it).
- Coverage leans toward API route handlers and lib logic, testing both happy paths and error cases (auth failures, network 503s, validation).

## Environment

From `.env.example`. Client-exposed (`NEXT_PUBLIC_`) vs server-only:

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client); `SUPABASE_SERVICE_ROLE_KEY` (server, secret).
- **Stripe:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client); `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (server).
- **Email:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_INBOX_TO` (optional — unset stores inquiries but skips the notification email).
- **Site/ops:** `CSP_MODE` (server, optional — `report-only` unless set to `enforce`); `NEXT_PUBLIC_SITE_URL` (client; canonical origin for metadata/sitemap/pings — the CSP builder falls back to Vercel's build-time system vars when it is unset); `INDEXNOW_KEY` (server — echoed at `/indexnow-key.txt` by a route handler, unset disables pings); `CRON_SECRET` (server — bearer auth for the crons, which fail closed without it).
- **Observability:** `NEXT_PUBLIC_SENTRY_DSN` (client + server, optional — unset means every Sentry entry point no-ops and errors only reach the console; setting it needs no code change). All reporting goes through `src/lib/observability/report.ts`; money-path metadata mismatches alert through `alertMoneyPathAnomaly`.
- **Local only:** `PAYMENTS_DEV_BYPASS=true` skips Stripe and creates paid $0 projects. `isPaymentsDevBypassEnabled` refuses it on **any Vercel deploy, preview included**, and under bare `NODE_ENV=production` off Vercel (#45) — preview counts because the single Supabase project means preview writes to the production database. Smoke-test deploys with a Stripe test card instead.

> Never put a personal email address in code, config, or docs. Use `noreply@nova-spatial.com` / `contact@nova-spatial.com`.

## Database & migrations

- Plain SQL in `supabase/migrations/`, named `YYYYMMDD_description.sql`. Each migration that adds a table also enables RLS and defines its policies; storage buckets are created here too.
- Read migrations chronologically — later ones override earlier constraints; same-day files apply alphabetically (e.g. `20260726_add_delivery_purge` before `20260726_system_only_project_inserts`). Apply via the Supabase CLI / MCP (migrations are **not** run in CI).
- Sensitive writes follow one **fence pattern**: `SECURITY DEFINER` trigger functions that allow service contexts (`auth.uid() IS NULL`) and studio profiles, else raise `42501` — archive (`20260625`), order-field freeze (`20260702`/`20260724`), status (`20260705`), system-only `projects` INSERTs (`20260726`), delivery/purge stamps (`20260726`), privileged `profiles` columns (`20260730`). Match this pattern when adding a fence.
- When changing schema, update the RLS policies and the types in `src/types/portal.ts` together.

## Deploy / CI

Vercel. `.github/workflows/main.yml` runs install → lint → vitest → build on push/PR to `main`. `next.config.ts` builds its headers from `src/lib/security/csp.ts` (tested): the CSP ships **Report-Only by default**, with `CSP_MODE=enforce` as the flip (compiled at build time, so it needs a redeploy), violations posted to `POST /api/csp-report` and logged; plus enforced security headers (HSTS, `X-Frame-Options: DENY`, nosniff) and long-lived immutable caching for `/videos` and `/images`. `vercel.json` defines two crons, both gated by `CRON_SECRET`: `/api/cron/purge-delivered` (daily 06:00 UTC, D7 retention) and `/api/cron/sweep-orphans` (daily 06:30 UTC, stale pending uploads + row-less comment attachments).

## Agent skills

### Issue tracker

Issues and PRDs live in novaspatial/nova's GitHub Issues, via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`. (The tracker was cleared on 2026-07-30 for a fresh start.)

> **Deliberate residuals — decisions, not bugs; don't "fix" without a new ruling:** a deep-linked `?code=` prefills without auto-applying, so the form quote reads undiscounted until Apply (the charge re-validates and is correct); abandoned pending checkouts hold coupon capacity until deleted (no sweep — accepted); rush has **no availability gate**, and refunds / revision tracking / post-order extras are **manual**; the live T&C deliberately omits the stem-prep-guide link (guard comment in `terms/page.tsx`; material changes bump `TERMS_VERSION`) — the guide itself is `UploadPrep.tsx` on the client dashboard; the dormant `first_mix_discount` flag survives only as the no-code fallback; only the Stripe webhook and the payment-status poll claim via `claimProjectPayment` — the dev-bypass inserts a born-paid row directly (all three send the receipt); the CSP stays Report-Only until the enforce flip is made deliberately — `CSP_MODE` is the lever and `/api/csp-report` the evidence (see Deploy / CI).

### Triage labels

Default vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root; new ADRs land in `docs/adr/` as decisions get recorded. See `docs/agents/domain.md`.
