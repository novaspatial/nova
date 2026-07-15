# DevPlan — Goal & Remaining Path

**Rewritten 2026-07-04** for agent consumption. Provenance: `devplan.docx` (Web Designer Meeting, 2026-06-09) was sliced into issues via `/to-issues`; gap-audited line-by-line against the docx on 2026-07-04 (added #31/#32/#33); extended the same day with six architecture refactors (#34–#39) from an `/improve-codebase-architecture` review. Status refreshed late 2026-07-04: **#23 (T&C) and #34 (lifecycle guards) shipped and closed**; #34's exploration surfaced two payment-write hardening bugs, filed as **#40/#41**. Refreshed again 2026-07-08: **#40/#41 shipped and closed** (`20260708` INSERT fence + shared service-side claim seam); they surfaced two narrower residuals, filed as **#42/#43**. Refreshed 2026-07-14: no new code since the 2026-07-13 sweep (#9/#31/#38/#25); with every commerce decision answered, **#26 and #30 are promoted from the gated commerce chain into the Now queue** (only #24 stays gated, on D13's sender). Same day, a history rewrite on `main` replaced every commit after `964242b` — commit citations below are remapped to the post-rewrite hashes (this also cleared nine citations orphaned by an earlier rewrite). Refreshed 2026-07-15: a second answer package (Jamie, 2026-07-14 — recorded in #1) resolves rush availability, D13's sender, D-revisions, D7, and D-refund — **#24 joins the Now queue and #19 flips to `ready-for-agent` in place**; **#32 closed 2026-07-14** (the guide lives in-portal — `UploadPrep`; no public page). Still open: D7b (the only #27 gate), D12, and #29's studio `sameAs` URLs. The previous revision of this file (Turkish, with full Phase 0–3 history) is in git history.

> Issues live in [novaspatial/nova](https://github.com/novaspatial/nova/issues) via `gh` (see `docs/agents/issue-tracker.md`).
> Open-decision umbrella: [#1](https://github.com/novaspatial/nova/issues/1) (`needs-info`).

---

## Goal

A Client can go from an interactive homepage price quote to a **paid, taxed, T&C-consented order** — with discount codes redeemed against the catalog, an order-confirmation email, and marketing copy that matches what checkout actually charges. After delivery, files purge on schedule. The blog/SEO surface (per-post SEO ✅, IndexNow, GEO) is live in production. The architecture lane keeps the seams deep so each slice lands small and tested.

**Done =** the 14 open work issues below closed (or consciously moved to *Deliberately not built*) and the open decisions in #1 answered.

## How an agent picks work

1. Work the **Now queue** top-down. Nothing there waits on an unanswered decision; the one `ready-for-human` row (#33) names the ops input it still needs in its Notes cell.
2. When a **gate opens** (a decision lands in #1, or an upstream issue closes), the gated chain **preempts** the Now queue.
3. Read the issue itself for the full spec; this file only carries ordering, gates, and the why.
4. Before commerce/lifecycle work, honor **Decided constraints** below — do not re-litigate them.

**Label key:** `ready-for-agent` = fully specified, take it AFK · `ready-for-human` = an input/decision is needed first (see the gate column) · `needs-info` = waiting on Mike/Jamie · `needs-triage` + `architecture` = the four remaining review refactors (#34 shipped 2026-07-04, #38 2026-07-13), sequenced here but awaiting Onur's triage confirmation · `needs-triage` + `bug` = #42/#43, the insert-fence residuals from the #40/#41 hardening (shipped 2026-07-08), same gate · `bug` = live defect.

---

## Where we are (2026-07-15)

**Live and shipped:** priced per-song USD checkout (S1/S2 — `computeOrderPrice`, Stripe PaymentIntent, bulk tiers, $225/song floor) now **charging GST/HST** (S21, `20260713`), **discount-code redemption at checkout** (S4b — the 15% welcome code per D11 on top of the S3 catalog + Studio CRUD, orchestrated through the #38 `orderDiscount` seam; consumption still open in #26), **T&C page + recorded checkout consent** (S7, `20260704`), **lifecycle transition guards** (#34 — `canTransition` seam in `workflow.ts` + `20260705` DB status fence), **payment-write hardening** (#40/#41 — `20260708` INSERT fence + shared `claimProjectPayment` seam; the poll fallback confirms paid orders again), full blog/SEO stack (sitemap, robots, per-post meta + JSON-LD, share images, IndexNow *code*), portal hardening (archive RLS trigger, storage-cleanup module, order-write freeze triggers), a11y/motion pass. Compact list in **Completed** below.

**Decision package answered (2026-07-13, Mike — recorded in #1):** D2 complete (full HST in HST provinces + computed-in-module mechanism), D5 (returning = prior paid), D6 (consume on payment success), D-floor-private (per-code override flag), D11 (welcome = 15%). Every commerce gate is open; **#38 (order-discount seam) and #25 (code redemption at checkout) both shipped 2026-07-13** (`0764def`, `5c83862`), so **#26 then #30 now head the Now queue** — the one decision then still touching the path (D13, #24's sender) was resolved the next day, below. **Until #26 lands consumption, do not distribute single-use or usage-limited codes** — they redeem but nothing stops re-use.

**Second answer package (2026-07-14, Jamie — recorded in #1):** rush = always accepted, studio contacts/refunds manually (no admin toggle); #24's sender = the existing `noreply@nova-spatial.com` Resend sender (D13 no longer gates code); D-revisions = manual, no in-portal tracking, post-order extras invoiced manually; D7 = Vercel Cron at 90 days, purging **stems and deliverables** (engineers keep local copies); D-refund = manual via the Stripe dashboard. **#24 joined the Now queue and #19 flipped to `ready-for-agent` in place** — nothing in commerce is gated anymore. Separately, **#32 closed 2026-07-14**: the stem-prep guide lives in-portal (`UploadPrep` on the client dashboard); no public page, and the live T&C keeps omitting the link. Still open: **D7b** (hard-delete vs tombstone for the project record — the only #27 gate, follow-up asked), **D12**, and the **studio** `sameAs` URLs for #29 (Jamie's author URL received: `jamiekuse.com`).

**Launch-debt cleared 2026-07-13** (had been charging real money without it since 2026-07-02): checkout now computes and charges **GST/HST** per D2 ([#31](https://github.com/novaspatial/nova/issues/31), `20260713` migration + billing country/province on the order form), and the marketing copy matches the charged **15% welcome offer** from one shared constant ([#9](https://github.com/novaspatial/nova/issues/9)).

The payment-write hardening pair (#40 INSERT forgery, #41 dead poll fallback) **shipped 2026-07-08** — `20260708` insert fence + a shared service-side claim seam; see Completed. Two narrower residuals it surfaced were filed as [#42](https://github.com/novaspatial/nova/issues/42) (delete-then-reattach DB floor) and [#43](https://github.com/novaspatial/nova/issues/43) (direct-insert rate/consent bypass).

Also inert in production: IndexNow ([#33](https://github.com/novaspatial/nova/issues/33) — `INDEXNOW_KEY` unset, live key URL 404s, apex→www redirect contradicts D10).

## Decided constraints (do not re-litigate; history in #1)

- **D1** — Order data lives on the `projects` row (1 order = 1 Project). Stripe Elements/PaymentIntent flow stays.
- **D3** — List prices in **USD**; the $225 floor is per-song in the charge currency.
- **D4** — $325/song list · bulk 15/20/25% (3–4 / 5–7 / 8+ songs) · one code max, private suppresses bulk · 35% cap on the percent stack only · fixed codes bounded by floor only · add-ons after discount, outside cap/floor · integer cents, half-up. Single source: `src/lib/stripe/pricing.ts`.
- **D2** — Canadian Clients pay **GST/HST at the full provincial rate**: ON 13% · NS 14% (cut 2025-04-01) · NB/NL/PE 15% · all other provinces/territories 5% GST; no PST/QST. Non-Canadian buyers zero-rated. Mechanism: computed in `src/lib/stripe/pricing.ts` from a billing country + province select on the order form (not Stripe Tax); `tax_cents` + buyer location persisted on the order row. (2026-07-13)
- **D5** — "Returning client" = any prior **paid** Project (`paid_at` set); delivery not required. (#25's eligibility helper)
- **D6** — Single-use codes are **consumed on confirmed payment** (webhook finalize). Reserve-at-checkout + restore-on-abandon stays as the concurrency mechanism — a hold, not consumption. (#26)
- **D-floor-private** — Private codes may price **below the $225/song floor** via an explicit per-code override flag set at creation. The floor remains the default everywhere else. (#26 shape: `discount_codes` column + `computeOrderPrice`)
- **D11** — Welcome discount = **15%** (replaces the 50% launch promo). Copy + charged constant now (#9); code-based enforcement with #25.
- **D13 (sender)** — #24 ships from the existing `noreply@nova-spatial.com` Resend sender; the inbox-provider/subdomain purchase stays a non-repo ops item, and swapping later is config-only. (2026-07-14)
- **Rush availability** — Rush is always purchasable at checkout; if the studio can't meet the 48h window they contact the client / refund the rush fee manually. No admin toggle, no availability gate. T&C's "subject to availability" is the backstop. (#19; 2026-07-14)
- **D-revisions** — No in-portal tracking of included rounds (studio handles manually, engineer discretion). Post-order extra revisions are **invoiced manually**, not purchasable in-portal. #19 ships order-time add-ons only. (2026-07-14)
- **D7** — Purge runs as a **Vercel Cron** job 90 days after delivery and removes **stems and deliverables both** (engineers retain local copies). The record question is D7b — still open. (#27; 2026-07-14)
- **D-refund** — Manual via the Stripe dashboard; nothing built in-portal. Revisit only if volume demands. (2026-07-14)
- **D8/D9/D10** — OG image = first inline image (fallback `/og-image.jpg`); share images via `next/og` Node runtime; canonical origin is the **apex** `https://nova-spatial.com` (the live apex→www 307 contradicts this — reconcile inside #33).
- **ADRs 0001–0004** — native Supabase audio, RLS-first authorization, signed-URL direct uploads, Stripe gating + atomic first-mix RPC. Settled architecture; the refactor lane works *within* them.

## Open decisions (all tracked in #1)

| Decision | Question | Gates |
| --- | --- | --- |
| **D7b** | Purge record handling: hard-delete the project row vs keep a tombstone (metadata stays, audio goes)? Files-purge infra + scope decided 2026-07-14 (D7). | #27 |
| **D12** | Nova Studios architecture | all of Part B |

> Open **info** (not a decision): the **studio's** official profile URLs for #29's `Organization` `sameAs` — Jamie's author URL is in (`jamiekuse.com`, not on socials). The inbox-provider/subdomain purchase (rest of D13) is pure ops, no repo artifact.

---

## The path

### Now queue (unblocked — work top-down)

| # | Issue | What / why now | Notes |
| --- | --- | --- | --- |
| 1 | [#26](https://github.com/novaspatial/nova/issues/26) **S5** | **Single-use code consumption** (atomic reserve/restore + webhook finalize). Head of the critical path — closes the two residuals #25 documented (single-use/usage-limit re-use; the concurrent-WELCOME D5 race). All gates answered: D6 (consume on confirmed payment), D-floor-private (per-code override column). | Copy the hardened first-mix reserve/restore RPC pattern; #25 left the hold point, restore key, and intent-metadata code ready in the #38 seam. **Coordinate webhook edits with #24** (both touch `src/app/api/stripe/webhook/route.ts`) — land #26 first or merge-coordinate. `ready-for-agent`. |
| 2 | [#30](https://github.com/novaspatial/nova/issues/30) **S20** | **Homepage price calculator** — interactive quote replacing the static CTA, doubles as the start of the new-project flow. D11 answered (15%); welcome preview reads the shipped shared constant. | Shares the S1 quote component / `computeOrderPrice` — no forked math; pass `buyer` for the tax line. Needs a number-stepper primitive. Sequenced after #26 so consumption is enforced before the calculator drives code-bearing traffic to checkout. `ready-for-agent`. |
| 3 | [#24](https://github.com/novaspatial/nova/issues/24) **S8** | **Order-confirmation email** on paid order. D13's sender answered 2026-07-14: launch from the existing `noreply@nova-spatial.com` Resend sender (subdomain swap later is config-only). Tax + coupon lines ready (`tax_cents`, `applied_coupon_code` persisted). | Reads `NOTIFIABLE_STATUSES` from the #34 seam; siteConfig origin for portal links. **Shares `src/app/api/stripe/webhook/route.ts` with #26** — land after #26 or merge-coordinate. `ready-for-agent`. |
| 4 | [#19](https://github.com/novaspatial/nova/issues/19) **S6** | **Add-ons** (extra revision, 48h rush). Math is shipped and tested (`ADD_ON_CENTS`); wire form checkboxes → checkout `addOns` → `add_ons` column → PaymentStep line. | Rush decided 2026-07-14: always accepted, studio contacts/refunds manually — no availability gate to build. Post-order revision purchase is out (manual invoice per D-revisions). `ready-for-agent`. |
| 5 | [#33](https://github.com/novaspatial/nova/issues/33) **S23** | **Activate IndexNow in prod**: set `INDEXNOW_KEY`, verify live key + accepted ping, and **reconcile the apex→www redirect with D10**. | Pure ops + verification; no code gaps. `ready-for-human` — needs prod env access (`INDEXNOW_KEY`, DNS/redirect). |
| 6 | [#35](https://github.com/novaspatial/nova/issues/35) + [#37](https://github.com/novaspatial/nova/issues/37) **arch** | **Storage seam** (buckets/paths/signed-URL choreography, one upload-runner hook, server-side size/MIME) + **`requireProjectChild`** authz helper. Natural pair — the download handlers consume both. | Do before #27 (purge sweeps buckets) and #13 (admin download consumes `signedDownload`). Strengths: Strong / Worth exploring. |
| 7 | [#36](https://github.com/novaspatial/nova/issues/36) **arch** | **Extract `useCommentClock`** — first meaningful test coverage for the Listen step. | Independent; fill capacity between gated slices. Strength: Strong. |
| 8 | [#42](https://github.com/novaspatial/nova/issues/42) + [#43](https://github.com/novaspatial/nova/issues/43) **bug** | **Insert-fence residuals** from the #40/#41 work. #42: delete-then-reattach of a freed Stripe intent id (needs a DB-level floor — intent tombstone or service-mediated Stripe insert). #43: direct PostgREST `pending_payment` inserts skip the route's rate limit + consent gate. | Narrow, non-payment-integrity; `needs-triage`. Take with the arch lane. |

### Gated chains (fire when the gate opens; they preempt the Now queue)

**Commerce chain: empty.** Every gate is answered (the 2026-07-13 decisions; the 2026-07-14 rulings on the sender, rush availability, and revisions) — #26, #30, #24, and #19 all sit in the Now queue above.

**Lifecycle queue:** D7b ─> [#27](https://github.com/novaspatial/nova/issues/27) **S18** delivery anchor + 90-day purge (D7 answered 2026-07-14: Vercel Cron, purge covers stems + deliverables; only the record question — hard-delete vs tombstone — remains. Reuses `projectCleanup` + #35's storage seam; stamps `delivered_at` at the PATCH transition point the shipped #34 seam made explicit). Independent of decisions: [#13](https://github.com/novaspatial/nova/issues/13) **S17** admin file download (after #35, trivially; the issue says "can start immediately" — its `ready-for-human` label is stale, a `ready-for-agent` candidate once #35 lands).

**Content/SEO queue:** [#29](https://github.com/novaspatial/nova/issues/29) **S19** GEO/LLM visibility (author `sameAs` received 2026-07-14 — `jamiekuse.com`, not on socials; **studio** URLs still outstanding; **bundle [#39](https://github.com/novaspatial/nova/issues/39) blog facade into this slice** — it touches the same metadata/JSON-LD modules). (#32 Stem Prep Guide closed 2026-07-14 — see Completed.)

**Not started until D12:** Nova Studios (Part B) — separate `/to-issues` round when the architecture decision lands.

### Critical path

```text
#26 ─> #30                                            ← head; consumption must land before the calculator drives traffic
#26 ─> #24                                            ← receipt, fully unblocked (sender = existing noreply per 2026-07-14; shared webhook file)
```

(#23, the former no-gate top of this path, shipped 2026-07-04; #40/#41 shipped 2026-07-08; #9/#31/#38/#25 shipped 2026-07-13.) Everything else (#42/#43, #19, #33, #13, #27, #29, arch lane) is parallel-safe. **No decision touches the path anymore** — #26 is the head; after it, #30 markets the offer safely and #24 ships the receipt from the existing sender.

---

## Architecture lane (review of 2026-07-04)

Six refactors from `/improve-codebase-architecture` (report vocabulary: seam/depth/locality). #34 shipped 2026-07-04 (`aa5b70f`) and #38 shipped 2026-07-13 (`0764def`); the remaining four are labeled `architecture` + `needs-triage`, sequenced above, summarized here:

| Issue | Strength | One-liner | Slot |
| --- | --- | --- | --- |
| [#34](https://github.com/novaspatial/nova/issues/34) ✅ | Strong (`bug`) | Transition + gating guards in `workflow.ts` + `20260705` DB status fence | **Shipped** (`aa5b70f`) |
| [#35](https://github.com/novaspatial/nova/issues/35) | Strong | One storage seam: buckets, path templates, signed-URL choreography, size/MIME | Before #27/#13 |
| [#36](https://github.com/novaspatial/nova/issues/36) | Strong | `useCommentClock` extraction; Listen step becomes testable | Anytime |
| [#37](https://github.com/novaspatial/nova/issues/37) | Worth exploring | `requireProjectChild` — one project-child authz helper | With #35 |
| [#38](https://github.com/novaspatial/nova/issues/38) ✅ | Worth exploring | `orderDiscount` seam: reservation handle + single code source for quote + charge | **Shipped** (`0764def`) |
| [#39](https://github.com/novaspatial/nova/issues/39) | Speculative | Blog facade returning a hydrated post | Inside #29 |

---

## Completed (compact — details in worklogs + git history)

| Slice | Issue | Outcome |
| --- | --- | --- |
| P1 | #4 | `Project` type synced with payment + order fields; `DiscountCode`/`PriceBreakdown` types |
| P2 + S4a | #5, #22 | Pure `computeOrderPrice` module, exec-approved, 44-test suite (`01c1601`, `ecb1395`) |
| P3 | #6 | `src/lib/site.ts` single origin (D10) + `onPostMutated` publish hook (`d626bc5`) |
| P4 | #2 | Checkbox primitive + Footer Legal seam (`de811ff`) — #23 is now thin wiring |
| P5 | #3 | `projectCleanup.ts` storage sweep; #27 reuses |
| S1 + S2 | #16, #18 | Per-song USD checkout end-to-end: order form, live quote, PaymentStep breakdown, `20260702` migrations incl. order-write freeze + RPC guards (`75239b6`…) |
| S3 | #17 | `discount_codes` table + studio-only RLS + admin CRUD (`1c486ec`); client-inert until #25 |
| S9/S9b | #7, #8 | Motion/reduced-motion pass (`c612c93`); contrast + hero credits (`6d36e6c`) |
| S11/S11b | #10, #11 | Blog readability (`1729e38`); structural fixes, hero extraction (`711ebbd`) |
| S12/S13 | #20, #21 | Per-post SEO meta + JSON-LD (`1734e4f`); `next/og` share image (`9d96206`) |
| S14/S15 | #14, #15 | Sitemap + robots (`2b653b9`); IndexNow code, env-gated (`2b4038d`) → activation is #33 |
| S16 | #12 | Archive RLS hardening — DB trigger enforces studio-only `archived_at` (`20260625`) |
| S7 | #23 | T&C page + required checkout consent, recorded as `terms_accepted_at/version` (`b437c99`, `20260704`) |
| arch | #34 | Lifecycle guards: `canTransition`/upload gates/`NOTIFIABLE_STATUSES` in `workflow.ts`, CAS route writes, `20260705` status fence (`aa5b70f`); spawned #40/#41 |
| bug | #40, #41 | Payment-write hardening: `20260708` BEFORE INSERT fence (client rows born unpaid/pending), dev-bypass + poll claims moved to the service client, shared `claimProjectPayment` seam revives the poll fallback; verified on the remote. Spawned #42/#43 |
| S10 | #9 | 15% welcome offer from one shared constant (`WELCOME_DISCOUNT_PCT`); promo token now value-agnostic `welcome`; PaymentStep rebranded to "Welcome discount" (`bd9125b`) |
| S21 | #31 | Computed GST/HST at checkout: `CA_TAX_RATES` in the pricing module, billing country/province on the order form, `tax_cents` + buyer location persisted + frozen (`20260713`), tax line on quote/PaymentStep, intent metadata reconciliation (`b9a6be0`) |
| arch | #38 | Order-discount seam (`src/lib/portal/orderDiscount.ts`): `reserveOrderDiscount` reservation handle with one `release()` replacing 4 restore copies, row-based `restoreUnpaidOrderDiscount` for cleanup, `FIRST_MIX_CODE` exported client-safe; #25/#26 plug in here (`0764def`) |
| S4b | #25 | Code redemption at checkout: order-form code field + live discounted quote (validate endpoint), server-side re-validation in the #38 seam (`lookup_discount_code` RPC, D5 eligibility via `hasPriorPaidProject`), `applied_coupon_code` persisted + frozen (`20260713`), welcome offer code-based per D11 (the welcome code from the shared constant, flag path = no-code fallback); consumption deferred to #26 (`5c83862`) |
| S22 | #32 | Stem Prep Guide — resolved in-portal: the `UploadPrep` collapsible guide on the client dashboard (`da43cb3`); no public page, and the live T&C deliberately omits the guide link (`terms/page.tsx` guard — adding it later bumps `TERMS_VERSION`). Closed 2026-07-14 |

## Definition of Done (every issue)

- **RLS-first:** any schema change updates the Postgres RLS policy **and** `src/types/portal.ts` together (CLAUDE.md rule; ADR-0002).
- **Tests co-located** as `*.test.ts(x)`; `npm run lint` + `npx vitest run` clean.
- **Migrations** named `YYYYMMDD_description.sql`; applied via Supabase CLI/MCP, never by CI.
- **Client choice:** server client for user-tied work (RLS applies); service-role only in sessionless contexts (webhook).
- **Never log money amounts; never use a personal email** (`noreply@nova-spatial.com`).

## Full issue index

| id | issue | label | title |
| --- | --- | --- | --- |
| — | [#1](https://github.com/novaspatial/nova/issues/1) | needs-info | Open decisions (D1–D13 + D-floor-private, D-revisions, D-refund) |
| S6 | [#19](https://github.com/novaspatial/nova/issues/19) | ready-for-agent | Add-ons: extra revision + 48h rush |
| S8 | [#24](https://github.com/novaspatial/nova/issues/24) | ready-for-agent | Order-confirmation email |
| S5 | [#26](https://github.com/novaspatial/nova/issues/26) | ready-for-agent | Single-use private code consumption |
| S17 | [#13](https://github.com/novaspatial/nova/issues/13) | ready-for-human | Admin file download |
| S18 | [#27](https://github.com/novaspatial/nova/issues/27) | ready-for-human | delivered_at + 90-day purge |
| S19 | [#29](https://github.com/novaspatial/nova/issues/29) | ready-for-human | LLM/AI-search visibility (GEO) |
| S20 | [#30](https://github.com/novaspatial/nova/issues/30) | ready-for-agent | Homepage price calculator |
| S23 | [#33](https://github.com/novaspatial/nova/issues/33) | ready-for-human | IndexNow production activation |
| arch | [#35](https://github.com/novaspatial/nova/issues/35) | needs-triage, architecture | One storage seam (buckets/paths/signed URLs) |
| arch | [#36](https://github.com/novaspatial/nova/issues/36) | needs-triage, architecture | Extract `useCommentClock` |
| arch | [#37](https://github.com/novaspatial/nova/issues/37) | needs-triage, architecture | `requireProjectChild` authz helper |
| arch | [#39](https://github.com/novaspatial/nova/issues/39) | needs-triage, architecture | Blog facade (hydrated post) |
| bug | [#42](https://github.com/novaspatial/nova/issues/42) | needs-triage, bug | Delete-then-reattach of a freed Stripe intent id (DB floor) |
| bug | [#43](https://github.com/novaspatial/nova/issues/43) | needs-triage, bug | Direct PostgREST inserts bypass the checkout rate limit + consent gate |

Closed: #2–#12, #14–#18, #20–#23, #25, #31, #32, #34, #38, #40, #41 (see Completed; #28 is a merged PR, not an issue).

## Deliberately not built

- **T&C text** — Jamie writes it (#23 ships page + checkbox + record only).
- **DNS / SPF / DKIM / DMARC, inbox purchase** — pure ops, no repo artifact.
- **Nova Studios port** — blocked on D12 (content, brand, redirects).
- **Refund flow** — decided manual via the Stripe dashboard (D-refund, 2026-07-14); revisit only if volume demands.
- **Revision-round tracking + post-order revision purchase** — manual per D-revisions (2026-07-14): engineer discretion, T&C is the backstop, extras invoiced manually.
- **Rush availability gate** — none; rush is always purchasable, studio contacts/refunds manually (2026-07-14).
- **Part C logistics** (prioritization, calendar) — project management, not code.

---

*Produced from the `devplan-to-slices` workflow output (8-subsystem map → draft → adversarial critique → revision); rewritten 2026-07-04 to fold in the gap audit and the architecture review.*
