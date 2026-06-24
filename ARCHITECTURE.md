# Architecture

NovaSpatial is a Next.js 15 (App Router) + React 19 application backed by Supabase (Postgres, Auth, Storage), with Stripe for payments and Resend for email. It is deployed on Vercel. It serves a public marketing site and blog, and a private **client portal** for commissioning, reviewing, and delivering Dolby Atmos mixes.

For domain vocabulary (Project, Stem, Mix, Deliverable, the comment clock, lifecycle statuses), see `CONTEXT.md`. For significant design decisions and their rationale, see `docs/adr/`.

> **Audio is native.** Playback and timestamped comments are handled directly against Supabase. A previous integration with the Samply service was removed (migration `20260301_remove_samply.sql`); see `docs/adr/0001-native-supabase-audio.md`. Ignore any older references to Samply.

## Top-level layout

```
src/
├── app/            # App Router: pages + API route handlers + server actions
│   ├── actions/    # Server actions (e.g. checkEmail)
│   └── api/        # Route handlers (auth, portal, stripe, blog admin, contact)
├── components/     # React components (audio, portal, blog, sections, layout, ui, popups)
├── hooks/          # Client hooks (useAuthUser, useProfile, useFileUpload, …)
├── lib/            # Domain + integration logic (supabase, auth, stripe, portal, email, blog)
├── types/          # Shared types (portal.ts is the portal domain model)
├── styles/         # Tailwind v4 entry + theme tokens + typography
├── middleware.ts   # Route guard for /portal and /profile
supabase/migrations/ # Schema, RLS policies, storage buckets (YYYYMMDD_*.sql)
```

## Routing

**Marketing (public):** `/`, `/about`, `/contact`, `/blog`, `/blog/[slug]`.

**Auth:** `/login`, `/auth/callback` (email-verification / OAuth return), `/auth/update-password`.

**Account (auth-gated):** `/profile` — manage the signed-in account (guarded by the same middleware as `/portal`).

**Portal (auth-gated):**
- `/portal` — project dashboard
- `/portal/new` — start a project (payment)
- `/portal/archived` — Studio-only archived projects
- `/portal/[projectId]` — redirects to the project's current step
- `/portal/[projectId]/upload` — hand over stems / upload mixes
- `/portal/[projectId]/listen` — play mixes and leave timestamped comments (`/portal/[projectId]/comment` is an alias of the same page)

**Blog admin (Studio-only):** `/blog/admin/blog`, `/blog/admin/blog/new`, `/blog/admin/blog/[id]/edit`.

### API endpoints

