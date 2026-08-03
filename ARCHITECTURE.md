# Architecture

NovaSpatial is a Next.js 15 (App Router) + React 19 + TypeScript 5 app on Supabase (Postgres, Auth, Storage), with Stripe for payments and Resend for email, deployed on Vercel: a public marketing site and blog, plus a private **client portal** for commissioning, reviewing, and delivering Dolby Atmos mixes. Everything described here is shipped and live in production.

Domain vocabulary and business values live in `CONTEXT.md`; commands and working rules in `CLAUDE.md`.

> **Audio is native to Supabase** — playback and timestamped comments run directly against it. A previous Samply integration was removed (`20260301_remove_samply`); ignore older references to it.

## Layout

```text
src/
├── app/            # App Router: pages + API route handlers
│   └── api/        # auth, portal, stripe, admin, blog admin, contact, cron, csp-report
├── components/     # admin, audio, portal, blog, sections, layout, ui, popups
├── hooks/          # useAuthUser, useProfile, useFileUpload, …
├── lib/            # supabase, auth, stripe, portal, email, blog, contact, legal, security, observability
├── types/          # portal.ts is the portal domain model
├── styles/         # Tailwind v4 entry + theme tokens + typography
├── middleware.ts   # Route guard for /portal, /profile, /blog/admin
supabase/migrations/ # Schema, RLS policies, storage buckets (YYYYMMDD_*.sql)
```

## Routing

