# Architecture

NovaSpatial is a Next.js 15 (App Router) + React 19 application backed by Supabase (Postgres, Auth, Storage), with Stripe for payments and Resend for email. It is deployed on Vercel. It serves a public marketing site and blog, and a private **client portal** for commissioning, reviewing, and delivering Dolby Atmos mixes.

For domain vocabulary (Project, Stem, Mix, Deliverable, the comment clock, lifecycle statuses), see `CONTEXT.md`.

> **Audio is native.** Playback and timestamped comments are handled directly against Supabase. A previous integration with the Samply service was removed (migration `20260301_remove_samply.sql`). Ignore any older references to Samply.

## Top-level layout

```text
src/
├── app/            # App Router: pages + API route handlers
│   └── api/        # Route handlers (auth, portal, stripe, admin, blog admin, contact, cron)
├── components/     # React components (audio, portal, blog, sections, layout, ui, popups)
├── hooks/          # Client hooks (useAuthUser, useProfile, useFileUpload, …)
├── lib/            # Domain + integration logic (supabase, auth, stripe, portal, email, blog, legal)
├── types/          # Shared types (portal.ts is the portal domain model)
├── styles/         # Tailwind v4 entry + theme tokens + typography
├── middleware.ts   # Route guard for /portal, /profile, /blog/admin
supabase/migrations/ # Schema, RLS policies, storage buckets (YYYYMMDD_*.sql)
```

## Routing

**Marketing (public):** `/`, `/about`, `/contact`, `/terms`, `/blog`, `/blog/[slug]`. Public infrastructure routes: `/sitemap.xml`, `/robots.txt`, `/blog/[slug]/share-image` (the generated OG card), `/indexnow-key.txt`.

**Auth:** `/login`, `/auth/update-password` (pages); `GET /auth/callback` is a route handler (email-verification / OAuth code exchange).

**Account (auth-gated):** `/profile` — manage the signed-in account (guarded by the same middleware as `/portal`).

**Portal (auth-gated):**

