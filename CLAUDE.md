# CLAUDE.md

Guidance for agents working in the **NovaSpatial** repo.

NovaSpatial is a Next.js 15 (App Router) + React 19 site and **client portal** for a Dolby Atmos mixing studio, backed by Supabase (Postgres, Auth, Storage), Stripe (payments), and Resend (email), deployed on Vercel. Clients commission a mix, upload stems, review mixes with timestamped comments, and download deliverables.

- **Architecture:** see `ARCHITECTURE.md` (system structure, data flow, auth, storage, payments).
- **Domain language:** see `CONTEXT.md` (glossary — use these exact terms). Key decisions: `docs/adr/`.
- **Audio is native to Supabase** (no Samply — it was removed). `project_files.file_type` is `stem | master_ref | mix | deliverable`.

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
- **Backend:** `@supabase/ssr` + `@supabase/supabase-js`. **Payments:** Stripe SDKs. **Email:** Resend. **Markdown (blog):** react-markdown + remark-gfm + rehype-sanitize.

## Conventions

- **TypeScript** is strict; path alias `@/*` → `src/*`.
- **Prettier:** single quotes, no semicolons. ESLint extends `next/core-web-vitals` + `next/typescript` (flat config).
- **API route handlers** export `GET`/`POST`/`PATCH`/`DELETE`, take `(request, { params })`, and return `NextResponse.json(...)`. Gate every handler with the helpers in `src/lib/auth/server.ts` (`requireApiUser` / `requireApiProfile` / `requireApiStudioUser`). Use consistent status codes: `400` validation, `401` unauth, `403` wrong role, `404` not found, `500` misconfig, `503` Supabase unreachable.
- **Supabase client choice matters:** use the **server** client (`@/lib/supabase/supabaseServer`) for anything tied to a signed-in user so RLS applies; use the **browser** client in client components; reserve the **service-role** client (`supabaseService`) for sessionless server contexts (e.g. the Stripe webhook) — it bypasses RLS.
- **Authorization is RLS-first.** Postgres RLS in the migrations is the enforcement floor; app-layer role checks are defense-in-depth. Don't rely on app checks alone — add/adjust the RLS policy too.
- **Components** are PascalCase; hooks are `useX`; lib/utils are camelCase. Portal domain types live in `src/types/portal.ts`.

## Testing

- Vitest + jsdom + Testing Library; `globals: true` and jest-dom matchers via `vitest.setup.ts`. Tests are **co-located** as `*.test.ts(x)` (~42 across routes, lib, hooks, components).
- Supabase is mocked globally in setup and built with `src/test/helpers/supabaseMock.ts` (`createSupabaseMock`, `createChainMock`, `createMockRequest`). Tests mock external deps (Supabase, Stripe, DNS) — no real network.
- Coverage leans toward API route handlers and lib logic, testing both happy paths and error cases (auth failures, network 503s, validation).

## Environment

From `.env.example`. Client-exposed (`NEXT_PUBLIC_`) vs server-only:

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client); `SUPABASE_SERVICE_ROLE_KEY` (server, secret).
- **Stripe:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client); `STRIPE_SECRET_KEY`, `STRIPE_RESTRICTED_KEY`, `STRIPE_WEBHOOK_SECRET` (server).
- **Email:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_INBOX_TO`.
- **Dev only:** `PAYMENTS_DEV_BYPASS=true` skips Stripe and creates paid $0 projects. **Never set in production.**

> Never put a personal email address in code, config, or docs. Use `noreply@nova-spatial.com` / `contact@nova-spatial.com`.

## Database & migrations

- Plain SQL in `supabase/migrations/`, named `YYYYMMDD_description.sql`. Each migration that adds a table also enables RLS and defines its policies; storage buckets are created here too.
- Read migrations chronologically — later ones override earlier constraints. Apply via the Supabase CLI / MCP (migrations are **not** run in CI).
- When changing schema, update the RLS policies and the types in `src/types/portal.ts` together.

## Deploy / CI

Vercel. `.github/workflows/main.yml` runs install → lint → vitest → build on push/PR to `main`. `next.config.mjs` sets a strict CSP (allows Stripe + the Supabase websocket) and long-lived caching for static media.

## Agent skills

### Issue tracker

Issues and PRDs live in novaspatial/nova's GitHub Issues, via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`. The sequenced **dev plan** (phases, decision gates D1–D13, critical path across the open issues) is `docs/devplan-issue-plan.md` — read it before picking up commerce/SEO/lifecycle work.

> **Known gaps (don't treat the clean state as reality):** checkout now charges **per-song USD** via `computeOrderPrice` (S1 #16, live since `20260702`; the one-shot first-mix discount rides as a private 50% code, floor-bounded to $225/song) — but it charges **no tax** (`taxCents = 0` stub; implementation is #31) and runs **without a T&C page or consent capture** (#23 is launch-debt — the devplan required terms before checkout went live). The discount-codes catalog + studio admin CRUD exists (#17, `20260704`) but is **client-inert** — redemption at checkout is #25/#26. IndexNow shipped code-only and is **inert in production** (`INDEXNOW_KEY` unset; activation is #33). Still **planned, not built**: add-ons (#19), order email (#24), the purge job (#27), the homepage price calculator (#30), and the stem-prep guide the drafted T&C references (#32). Marketing copy still advertises the old 50%-off promo until S10 (#9) — the charge and the copy disagree for single-song first orders.

### Triage labels

Default vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