- **Marketing (public):** `/`, `/about`, `/contact`, `/terms`, `/blog`, `/blog/[slug]`, plus `/sitemap.xml`, `/robots.txt`, `/blog/[slug]/share-image` (generated OG card), `/indexnow-key.txt`.
- **Auth:** `/login`, `/auth/confirm`, `/auth/update-password`; `GET /auth/callback` is a route handler (email-verification / OAuth code exchange).
- **Portal & account** (auth-gated by the middleware): `/profile`; `/portal` dashboard; `/portal/new` (priced checkout — consumes the homepage calculator's `?songs/addons/code` deep-link via `src/lib/portal/newProjectParams.ts`); `/portal/archived` (Studio-only); `/portal/[projectId]` redirects to the project's current step; `…/upload`; `…/listen` (`…/comment` is an alias of the same page).
- **Blog admin** (Studio-only): `/blog/admin/blog`, `…/blog/new`, `…/blog/[id]/edit`, `/blog/admin/discount-codes` — all under `src/app/blog/admin/layout.tsx`, which calls `requirePageStudioUser`.

### API endpoints

Handlers under `src/app/api`, each exporting `GET`/`POST`/`PATCH`/`DELETE` and returning `NextResponse.json(...)`. Status-code vocabulary: CLAUDE.md §Conventions.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login`, `/signup`, `/confirm`, `/resend-confirmation`, `/reset-password`; `GET /api/auth/me`; `GET /auth/callback` |
| Contact | `POST /api/contact` — store inquiry + email the studio |
| Projects | `GET /api/portal/projects` (list — **creation happens only through checkout**; the unpriced POST is gone); `GET /api/portal/projects/new-count`; `GET/PATCH/DELETE /api/portal/projects/[id]` |
| Checkout & pay | `POST /api/portal/projects/checkout`; `POST /api/stripe/webhook`; `GET /api/portal/projects/[id]/payment-status` |
| Discount codes | `GET/POST /api/admin/discount-codes`; `PATCH/DELETE /api/admin/discount-codes/[id]` (Studio CRUD — DELETE hard-deletes only an already-deactivated code: 400 if still active, 404 if absent, so a live code is never one click from gone); `POST /api/portal/discount-codes/validate` (authed live quote) |
| Files | `POST /api/portal/projects/[id]/files`; `POST …/files/[fileId]/confirm`; `GET …/files/[fileId]/download`; `DELETE …/files/[fileId]`; `POST …/finish-upload` |
| Comments | `GET/POST /api/portal/projects/[id]/listen` — list/create comments, named for its page; `DELETE …/comments/[commentId]`; `POST …/comment-attachments/register`; `GET …/comment-attachments/[attachmentId]/download` |
| Archive | `POST/DELETE /api/portal/projects/[id]/archive` |
| Blog admin | `POST /api/blog/admin/blog/posts`; `PATCH/DELETE …/posts/[id]` |
| Cron | `GET /api/cron/purge-delivered`, `GET /api/cron/sweep-orphans` (see §Cron jobs) |
| Security | `POST /api/csp-report` — browser violation sink; unauthenticated by protocol necessity, write-only with no DB surface, bounded and logged |

## Supabase clients

Three clients in `src/lib/supabase/`, chosen by execution context:

- **Browser** (`supabaseClient.ts`) — `createBrowserClient`, publishable key. Client components only.
- **Server** (`supabaseServer.ts`) — `createServerClient` wired to `cookies()`; the default for route handlers and server components. The middleware builds its own `createServerClient` over the request/response cookies, since it can't use `next/headers`, and that adapter is what refreshes the session cookie each request. Both run as the signed-in user, so **RLS applies**.
- **Service role** (`supabaseService.ts`, export `createServiceClient()`) — full-access singleton, `persistSession: false`, **bypasses RLS**. Reserved for work whose authority is not the user's session: the Stripe webhook, the payment-status poll's claim (a Stripe-verified fact), both checkout project INSERTs, the contact-inquiry INSERT, the unpaid-delete discount restore, the crons, and **every discount RPC** — reserve/restore/consume plus the catalog `lookup_discount_code`, which even the authed validate endpoint must call on this client since the `20260731` grants.

## Auth & authorization

**Middleware** (`src/middleware.ts`, matching `/portal/:path*`, `/profile/:path*`, `/blog/admin/:path*` — the whole private surface). Every matched response carries `X-Robots-Tag: noindex, nofollow`, so private URLs are de-indexed rather than merely un-crawled. Without an `sb-*-auth-token` cookie, bare `/portal` and `/profile` redirect to `/` (marketing-first) and deeper links to `/login?next=…`; with one, it validates via `getClaims()` and refreshes the session cookie, clearing stale cookies when validation fails because Supabase is unreachable.

**Redirect targets are untrusted.** Every `?next=` passes through `safeNextPath` (`src/lib/auth/nextPath.ts`) — one leading slash, no `//` or `/\`, no control characters — at every consumer: the callback, the signup and resend-confirmation routes' `emailRedirectTo`, the confirm route and the confirm page's hidden field, and the login page's `router.push`. The callback's host comes from `resolveRedirectOrigin` (`src/lib/auth/redirectOrigin.ts`), which honors `x-forwarded-host` only when it matches the canonical host, its `www.` sibling, or a platform-supplied `VERCEL_*` host; outside production the request origin passes through unchanged.

**Server helpers** (`src/lib/auth/server.ts`) gate every page and handler:

- `requirePageUser` / `requirePageProfile` / `requirePageStudioUser` — redirect-based, for server components; the studio variant sends non-studio users to `/portal`.
- `requireApiUser` / `requireApiProfile` / `requireApiStudioUser` — return an error `Response` instead of redirecting; the studio variant enforces `role === 'studio'`.
- `getProjectOrNotFound` / `getProjectOrApiNotFound` — fetch a project and apply visibility (soft-delete flags + role) before returning.
- `requireProjectChild` — composite guard for project-scoped child rows; loads project + child and derives `isStudio`/`isOwner`/`isAuthor`, leaving the 403 decision to the handler.

**RLS policies** are the enforcement floor (CLAUDE.md states the RLS-first rule):

- **profiles** — you read your own row, Studio reads every row, and every session reads Studio rows (comment authorship renders from them); anonymous sessions read nothing (`20260730_restrict_profile_reads`). You update only your own `display_name`/`avatar_url`/`updated_at`; `role`, `first_mix_discount`, and `email` are frozen by a narrowed column grant plus a trigger fence (`20260730_fence_profile_role`). The `is_studio()` SECURITY DEFINER helper exists because a policy on `profiles` cannot subquery `profiles` (42P17).
- **projects / project_files / project_comments** — visible to the owning Client and all Studio; Studio-only status writes; comment INSERT/DELETE scoped to author-or-Studio, INSERT additionally requiring project membership at the DB floor (`20260730_harden_comment_inserts`).
- **archive** (`projects.archived_at`) — studio-only write via its fence; read deliberately unrestricted, since archiving doesn't change what the Client sees (the `.is('archived_at', null)` filter is studio-dashboard-only). The timestamp carries no Client-relevant state, and hiding one column from the shared role isn't worth a separate table.
- **contact_inquiries** — deny-all, and inquiries are a system write through the service client, so a row is only born through the endpoint that applies validation, caps, and a rate limit. That limit bounds each key independently: at most 3 inquiries per email address and 3 per SHA-256 `ip_hash` in a 10-minute window, the hash standing in for the raw address, which is never stored. It is nullable, so a request with no forwarded IP is bounded by email alone. No public SELECT (`20260730_harden_contact_inquiries`).
- **blog_posts** — anon reads *published* posts (`published_at` non-null); Studio reads and writes everything.
- **discount_codes / discount_redemptions** — client-inert, with no client-reachable RPC at all: since `20260731_service_only_discount_rpcs` all six discount functions, the read-only `lookup_discount_code` included, are EXECUTE-granted to `service_role` only, because a lookup granted to `authenticated` is a per-guess catalog oracle. The catalog is reachable only through the server routes on the service client. The redemptions ledger is deny-all except Studio SELECT.

**Trigger fences.** Where a rule needs an OLD/NEW comparison, or must tell system and Studio writers apart from Clients (Supabase gives them all the one `authenticated` role), the floor is a `SECURITY DEFINER` `BEFORE` trigger raising `42501`, with two escape hatches: service contexts (`auth.uid() IS NULL`) and Studio profiles.

| Fence | Migration |
| --- | --- |
| Archive writes | `20260625` (service escape added in `20260731_archive_fence_service_escape`) |
| Order-field freeze | `20260702` / `20260713` / `20260724` |
| Status writes | `20260705` |
| System-only `projects` INSERTs — client sessions cannot create project rows at all | `20260726` |
| Delivery / purge stamps | `20260726` |
| Privileged profile columns | `20260730_fence_profile_role` |
| Paid-project deletes — clients may delete only unpaid rows, protecting the order/consent/tax record and closing a charge-without-project race against the webhook | `20260730_fence_paid_project_delete` |

## Storage

Two buckets: **project-uploads** (private, 5 GiB/file) and **blog-assets** (public, 20 MB, images only, Studio-only writes; anonymous bucket *listing* dropped in `20260731_blog_assets_no_listing`). The dormant `project-deliverables` bucket and `deliverables` table were removed in `20260725`. `project_files.file_type` is `stem | master_ref | mix`. Large audio never streams through the API.

- **Paths:** stems and master refs `{owner}/{project}/{file}`; mixes `{owner}/{project}/mixes/{file}`; comment attachments `{owner}/{project}/comments/{uuid}/{file}`.
- **Re-upload / mix replacement:** re-registering a file under a name it already carries upserts the object in place and reuses its `project_files` row, for **every** kind — stem, master ref, and mix alike (unique `(project_id, storage_path)` since `20260730_dedupe_project_files`), so a client re-uploading a corrected stem no longer hits an opaque 500. For a Mix that reuse is what makes a replacement keep its id and comments instead of duplicating the track. Deleting a Mix **detaches** its comments (`track_id` nulls out — `20260730_detach_comments_from_tracks`) rather than cascading them away: the conversation and its attachments outlive the audio, preserved in the record but no longer rendered on `/listen`, which has no track to hang them under.
- **Server seam** (`src/lib/portal/storage.ts`) — buckets, path templates, `SIGNED_URL_TTL_SECONDS` (1 h), upload validation (5 GiB cap, 200-char filename cap, MIME allowlist: the `audio/*` family plus archives and `application/octet-stream` for audio kinds, images/PDF/text for attachments, **never SVG**), `signedDownload`, and a download-route factory whose prebuilt products the route files re-export (`stemDownloadRoute` studio-only, `attachmentDownloadRoute` any project viewer). `createUpload` mints the signed upload URL *first*, then writes the `project_files` row born `upload_status: 'pending'`, so a storage collision can't leave a dangling row; only `confirm` flips it to `uploaded`.
- **Client seam** (`src/lib/portal/uploadRunner.ts`) — the **register → PUT → confirm** dance. Comment attachments register and PUT only; their row is created by the listen POST, which rolls the comment back if the attachment insert fails.
- Mixes stream and download via signed URLs minted server-side in the `/listen` page — there is no mix API route. Bucket-level storage RLS is deliberately coarse (any authenticated user may touch the private bucket); real per-project authorization lives at the table/API layer, since signed URLs are only ever minted server-side behind the auth guards.

## Payments

`src/lib/stripe/*` plus the `checkout` / `webhook` / `payment-status` routes; discount orchestration in `src/lib/portal/orderDiscount.ts`; the shared payment writer in `src/lib/portal/paymentClaim.ts`.

**Pricing** — the pure `computeOrderPrice` (`pricing.ts`) quotes identically for the calculator, order form, payment step, and charge; the values live in CONTEXT §Commerce & pricing. Private codes suppress the bulk tier, percent discounts stack under the cap, the floor binds unless the code carries `allow_below_floor`, add-ons price after discounts outside the cap/floor base, and tax applies to the discounted subtotal including add-ons.

**Discounts** — the welcome offer is one shared constant (`WELCOME_DISCOUNT_PCT`, so copy and charge agree), redeemed as `WELCOME`: resolved in code rather than the catalog, eligible with no prior paid Project, race-proofed by a one-WELCOME-per-owner partial unique index. The legacy `first_mix_discount` flag survives only as the no-code fallback (identity-guarded `reserve/restore_first_mix_discount` RPCs). Catalog codes resolve through `lookup_discount_code` — rejections deliberately indistinct, so validate is not an enumeration oracle — then are **held** by an atomic `reserve_discount_code` CAS, returned via `restore_discount_code`, and finalized by `consume_discount_code` on payment, idempotent per project via the `discount_redemptions` ledger.

**Checkout** (`POST …/checkout`):

1. Validate before any side effect: format, song count 1–99, stem count 1–999, add-ons against the canonical list, billing country (CA/US/OTHER) + CA province, 5000-char text caps, and T&C consent whose echoed version must equal the server's `TERMS_VERSION` (else 400 → re-consent). Rate limit: 3 pending checkouts per owner per minute (429).
2. Reserve the discount, price it, and reject sub-50¢ totals — Stripe's minimum, reachable via below-floor codes — releasing the hold.
3. Create the PaymentIntent, redirect-based payment methods disabled so the pre-selected stem list survives to the post-payment upload. Metadata carries `user_id`, `song_count`, `add_ons`, `tax_cents`, `tax_region`, `applied_coupon_code`.
4. INSERT the `pending_payment` Project and its frozen order fields **on the service client** — the `20260726` fence rejects client-session INSERTs, though `owner_id` still binds to the session user — then best-effort patch `project_id` into the intent. Every failure past the reserve releases the hold exactly once; an insert failure also cancels the intent.
5. Return the `clientSecret` + full `PriceBreakdown` (discount lines, `add_ons_cents`, tax fields). The local dev bypass (CLAUDE.md §Environment) skips Stripe: a born-paid `uploading` project at $0 with the real quote persisted, finalizing the discount and sending the receipt inline since no webhook will fire.

**Payment writers.** `claimProjectPayment` is the single payment-write seam: a CAS fenced on `paid_at IS NULL`, run on the service client (the freeze and status fences 42501 client sessions by design), recording `paid_at` and advancing `pending_payment`→`uploading` along the legal system edge only.

- The **webhook** — signature-verified, needing a registered live endpoint and `STRIPE_WEBHOOK_SECRET` in the production env — cross-checks intent metadata against the row (a mismatch logs and 200-acks with **no write**), claims, then must finalize the discount consumption. It 500s on that failure so Stripe's retry loop becomes the durable finalizer, replays re-attempting idempotently. Only the claim winner sends the receipt.
- The **payment-status poll** is the fallback, reconciling directly with Stripe. It fail-closed-verifies the intent metadata (`user_id`, `project_id`, `song_count`, `add_ons`) before claiming — defense-in-depth over the DB fence against re-attaching a freed intent to a forged row — and self-heals stranded discount consumes on every poll.

**Delete (unpaid)** reads the project's storage paths first (stems, mixes, comment attachments — the child *rows* cascade, the storage *objects* don't), deletes with RETURNING, restores whatever discount the returned row held (the first-mix flag via its RPC, a catalog code's hold via the service-role restore), and only then sweeps the objects; a sweep failure after the committed delete is logged, never surfaced. The order is load-bearing — sweeping first meant a failed row delete left the audio gone and the rows pointing at nothing. `WELCOME` rows hold nothing — the row itself was the hold, so deletion frees the index slot. Paid rows restore nothing, and the DB floor rejects client deletes of paid rows outright (`20260730_fence_paid_project_delete`).

## Email

Three surfaces, all best-effort (a failed send never fails the request) and all Client/inbox-facing — there are no studio-facing status emails.

- **Contact form** — stores the inquiry first, then emails `CONTACT_INBOX_TO`; dev falls back to self-sending to the from-address, production skips with a logged warning if unset (the inquiry is still stored).
- **Status notifications** (`src/lib/email/projectNotifications.ts`) — emails the Client on `in_review`, `processing`/`mixing` (one shared "mixing has started" message), `review`, and `delivered`; `revision` and `approved` are deliberately silent. Sent only by the winner of the CAS status update, so a lost race never double-emails.
- **Order-confirmation receipt** (`src/lib/email/orderConfirmation.ts`) — rendered exclusively from the frozen order row (`add_ons` via `ADD_ON_LABELS`, `tax_cents` with its HST/GST label, `applied_coupon_code`), never recomputed, so a later price change can't rewrite an old receipt. Sent exactly once, by whichever payment writer wins the claim: webhook, poll, or dev-bypass insert.

`src/lib/resend.ts` configures Resend; `RESEND_FROM_EMAIL` sets the sender (`noreply@nova-spatial.com` in production).

## Blog & SEO

Posts live in the `blog_posts` table (`20260426_create_blog_posts`; `published_at NULL` = draft, there is no boolean flag), read via `src/lib/blog/posts.ts` on the cookie-based server client so RLS applies — it degrades to empty on error, so `/blog`, the sitemap, and the share image degrade instead of throwing. Authors are not DB rows: `author_key` points into the static team registry `src/lib/team.ts`. Markdown renders through react-markdown + remark-gfm + rehype-unwrap-images + rehype-slug + rehype-sanitize; the first inline image is the hero (`extractHeroImage.ts`), reused for the OG fallback and the share-card background.

Per-post SEO comes from `src/lib/blog/metadata.ts` (metadata + `BlogPosting` JSON-LD); the share card is generated at `GET /blog/[slug]/share-image` (next/og, brand font traced into the lambda via `outputFileTracingIncludes`, CDN-cached, gradient fallback). `sitemap.ts` derives from the same published-posts query, so a publish appears in the sitemap immediately; `robots.ts` runs no query — it is a static rule set disallowing only the private surface (`/api/`, `/auth/`, `/login`, `/profile`, `/portal/`, `/blog/admin`) and pointing crawlers at the sitemap. Nothing blocks AI crawlers. All publish side-effects run through one hook, `src/lib/blog/onPostMutated.ts`: Next.js cache revalidation plus a best-effort IndexNow ping (`indexnow.ts`, key served at `/indexnow-key.txt`, accepted pings logged; live and verified in production since 2026-07-27). Canonical host handling is `src/lib/site.ts` (`NEXT_PUBLIC_SITE_URL`, defaulting to the apex domain); the www→apex redirect is infrastructure.

## End-to-end flow

The sequence, with each step's mechanics in the section named:

1. **Commission** — Client fills `/portal/new`; checkout prices it and creates a `pending_payment` Project + PaymentIntent (§Payments).
2. **Pay** — the webhook or poll claims the payment, flips the Project to `uploading`, and the claim winner emails the receipt.
3. **Hand over** — Client uploads stems on `/upload`, then `finish-upload` moves the Project to `in_review`; it is idempotent, so a re-submit is a silent no-op.
4. **Mix** — Studio reviews, uploads Mixes (`file_type: 'mix'`), and PATCHes status toward `review` (§Storage, §Status state machine).
5. **Review** — Client plays Mixes on `/listen` and leaves timestamped Comments tied to a `track_id`, optionally with attachments; Studio iterates through `revision`.
6. **Deliver** — Studio sets `approved`, then `delivered`, whose PATCH stamps `delivered_at` inside the same CAS. The final Mix files on `/listen` are the Deliverables.
7. **Archive** — Studio clears the finished Project from the studio dashboard (§Auth & authorization). A full delete also removes storage objects.
8. **Purge** — after the retention window the cron strips the audio and leaves the row as the order record (§Cron jobs; CONTEXT: Purge).

## Status state machine

`src/lib/portal/workflow.ts` is the single source of truth: `PROJECT_STATUSES`, the status→step mapping, display labels, which steps are unlocked, transition legality (`canTransition(from, to, actor)`), the upload gates (`canUploadStems`/`canUploadMix`), and the notifiable-status set. Clients advance only `uploading`→`in_review` (via `finish-upload`); Studio drives the rest via PATCH, with illegal jumps rejected 400 and concurrent transitions 409; payment events drive `pending_payment`→`uploading`. The DB backs the client rule per the RLS-first doctrine (`20260705`). `processing` is retired — `canonicalStatus` maps it to `mixing`, and it survives only for legacy rows.

## Cron jobs

Both scheduled by `vercel.json` and bearer-authed by `CRON_SECRET`, failing closed without it:

- **`GET /api/cron/purge-delivered`** (daily 06:00 UTC) — removes stem + mix audio in batches once the retention window passes, stamping `files_purged_at`.
- **`GET /api/cron/sweep-orphans`** (daily 06:30 UTC) — removes `project_files` rows stuck `pending` beyond 24 h, and comment-attachment objects that never got a row, via a service-only RPC anti-join (`20260731_add_orphan_sweep_support`). It deliberately never touches `projects`: abandoned checkouts holding coupon capacity is an accepted residual (CLAUDE.md), and a test asserts the table is never named.

## Build & deploy notes

`next.config.ts` derives its headers from `src/lib/security/csp.ts`, a pure tested builder — the config is transpiled by SWC, so that module stays free of runtime imports. The CSP allows Stripe's script, frame (including `m.stripe.network`), and telemetry hosts plus the Supabase origin and websocket, drops `'unsafe-eval'` outside development, and names `/api/csp-report` in both `report-uri` and `report-to`; Report-Only vs enforce is the `CSP_MODE` flip described in CLAUDE.md §Deploy / CI. Enforced security headers (HSTS, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy) and long-lived immutable caching for `/videos` and `/images` ship alongside. Commands, CI, testing, and the migration workflow: see CLAUDE.md.
