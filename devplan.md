# NovaSpatial — Launch-Readiness Remediation Plan

**Created:** 2026-07-30 · **Status:** all agent-side code shipped — GO pending human ops (#55 legal + retention disclosure — **again the one hard blocker**, #50 CSP flip after the five soak flows, #54's three remaining copy rulings — the `/blog` filler and Tone Lock wording shipped 2026-08-01 — two #59 toggles; **#63 Stripe webhook closed 2026-08-03**) · **Tracker:** GitHub issues #44–#64 · **Refreshed:** 2026-08-03

Derived from the launch-readiness audit (portal + marketing site, first real paying clients).
Original verdict: do not launch until the two blockers close. Both original blockers (#44, #45)
are now closed; every technical fix is on `main` and applied to the live database. A third
blocker briefly replaced them — **#63, the Stripe webhook that was never registered** — and
closed 2026-08-03: endpoint registered, secret deployed, and the match proven with a zero-money
signed delivery. What remains is human-owned (see the ops checklist)
plus the decision packs posted to #54 and #55, which turn each remaining ruling into a one-line
answer. Migrations follow the repo's fence pattern; each RLS change updates the policy,
`src/types/portal.ts`, and tests together, is applied via the Supabase CLI/MCP (not CI), and is
followed by a fresh `get_advisors(security)` run.

**2026-07-31 addendum.** A second pass over the "human-gated" residue found that framing was
only partly true. #59 still held six shippable code items — one of which, the discount-RPC
grants, turned out to be a **live unauthenticated hole**: `reserve_/restore_first_mix_discount`
were EXECUTE-able by `anon` (Supabase default privileges, never revoked) and their identity
guards pass a null uid, so an anonymous caller could burn or re-arm any client's welcome
discount. Three more defects surfaced in code already called done: the contact rate limiter
was defeatable by a comma in a validated email address, production was shipping no
`Reporting-Endpoints` header at all (so half of #50's evidence channel was dark), and the
`blog-assets` bucket allowed anonymous enumeration. All fixed and verified against production.

---

## Guiding principles

1. **RLS-first.** Every authorization fix lands as a Postgres policy/trigger change first;
   app-layer checks are defense-in-depth, never the only layer.
2. **Blockers before anything else.** Phase 0 gated the work; it was taken first.
3. **Batch by seam.** The three RLS fixes (#44, #46, #47) rode one coordinated migration
   commit; the handler fixes rode a second; the trailing tiers were independent. (Written as
   "PR" originally — the work landed as direct commits to `main`, one per unit, each with CI
   green before the next started.)
4. **Verify each fix adversarially** — from a non-privileged session, confirm the hole is
   actually closed, not just that the app path behaves.

---

## Phase 0 — Launch blockers (MUST close before go) 🔴

| Issue                                        | Fix                                                                                                                                                                                                           | Type       | Status                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------- |
| #44 Privilege escalation via `profiles.role` | `BEFORE UPDATE` trigger fence on `profiles` (role + `first_mix_discount` immutable for non-studio/non-service) **and** grant narrowing on `public.profiles` (the proposed column `REVOKE` was a no-op)        | Migration  | ✅ closed 2026-07-31   |
| #45 `PAYMENTS_DEV_BYPASS` unguarded          | Refuse the bypass on **any Vercel deploy** (preview shares the prod DB) and under bare `NODE_ENV=production`; comment out the `=true` default in `.env.example`; **verify the Vercel env**                    | Code + ops | ✅ closed 2026-08-01   |
| #63 Stripe webhook never deployed            | Register the live endpoint at `/api/stripe/webhook` (`payment_intent.succeeded`) and set `STRIPE_WEBHOOK_SECRET` in the Production scope, then redeploy. Until then the only claim path is a 30s in-page poll | Ops        | ✅ closed 2026-08-03   |

**Shipped (54161d7, 91adecb):**

- `20260730_fence_profile_role.sql` — the `is_studio()` helper plus a `BEFORE UPDATE` fence on
  `role` / `first_mix_discount` / `email`. The planned column `REVOKE` turned out to be a no-op
  (column privileges were never granted separately), so the grant itself was narrowed:
  `REVOKE UPDATE ON profiles` then `GRANT UPDATE (display_name, avatar_url, updated_at)`.
- `isPaymentsDevBypassEnabled` in `src/lib/stripe/devBypass.ts` replaces the raw env read in
  the checkout route; `.env.example` ships the flag commented out. **Widened 2026-07-31 (not yet
  committed):** the helper now refuses the bypass on _any_ Vercel deploy — gating on
  `VERCEL`/`VERCEL_ENV` presence, and separately on bare `NODE_ENV=production` for non-Vercel
  hosting — so preview is covered too. Local dev and vitest (`NODE_ENV=test`) are unaffected.

**Exit gate:**

- [x] Non-studio `PATCH {"role":"studio"}` → denied. Verified twice: the grant layer refuses it
      (`permission denied for table profiles`) and, tested in isolation, the trigger raises `42501`.
- [x] Trigger present; `get_advisors(security)` shows no ERROR-level findings.
- [x] Unit cases assert `devBypass` is false on every Vercel deploy (preview included) and under
      bare `NODE_ENV=production`, plus a route-level test that a production env takes the real
      Stripe path, and two tree assertions (single reader; `.env.example` never ships it armed).
- [x] **Human/ops:** the two production `role='studio'` accounts confirmed intended by the
      owner (2026-07-31); the grant procedure is recorded in `docs/adr/0001-studio-access-is-granted-out-of-band.md`. **#44 closed.**
- [x] The preview scope is closed in code too: with one Supabase project and no branches, a
      preview deploy writes to the production database, so the bypass is refused on Vercel
      outright. Deploy smoke tests use a Stripe test card.
- [x] **Human/ops:** Vercel env verified 2026-08-01 against the dashboard, Project tab, All
      Environments — 10 variables, **no `PAYMENTS_DEV_BYPASS` in any scope** and nothing in the
      `Shared` tab. Nothing to unset; **#45 closed**. The same audit found #63 (below).

---

## Phase 1 — High severity (before launch) 🟠

| Issue                                             | Fix                                                                                                                          | Type             | Status               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------- |
| #46 Cross-project comment injection               | Add owner-or-studio project-membership predicate to `project_comments` INSERT `WITH CHECK`                                   | Migration        | ✅ closed 2026-07-30 |
| #47 `profiles` read policy exposes contact fields | Restrict SELECT to self-or-studio for `email`/`role`/`first_mix_discount`; keep `display_name`/`avatar_url` public if needed | Migration        | ✅ closed 2026-07-30 |
| #48 Delete of paid/delivered projects             | Gate client DELETE to `pending_payment` (studio override); move storage sweep to **after** a successful row delete           | Code + migration | ✅ closed 2026-07-30 |
| #49 Status-notification 500s after commit         | Wrap `projectNotifications` send in try/catch (log-and-continue)                                                             | Code             | ✅ closed 2026-07-30 |

**Batching (as shipped):** #46 + #47 rode with #44 in 54161d7 (`20260730_harden_comment_inserts`,
`20260730_restrict_profile_reads`). #48 + #49 rode in 64194e9, plus one migration the plan didn't
anticipate — `20260730_fence_paid_project_delete` — because the paid-delete rule belongs at the
DB floor, not only in the handler. `src/types/portal.ts` needed no change here (no column
exposure changed); it changed later for #58.

**Exit gate:**

- [x] Foreign-project comment insert from a simulated client session → `42501`. Positive control
      first: the same insert succeeded before the migration.
- [x] Anon reads 0 profile rows; a client reads 0 foreign client rows, still sees its own row and
      studio rows (which comment authorship renders from), and can still rename itself.
- [x] Client DELETE of a paid row → `42501` at the DB and 403 in the handler; unpaid client delete
      and studio paid delete still work. Storage sweep now runs after the row delete, with a test
      that a failed delete leaves the audio untouched.
- [x] Thrown Resend error on PATCH → 200, not 500 (unit tests on the sender plus a route test).

---

## Phase 2 — Medium severity (target pre-launch; legal items human-owned) 🟡

**Security (`ready-for-agent`):**

- 🔒 #50 CSP → report endpoint live, directive list corrected (Stripe frame/telemetry hosts, no `unsafe-eval` in prod), `CSP_MODE` lever added _(shipped 2026-07-30)_; canonical-origin fallback so `Reporting-Endpoints` is actually emitted in production, plus a throttle on the sink so a flood can't bury the soak evidence _(2026-07-31)_. Enforce flip is an ops step after the soak.
- ✅ #51 Contact form → rate limit, length caps, email validation, sanitized subject/replyTo, guarded `request.json()`, anon INSERT policy dropped _(shipped 2026-07-30)_; limiter filter-injection fixed and **captcha ruled out** as controls-sufficient _(2026-07-31 — closed)_.
- ✅ #52 Promo email check → the probe was deleted outright (any boolean is an oracle); the popup forwards straight to signup. _(closed 2026-07-30)_
- ✅ #56 `/auth/callback` open redirect → validate `next` starts with a single `/`; stop trusting `x-forwarded-host` unvalidated. _(closed 2026-07-30)_

**SEO / content / legal:**

- ✅ #53 Per-page self-referential canonicals (SEO — important for the marketing push). _(closed 2026-07-30)_
- 🚫 #54 Rewrite `/blog` + `/about` meta copy; legal/marketing review of the "Trusted by" logos and volume stats (**`ready-for-human`** — skipped by the loop, human-owned). The decision pack is **five** rulings; **two were taken and shipped 2026-08-01**: (1) meta copy — B2 on `/blog` (meta **and** the visible PageIntro), A2 on `/about` (db2fc36); (4) Spatial Tone Lock ruled an in-house process, not a filed mark — "proprietary"/"exclusive" swapped for "in-house"/"custom"/"specialized" in `HeroContent`, `FAQ`, `Services`, `about/page` (ba512d2; PromoPopup's "exclusive welcome discount" qualifies the offer, not the process, and stays). Still open: (2) the logo wall, (3) the three `/about` stats — which must move in lockstep with `Testimonials.tsx:12-13` ("20+ Years Experience" / "Award-Winning Quality" chips under "Over 20 Years of Mixing Excellence", on the **homepage**, or the site contradicts itself), and (5) whether #54 blocks launch at all — the Phase 2 exit gate below still doesn't name it.
- 🚫 #55 Add a privacy policy; expand Terms (refund/cancellation, revisions, delivery, governing law, legal entity) (**`ready-for-human`, legal ownership** — skipped by the loop; still the one hard launch blocker for taking payments). **It also carries the retention disclosure**: `RETENTION_DAYS = 90` has been purging on a daily cron since 2026-07-26, and no client-facing surface — Terms, checkout, or any privacy text — has ever said so (the old `retentionPurge.ts` citation of "T&C §6" was false and is corrected). No ruling is needed for it (D7/D7b are settled) and the copy is drafted in the #55 pack; it just cannot ship separately, because the same deploy bumps `TERMS_VERSION` and forces every returning client to re-tick consent.

**Data integrity:**

- ✅ #57 Mix re-upload dedupe (unique on `(project_id, storage_path)` + row reuse), stem re-upload path, MIME allowlist + filename length cap. _(closed 2026-07-30)_
- ✅ #58 Ruled in favor of the documented behavior: comments detach from a purged Mix instead of cascading; code + docs agree. _(closed 2026-07-30)_

**Exit gate:**

- [x] Contact-form abuse controls in place (rate limit, caps, validation, header-safety,
      service-only writes).
- [x] Canonicals correct per page, with a metadata test guarding the regression.
- [x] #57 / #58 resolved with tests and adversarial DB checks.
- [ ] Enforcing CSP live — the endpoint and the corrected policy shipped; the flip is an ops
      step (#50).
- [ ] Privacy policy published and Terms expanded, with legal sign-off (#55) — including the
      90-day audio-retention disclosure, which has no client-facing statement today.
- [ ] **Ruling recorded on whether #54 blocks launch.** Neither answer is written down anywhere,
      so as it stands launch can be declared GO while `/blog`'s meta description tells search
      engines the site re-purposes CSS-tricks articles and the homepage shows Netflix and
      Universal under "Trusted by". Either ruling is fine; the gap is that it is unrecorded.

---

## Phase 3 — Low / fast-follow ⚪

- 🔒 #59 batch (8 items). **Shipped:** Stripe `idempotencyKey`, re-pinned API version, hardened
  `confirm` route, no more raw error details, contact-address and sender-fallback fixes;
  discount RPC grants service-only (2026-07-31 — the anon hole on the first-mix pair was a
  live exploit; code deployed first, migration `20260731_service_only_discount_rpcs` after
  the drain, probes on #59).
  Sentry wired DSN-gated + money-path anomaly alerts, footer newsletter form made real
  (forwards to signup with the promo token, like the popup), package name/engines, unused
  `STRIPE_RESTRICTED_KEY` dropped, purge backlog warned, archive fence brought into the
  family, blog-assets listing policy dropped _(2026-07-31)_.
  Orphan sweeper shipped as a second daily cron _(2026-07-31)_.
  **Open:** leaked-password protection (dashboard), Sentry DSN provisioning (ops).

Split any item into its own issue if it grows beyond a cleanup.

---

## Sequencing & dependencies

Executed order, one commit per unit, CI green before the next:

```
#45 ─► #44+#46+#47 (RLS) ─► #48+#49 (handlers) ─► #56 ─► #52+#53 ─► #51 ─► #57 ─► #58 ─► #50 ─► #59
```

`#50` was taken last on purpose: the header is compiled into the build, so a wrong directive
would mean a redeploy to recover, and the report data it adds is what makes the flip decidable.

- The launch gate = Phase 0 **and** Phase 1 green, plus the legal minimum from #55 (privacy
  policy + refund terms) if taking real payments at launch. Phase 0 and 1 are green on the
  technical side; **#55 is the one remaining hard blocker.**
- Phase 2 security + SEO items landed pre-launch, except the CSP enforce flip and the captcha
  decision, which are ops calls rather than code.

---

## Verification (each phase)

1. **Adversarial DB check** for every RLS/authz fix — exploit the hole from a non-privileged
   session and confirm it's closed (not just the app path).
2. `npx vitest run` (add co-located tests per fix) and `npm run build` (the only type-check in CI).
3. `get_advisors(security)` after every DDL change; keep it clean.
4. Manual smoke of the affected flow (checkout, upload, listen, delete) on a preview deploy.
   **Checkout smokes with a Stripe test card, not the dev bypass** — the bypass is refused on
   every Vercel deploy since #45's preview fix, and it never exercised Stripe anyway. Note that
   a preview deploy writes to the production database (one Supabase project, no branches), so
   smoke-test rows are real rows: clean them up.

## Ops checklist (launch day)

Everything below needs a human — none of it is visible from or fixable in the repo.

- [x] **Register the Stripe webhook (#63) — done, closed 2026-08-03.** In the live
      Stripe Dashboard create an endpoint at `https://nova-spatial.com/api/stripe/webhook`
      subscribed to `payment_intent.succeeded`, then set its `whsec_…` signing secret as
      `STRIPE_WEBHOOK_SECRET` in the **Production** scope only (one Stripe account and one
      Supabase project — a preview-scoped webhook would race production on the same rows) and
      redeploy. Verified 2026-08-01 as absent on both sides: no `STRIPE_WEBHOOK_SECRET` in any
      Vercel scope, and `/v1/webhook_endpoints` + `/v2/core/event_destinations` both return 0.
      Until this lands, the only path that claims a payment is a 30s in-page poll
      (`NewProjectForm.tsx:112`), so a client who closes the tab — or a 3DS intent that settles
      past 30s — is charged with no project, no receipt and a coupon reservation left held.
      **Executed 2026-08-03:** endpoint `we_1U0ENlEHmSecVNzjBbEBAtKu` enabled with the three
      intent events; curl probe flipped 500 → 400 after the env + redeploy; secret match proven
      without money — a cardless $1 PI was created and canceled to make Stripe send a genuinely
      signed `payment_intent.canceled`, and the event read back `pending_webhooks: 0` (2xx ack,
      which the handler only gives after `constructEvent` verifies against the deployed secret).
      Real-money E2E + dashboard resend waived by owner ruling; the first organic payment is the
      final confirm (`[stripe webhook] payment claimed` must appear in the Vercel logs — a real
      payment without that line reopens #63). Endpoint api_version `2026-03-25.dahlia` vs SDK pin
      `2026-05-27.dahlia` is harmless (handler reads only `intent.id`/`intent.metadata`).
- [x] Vercel env: `PAYMENTS_DEV_BYPASS` unset/false in **both** the Production and Preview
      scopes, and in any shared env group they inherit (#45) — verified 2026-08-01: the flag is
      absent from all 10 variables and from the `Shared` tab, so there was nothing to unset. The
      audit also recorded that `SUPABASE_SERVICE_ROLE_KEY` is scoped Production **and Preview**
      and `STRIPE_SECRET_KEY` / `RESEND_API_KEY` to All Environments — preview carries live
      credentials, which is the evidence behind refusing the bypass there.
- [x] Confirm the two existing `role = 'studio'` profiles are intended accounts, and record how
      studio access gets granted from here (#44) — both confirmed 2026-07-31; procedure in
      `docs/adr/0001-studio-access-is-granted-out-of-band.md` (service-role only, no admin UI).
- [ ] **Run the five soak flows**, then set `CSP_MODE=enforce`, redeploy, and smoke-test checkout
      with a 3DS card (#50). Elapsed days are _not_ the gate: Report-Only fires only on real page
      loads, so a quiet log proves nothing unless each directive family was actually exercised —
      checkout to the Payment Element, portal playback with the comment thread open, one stem
      upload, a blog post with images, and the marketing pages + login. Then `[csp-report]` in the
      Vercel logs must be empty (extension noise is already filtered server-side, so any surviving
      line is real). After the flip, verify with
      `curl -sSI https://nova-spatial.com | grep -i content-security-policy` — expect no
      `-report-only` and the three Stripe hosts still present. Rollback = clear `CSP_MODE` and
      redeploy. Full matrix and checklist on #50.
- [x] Captcha decision (#51): **no captcha** — ruled 2026-07-31, the 3-per-10-min limit plus
      service-only writes are sufficient for launch. Reopen trigger: sustained abuse rows in
      `contact_inquiries`.
- [ ] Supabase Auth: leaked-password protection enabled (#59) — still showing in the advisors.
- [ ] Sentry: create the project and set `NEXT_PUBLIC_SENTRY_DSN` in Vercel (#59). The code
      ships inert without it; setting it is the whole activation.
- [x] All migrations applied to the production DB via MCP, each with a pre-migration positive
      control and a post-migration probe: `20260730_fence_profile_role`,
      `_harden_comment_inserts`, `_restrict_profile_reads`, `_fence_paid_project_delete`,
      `_harden_contact_inquiries`, `_dedupe_project_files`, `_detach_comments_from_tracks`.
- [x] `get_advisors(security)` on production: no ERROR-level findings. The
      `rls_policy_always_true` warning on `contact_inquiries` is gone; what remains are the
      pre-existing SECURITY DEFINER-callable warnings (the whole `enforce_*` fence family shares
      them) and the leaked-password item above.
- [ ] Privacy policy + refund terms live (#55) — with the 90-day retention disclosure in the
      same deploy.
- [ ] Error reporting receiving events (#59) before opening the funnel. The vendor question is
      settled (Sentry, ruled 2026-07-31) and the code shipped inert; this is the DSN item above
      plus one triggered error confirming events arrive.
- [x] **Auth email templates — recovery verified end-to-end on production 2026-08-01.** The
      earlier worry (a legacy `{{ .ConfirmationURL }}` template landing on
      `…/auth/callback#access_token=…`, an implicit-flow fragment no server route can read, and
      falling through to `/login?error=auth-code-error`) did **not** materialise: both dashboard
      templates already link straight to `/auth/confirm?token_hash={{ .TokenHash }}&type=…`, which
      is what `confirm/page.tsx` expects. Nobody had ever exercised it — `recovery_sent_at` was
      null on all three accounts, which is why it read as unverified rather than broken.
      Live proof: a real reset through `POST /api/auth/reset-password` stamped `recovery_sent_at`
      at 15:22:49Z; after the click-through, `recovery_sent_at` returned to **null** (GoTrue clears
      it when the token is consumed) with `updated_at`/`last_sign_in_at` at 15:26:32Z. Signup was
      already confirmed on the same code path (`POST /api/auth/confirm` → `verifyOtp`).
- [ ] **Auth email cosmetics + sender (#61).** Both templates shipped light-theme text colours
      (`#18181b` headline) with **no** `background-color` while declaring
      `color-scheme: light dark` — so dark-mode clients, which then skip auto-inversion, rendered
      a near-black headline on a dark background. They also used an inline `<svg>` logo (stripped
      by Gmail, unsupported by Outlook) and raw `&` in the href. Corrected copy was handed over
      2026-08-01 and applied to both templates; **re-check how they render in a dark-mode inbox.**
      Still open: **decide built-in SMTP vs Resend** — if the recovery mail arrives from a
      `mail.app.supabase.io` sender, that is both a deliverability risk and a credibility problem
      on a client-facing product. Also still unrun: the checks needing a second device or a
      corporate inbox (SafeLinks retest, cross-device, stale-link UX, resend end-to-end).
- [x] **The one production project row (#62) — ruled "delete", executed 2026-08-01.** The "Test"
      project ($1.13, TEST12, delivered 2026-07-31) deleted via service role in the #48 order:
      row first (9 comments, 6 file rows, 2 attachment rows cascaded), then the 8 storage
      objects (~468 MB) under its prefix. Verified after: 0 projects, 0 child rows, 0 objects —
      production is the two studio profiles and nothing else, and the purge cron has no backlog.
      Sole remaining test artifact: the TEST12 coupon row (single-use, already inactive,
      `redeemed_count` 1) — harmless, delete only if zero artifacts is the goal.

---

## Remaining work (audited 2026-08-01)

A full pass over everything opened, promised or half-done in this plan. Split by who can
actually finish it, because "ready-for-human" has twice hidden work an agent could have taken.

**Agent-doable — code, not rulings:**

- [x] **`/blog` template filler — resolved 2026-08-01.** B2 picked from the #54 pack and shipped
      (db2fc36) to both places it lived: the meta description and the `PageIntro` paragraph a
      visitor actually reads (which also ends the "teams finds" grammar error).
- [x] `src/app/about/page.tsx` "collaborative approach" meta description — A2 picked and shipped
      in the same commit (db2fc36). Meta only; `/about`'s visible copy was already real.
- [x] The studio toasts assert an email that may not have been sent: _"The client has been
      emailed…"_ at `src/components/portal/UploadManager.tsx:373` and `:472`, while status
      notifications are deliberately best-effort (#49, log-and-continue). The portal work
      shipped as 8db57ee **without** this fix, so it landed separately (b7c2093): the standing
      review banner now states only what status derives, and the two transition toasts hedge
      with "a notification email should be on its way".
- [x] #45 — resolution and rationale posted 2026-08-01, ops box verified the same day, issue
      **closed**. The Preview question the tracker framed as a three-part ruling was answered in
      code; the surviving hygiene command came back clean.

**Human-owned — genuinely cannot be done from the repo:**

- [x] **Register the Stripe webhook and set `STRIPE_WEBHOOK_SECRET` (#63)** — done and verified
      2026-08-03 (zero-money signed-delivery proof; see the ops checklist). #55 is again the
      sole hard blocker for taking payments.
- [ ] Run the five CSP soak flows, then flip `CSP_MODE=enforce` (#50).
- [ ] Privacy policy + expanded Terms, carrying the 90-day retention disclosure (#55) — still the
      one hard launch blocker for taking payments.
- [ ] The three remaining #54 copy rulings — the "Trusted by" logo wall, the `/about` stats
      (which move in lockstep with `Testimonials.tsx`), and whether #54 blocks launch. Rulings
      (1) meta copy and (4) Tone Lock were taken and shipped 2026-08-01.
- [ ] Supabase leaked-password protection; Sentry project + DSN (#59).
- [x] The leftover production project row (**#62**) — ruled "delete", executed and verified
      2026-08-01; details in the ops checklist. Production is a clean dataset.
- [ ] **Check the restyled emails in a real dark-mode inbox** (**#61**). The rendered HTML was
      verified for explicit backgrounds, canonical hosts and CTA targets, but no client renders it
      like a browser does. #61 also carries the SMTP-vs-Resend sender ruling and the checks needing
      a second device or a corporate inbox.
- [ ] After this deploy, trigger one real status change and confirm the HTML email arrives and
      looks right — local sends are impossible while the `.env.local` demo kill switches are on
      (#61).

**Formerly in flight, now shipped:** the portal toast / upload-manager work landed as 8db57ee —
but without the toast-wording item it was supposed to carry, which followed separately as
b7c2093 (see above).

---

## Log

- 2026-08-03 — **#63 closed: the webhook is live and the secret proven matching.** The endpoint
  (`we_1U0ENlEHmSecVNzjBbEBAtKu`, apex URL, the three intent events) was created per the runbook,
  the owner set `STRIPE_WEBHOOK_SECRET` (Production) and redeployed. Verified from the repo side
  without money or dashboard access: the bogus-signature probe flipped 500 "Webhook not
  configured" → 400 "Invalid signature"; live `/blog` carries post-0f16eec copy, so the
  groundwork build is what runs; and a cardless $1 PaymentIntent (`pi_3U0NfbEHmSecVNzj16OpfbY1`,
  never confirmed, `amount_received: 0`) was canceled to make Stripe deliver a genuinely signed
  `payment_intent.canceled` — `evt_3U0NfbEHmSecVNzj1LPYUPMx` read back **`pending_webhooks: 0`**,
  which with a single subscribed endpoint means a 2xx ack, which the handler only returns after
  `constructEvent` verifies against the deployed secret. Real-money E2E and dashboard resend
  waived by owner ruling (no dashboard access, no real-money test); the DB claim path is
  suite-covered; reopen trigger = a real payment with no `[stripe webhook] payment claimed` log
  line. Residuals: endpoint api_version `2026-03-25.dahlia` vs SDK pin `2026-05-27.dahlia` —
  harmless, handler reads only `intent.id`/`intent.metadata`, immutable post-creation;
  reconciliation stays #64. Probe left nothing behind: 0 projects / 0 file rows after, the
  canceled PI is the sole Stripe artifact. Evidence pack drafted for #63 (posting hit a local
  permission block; command handed to the owner).
- 2026-08-01 — Three of the waiting rulings answered and executed in one pass. **#54 (1):** B2 on
  `/blog` — meta **and** the visible `PageIntro` — and A2 on `/about` (db2fc36). **#54 (4):**
  Spatial Tone Lock ruled an in-house process, not a filed mark; "proprietary"/"exclusive"
  swapped for "in-house"/"custom"/"specialized" across `HeroContent`, `FAQ`, `Services` and
  `/about` (ba512d2) — PromoPopup's "exclusive welcome discount" stays, it qualifies the offer,
  not the process. **#62:** ruled "delete" — the "Test" project ($1.13, delivered 2026-07-31)
  removed via service role in the #48 order (row first, 9 comments + 6 file rows + 2 attachment
  rows cascading; then the 8 storage objects, ~468 MB), verified to zero rows and zero objects.
  Production now holds only the two studio profiles; the sole test artifact left is the inactive
  single-use TEST12 coupon row. A pre-existing uncommitted blog style tweak (class order + list
  bottom margin) was committed separately (393fe1d) to keep the copy commit clean. Suite 1094
  green, lint clean. Still open on #54: the logo wall, the stats, and the blocks-launch ruling.
- 2026-08-01 — #63 groundwork shipped and the runbook handed over. 0f16eec pins the
  unset-secret 500 branch (previously zero coverage — the exact state production is in), adds a
  `[stripe webhook] payment claimed` info log before the consume so healthy deliveries stop
  being invisible, and documents registration end-to-end (`.env.example` rationale block,
  README → Deploy 3-step runbook, ARCHITECTURE pointer; README's cron count corrected to two).
  Live "before" probe recorded on #63: a bogus-signature POST to production returns 500
  "Webhook not configured" — after the redeploy the same probe must flip to 400 "Invalid
  signature". Full runbook + verification ladder posted to #63; endpoint creation is delegated
  (Jamie creates it and hands over the `whsec_…`), then the secret goes in Production-only and
  the latest deployment is redeployed. Riding along: the toast-wording fix (b7c2093, above) and
  **#64 filed** — the reconciliation-cron open question moved out of #63's tail (Low,
  needs-triage; the sweep would claim paid rows only, leaving the unpaid-holds residual alone).
- 2026-08-01 — #45 closed, and the audit that closed it found a worse one. The last ops box came
  back clean: 10 variables in the Vercel project, `PAYMENTS_DEV_BYPASS` in none of them and
  nothing in the `Shared` tab, so there was never anything to unset. The scopes are worth keeping
  — `SUPABASE_SERVICE_ROLE_KEY` covers Production **and Preview**, `STRIPE_SECRET_KEY` and
  `RESEND_API_KEY` cover All Environments — which turns "preview carries live credentials" from
  an inference into a recorded fact and retroactively justifies `51a44f2`.
- 2026-08-01 — **#63 filed: the Stripe webhook has never existed.** `STRIPE_WEBHOOK_SECRET` is
  absent from every Vercel scope, and the live Stripe account returns 0 from both
  `/v1/webhook_endpoints` and `/v2/core/event_destinations` (checked separately — a Workbench
  event destination does not show up under v1; the restricted key returned empty collections
  rather than 403s, so zero means zero). Not a missing secret on a configured webhook: no webhook
  was ever created, so `api/stripe/webhook/route.ts` is dead code in production. That leaves a 30s
  in-page poll (`NewProjectForm.tsx:112`) as the sole path that claims a payment, with one caller
  and no server-side reconciliation. Close the tab, lose the network, or let a 3DS intent settle
  past 30s and Stripe captures the money while `paid_at` is never stamped, the receipt never
  sends, and the coupon reservation stays held — silently, since `alertMoneyPathAnomaly` only
  fires on metadata _mismatch_, never on a payment nothing looks at. The handler's deliberate
  500-on-consume-failure design exists to recruit Stripe's retry loop as the durability
  mechanism, which means nothing while Stripe is not calling it. Ops-only fix; no code changes.
  Noted alongside: `STRIPE_RESTRICTED_KEY` is deployed to Production and Preview but read nowhere
  in `src/` and absent from `.env.example`.
- 2026-08-01 — Tracker synced to this plan. Four of the six open issues needed nothing (#50, #55,
  #59, #60 already carry their 07-31 state verbatim). #45 got the resolution it was owed: its last
  comment still asked for a three-part Preview ruling that `51a44f2` had already taken in code, so
  the checklist now collapses to one hygiene command and the issue is explicitly no longer a live
  hole. #54 got the correction that its filler is **rendered on `/blog`**, not just in `<head>` —
  which moves the meta-copy item from a search-snippet nicety to the one part of #54 with a
  visitor-visible cost and no ruling attached. Two devplan items had no tracker home at all and
  now do: **#61** (auth mail may still leave from `mail.app.supabase.io`; dark-mode render, Outlook/
  SafeLinks, cross-device and resend checks all unrun) and **#62** (the leftover production project
  row, which is the purge cron's first customer in late October). Checked while there: `/about`'s
  filler is meta-only — its visible `PageIntro` is real copy — so `/blog` is the sole page a
  visitor can read template text on; that correction is now on #54 and above.
- 2026-08-01 — App-sent emails brought onto the auth templates' visual language. Every
  `resend.emails.send()` call was **text-only**, so a client got a designed "Confirm your email"
  and then a plain-text receipt and plain-text status notifications. New shared shell
  `src/lib/email/layout.ts` (`renderEmailHtml`) carries the tokens transcribed from the dashboard
  templates; the receipt, the four status notifications and the contact-form notice all render
  through it. `text` is kept on every send as the multipart alternative and as the fallback if
  anything about the markup goes wrong — the money-path receipt's text builder was deliberately
  left untouched. **The load-bearing part is `escapeHtml`:** project titles, contact-form fields
  and discount codes are user input that was harmless in text/plain and becomes HTML injection
  the moment it lands in markup; every interpolation goes through it, asserted per sender.
  Also fixed a latent bug found while wiring it — `sendProjectStatusEmail` took an `origin`
  argument built from `new URL(request.url).origin`, so a transition driven from a preview deploy
  would mail the client a preview link; it now resolves through `absoluteUrl`, making `SITE_URL`
  the only host source. Suite 1076 → 1093, lint and build green; all six emails rendered and
  checked for explicit backgrounds, canonical hosts and correct CTA targets.
- 2026-08-01 — Recovery (password-reset) flow verified end-to-end on production, closing the
  longest-standing "not provable from the repo" item. It was never broken: both dashboard
  templates already used the token-hash form the app expects, and the reason it read as
  unverified is that **nobody had ever run it** — `recovery_sent_at` was null on all three
  accounts. Evidence: `POST /api/auth/reset-password` against production stamped
  `recovery_sent_at` 15:22:49Z; after click-through it returned to null (GoTrue clears it on
  consumption) with `updated_at`/`last_sign_in_at` 15:26:32Z. Checked first that
  `/auth/confirm?token_hash=…&type=recovery&next=/auth/update-password` renders the right copy
  live and carries all three values into the form's hidden fields, that `/auth/update-password`
  is up, and that the `www` footer host 308s to the apex. Separately, both templates had a real
  rendering defect — light-theme text (`#18181b`) with no `background-color` under a declared
  `color-scheme: light dark`, which suppresses client auto-inversion and hides the headline in a
  dark-mode inbox — plus an inline `<svg>` logo Gmail strips and raw `&` in the href. Corrected
  copy handed over and applied. Remaining: confirm the dark-mode render in a real inbox, and rule
  on built-in SMTP vs Resend for the sender address.
- 2026-07-31 — Audit of the remaining-work list against the tracker, the tree, and production.
  Six issues open (#45, #50, #54, #55, #59, #60) and the human/agent split holds, but four claims
  were more optimistic than the evidence supports; all four are corrected above. The #50 "soak" is
  five flows to run, not days to wait — Report-Only fires only on real page loads. #54 is five
  rulings, not two, and the stat ruling has to move `Testimonials.tsx` in lockstep with `/about`
  or the homepage contradicts the fix. The 90-day retention purge has run daily since 2026-07-26
  with **no client-facing disclosure anywhere**, and it rides with #55 because the `TERMS_VERSION`
  bump can't be split off. And two human items had no home at all: the recovery email template
  (unverifiable from the repo — the GREEN redirect script proves the allowlist, not the template)
  and the leftover production project row. Verified live while checking: `get_advisors(security)`
  still reports `auth_leaked_password_protection`, so #59's toggle is genuinely unflipped, and no
  ERROR-level findings; `projects` = 1 row, paid, delivered today. Deliberately not recorded above
  because it is still in flight: the uncommitted portal toast/upload work.
- 2026-07-31 — #45 preview scope closed in code. `list_branches` on the Supabase project returns
  empty and there is only the one project, so a preview deploy provably writes to the production
  database — the last open path to this issue's failure scenario (born-paid $0 rows, burned
  discount reservations, real "Total: $0.00" receipts, reachable by anyone on an unprotected
  preview URL). Ruling taken: refuse the bypass on **any** Vercel deploy rather than leave it
  contingent on three dashboard settings. `isPaymentsDevBypassEnabled` now gates on
  presence-on-Vercel (`VERCEL`/`VERCEL_ENV`) and, separately, bare `NODE_ENV=production` for
  non-Vercel hosting; local dev and vitest (`NODE_ENV=test`) are unaffected. Deploy smoke tests
  use a Stripe test card, which covers more than the bypass did — it skips Stripe entirely.
  Docs synced (README, CLAUDE.md, `.env.example`, ARCHITECTURE). The remaining ops box is
  hygiene, not exposure, and now covers the Preview scope as well as Production. Verified by
  simulating each env: local/vitest armed; preview, production, bare-prod, and a bare `VERCEL=1`
  (the All-Environments bulk import that opened this issue) all refused. Suite 1067 green
  excluding the in-flight portal tests, 1076 with them; lint and build green. Uncommitted.
- 2026-07-31 — Wrap: #44 and #51 closed; #54/#55 decision packs posted (every remaining ruling
  reduced to a pick-a-letter answer); #60 filed for the nonce/`unsafe-inline` half of #50 that
  was deferred and never tracked; dev-bypass regression guards added (one env reader, and
  `.env.example` can't ship the flag armed). Suite 862 → 1015.
- 2026-07-31 — #59 sweeper + Sentry + cosmetics: orphan sweep on a second daily cron
  (`20260731_add_orphan_sweep_support` — `upload_registered_at` because #57's idempotent
  re-register would otherwise make a live re-upload look stale, plus a service-only anti-join
  RPC for row-less comment attachments); Sentry wired DSN-gated with `alertMoneyPathAnomaly`
  on all four metadata-mismatch branches; footer newsletter form made real (forwards to signup
  with the promo token, matching PromoPopup) instead of a dead control promising a discount;
  `20260731_archive_fence_service_escape` (the one fence missing its null-uid escape) and
  `20260731_blog_assets_no_listing` (anon could enumerate the bucket — probed before and after).
- 2026-07-31 — #50 code half: canonical-origin fallback to Vercel's build-time system vars, so
  `Reporting-Endpoints` is actually emitted in production (it never was — `NEXT_PUBLIC_SITE_URL`
  is unset at build); plus a token-bucket + dedupe throttle on the sink so a flood can't bury
  the soak evidence the flip decision rests on. Soak coverage matrix and flip checklist on #50.
- 2026-07-31 — #51 closed: the limiter interpolated the submitter's email into PostgREST's
  comma-delimited `or=` grammar, and `EMAIL_PATTERN` admits commas — so a crafted address
  split the filter and the per-email bound stopped binding. Two `.eq()` counts instead.
  Captcha ruled out as controls-sufficient.
- 2026-07-31 — #59 grants slice: all six discount RPCs now service_role-only. Live probe
  found the first-mix pair EXECUTE-able by **anon** (default-privilege grants never revoked)
  with identity guards that pass a null uid — an unauthenticated caller could burn or re-arm
  any client's welcome flag. Code first (lookup/reserve/restore moved to the service client
  in `orderDiscount.ts`; checkout/validate/delete call sites threaded; suite 971 green),
  migration `20260731_service_only_discount_rpcs` applied after the deploy drained — the
  reverse order would have 500'd every no-code checkout. Pre/post probe evidence on #59.
- 2026-07-30 — Tracker sync: #50 and #51 relabelled `ready-for-human` (their remaining work is an
  ops flip and a captcha decision, not code); #59 stays `ready-for-agent` for the grants, sweeper
  and cosmetics still in it. Worklog written to `docs/worklogs/2026-07-30-launch-readiness-sweep.md`.
- 2026-07-30 — #59 partial: Stripe idempotency key on intent creation + API version re-pinned to the installed SDK; confirm route gated to the registrant and to the pending→uploaded edge; register 500s stop forwarding raw storage/PG errors; contact address and Resend sender fallback corrected. Remaining items (leaked-password toggle, Sentry/OTel, discount-RPC grants, orphan sweeper, misc config) stay on the issue. Suite 969 green.
- 2026-07-30 — #50: security headers moved into a tested builder (`src/lib/security/csp.ts`, config renamed to `next.config.ts`), `/api/csp-report` sink added (both wire formats, extension noise filtered, query strings stripped), Stripe's `m.stripe.network`/`r.stripe.com`/`m.stripe.com` added — Report-Only had been hiding their absence, so enforcing the old list would have broken checkout. Ships report-only; `CSP_MODE=enforce` is the flip. Suite 962 green.
- 2026-07-30 — #58: `project_comments.track_id` is nullable with `ON DELETE SET NULL`, so purging or deleting a Mix detaches its comments instead of destroying the conversation — which also ends the orphaned attachment objects. Probe: after a mix delete, comment survives with `track_id IS NULL` and its attachment row is intact.
- 2026-07-30 — #57: register step is idempotent per `(project_id, storage_path)` — a re-uploaded mix reuses its row (id survives, comments stay attached) and same-name stems upsert instead of 500ing; MIME allowlist by family + 200-char filename cap; unique index applied (0 duplicates in prod). Suite 927 green.
- 2026-07-30 — #51: contact endpoint hardened — validation seam with length caps and header-safety, per-email/per-IP-hash rate limit (3 / 10 min), guarded JSON parse, studio-owned Subject line, and the anon INSERT policy dropped so inquiries are service-only writes (also clears the advisor's rls_policy_always_true finding). Probe: anon insert denied 42501. Suite 915 green.
- 2026-07-30 — #52/#53: `checkEmail` server action deleted (enumeration oracle + unsolicited login mail); PromoPopup forwards straight to the signup link. Self-referential canonicals on /about, /contact, /terms, /blog with a metadata test. Suite 887 green.
- 2026-07-30 — #56: `safeNextPath` sanitizer wired into the callback, the signup email link, and the login page's `router.push` (the actually-exploitable consumer); callback host now comes from an allowlist (`resolveRedirectOrigin`) instead of a raw `x-forwarded-host`. Suite 887 green.
- 2026-07-30 — #48/#49 handler unit: paid-row delete gated in the handler **and** at the DB floor (`enforce_unpaid_client_deletes` fence), storage sweep moved after the row delete (paths collected before it, since children cascade); status notifications made best-effort like the receipt sender. Probes: client delete of a paid row denied 42501, unpaid client delete and studio paid delete still work. Suite 874 green.
- 2026-07-30 — #44/#46/#47 coordinated RLS unit: `is_studio()` helper + privileged-column fence & grant narrowing on `profiles`, membership predicate on the comment INSERT floor, profiles SELECT restricted to self/studio (anon reads 0). Probes: escalation and injection both denied 42501, anon 0 rows, allowed paths (self read/rename, studio-row read, studio sees all) intact; advisors show no new errors. #46/#47 closed; #44 open on ops.
- 2026-07-30 — #45 tech half: `isPaymentsDevBypassEnabled` seam forces the bypass off in production (Vercel preview left usable — revisited and closed 2026-07-31, see above); `.env.example` default commented out; suite 868 green. Open on ops (Vercel prod env check).
