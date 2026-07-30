# NovaSpatial — Launch-Readiness Remediation Plan

**Created:** 2026-07-30 · **Status:** all agent-side work shipped — GO pending human ops (#44/#45 checklists, #55 legal, #50 CSP flip) · **Tracker:** GitHub issues #44–#59 · **Refreshed:** 2026-07-30

Derived from the launch-readiness audit (portal + marketing site, first real paying clients).
Original verdict: do not launch until the two blockers close. As of 2026-07-30 every technical
fix is on `main` and applied to production; what remains is human-owned (see the ops checklist). This plan sequences all 16 filed issues
into gated phases. Migrations follow the repo's fence pattern; each RLS change updates the
policy, `src/types/portal.ts`, and tests together, is applied via the Supabase CLI/MCP (not
CI), and is followed by a fresh `get_advisors(security)` run.

---

## Guiding principles

1. **RLS-first.** Every authorization fix lands as a Postgres policy/trigger change first;
   app-layer checks are defense-in-depth, never the only layer.
2. **Blockers before anything else.** Phase 0 gates the launch; nothing ships until it's green.
3. **Batch by seam.** The three RLS fixes (#44, #46, #47) ride one coordinated migration PR;
   handler fixes ride a second; the trailing tiers are independent.
4. **Verify each fix adversarially** — from a non-privileged session, confirm the hole is
   actually closed, not just that the app path behaves.

---

## Phase 0 — Launch blockers (MUST close before go) 🔴

| Issue | Fix | Type | Status |
|---|---|---|---|
| #44 Privilege escalation via `profiles.role` | `BEFORE UPDATE` trigger fence on `profiles` (role + `first_mix_discount` immutable for non-studio/non-service) **and** `REVOKE UPDATE (role, first_mix_discount) ON public.profiles FROM authenticated, anon` | Migration | 🔒 tech half shipped; open on ops |
| #45 `PAYMENTS_DEV_BYPASS` unguarded | Force `devBypass=false` (or hard-fail) when `VERCEL_ENV/NODE_ENV === 'production'`; comment out the `=true` default in `.env.example`; **verify the Vercel production env** | Code + ops | 🔒 tech half shipped; open on ops |

**Work:**
- New migration `20260730_fence_profile_role.sql` (mirror the `enforce_status_write_roles`
  pattern: service `auth.uid() IS NULL` and studio pass; else `raise 42501` on role/flag change).
- Guard in `src/app/api/portal/projects/checkout/route.ts` around line 225; edit `.env.example:29`.
- **Human/ops action:** confirm `PAYMENTS_DEV_BYPASS` is unset/false in Vercel production
  (not visible from the repo).

**Exit gate (all required):**
- From an authenticated non-studio session, `PATCH /rest/v1/profiles {"role":"studio"}` → 42501/403.
- `pg_trigger` shows the new profiles trigger; `get_advisors(security)` clean of new criticals.
- Unit test asserts `devBypass` is false under production env; Vercel prod verified.
- Co-located RLS/route tests added for both.

---

## Phase 1 — High severity (before launch) 🟠

| Issue | Fix | Type | Status |
|---|---|---|---|
| #46 Cross-project comment injection | Add owner-or-studio project-membership predicate to `project_comments` INSERT `WITH CHECK` | Migration | ✅ closed 2026-07-30 |
| #47 `profiles` read policy exposes contact fields | Restrict SELECT to self-or-studio for `email`/`role`/`first_mix_discount`; keep `display_name`/`avatar_url` public if needed | Migration | ✅ closed 2026-07-30 |
| #48 Delete of paid/delivered projects | Gate client DELETE to `pending_payment` (studio override); move storage sweep to **after** a successful row delete | Code + migration | ✅ closed 2026-07-30 |
| #49 Status-notification 500s after commit | Wrap `projectNotifications` send in try/catch (log-and-continue) | Code | ✅ closed 2026-07-30 |

**Batching:** #46 + #47 join #44 in the coordinated RLS migration PR. #48 + #49 are handler
edits in a second PR. Regenerate `src/types/portal.ts` if column exposure changes.

**Exit gate:**
- Direct PostgREST `POST /rest/v1/project_comments` into a foreign `project_id` → denied.
- Anon `select email from profiles` → no rows; owner reads only own row.
- DELETE on a paid project → refused; cleanup-ordering test passes.
- Simulated Resend throw on PATCH/finish-upload → 200 (or logged), not 500.

---

## Phase 2 — Medium severity (target pre-launch; legal items human-owned) 🟡

**Security (`ready-for-agent`):**
- 🔒 #50 CSP → report endpoint live, directive list corrected (Stripe frame/telemetry hosts, no `unsafe-eval` in prod), `CSP_MODE` lever added *(shipped 2026-07-30; enforce flip is an ops step after a soak)*.
- 🔒 #51 Contact form → rate limit, length caps, email validation, sanitized subject/replyTo, guarded `request.json()`, anon INSERT policy dropped *(shipped 2026-07-30; captcha deferred — open on an ops decision)*.
- ✅ #52 Promo email check → the probe was deleted outright (any boolean is an oracle); the popup forwards straight to signup. *(closed 2026-07-30)*
- ✅ #56 `/auth/callback` open redirect → validate `next` starts with a single `/`; stop trusting `x-forwarded-host` unvalidated. *(closed 2026-07-30)*

**SEO / content / legal:**
- ✅ #53 Per-page self-referential canonicals (SEO — important for the marketing push). *(closed 2026-07-30)*
- 🚫 #54 Rewrite `/blog` + `/about` meta copy; legal/marketing review of the "Trusted by" logos and volume stats (**`ready-for-human`** — skipped by the loop, human-owned).
- 🚫 #55 Add a privacy policy; expand Terms (refund/cancellation, revisions, delivery, governing law, legal entity) (**`ready-for-human`, legal ownership** — skipped by the loop; still the one hard launch blocker for taking payments).

**Data integrity:**
- ✅ #57 Mix re-upload dedupe (unique on `(project_id, storage_path)` + row reuse), stem re-upload path, MIME allowlist + filename length cap. *(closed 2026-07-30)*
- ✅ #58 Ruled in favor of the documented behavior: comments detach from a purged Mix instead of cascading; code + docs agree. *(closed 2026-07-30)*

**Exit gate:** enforcing CSP live; contact-form abuse controls in place; canonicals correct
per page; privacy policy published and Terms expanded (legal sign-off); #57/#58 resolved with tests.

---

## Phase 3 — Low / fast-follow ⚪

- 🔒 #59 batch (8 items). **Shipped:** Stripe `idempotencyKey`, re-pinned API version, hardened
  `confirm` route, no more raw error details, contact-address and sender-fallback fixes.
  **Open:** leaked-password protection (dashboard), error reporting + mismatch alert (needs a
  vendor decision), discount RPC grants (touches the money path — its own unit), remaining
  config cosmetics, orphan-row sweeper.

Split any item into its own issue if it grows beyond a cleanup.

---

## Sequencing & dependencies

```
Phase 0 (#44, #45) ──► LAUNCH GATE ◄── Phase 1 (#46, #47, #48, #49)
        │                                        │
        └──► RLS migration PR: #44 + #46 + #47 ──┘   (one coordinated migration)
             Handler PR: #48 + #49

Phase 2 (security #50/#51/#52/#56, SEO #53, legal #54/#55, data #57/#58) — parallelizable
Phase 3 (#59) — after launch
```

- The launch gate = Phase 0 **and** Phase 1 green, plus the legal minimum from #55 (privacy
  policy + refund terms) if taking real payments at launch.
- Phase 2 security + SEO items should also land pre-launch where feasible; they don't hard-block
  but materially affect a public marketing launch.

---

## Verification (each phase)

1. **Adversarial DB check** for every RLS/authz fix — exploit the hole from a non-privileged
   session and confirm it's closed (not just the app path).
2. `npx vitest run` (add co-located tests per fix) and `npm run build` (the only type-check in CI).
3. `get_advisors(security)` after every DDL change; keep it clean.
4. Manual smoke of the affected flow (checkout, upload, listen, delete) on a preview deploy.

## Ops checklist (launch day)

Everything below needs a human — none of it is visible from or fixable in the repo.

- [ ] Vercel production env: `PAYMENTS_DEV_BYPASS` unset/false (#45 — the code now forces it
      off in production regardless, but a clean env is still the ask).
- [ ] Confirm the two existing `role = 'studio'` profiles are intended accounts, and record how
      studio access gets granted from here (#44).
- [ ] Soak `/api/csp-report`, then set `CSP_MODE=enforce` and redeploy; smoke-test checkout with
      a 3DS card afterwards (#50).
- [ ] Decide whether the contact form needs a captcha on top of the shipped rate limit (#51).
- [ ] Supabase Auth: leaked-password protection enabled (#59).
- [ ] All Phase 0 + Phase 1 migrations applied to production DB (manual, via CLI/MCP).
- [ ] `get_advisors(security)` clean on production.
- [ ] Privacy policy + refund terms live (#55).
- [ ] Error reporting receiving events (#59) before opening the funnel.

---

## Log

- 2026-07-30 — #59 partial: Stripe idempotency key on intent creation + API version re-pinned to the installed SDK; confirm route gated to the registrant and to the pending→uploaded edge; register 500s stop forwarding raw storage/PG errors; contact address and Resend sender fallback corrected. Remaining items (leaked-password toggle, Sentry/OTel, discount-RPC grants, orphan sweeper, misc config) stay on the issue. Suite 969 green.
- 2026-07-30 — #50: security headers moved into a tested builder (`src/lib/security/csp.ts`, config renamed to `next.config.ts`), `/api/csp-report` sink added (both wire formats, extension noise filtered, query strings stripped), Stripe's `m.stripe.network`/`r.stripe.com`/`m.stripe.com` added — Report-Only had been hiding their absence, so enforcing the old list would have broken checkout. Ships report-only; `CSP_MODE=enforce` is the flip. Suite 962 green.
- 2026-07-30 — #58: `project_comments.track_id` is nullable with `ON DELETE SET NULL`, so purging or deleting a Mix detaches its comments instead of destroying the conversation — which also ends the orphaned attachment objects. Probe: after a mix delete, comment survives with `track_id IS NULL` and its attachment row is intact.
- 2026-07-30 — #57: register step is idempotent per `(project_id, storage_path)` — a re-uploaded mix reuses its row (id survives, comments stay attached) and same-name stems upsert instead of 500ing; MIME allowlist by family + 200-char filename cap; unique index applied (0 duplicates in prod). Suite 927 green.
- 2026-07-30 — #51: contact endpoint hardened — validation seam with length caps and header-safety, per-email/per-IP-hash rate limit (3 / 10 min), guarded JSON parse, studio-owned Subject line, and the anon INSERT policy dropped so inquiries are service-only writes (also clears the advisor's rls_policy_always_true finding). Probe: anon insert denied 42501. Suite 915 green.
- 2026-07-30 — #52/#53: `checkEmail` server action deleted (enumeration oracle + unsolicited login mail); PromoPopup forwards straight to the signup link. Self-referential canonicals on /about, /contact, /terms, /blog with a metadata test. Suite 887 green.
- 2026-07-30 — #56: `safeNextPath` sanitizer wired into the callback, the signup email link, and the login page's `router.push` (the actually-exploitable consumer); callback host now comes from an allowlist (`resolveRedirectOrigin`) instead of a raw `x-forwarded-host`. Suite 887 green.
- 2026-07-30 — #48/#49 handler unit: paid-row delete gated in the handler **and** at the DB floor (`enforce_unpaid_client_deletes` fence), storage sweep moved after the row delete (paths collected before it, since children cascade); status notifications made best-effort like the receipt sender. Probes: client delete of a paid row denied 42501, unpaid client delete and studio paid delete still work. Suite 874 green.
- 2026-07-30 — #44/#46/#47 coordinated RLS unit: `is_studio()` helper + privileged-column fence & grant narrowing on `profiles`, membership predicate on the comment INSERT floor, profiles SELECT restricted to self/studio (anon reads 0). Probes: escalation and injection both denied 42501, anon 0 rows, allowed paths (self read/rename, studio-row read, studio sees all) intact; advisors show no new errors. #46/#47 closed; #44 open on ops.
- 2026-07-30 — #45 tech half: `isPaymentsDevBypassEnabled` seam forces the bypass off in production (Vercel preview stays usable); `.env.example` default commented out; suite 868 green. Open on ops (Vercel prod env check).
