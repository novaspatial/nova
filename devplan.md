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
2. **Blockers before anything else.** Phase 0 gated the work; it was taken first.
3. **Batch by seam.** The three RLS fixes (#44, #46, #47) rode one coordinated migration
   commit; the handler fixes rode a second; the trailing tiers were independent. (Written as
   "PR" originally — the work landed as direct commits to `main`, one per unit, each with CI
   green before the next started.)
4. **Verify each fix adversarially** — from a non-privileged session, confirm the hole is
   actually closed, not just that the app path behaves.

---

## Phase 0 — Launch blockers (MUST close before go) 🔴

| Issue | Fix | Type | Status |
|---|---|---|---|
| #44 Privilege escalation via `profiles.role` | `BEFORE UPDATE` trigger fence on `profiles` (role + `first_mix_discount` immutable for non-studio/non-service) **and** `REVOKE UPDATE (role, first_mix_discount) ON public.profiles FROM authenticated, anon` | Migration | 🔒 tech half shipped; open on ops |
| #45 `PAYMENTS_DEV_BYPASS` unguarded | Force `devBypass=false` (or hard-fail) when `VERCEL_ENV/NODE_ENV === 'production'`; comment out the `=true` default in `.env.example`; **verify the Vercel production env** | Code + ops | 🔒 tech half shipped; open on ops |

**Shipped (54161d7, 91adecb):**
- `20260730_fence_profile_role.sql` — the `is_studio()` helper plus a `BEFORE UPDATE` fence on
  `role` / `first_mix_discount` / `email`. The planned column `REVOKE` turned out to be a no-op
  (column privileges were never granted separately), so the grant itself was narrowed:
  `REVOKE UPDATE ON profiles` then `GRANT UPDATE (display_name, avatar_url, updated_at)`.
- `isPaymentsDevBypassEnabled` in `src/lib/stripe/devBypass.ts` replaces the raw env read in
  the checkout route; `.env.example` ships the flag commented out.

**Exit gate:**
- [x] Non-studio `PATCH {"role":"studio"}` → denied. Verified twice: the grant layer refuses it
      (`permission denied for table profiles`) and, tested in isolation, the trigger raises `42501`.
- [x] Trigger present; `get_advisors(security)` shows no ERROR-level findings.
- [x] Six unit cases assert `devBypass` is false under production env (Vercel preview still works),
      plus a route-level test that a production env takes the real Stripe path.
- [ ] **Human/ops:** Vercel production env verified (see the ops checklist).

---

## Phase 1 — High severity (before launch) 🟠

| Issue | Fix | Type | Status |
|---|---|---|---|
| #46 Cross-project comment injection | Add owner-or-studio project-membership predicate to `project_comments` INSERT `WITH CHECK` | Migration | ✅ closed 2026-07-30 |
| #47 `profiles` read policy exposes contact fields | Restrict SELECT to self-or-studio for `email`/`role`/`first_mix_discount`; keep `display_name`/`avatar_url` public if needed | Migration | ✅ closed 2026-07-30 |
| #48 Delete of paid/delivered projects | Gate client DELETE to `pending_payment` (studio override); move storage sweep to **after** a successful row delete | Code + migration | ✅ closed 2026-07-30 |
| #49 Status-notification 500s after commit | Wrap `projectNotifications` send in try/catch (log-and-continue) | Code | ✅ closed 2026-07-30 |

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
- 🔒 #50 CSP → report endpoint live, directive list corrected (Stripe frame/telemetry hosts, no `unsafe-eval` in prod), `CSP_MODE` lever added *(shipped 2026-07-30; enforce flip is an ops step after a soak)*.
- ✅ #51 Contact form → rate limit, length caps, email validation, sanitized subject/replyTo, guarded `request.json()`, anon INSERT policy dropped *(shipped 2026-07-30)*; limiter filter-injection fixed and **captcha ruled out** as controls-sufficient *(2026-07-31 — closed)*.
- ✅ #52 Promo email check → the probe was deleted outright (any boolean is an oracle); the popup forwards straight to signup. *(closed 2026-07-30)*
- ✅ #56 `/auth/callback` open redirect → validate `next` starts with a single `/`; stop trusting `x-forwarded-host` unvalidated. *(closed 2026-07-30)*

**SEO / content / legal:**
- ✅ #53 Per-page self-referential canonicals (SEO — important for the marketing push). *(closed 2026-07-30)*
- 🚫 #54 Rewrite `/blog` + `/about` meta copy; legal/marketing review of the "Trusted by" logos and volume stats (**`ready-for-human`** — skipped by the loop, human-owned).
- 🚫 #55 Add a privacy policy; expand Terms (refund/cancellation, revisions, delivery, governing law, legal entity) (**`ready-for-human`, legal ownership** — skipped by the loop; still the one hard launch blocker for taking payments).

**Data integrity:**
- ✅ #57 Mix re-upload dedupe (unique on `(project_id, storage_path)` + row reuse), stem re-upload path, MIME allowlist + filename length cap. *(closed 2026-07-30)*
- ✅ #58 Ruled in favor of the documented behavior: comments detach from a purged Mix instead of cascading; code + docs agree. *(closed 2026-07-30)*

**Exit gate:**
- [x] Contact-form abuse controls in place (rate limit, caps, validation, header-safety,
      service-only writes).
- [x] Canonicals correct per page, with a metadata test guarding the regression.
- [x] #57 / #58 resolved with tests and adversarial DB checks.
- [ ] Enforcing CSP live — the endpoint and the corrected policy shipped; the flip is an ops
      step (#50).
- [ ] Privacy policy published and Terms expanded, with legal sign-off (#55).

---

## Phase 3 — Low / fast-follow ⚪

- 🔒 #59 batch (8 items). **Shipped:** Stripe `idempotencyKey`, re-pinned API version, hardened
  `confirm` route, no more raw error details, contact-address and sender-fallback fixes;
  discount RPC grants service-only (2026-07-31 — the anon hole on the first-mix pair was a
  live exploit; code deployed first, migration `20260731_service_only_discount_rpcs` after
  the drain, probes on #59).
  **Open:** leaked-password protection (dashboard), error reporting + mismatch alert
  (vendor ruled 2026-07-31: **Sentry** — wiring is agent work, DSN provisioning is ops),
  remaining config cosmetics, orphan-row sweeper.

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

## Ops checklist (launch day)

Everything below needs a human — none of it is visible from or fixable in the repo.

- [ ] Vercel production env: `PAYMENTS_DEV_BYPASS` unset/false (#45 — the code now forces it
      off in production regardless, but a clean env is still the ask).
- [ ] Confirm the two existing `role = 'studio'` profiles are intended accounts, and record how
      studio access gets granted from here (#44).
- [ ] Soak `/api/csp-report`, then set `CSP_MODE=enforce` and redeploy; smoke-test checkout with
      a 3DS card afterwards (#50).
- [x] Captcha decision (#51): **no captcha** — ruled 2026-07-31, the 3-per-10-min limit plus
      service-only writes are sufficient for launch. Reopen trigger: sustained abuse rows in
      `contact_inquiries`.
- [ ] Supabase Auth: leaked-password protection enabled (#59) — still showing in the advisors.
- [x] All migrations applied to the production DB via MCP, each with a pre-migration positive
      control and a post-migration probe: `20260730_fence_profile_role`,
      `_harden_comment_inserts`, `_restrict_profile_reads`, `_fence_paid_project_delete`,
      `_harden_contact_inquiries`, `_dedupe_project_files`, `_detach_comments_from_tracks`.
- [x] `get_advisors(security)` on production: no ERROR-level findings. The
      `rls_policy_always_true` warning on `contact_inquiries` is gone; what remains are the
      pre-existing SECURITY DEFINER-callable warnings (the whole `enforce_*` fence family shares
      them) and the leaked-password item above.
- [ ] Privacy policy + refund terms live (#55).
- [ ] Error reporting receiving events (#59) before opening the funnel — needs a vendor choice
      before any code is worth writing.

---

## Log

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
- 2026-07-30 — #45 tech half: `isPaymentsDevBypassEnabled` seam forces the bypass off in production (Vercel preview stays usable); `.env.example` default commented out; suite 868 green. Open on ops (Vercel prod env check).
