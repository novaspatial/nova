# DevPlan — Goal & Remaining Path

**Rewritten 2026-07-04** for agent consumption. Provenance: `devplan.docx` (Web Designer Meeting, 2026-06-09) was sliced into issues via `/to-issues`; gap-audited line-by-line against the docx on 2026-07-04 (added #31/#32/#33); extended the same day with six architecture refactors (#34–#39) from an `/improve-codebase-architecture` review. Status refreshed late 2026-07-04: **#23 (T&C) and #34 (lifecycle guards) shipped and closed**; #34's exploration surfaced two payment-write hardening bugs, filed as **#40/#41**. Refreshed again 2026-07-08: **#40/#41 shipped and closed** (`20260708` INSERT fence + shared service-side claim seam); they surfaced two narrower residuals, filed as **#42/#43**. The previous revision of this file (Turkish, with full Phase 0–3 history) is in git history.

> Issues live in [novaspatial/nova](https://github.com/novaspatial/nova/issues) via `gh` (see `docs/agents/issue-tracker.md`).
> Open-decision umbrella: [#1](https://github.com/novaspatial/nova/issues/1) (`needs-info`).

---

## Goal

A Client can go from an interactive homepage price quote to a **paid, taxed, T&C-consented order** — with discount codes redeemed against the catalog, an order-confirmation email, and marketing copy that matches what checkout actually charges. After delivery, files purge on schedule. The blog/SEO surface (per-post SEO ✅, IndexNow, GEO) is live in production. The architecture lane keeps the seams deep so each slice lands small and tested.

**Done =** the 19 open work issues below closed (or consciously moved to *Deliberately not built*) and the open decisions in #1 answered.

## How an agent picks work

1. Work the **Now queue** top-down. Every item there is unblocked — no decision, no missing input.
2. When a **gate opens** (a decision lands in #1, or an upstream issue closes), the gated chain **preempts** the Now queue.
3. Read the issue itself for the full spec; this file only carries ordering, gates, and the why.
4. Before commerce/lifecycle work, honor **Decided constraints** below — do not re-litigate them.

**Label key:** `ready-for-agent` = fully specified, take it AFK · `ready-for-human` = an input/decision is needed first (see the gate column) · `needs-info` = waiting on Mike/Jamie · `needs-triage` + `architecture` = the five remaining review refactors (#34 was triaged and shipped 2026-07-04), sequenced here but awaiting Onur's triage confirmation · `needs-triage` + `bug` = #42/#43, the insert-fence residuals from the #40/#41 hardening (shipped 2026-07-08), same gate · `bug` = live defect.

---

## Where we are (2026-07-08)

**Live and shipped:** priced per-song USD checkout (S1/S2 — `computeOrderPrice`, Stripe PaymentIntent, bulk tiers, first-mix private 50% code floor-bounded to $225/song), **T&C page + recorded checkout consent** (S7, `20260704`), discount-codes catalog + Studio CRUD (S3, client-inert), **lifecycle transition guards** (#34 — `canTransition` seam in `workflow.ts` + `20260705` DB status fence), **payment-write hardening** (#40/#41 — `20260708` INSERT fence + shared `claimProjectPayment` seam; the poll fallback confirms paid orders again), full blog/SEO stack (sitemap, robots, per-post meta + JSON-LD, share images, IndexNow *code*), portal hardening (archive RLS trigger, storage-cleanup module, order-write freeze triggers), a11y/motion pass. Compact list in **Completed** below.

**Launch-debt on live checkout** (charging real money since 2026-07-02):

- **No tax** ([#31](https://github.com/novaspatial/nova/issues/31)) — `taxCents = 0` stub; Canadian GST is owed per D2.
- **Marketing promises "50% off"** ([#9](https://github.com/novaspatial/nova/issues/9)) while the floored real discount is ~31% for a single-song first order.

The payment-write hardening pair (#40 INSERT forgery, #41 dead poll fallback) **shipped 2026-07-08** — `20260708` insert fence + a shared service-side claim seam; see Completed. Two narrower residuals it surfaced were filed as [#42](https://github.com/novaspatial/nova/issues/42) (delete-then-reattach DB floor) and [#43](https://github.com/novaspatial/nova/issues/43) (direct-insert rate/consent bypass).

Also inert in production: IndexNow ([#33](https://github.com/novaspatial/nova/issues/33) — `INDEXNOW_KEY` unset, live key URL 404s, apex→www redirect contradicts D10).

## Decided constraints (do not re-litigate; history in #1)

- **D1** — Order data lives on the `projects` row (1 order = 1 Project). Stripe Elements/PaymentIntent flow stays.
- **D3** — List prices in **USD**; the $225 floor is per-song in the charge currency.
- **D4** — $325/song list · bulk 15/20/25% (3–4 / 5–7 / 8+ songs) · one code max, private suppresses bulk · 35% cap on the percent stack only · fixed codes bounded by floor only · add-ons after discount, outside cap/floor · integer cents, half-up. Single source: `src/lib/stripe/pricing.ts`.
- **D2 (policy half)** — Canadian Clients pay **GST, no PST**; the computation mechanism is ours to choose. *Still open:* the HST-province question (asked in #1) — gates #31.
- **D8/D9/D10** — OG image = first inline image (fallback `/og-image.jpg`); share images via `next/og` Node runtime; canonical origin is the **apex** `https://nova-spatial.com` (the live apex→www 307 contradicts this — reconcile inside #33).
- **ADRs 0001–0004** — native Supabase audio, RLS-first authorization, signed-URL direct uploads, Stripe gating + atomic first-mix RPC. Settled architecture; the refactor lane works *within* them.

## Open decisions (all tracked in #1 — send to Mike/Jamie as one package)

| Decision | Question | Gates |
| --- | --- | --- |
| **D5** | "Returning client" = paid or delivered Project? | #25 |
| **D6** | When is a single-use code consumed? (suggest: existing reserve/restore pattern) | #26 |
| **D11** | Welcome code 10% vs 15%, and when it replaces the promo | #9, #30 |
| **D2-HST** | Ontario etc.: 5% GST or full HST? | #31 → #24 |
| **D13** | Inbox provider + sending subdomain | #24 (sender only) |
| **D-floor-private** | Private codes targeting ~$200 vs the $225 floor | #26 shape |
| **D-revisions** | Track included revision rounds in-portal or manually? | #19 note |
| **D7 / D7b** | Purge infra (suggest Vercel Cron) / tombstone vs hard-delete | #27 |
| **D-refund** | Refund mechanism (in-app or manual) | new slice or exclusion |
| **D12** | Nova Studios architecture | all of Part B |

---

## The path

### Now queue (unblocked — work top-down)

| # | Issue | What / why now | Notes |
| --- | --- | --- | --- |
| 1 | [#19](https://github.com/novaspatial/nova/issues/19) **S6** | **Add-ons** (extra revision, 48h rush). Math is shipped and tested (`ADD_ON_CENTS`); wire form checkboxes → checkout `addOns` → `add_ons` column → PaymentStep line. | Rush is "subject to availability" per T&C — availability gate or manual-refund note (issue comment). Post-order revision purchase waits on D-revisions. |
| 2 | [#33](https://github.com/novaspatial/nova/issues/33) **S23** | **Activate IndexNow in prod**: set `INDEXNOW_KEY`, verify live key + accepted ping, and **reconcile the apex→www redirect with D10**. | Pure ops + verification; no code gaps. |
| 3 | [#38](https://github.com/novaspatial/nova/issues/38) **arch** | **First-mix discount orchestration module** (one `reserve/restore/code()` seam; quote and charge read the same code source). Prepares #25 — redemption plugs into this wrapper. | Do before D5 lands so #25 starts on a clean seam. Strength: Worth exploring. |
| 4 | [#35](https://github.com/novaspatial/nova/issues/35) + [#37](https://github.com/novaspatial/nova/issues/37) **arch** | **Storage seam** (buckets/paths/signed-URL choreography, one upload-runner hook, server-side size/MIME) + **`requireProjectChild`** authz helper. Natural pair — the download handlers consume both. | Do before #27 (purge sweeps buckets) and #13 (admin download consumes `signedDownload`). Strengths: Strong / Worth exploring. |
| 5 | [#36](https://github.com/novaspatial/nova/issues/36) **arch** | **Extract `useCommentClock`** — first meaningful test coverage for the Listen step. | Independent; fill capacity between gated slices. Strength: Strong. |
| 6 | [#42](https://github.com/novaspatial/nova/issues/42) + [#43](https://github.com/novaspatial/nova/issues/43) **bug** | **Insert-fence residuals** from the #40/#41 work. #42: delete-then-reattach of a freed Stripe intent id (needs a DB-level floor — intent tombstone or service-mediated Stripe insert). #43: direct PostgREST `pending_payment` inserts skip the route's rate limit + consent gate. | Narrow, non-payment-integrity; `needs-triage`. Take with the arch lane. |

### Gated chains (fire when the gate opens; they preempt the Now queue)

**Commerce chain (critical path):**

```text
D5 ─> #25 S4b  wire code redemption at checkout        (builds on #38's seam; #17 table ready)
        └─ D6 ─> #26 S5  single-use consumption         (copy the hardened first-mix RPC pattern; D-floor-private shapes it)
D11 ─> #9 S10  promo → welcome-code copy               (live copy currently over-promises — insert ASAP once decided)
   └─> #30 S20 homepage price calculator               (shares the S1 quote component; same round as #9)
D2-HST ─> #31 S21  GST at checkout                     (fill taxCents stub or Stripe Tax; migration+RLS+types together; quote/PaymentStep/PaymentIntent)
              └─> #24 S8  order-confirmation email      (consumes #31's persisted tax line; D13 for sender — can ship earlier with the existing sender) (reads NOTIFIABLE_STATUSES from the shipped #34 seam)
```

**Lifecycle queue:** D7 + D7b ─> [#27](https://github.com/novaspatial/nova/issues/27) **S18** delivery anchor + 90-day purge (reuses `projectCleanup` + #35's storage seam; stamps `delivered_at` at the PATCH transition point the shipped #34 seam made explicit). Independent of decisions: [#13](https://github.com/novaspatial/nova/issues/13) **S17** admin file download (after #35, trivially).

**Content/SEO queue:** [#32](https://github.com/novaspatial/nova/issues/32) **S22** Stem Prep Guide (content from Jamie; T&C references it — coordinate with #23) · [#29](https://github.com/novaspatial/nova/issues/29) **S19** GEO/LLM visibility (needs `sameAs` URLs; **bundle [#39](https://github.com/novaspatial/nova/issues/39) blog facade into this slice** — it touches the same metadata/JSON-LD modules).

**Not started until D12:** Nova Studios (Part B) — separate `/to-issues` round when the architecture decision lands.

### Critical path

```text
D5 ─> #25 ─> D6 ─> #26 ─> D11 ─> #9 + #30            ← code redemption + honest marketing
D2-HST ─> #31 ─> #24                                  ← tax + receipt
```

(#23, the former no-gate top of this path, shipped 2026-07-04; #40/#41 shipped 2026-07-08.) Everything else (#42/#43, #19, #33, #13, #27, #29/#32, arch lane) is parallel-safe. The single biggest unlock is sending the **decision package** — it opens every gated chain at once.

---

## Architecture lane (review of 2026-07-04)

Six refactors from `/improve-codebase-architecture` (report vocabulary: seam/depth/locality). #34 shipped 2026-07-04 (`aa5b70f`); the remaining five are labeled `architecture` + `needs-triage`, sequenced above, summarized here:

| Issue | Strength | One-liner | Slot |
| --- | --- | --- | --- |
| [#34](https://github.com/novaspatial/nova/issues/34) ✅ | Strong (`bug`) | Transition + gating guards in `workflow.ts` + `20260705` DB status fence | **Shipped** (`aa5b70f`) |
| [#35](https://github.com/novaspatial/nova/issues/35) | Strong | One storage seam: buckets, path templates, signed-URL choreography, size/MIME | Before #27/#13 |
| [#36](https://github.com/novaspatial/nova/issues/36) | Strong | `useCommentClock` extraction; Listen step becomes testable | Anytime |
| [#37](https://github.com/novaspatial/nova/issues/37) | Worth exploring | `requireProjectChild` — one project-child authz helper | With #35 |
| [#38](https://github.com/novaspatial/nova/issues/38) | Worth exploring | First-mix reserve/restore/code() wrapper; single code source for quote + charge | Before #25 |
| [#39](https://github.com/novaspatial/nova/issues/39) | Speculative | Blog facade returning a hydrated post | Inside #29 |

---

## Completed (compact — details in worklogs + git history)

| Slice | Issue | Outcome |
| --- | --- | --- |
| P1 | #4 | `Project` type synced with payment + order fields; `DiscountCode`/`PriceBreakdown` types |
| P2 + S4a | #5, #22 | Pure `computeOrderPrice` module, exec-approved, 44-test suite (`748ba42`, `edacdca`) |
| P3 | #6 | `src/lib/site.ts` single origin (D10) + `onPostMutated` publish hook (`cf283fb`) |
| P4 | #2 | Checkbox primitive + Footer Legal seam (`de811ff`) — #23 is now thin wiring |
| P5 | #3 | `projectCleanup.ts` storage sweep; #27 reuses |
| S1 + S2 | #16, #18 | Per-song USD checkout end-to-end: order form, live quote, PaymentStep breakdown, `20260702` migrations incl. order-write freeze + RPC guards (`60bee5d`…) |
| S3 | #17 | `discount_codes` table + studio-only RLS + admin CRUD (`daf4748`); client-inert until #25 |
| S9/S9b | #7, #8 | Motion/reduced-motion pass (`c612c93`); contrast + hero credits (`6d36e6c`) |
| S11/S11b | #10, #11 | Blog readability (`1729e38`); structural fixes, hero extraction (`711ebbd`) |
| S12/S13 | #20, #21 | Per-post SEO meta + JSON-LD (`be6209c`); `next/og` share image (`8ec148c`) |
| S14/S15 | #14, #15 | Sitemap + robots (`bf710fe`); IndexNow code, env-gated (`02d3d02`) → activation is #33 |
| S16 | #12 | Archive RLS hardening — DB trigger enforces studio-only `archived_at` (`20260625`) |
| S7 | #23 | T&C page + required checkout consent, recorded as `terms_accepted_at/version` (`b437c99`, `20260704`) |
| arch | #34 | Lifecycle guards: `canTransition`/upload gates/`NOTIFIABLE_STATUSES` in `workflow.ts`, CAS route writes, `20260705` status fence (`aa5b70f`); spawned #40/#41 |
| bug | #40, #41 | Payment-write hardening: `20260708` BEFORE INSERT fence (client rows born unpaid/pending), dev-bypass + poll claims moved to the service client, shared `claimProjectPayment` seam revives the poll fallback; verified on the remote. Spawned #42/#43 |

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
| S6 | [#19](https://github.com/novaspatial/nova/issues/19) | ready-for-human | Add-ons: extra revision + 48h rush |
| S8 | [#24](https://github.com/novaspatial/nova/issues/24) | ready-for-human | Order-confirmation email |
| S4b | [#25](https://github.com/novaspatial/nova/issues/25) | ready-for-human | Wire code redemption at checkout |
| S5 | [#26](https://github.com/novaspatial/nova/issues/26) | ready-for-human | Single-use private code consumption |
| S10 | [#9](https://github.com/novaspatial/nova/issues/9) | ready-for-human | Replace 50% promo with welcome code |
| S17 | [#13](https://github.com/novaspatial/nova/issues/13) | ready-for-human | Admin file download |
| S18 | [#27](https://github.com/novaspatial/nova/issues/27) | ready-for-human | delivered_at + 90-day purge |
| S19 | [#29](https://github.com/novaspatial/nova/issues/29) | ready-for-human | LLM/AI-search visibility (GEO) |
| S20 | [#30](https://github.com/novaspatial/nova/issues/30) | ready-for-human | Homepage price calculator |
| S21 | [#31](https://github.com/novaspatial/nova/issues/31) | ready-for-human | Compute + charge GST at checkout |
| S22 | [#32](https://github.com/novaspatial/nova/issues/32) | ready-for-human | Stem Prep Guide page |
| S23 | [#33](https://github.com/novaspatial/nova/issues/33) | ready-for-human | IndexNow production activation |
| arch | [#35](https://github.com/novaspatial/nova/issues/35) | needs-triage | One storage seam (buckets/paths/signed URLs) |
| arch | [#36](https://github.com/novaspatial/nova/issues/36) | needs-triage | Extract `useCommentClock` |
| arch | [#37](https://github.com/novaspatial/nova/issues/37) | needs-triage | `requireProjectChild` authz helper |
| arch | [#38](https://github.com/novaspatial/nova/issues/38) | needs-triage | First-mix discount orchestration module |
| arch | [#39](https://github.com/novaspatial/nova/issues/39) | needs-triage | Blog facade (hydrated post) |
| bug | [#42](https://github.com/novaspatial/nova/issues/42) | needs-triage, bug | Delete-then-reattach of a freed Stripe intent id (DB floor) |
| bug | [#43](https://github.com/novaspatial/nova/issues/43) | needs-triage, bug | Direct PostgREST inserts bypass the checkout rate limit + consent gate |

Closed: #2–#8, #10–#12, #14–#18, #20–#23, #28, #34, #40, #41 (see Completed).

## Deliberately not built

- **T&C text** — Jamie writes it (#23 ships page + checkbox + record only).
- **DNS / SPF / DKIM / DMARC, inbox purchase** — pure ops, no repo artifact.
- **Nova Studios port** — blocked on D12 (content, brand, redirects).
- **Refund mechanism** — blocked on D-refund (new slice if in-app).
- **Part C logistics** (prioritization, calendar) — project management, not code.

---

*Produced from the `devplan-to-slices` workflow output (8-subsystem map → draft → adversarial critique → revision); rewritten 2026-07-04 to fold in the gap audit and the architecture review.*