Route handlers under `src/app/api`. Each file exports `GET`/`POST`/`PATCH`/`DELETE` and returns `NextResponse.json(...)`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login`, `/signup`, `/me`, `/reset-password` |
| Contact | `POST /api/contact` — store inquiry + email the studio |
| Projects | `GET/POST /api/portal/projects`; `GET /api/portal/projects/new-count`; `GET/PATCH/DELETE /api/portal/projects/[id]` |
| Checkout & pay | `POST /api/portal/projects/checkout`; `POST /api/stripe/webhook`; `GET /api/portal/projects/[id]/payment-status` |
| Files | `POST /api/portal/projects/[id]/files`; `POST …/files/[fileId]/confirm`; `GET …/files/[fileId]/download`; `DELETE …/files/[fileId]`; `POST …/finish-upload` |
| Comments | `GET/POST /api/portal/projects/[id]/listen` (list/create comments); `DELETE …/comments/[commentId]`; `POST …/comment-attachments/register`; `GET …/comment-attachments/[attachmentId]/download` |
| Deliverables | `GET/POST /api/portal/projects/[id]/deliverables`; `GET …/deliverables/[delivId]/download`; `DELETE …/deliverables/[delivId]` |
| Archive | `POST/DELETE /api/portal/projects/[id]/archive` |
| Blog admin | `POST /api/blog/admin/blog/posts`; `PATCH/DELETE …/posts/[id]` |

> Note: `…/listen` is the comments endpoint (named for its page). `GET` returns the project's comments with authors and attachments; `POST` creates a comment on a Mix.

## Supabase clients

Three clients live in `src/lib/supabase/`, picked by execution context:

- **Browser** (`supabaseClient.ts`) — `createBrowserClient`, anon/publishable key. Client components.
- **Server** (`supabaseServer.ts`) — `createServerClient` wired to Next.js `cookies()`. The default for middleware, route handlers, server actions, and server components. Runs as the signed-in user, so **RLS applies**, and it refreshes the session cookie on each request.
- **Service role** (`supabaseService.ts`) — full-access singleton, `persistSession: false`. **Bypasses RLS.** Used only where there is no user session — currently the Stripe webhook.

## Auth & authorization

**Middleware** (`src/middleware.ts`, matcher `/portal/:path*` and `/profile/:path*`): if no `sb-*-auth-token` cookie, redirect to `/login?next=…`; otherwise validate via `getClaims()`, refreshing the session cookie (and clearing stale cookies if validation fails because Supabase is unreachable).

**Server helpers** (`src/lib/auth/server.ts`) are the gate inside pages and handlers:
- `requirePageUser()` / `requirePageProfile()` — redirect-based, for server components.
- `requireApiUser()` / `requireApiProfile()` / `requireApiStudioUser()` — return an error `Response` instead of redirecting; the studio variant enforces `role === 'studio'`.
- `getProjectOrNotFound()` / `getProjectOrApiNotFound()` — fetch a project and apply visibility (soft-delete flags + role) before returning.

**Authorization is RLS-first** (see `docs/adr/0002-rls-first-authorization.md`). Postgres Row Level Security in the migrations is the enforcement floor; API role checks are defense-in-depth and for clean error codes. Broad strokes:
- **profiles** — anyone can read; you can update only your own.
- **projects / project_files / project_comments / deliverables** — visible to the owning Client and all Studio; Studio-only writes for status and deliverables; comment INSERT/DELETE scoped to author-or-Studio.

> **Known gap (archive):** the `archived_at` column (migration `20260624`) was added **without an RLS policy**. Today the "archived is Client-invisible" guarantee is enforced only at the app layer (the `.is('archived_at', null)` filters in the projects list, dashboard, and new-count), not by Postgres — a deviation from RLS-first. DB-level hardening is tracked in [issue #12](https://github.com/novaspatial/nova/issues/12).
- **contact_inquiries** — public INSERT, no public SELECT.
- **blog_posts** — anon reads *published* posts; Studio reads/writes everything.

API error codes are consistent: `400` validation, `401` unauthenticated, `403` wrong role, `404` not found/not visible, `500` misconfig, `503` Supabase unreachable.

## Storage

Three buckets (defined and resized in the `2026030x`/`20260425`/`20260428` migrations):

- **project-uploads** (private, 5 GiB/file) — stems, mixes, and comment attachments. Paths: `{owner}/{project}/{file}` (stems), `{owner}/{project}/mixes/{file}` (mixes), `{owner}/{project}/comments/{uuid}/{file}` (attachments).
- **project-deliverables** (private, 5 GiB/file) — approved final files.
- **blog-assets** (public, 20 MB, images only) — Studio-only writes.

Large audio never streams through the API. Uploads use a **register → PUT → confirm** dance with signed upload URLs; downloads/playback use short-lived signed download URLs. See `docs/adr/0003-signed-url-direct-storage.md`.

## Payments

`src/lib/stripe/*` + `checkout` / `webhook` / `payment-status` routes. Pricing (`pricing.ts`): $299 full, $149 first-mix. Flow:

1. `POST …/checkout` creates the Project in `pending_payment`, atomically reserves the first-mix discount via the `reserve_first_mix_discount` RPC, and creates a Stripe PaymentIntent — returning a `clientSecret`. (If `PAYMENTS_DEV_BYPASS=true`, it skips Stripe and creates a paid `uploading` project at $0.)
2. The Stripe **webhook** (service-role client, signature-verified) handles `payment_intent.succeeded` idempotently: sets `paid_at` and flips status to `uploading`.
3. The client may also poll `…/payment-status`, which reconciles against Stripe directly as a fallback.
4. Deleting an unpaid Project calls `restore_first_mix_discount` so an abandoned checkout doesn't burn the discount.

The payment columns (`stripe_payment_intent_id`, `paid_at`, `amount_cents`, `currency`, `discount_applied`) live on the `projects` row (migration `20260422`). Note the `Project` type in `src/types/portal.ts` is **not yet synced** with these columns; that sync is tracked in [issue #4](https://github.com/novaspatial/nova/issues/4) (pending the order-records decision in [#1](https://github.com/novaspatial/nova/issues/1)).

See `docs/adr/0004-stripe-payment-gating.md`.

## Email

`src/lib/resend.ts` configures Resend; `RESEND_FROM_EMAIL` sets the sender (`noreply@nova-spatial.com` in production). `src/lib/email/projectNotifications.ts` emails the Client on status changes (`in_review`, `processing`, `mixing`, `review`, `delivered`; `processing` and `mixing` share the "mixing has started" message). The contact form emails `CONTACT_INBOX_TO` (and silently skips the email if unset, still storing the inquiry).

## End-to-end flow

1. **Commission** — Client fills `/portal/new`; `…/checkout` creates a `pending_payment` Project and a PaymentIntent.
2. **Pay** — Client pays; webhook (or polling) flips the Project to `uploading`.
3. **Hand over** — Client uploads stems on `/upload` (register → PUT → confirm), then `finish-upload` moves the Project to `in_review`.
4. **Mix** — Studio reviews, uploads Mixes (same upload dance, `file_type: 'mix'`), and PATCHes status toward `review`.
5. **Review** — On `/listen`, the Client plays Mixes (signed streaming URLs) and leaves timestamped Comments tied to a `track_id`, optionally with attachments. Studio iterates through `revision`.
6. **Deliver** — Studio sets `approved` (with a delivery format), uploads Deliverables, and sets `delivered`; the Client downloads via signed URLs.
7. **Archive** — Studio archives the finished Project (reversible, Client-invisible — currently enforced app-side; see the archive RLS gap above); full delete also removes storage objects.

## Status state machine

`src/lib/portal/workflow.ts` is the single source of truth for the lifecycle: `PROJECT_STATUSES`, the status→step mapping, display labels, and which steps are unlocked. Clients advance only `uploading`→`in_review` (via `finish-upload`); Studio drives the rest via PATCH. Payment events drive `pending_payment`→`uploading`.

## Testing, migrations, deploy

- **Tests:** Vitest + jsdom + Testing Library, co-located `*.test.ts(x)` (~42 files). Supabase is mocked via `src/test/helpers/supabaseMock.ts`. See `CLAUDE.md` for commands.
- **Migrations:** plain SQL in `supabase/migrations/`, `YYYYMMDD_description.sql`, applied via the Supabase CLI / MCP (not in CI). RLS and storage buckets are defined here too.
- **Deploy:** Vercel. `next.config.mjs` sets a strict CSP (allowing Stripe + the Supabase websocket) and long-lived caching for static media. CI (`.github/workflows/main.yml`) installs, lints, and builds on push/PR; a Vitest step is still a TODO.

## Roadmap / planned work

This document describes the **current built system**. A larger commerce/SEO/lifecycle rework is planned but **not yet built** — don't read the items below as existing capabilities:

- **Commerce engine** — replace today's flat **USD** pricing ($299 full / $149 first-mix + first-mix discount) with per-song **CAD** list pricing, album/EP bulk auto-discounts, a `discount_codes` catalog + Studio admin, add-ons (extra revision, 48h rush), a Terms & Conditions page with a recorded agree-checkbox, and an order-confirmation email.
- **Blog / SEO** — per-post SEO metadata + Article JSON-LD, auto-generated share images, `sitemap`/`robots`, and IndexNow pings on publish.
- **Lifecycle** — archive RLS hardening ([#12](https://github.com/novaspatial/nova/issues/12)), a `delivered_at` anchor with a 90-day file-retention purge job, and admin file download.

The sequenced plan (phases, decision gates D1–D13, critical path) lives in [`docs/devplan-issue-plan.md`](docs/devplan-issue-plan.md), sliced across the open [GitHub issues](https://github.com/novaspatial/nova/issues).