- `/portal` — project dashboard
- `/portal/new` — start a project (priced checkout; consumes the homepage calculator's `?songs/addons/code` deep-link, parsed in `src/lib/portal/newProjectParams.ts`)
- `/portal/archived` — Studio-only archived projects
- `/portal/[projectId]` — redirects to the project's current step
- `/portal/[projectId]/upload` — hand over stems / upload mixes
- `/portal/[projectId]/listen` — play mixes and leave timestamped comments (`/portal/[projectId]/comment` is an alias of the same page)

**Blog admin (Studio-only, behind the middleware):** `/blog/admin/blog`, `/blog/admin/blog/new`, `/blog/admin/blog/[id]/edit`, and `/blog/admin/discount-codes` (the discount-codes admin UI). All share `src/app/blog/admin/layout.tsx`, which calls `requirePageStudioUser`.

### API endpoints

Route handlers under `src/app/api`. Each file exports `GET`/`POST`/`PATCH`/`DELETE` and returns `NextResponse.json(...)`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login`, `/signup`, `/reset-password`; `GET /api/auth/me`; `GET /auth/callback` |
| Contact | `POST /api/contact` — store inquiry + email the studio |
| Projects | `GET /api/portal/projects` (list — **creation happens only through checkout**; the unpriced POST was removed when priced checkout landed); `GET /api/portal/projects/new-count`; `GET/PATCH/DELETE /api/portal/projects/[id]` |
| Checkout & pay | `POST /api/portal/projects/checkout`; `POST /api/stripe/webhook`; `GET /api/portal/projects/[id]/payment-status` |
| Discount codes | `GET/POST /api/admin/discount-codes`, `PATCH /api/admin/discount-codes/[id]` (Studio CRUD); `POST /api/portal/discount-codes/validate` (authed live quote) |
| Files | `POST /api/portal/projects/[id]/files`; `POST …/files/[fileId]/confirm`; `GET …/files/[fileId]/download`; `DELETE …/files/[fileId]`; `POST …/finish-upload` |
| Comments | `GET/POST /api/portal/projects/[id]/listen` (list/create comments); `DELETE …/comments/[commentId]`; `POST …/comment-attachments/register`; `GET …/comment-attachments/[attachmentId]/download` |
| Archive | `POST/DELETE /api/portal/projects/[id]/archive` |
| Blog admin | `POST /api/blog/admin/blog/posts`; `PATCH/DELETE …/posts/[id]` |
| Cron | `GET /api/cron/purge-delivered` — `CRON_SECRET` bearer, scheduled daily by `vercel.json` |

> Note: `…/listen` is the comments endpoint (named for its page). `GET` returns the project's comments with authors and attachments; `POST` creates a comment on a Mix.

## Supabase clients

Three clients live in `src/lib/supabase/`, picked by execution context:

- **Browser** (`supabaseClient.ts`) — `createBrowserClient`, anon/publishable key. Client components.
- **Server** (`supabaseServer.ts`) — `createServerClient` wired to Next.js `cookies()`. The default for middleware, route handlers, server actions, and server components. Runs as the signed-in user, so **RLS applies**, and it refreshes the session cookie on each request.
- **Service role** (`supabaseService.ts`) — full-access singleton, `persistSession: false`. **Bypasses RLS.** Used for **system writes whose authority is not the user's session**: the Stripe webhook, the payment-status poll's claim (a Stripe-verified fact), both checkout project INSERTs (the `20260726` fence reserves `projects` births for system writers), the unpaid-delete discount restore, and the purge cron. The discount reserve/restore/consume RPCs are EXECUTE-granted to `service_role` only.

## Auth & authorization

**Middleware** (`src/middleware.ts`, matcher `/portal/:path*`, `/profile/:path*`, `/blog/admin/:path*` — the whole private surface): every matched response carries `X-Robots-Tag: noindex, nofollow`, so private URLs get de-indexed rather than merely un-crawled. Without an `sb-*-auth-token` cookie, bare `/portal` and `/profile` redirect to `/` (marketing-first) and deeper links to `/login?next=…`; with one, validate via `getClaims()`, refreshing the session cookie (and clearing stale cookies if validation fails because Supabase is unreachable).

**Redirect targets are untrusted.** Every `?next=` passes through `safeNextPath` (`src/lib/auth/nextPath.ts`) — a single leading slash, no `//` or `/\`, no control characters — at all three consumers (the callback, the signup route's `emailRedirectTo`, and the login page's `router.push`). The callback's host comes from `resolveRedirectOrigin` (`src/lib/auth/redirectOrigin.ts`), which honors `x-forwarded-host` only when it matches the canonical host, its `www.` sibling, or a platform-supplied `VERCEL_*` host; outside production the request origin passes through unchanged.

**Server helpers** (`src/lib/auth/server.ts`) are the gate inside pages and handlers:

- `requirePageUser()` / `requirePageProfile()` / `requirePageStudioUser()` — redirect-based, for server components (the studio variant sends non-studio users to `/portal`).
- `requireApiUser()` / `requireApiProfile()` / `requireApiStudioUser()` — return an error `Response` instead of redirecting; the studio variant enforces `role === 'studio'`.
- `getProjectOrNotFound()` / `getProjectOrApiNotFound()` — fetch a project and apply visibility (soft-delete flags + role) before returning.
- `requireProjectChild()` — the composite guard for project-scoped child rows (loads project + child, derives `isStudio`/`isOwner`/`isAuthor`; the 403 decision stays in the handler).

**Authorization is RLS-first.** Postgres Row Level Security in the migrations is the enforcement floor; API role checks are defense-in-depth and for clean error codes. Broad strokes:

- **profiles** — signed-in only: you read your own row, Studio reads every row, and every session can read Studio rows (comment authorship renders from them). Anonymous sessions read nothing. You update only your own row, and only `display_name`/`avatar_url`/`updated_at` — `role`, `first_mix_discount`, and `email` are frozen by both a narrowed column grant and a trigger fence (`20260730`). The `is_studio()` SECURITY DEFINER helper exists because a policy on `profiles` cannot subquery `profiles` (42P17).
- **projects / project_files / project_comments** — visible to the owning Client and all Studio; Studio-only writes for status; comment INSERT/DELETE scoped to author-or-Studio, with INSERT additionally requiring project membership at the DB floor (`20260730`).
- **Trigger fences.** Where a rule needs an OLD/NEW comparison or must tell system/Studio writers apart from Clients (Supabase gives them all the one `authenticated` role), the floor is a `SECURITY DEFINER` `BEFORE` trigger raising `42501`, with two escape hatches — service contexts (`auth.uid() IS NULL`) and Studio profiles. The family: archive (`20260625`), the order-field freeze (`20260702`/`20260713`/`20260724`), status writes (`20260705`), **system-only `projects` INSERTs** (`20260726` — client sessions cannot create project rows at all), the delivery/purge stamps (`20260726`), and the **privileged profile columns** (`20260730` — `role`/`first_mix_discount`/`email`).
- **archive (`projects.archived_at`)** — studio-only write via its fence; read is intentionally **not** restricted: archiving doesn't change what the Client sees (archived projects stay visible to their owner; the `.is('archived_at', null)` filter is studio-dashboard-only), so the timestamp carries no Client-relevant state and hiding one column from the shared role isn't worth a separate table.
- **contact_inquiries** — public INSERT, no public SELECT.
- **blog_posts** — anon reads *published* posts (`published_at` non-null); Studio reads/writes everything.
- **discount_codes / discount_redemptions** — client-inert under RLS; the only client-reachable surface is the narrow `lookup_discount_code` RPC. The redemptions ledger is deny-all except Studio SELECT; all writes flow through the service-role-only RPCs.

API error codes are consistent: `400` validation, `401` unauthenticated, `402` stem upload before payment, `403` wrong role, `404` not found/not visible, `409` concurrent status change / duplicate slug, `429` checkout rate limit, `500` misconfig, `503` Supabase unreachable.

## Storage

Two buckets (defined and resized in the `2026030x`/`20260425`/`20260428` migrations; the dormant `project-deliverables` bucket was removed in `20260725`):

- **project-uploads** (private, 5 GiB/file) — stems **and master refs** (`{owner}/{project}/{file}`), mixes (`{owner}/{project}/mixes/{file}` — upserts, so the Studio can replace a mix in place; since `20260730` the `project_files` row is reused too, keyed by a unique `(project_id, storage_path)`, so a replacement keeps its id and its comments instead of duplicating the track), comment attachments (`{owner}/{project}/comments/{uuid}/{file}`).
- **blog-assets** (public, 20 MB, images only) — Studio-only writes.

Large audio never streams through the API. The server half of the seam is `src/lib/portal/storage.ts`: buckets, path templates, `SIGNED_URL_TTL_SECONDS` (1 h), upload validation (5 GiB cap, 200-char filename cap, MIME allowlist — the `audio/*` family plus archives and `application/octet-stream` for audio kinds, images/PDF/text for attachments, never SVG), `createUpload` (signed upload URL first, then the `project_files` row born `upload_status: 'pending'` — a storage collision can't leave a dangling row; only `confirm` flips it to `uploaded`), `signedDownload`, and a download-route factory whose prebuilt products (`stemDownloadRoute` — studio-only; `attachmentDownloadRoute` — any project viewer) are re-exported by the route files. The client half is `src/lib/portal/uploadRunner.ts` — the **register → PUT → confirm** dance (comment attachments register + PUT only; their row is created by the listen POST, which rolls the comment back if the attachment insert fails). Mixes are streamed/downloaded via signed URLs minted server-side in the `/listen` page — there is no mix API route. Bucket-level storage RLS is deliberately coarse (any authenticated user may touch the private bucket); real per-project authorization happens at the table/API layer, because signed URLs are only ever minted server-side behind the auth guards.

## Payments

`src/lib/stripe/*` + the `checkout` / `webhook` / `payment-status` routes; discount orchestration in `src/lib/portal/orderDiscount.ts`; the shared payment writer in `src/lib/portal/paymentClaim.ts`.

**Pricing** (`pricing.ts`, pure `computeOrderPrice` — quoted identically by the homepage calculator, the order form, and checkout): $325 USD/song list, bulk tiers (3–4: 15%, 5–7: 20%, 8+: 25%), one public/private code (percent or fixed; private codes suppress the bulk tier), a 35% stacked-percentage cap, and a $225 USD per-song floor — a private code created with `allow_below_floor` may pierce it. **Add-ons** (extra revision +$50, 48h rush +$149) are priced after discounts, outside the cap/floor base. **GST/HST** (`CA_TAX_RATES`): full HST in HST provinces (15% NB/NL/PE, 14% NS, 13% ON), 5% GST elsewhere in Canada, non-CA buyers zero-rated; tax applies to the discounted subtotal including add-ons.

**Discounts:** the advertised welcome offer is **15% from one shared constant** (`WELCOME_DISCOUNT_PCT` — copy and charge agree), redeemed as the `WELCOME` code: resolved in code (never from the catalog), eligible when the Client has no prior paid Project, race-proofed by a one-WELCOME-per-owner partial unique index. The legacy `first_mix_discount` profile flag survives only as the no-code fallback (identity-guarded `reserve/restore_first_mix_discount` RPCs). Catalog codes are looked up via `lookup_discount_code` (rejections deliberately indistinct — the validate endpoint is not an enumeration oracle), held by an atomic `reserve_discount_code` CAS at checkout, returned via `restore_discount_code`, and finalized by `consume_discount_code` on confirmed payment — idempotent per project via the `discount_redemptions` ledger.

**Checkout flow** (`POST …/checkout`):

1. Validate everything before any side effect: service format, song count 1–99, stem count 1–999, add-ons against the canonical list, billing country (CA/US/OTHER) + CA province, 5000-char text caps, and T&C consent — the client-echoed version must equal the server's `TERMS_VERSION` (else 400 → re-consent). Rate limit: 3 pending checkouts per owner per minute (429).
2. Reserve the discount, price via `computeOrderPrice`, and reject sub-50¢ totals (Stripe's minimum — reachable via below-floor codes) with the hold released.
3. Create the PaymentIntent (redirect-based payment methods disabled so the pre-selected stem list survives to the post-payment upload; metadata carries `user_id`, `song_count`, `add_ons`, `tax_cents`, `tax_region`, `applied_coupon_code`).
4. INSERT the `pending_payment` Project **on the service client** (the `20260726` fence rejects any client-session INSERT; `owner_id` still binds to the session user) with the frozen order fields — `song_count`, `stem_count`, `subtotal_cents`, `tax_cents`, `add_ons`, `applied_coupon_code`, buyer country/province, `terms_accepted_at`/`terms_version`, `reference_tracks` — then best-effort patch `project_id` into the intent. Every failure past the reserve releases the hold exactly once; an insert failure also cancels the intent.
5. Return the `clientSecret` + full `PriceBreakdown` (which carries the discount lines, `add_ons_cents`, and the tax fields). If `PAYMENTS_DEV_BYPASS=true`, skip Stripe entirely: a born-paid `uploading` project at $0 with the real quote persisted; being webhook-less, it finalizes the discount consumption and sends the receipt inline.

**Payment writers.** `claimProjectPayment` is the single payment-write seam: a CAS fenced on `paid_at IS NULL`, run on the service client (the freeze + status fences 42501 client sessions by design), recording `paid_at` and advancing `pending_payment`→`uploading` only along the legal system edge. The **webhook** (signature-verified) cross-checks intent metadata against the row (mismatch: log + 200-ack, no write), claims, then must finalize the discount consumption — it 500s on failure so Stripe's retry loop is the durable finalizer (replays re-attempt idempotently) — and, only as the claim winner, best-effort sends the receipt. The **payment-status poll** reconciles directly with Stripe as the fallback: it fail-closed-verifies the intent metadata (`user_id`, `project_id`, `song_count`, `add_ons`) before claiming — defense-in-depth over the DB fence against re-attaching a freed intent to a forged row — and self-heals stranded discount consumes on every poll.

**Delete (unpaid):** sweeps the project's storage objects (stems, mixes, comment attachments), deletes with RETURNING, then restores whatever discount the returned row held — the first-mix flag via its RPC, a catalog code's hold via the service-role restore; `WELCOME` rows hold nothing (the row itself was the hold, so deletion frees the index slot). Paid rows restore nothing.

## Email

Three surfaces, all best-effort (a failed send never fails the request), all Client/inbox-facing — there are no studio-facing status emails:

- **Contact form** — stores the inquiry first, then emails `CONTACT_INBOX_TO` (dev falls back to self-sending to the from-address; production skips with a logged warning if unset — the inquiry is still stored).
- **Status notifications** (`src/lib/email/projectNotifications.ts`) — emails the Client on `in_review`, `processing`, `mixing`, `review`, `delivered` (`processing`/`mixing` share the "mixing has started" message; `revision`/`approved` are deliberately silent). Sent only by the winner of the CAS status update, so a lost race never double-emails.
- **Order-confirmation receipt** (`src/lib/email/orderConfirmation.ts`) — rendered exclusively from the frozen order row (`add_ons` via `ADD_ON_LABELS`, `tax_cents` with its HST/GST label, `applied_coupon_code` — never recomputed), sent exactly once by whichever payment writer wins the claim: webhook, poll, or dev-bypass insert.

`src/lib/resend.ts` configures Resend; `RESEND_FROM_EMAIL` sets the sender (`noreply@nova-spatial.com` in production).

## Blog & SEO

Posts live in the `blog_posts` table (`20260426`; `published_at NULL` = draft — there is no boolean flag), read via `src/lib/blog/posts.ts` (cookie-based server client so RLS applies; degrades to empty on error, so `/blog`, the sitemap, and the share image degrade instead of throwing). Authors are not DB rows: `author_key` points into the static team registry `src/lib/team.ts`. Markdown renders through react-markdown + remark-gfm + rehype-unwrap-images + rehype-slug + rehype-sanitize; the first inline image is the post's hero (`extractHeroImage.ts`), reused for the OG fallback and the share-card background.

Per-post SEO is built by `src/lib/blog/metadata.ts` (metadata + `BlogPosting` JSON-LD); the share card is generated at `GET /blog/[slug]/share-image` (next/og, brand font traced into the lambda via `outputFileTracingIncludes`, CDN-cached, gradient fallback). `sitemap.ts` and `robots.ts` derive from the same published-posts query — a publish appears in the sitemap immediately, and robots disallows only the private surface (nothing blocks AI crawlers). All publish side-effects run through one hook, `src/lib/blog/onPostMutated.ts`: Next.js cache revalidation plus a best-effort IndexNow ping (`indexnow.ts` — key served at `/indexnow-key.txt`, accepted pings logged; live and verified in production since 2026-07-27). Canonical host handling is `src/lib/site.ts` (`NEXT_PUBLIC_SITE_URL`, defaulting to the apex domain); the www→apex redirect is infrastructure.

## End-to-end flow

1. **Commission** — Client fills `/portal/new` (songs, stems, add-ons, optional discount code, billing country/province, T&C consent; the homepage calculator deep-links its quote into the form); `…/checkout` prices it and creates a `pending_payment` Project + PaymentIntent.
2. **Pay** — Client pays; the webhook (or the poll) claims the payment and flips the Project to `uploading`; the claim winner emails the receipt.
3. **Hand over** — Client uploads stems on `/upload` (register → PUT → confirm), then `finish-upload` moves the Project to `in_review` (idempotent — a re-submit is a silent no-op).
4. **Mix** — Studio reviews, uploads Mixes (same upload dance, `file_type: 'mix'`), and PATCHes status toward `review`.
5. **Review** — On `/listen`, the Client plays Mixes (signed streaming URLs) and leaves timestamped Comments tied to a `track_id`, optionally with attachments. Studio iterates through `revision`.
6. **Deliver** — Studio sets `approved`, then `delivered` (the PATCH stamps `delivered_at` inside the same CAS); the final Mix files on `/listen` are the Deliverables, downloaded via signed URLs.
7. **Archive** — Studio archives the finished Project to clear it from the studio dashboard (reversible; studio-only write enforced at the DB level). Archiving doesn't change the Client's view; full delete also removes storage objects.
8. **Purge** — 90 days after delivery, the daily cron (`/api/cron/purge-delivered`, 06:00 UTC) removes stem + mix audio in batches and stamps the `files_purged_at` tombstone; the project row survives as the order/consent/tax record. `master_ref` files and comment attachments are deliberately not purged, and since `20260730` deleting a Mix row **detaches** its comments (`track_id` nulls out) instead of cascading them away — the conversation and its attachments outlive the audio. A detached comment is preserved in the record but no longer rendered on `/listen`, which has no track to hang it under.

## Status state machine

`src/lib/portal/workflow.ts` is the single source of truth for the lifecycle: `PROJECT_STATUSES`, the status→step mapping, display labels, which steps are unlocked, and transition legality (`canTransition(from, to, actor)`) plus the upload gates (`canUploadStems`/`canUploadMix`) and the notifiable-status set. Clients advance only `uploading`→`in_review` (via `finish-upload`); Studio drives the rest via PATCH (illegal jumps are rejected with 400, concurrent transitions with 409). Payment events drive `pending_payment`→`uploading`. The DB backs the client rule per the RLS-first rule: the `projects_enforce_status_write_roles` trigger (`20260705`) lets service and studio contexts through and limits clients to `uploading`→`in_review`. (`processing` is retired — `canonicalStatus` maps it to `mixing`; it survives only for legacy rows.)

## Testing, migrations, deploy

- **Tests:** Vitest + jsdom + Testing Library, co-located `*.test.ts(x)` (72 files / ~860 tests). Supabase is mocked via `src/test/helpers/supabaseMock.ts`. See `CLAUDE.md` for commands.
- **Migrations:** plain SQL in `supabase/migrations/`, `YYYYMMDD_description.sql` (same-day files apply alphabetically), applied via the Supabase CLI / MCP (not in CI). RLS and storage buckets are defined here too.
- **Deploy:** Vercel. CI (`.github/workflows/main.yml`) installs, lints, runs the vitest suite, and builds on push/PR. `next.config.mjs` ships the CSP in **Report-Only** mode (Stripe + the Supabase origin/websocket allowed; not yet enforcing) plus enforced security headers (HSTS, `X-Frame-Options: DENY`, nosniff) and long-lived immutable caching for static media. `vercel.json` schedules the daily purge cron.

## Status

This document describes the current built system, which is fully shipped and live in production: the commerce engine (per-song USD pricing, bulk tiers, GST/HST, add-ons, the discount catalog + welcome code, T&C consent, order receipts), blog/SEO (per-post metadata + JSON-LD, share images, sitemap/robots, IndexNow — verified live), and the full project lifecycle (delivery anchor + 90-day purge, armed in production).
