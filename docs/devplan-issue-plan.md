# DevPlan — Goal & Remaining Path

**Rewritten 2026-07-04** for agent consumption. Provenance: `devplan.docx` (Web Designer Meeting, 2026-06-09) was sliced into issues via `/to-issues`; gap-audited line-by-line against the docx on 2026-07-04 (added #31/#32/#33); extended the same day with six architecture refactors (#34–#39) from an `/improve-codebase-architecture` review. Status refreshed late 2026-07-04: **#23 (T&C) and #34 (lifecycle guards) shipped and closed**; #34's exploration surfaced two payment-write hardening bugs, filed as **#40/#41**. Refreshed again 2026-07-08: **#40/#41 shipped and closed** (`20260708` INSERT fence + shared service-side claim seam); they surfaced two narrower residuals, filed as **#42/#43**. Refreshed 2026-07-14: no new code since the 2026-07-13 sweep (#9/#31/#38/#25); with every commerce decision answered, **#26 and #30 are promoted from the gated commerce chain into the Now queue** (only #24 stays gated, on D13's sender). Same day, a history rewrite on `main` replaced every commit after `964242b` — commit citations below are remapped to the post-rewrite hashes (this also cleared nine citations orphaned by an earlier rewrite). Refreshed 2026-07-15: a second answer package (Jamie, 2026-07-14 — recorded in #1) resolves rush availability, D13's sender, D-revisions, D7, and D-refund — **#24 joins the Now queue and #19 flips to `ready-for-agent` in place**; **#32 closed 2026-07-14** (the guide lives in-portal — `UploadPrep`; no public page). Later the same day, **#26 shipped and closed** (the `20260715` consumption migration applied to the remote + the seam/webhook wiring; D-floor-private included) — **#30 now heads the Now queue**. Refreshed 2026-07-24: **#30 shipped and closed** (`8df8b5a` — homepage price calculator deep-linking into the portal), and a same-day unplanned admin pass (`997cfd2`) put `/blog/admin` behind the middleware, collapsed the role check into `requirePageStudioUser`, and dropped the unused `referral_attribution` column (`20260724`, applied). **#19 now heads the Now queue**: the live calculator advertises add-ons the order form still drops — a client-visible gap; #24 follows. Refreshed again later that day: **#19 shipped and closed** (`8ef8b14` — add-ons wired form → checkout → new `add_ons` column → PaymentStep, the `20260724_add_project_add_ons` migration applied to the remote, plus the details-card display so the studio sees rush orders) — **#24 now heads the Now queue** as the last commerce slice. Refreshed once more the same day: **#24 shipped and closed** (order-confirmation receipt fired exactly-once from all 3 payment writers via the claim CAS; no schema change) — **the commerce lane is closed**. Later that day **#35/#37 flipped `needs-triage` → `ready-for-agent`** (Onur's triage go) and moved to the head of the Now queue as one slice — the storage seam + `requireProjectChild` pair that unblocks #27 and #13; re-anchor notes on both issues map the code drift (#34/#40/#41/#26/#24 all touched the cited handlers). **That slice shipped the same day (`c2e1a23`) and both issues closed**: `src/lib/portal/storage.ts` (buckets/tables/paths/TTL/size-MIME validation/`createUpload`/`signedDownload` + the three download handlers as one route factory), `src/lib/portal/uploadRunner.ts` (the ADR-0003 client dance, de-triplicated), and `requireProjectChild` beside its sibling in `auth/server.ts` — no migration, RLS/storage policies untouched, the `claimProjectPayment`/consume/receipt and #26-restore choreographies preserved. **#13 flipped `ready-for-human` → `ready-for-agent`** (its blocker was #35; `signedDownload` now exists) and **#33 heads the Now queue**. Refreshed 2026-07-25: **#13 closed as already-live, not implemented** — its stems half had been shipping for a while (`UploadManager`'s studio download → the studio-only `stemDownloadRoute`, "studio sees all" RLS beneath) and its deliverables half had nothing to download (the `deliverables` table/bucket/API were consumed by no UI; delivery in practice is mix-type `project_files` on Listen) — so the dormant pipeline was **removed end-to-end** (`90c1f82`, −868 lines + the `20260725_remove_deliverables` migration: table + 3 RLS policies + 4 storage policies + bucket dropped, `file_type` CHECK narrowed to `stem|master_ref|mix`; the PATCH `deliverable_format` side-write it deleted was a silent no-op — no UPDATE policy existed). D7's "stems and deliverables" purge scope now maps to stem + mix rows — noted on #27 for confirmation at pickup. Still open: D7b (the only #27 gate), D12, and #29's studio `sameAs` URLs. Refreshed 2026-07-26: **D7b answered — tombstone** (Onur, recorded in #1: row kept, audio removed, `files_purged_at` stamped — the projects row is the order/consent/tax record per D1), so **#27 flipped `ready-for-human` → `ready-for-agent`** and per the gate rule now heads the queue; the same day Onur's triage go flipped **#36, #42, #43** `needs-triage` → `ready-for-agent`, and the #33 ops pass started (live re-check: apex→www 307 still contradicts D10; `/indexnow-key.txt` 404s — key env + primary-domain flip pending in Vercel). That ops pass surfaced a blocker: **prod's Vercel account and the GoDaddy registrar both sit under the client's email** (recovery email drafted; #33 waits on the client's reply — details in the session memory). Later that day **#27 shipped and closed** (`delivered_at` stamped in the PATCH status CAS, the `retentionPurge` sweep + protected `/api/cron/purge-delivered` entrypoint + `vercel.json` cron, `20260726_add_delivery_purge` applied to the remote with a 20260625-pattern UPDATE fence; the cron stays inert until `CRON_SECRET` lands in Vercel — riding the same access recovery). Same day **#36 shipped and closed** (`7b43587` — the comment clock extracted into `useCommentClock` with the Listen step's first unit tests); **#42/#43 now head the Now queue**. Later that day **#42/#43 shipped and closed as one slice** (`13908d3` + the `20260726_system_only_project_inserts` migration, applied to the remote after the deploy): the Stripe-branch checkout insert moved to the service client and the `20260708` fence was replaced by a full system-only INSERT fence — client sessions can no longer create `projects` rows at all, closing the freed-intent-id resurrection and every direct-insert bypass at the floor; **#33 now heads the Now queue** (`ready-for-human`, blocked on the client's hosting access). The previous revision of this file (Turkish, with full Phase 0–3 history) is in git history.

> Issues live in [novaspatial/nova](https://github.com/novaspatial/nova/issues) via `gh` (see `docs/agents/issue-tracker.md`).
> Open-decision umbrella: [#1](https://github.com/novaspatial/nova/issues/1) (`needs-info`).

---

## Goal

A Client can go from an interactive homepage price quote to a **paid, taxed, T&C-consented order** — with discount codes redeemed against the catalog, an order-confirmation email, and marketing copy that matches what checkout actually charges. After delivery, files purge on schedule. The blog/SEO surface (per-post SEO ✅, IndexNow, GEO) is live in production. The architecture lane keeps the seams deep so each slice lands small and tested.

**Done =** the 5 open work issues below closed (or consciously moved to *Deliberately not built*) and the open decisions in #1 answered.

## How an agent picks work

1. Work the **Now queue** top-down. Nothing there waits on an unanswered decision; the queue currently holds only #33 (`ready-for-human`), which names the ops input it still needs in its Notes cell.
2. When a **gate opens** (a decision lands in #1, or an upstream issue closes), the gated chain **preempts** the Now queue.
3. Read the issue itself for the full spec; this file only carries ordering, gates, and the why.
4. Before commerce/lifecycle work, honor **Decided constraints** below — do not re-litigate them.

**Label key:** `ready-for-agent` = fully specified, take it AFK · `ready-for-human` = an input/decision is needed first (see the gate column) · `needs-info` = waiting on Mike/Jamie · `needs-triage` + `architecture` = the review refactors still awaiting Onur's triage confirmation — now just #39 (#34 shipped 2026-07-04, #38 2026-07-13, #35/#37 2026-07-24, #36 2026-07-26) · `bug` = live defect (none open — #42/#43, the insert-fence residuals from the #40/#41 hardening, shipped 2026-07-26 as one slice).

---

## Where we are (2026-07-26)

**Live and shipped:** priced per-song USD checkout (S1/S2 — `computeOrderPrice`, Stripe PaymentIntent, bulk tiers, $225/song floor) now **charging GST/HST** (S21, `20260713`), **discount-code redemption at checkout** (S4b — the 15% welcome code per D11 on top of the S3 catalog + Studio CRUD, orchestrated through the #38 `orderDiscount` seam) with **consumption enforced** (S5 #26, `20260715` — atomic reserve/restore holds on service-role-only RPCs, webhook finalize per D6 into the `discount_redemptions` ledger, the one-WELCOME-per-owner index closing the D5 race, and D-floor-private's `allow_below_floor`), **T&C page + recorded checkout consent** (S7, `20260704`), the **homepage price calculator** (S20 #30, 2026-07-24 — the `#pricing` section quotes live from `computeOrderPrice`, prices the welcome offer in only when it strictly beats the album discount, and deep-links `?songs/addons/code` into `/portal/new` through the server-parsed `newProjectParams` contract), **order add-ons** (S6 #19, 2026-07-24 — extra revision +$50 and 48h rush +$149 wired form → checkout → `add_ons` column (`20260724`, freeze-trigger widened) → PaymentStep + details card, with the intent-metadata/payment-status cross-check; per the 2026-07-14 rulings no availability gate and no post-order purchase), the **order-confirmation receipt** (S8 #24, 2026-07-24 — one best-effort `sendOrderConfirmationEmail` rendering the frozen order row, sent exactly-once from whichever payment writer wins the `claimProjectPayment` CAS: webhook post-claim slot, poll claim, or the dev-bypass born-paid insert; sender per D13), **lifecycle transition guards** (#34 — `canTransition` seam in `workflow.ts` + `20260705` DB status fence), **payment-write hardening** (#40/#41 — `20260708` INSERT fence + shared `claimProjectPayment` seam; the poll fallback confirms paid orders again), full blog/SEO stack (sitemap, robots, per-post meta + JSON-LD, share images, IndexNow *code*), portal hardening (archive RLS trigger, storage-cleanup module, order-write freeze triggers), a11y/motion pass, and a 2026-07-24 admin pass (`/blog/admin` in the middleware matcher — edge login redirect + noindex, `requirePageStudioUser` gate, paginated admin lists on shared `Select`/`Checkbox`/`NumberInput`/`Pagination` primitives, `referral_attribution` dropped end-to-end via `20260724`). Compact list in **Completed** below.

**Deliverables pipeline removed 2026-07-25 (`90c1f82` + `20260725` migration, applied):** #13 closed as already-live; the never-consumed `deliverables` table, `project-deliverables` bucket, their policies, routes, and the `'deliverable'` file-type value are gone. **Deliverable** survives as the glossary term for the signed-off mix files on Listen.

**D7b answered + triage sweep + #27 shipped, 2026-07-26 (Onur):** purge record handling = **tombstone** (see Decided constraints), and #27 shipped the same day: `delivered_at` stamped at the PATCH transition point, the `retentionPurge` sweep (stem + mix rows; `master_ref` + comment attachments stay), `files_purged_at` tombstone, `GET /api/cron/purge-delivered` behind `CRON_SECRET`, `vercel.json` cron at daily 06:00 UTC, `20260726` migration applied. #36 and the #42/#43 bug pair got their triage go. #33's ops half hit a wall: **the prod Vercel account, its DNS zone, and the GoDaddy registrar all sit under the client's email** — a recovery email to the client is drafted; #33 and the purge-cron activation (`CRON_SECRET`) both ride that access.

**#36 shipped, 2026-07-26 (`7b43587`):** the comment clock is `useCommentClock` beside ReviewTimeline — behaviour unchanged, 29 unit tests (the suite's first fake-timer/rAF coverage), the Listen step's first interactive coverage. #42/#43 now head the Now queue.

**#42/#43 shipped, 2026-07-26 (`13908d3` + `20260726_system_only_project_inserts`, applied):** project rows are now born only from system (service/studio) writes. The Stripe-branch checkout insert moved to the service client (`owner_id` still session-bound, test-pinned) and the `20260708` fence was replaced with a full reject of non-studio client INSERTs — no unprivileged writer of `stripe_payment_intent_id` remains (#42 closed without an intent tombstone), and the direct-insert bypasses (#43: rate limit, consent, born-archived/deleted, hold-less coupon stamps) are gone at the floor. Consent and the 3/min limit deliberately stay route concerns. Remote-probed (42501 client insert / sessionless pass); suite 861. **#33 now heads the Now queue.**

**#30 shipped 2026-07-24 (`8df8b5a`) with 2 recorded residuals — 1 closed same-day:** the add-on gap (form and checkout dropping the deep-linked `addons=`) closed with **#19 (`8ef8b14`)**. The remaining residual: a deep-linked `?code=` prefills the input without auto-applying, so the form's live quote reads undiscounted until Apply/submit (the charge itself re-validates and is correct — display drift only).

**Decision package answered (2026-07-13, Mike — recorded in #1):** D2 complete (full HST in HST provinces + computed-in-module mechanism), D5 (returning = prior paid), D6 (consume on payment success), D-floor-private (per-code override flag), D11 (welcome = 15%). Every commerce gate is open; **#38 (order-discount seam) and #25 (code redemption at checkout) both shipped 2026-07-13** (`0764def`, `5c83862`), and **#26 consumed the D6/D-floor-private rulings and shipped 2026-07-15** — single-use and usage-limited codes are now safe to distribute (an abandoned-but-undeleted pending checkout holds capacity until deleted; reconciliation SQL in the 2026-07-15 worklog).

**Second answer package (2026-07-14, Jamie — recorded in #1):** rush = always accepted, studio contacts/refunds manually (no admin toggle); #24's sender = the existing `noreply@nova-spatial.com` Resend sender (D13 no longer gates code); D-revisions = manual, no in-portal tracking, post-order extras invoiced manually; D7 = Vercel Cron at 90 days, purging **stems and deliverables** (engineers keep local copies); D-refund = manual via the Stripe dashboard. **#24 joined the Now queue and #19 flipped to `ready-for-agent` in place** — nothing in commerce is gated anymore. Separately, **#32 closed 2026-07-14**: the stem-prep guide lives in-portal (`UploadPrep` on the client dashboard); no public page, and the live T&C keeps omitting the link. Still open: **D7b** (hard-delete vs tombstone for the project record — the only #27 gate, follow-up asked), **D12**, and the **studio** `sameAs` URLs for #29 (Jamie's author URL received: `jamiekuse.com`).

**Launch-debt cleared 2026-07-13** (had been charging real money without it since 2026-07-02): checkout now computes and charges **GST/HST** per D2 ([#31](https://github.com/novaspatial/nova/issues/31), `20260713` migration + billing country/province on the order form), and the marketing copy matches the charged **15% welcome offer** from one shared constant ([#9](https://github.com/novaspatial/nova/issues/9)).

The payment-write hardening pair (#40 INSERT forgery, #41 dead poll fallback) **shipped 2026-07-08** — `20260708` insert fence + a shared service-side claim seam; see Completed. Two narrower residuals it surfaced were filed as [#42](https://github.com/novaspatial/nova/issues/42) (delete-then-reattach DB floor) and [#43](https://github.com/novaspatial/nova/issues/43) (direct-insert rate/consent bypass) — **both closed 2026-07-26** by the system-only insert fence (`20260726`; see Completed).

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
- **D7** — Purge runs as a **Vercel Cron** job 90 days after delivery and removes **stems and deliverables both** (engineers retain local copies). Since the 2026-07-25 removal of the `deliverables` table, "deliverables" maps to mix-type `project_files` — the purge in practice covers stem + mix rows (`master_ref` stays). The record question D7b was answered 2026-07-26 — see D7b. (#27; 2026-07-14)
- **D7b** — The purge keeps the project **row** as a tombstone: stored audio removed, `files_purged_at` stamped, the order/consent/tax fields staying on as the retention record (the row *is* the order per D1 — a hard-delete would destroy the financial/consent trail). (#27; 2026-07-26)
- **D-refund** — Manual via the Stripe dashboard; nothing built in-portal. Revisit only if volume demands. (2026-07-14)
- **D8/D9/D10** — OG image = first inline image (fallback `/og-image.jpg`); share images via `next/og` Node runtime; canonical origin is the **apex** `https://nova-spatial.com` (the live apex→www 307 contradicts this — reconcile inside #33).
- **ADRs 0001–0004** — native Supabase audio, RLS-first authorization, signed-URL direct uploads, Stripe gating + atomic first-mix RPC. Settled architecture; the refactor lane works *within* them.

## Open decisions (all tracked in #1)

| Decision | Question | Gates |
| --- | --- | --- |
| **D12** | Nova Studios architecture | all of Part B |

> Open **info** (not a decision): the **studio's** official profile URLs for #29's `Organization` `sameAs` — Jamie's author URL is in (`jamiekuse.com`, not on socials). The inbox-provider/subdomain purchase (rest of D13) is pure ops, no repo artifact.

---

## The path

### Now queue (unblocked — work top-down)

| # | Issue | What / why now | Notes |
| --- | --- | --- | --- |
| 1 | [#33](https://github.com/novaspatial/nova/issues/33) **S23** | **Activate IndexNow in prod**: set `INDEXNOW_KEY`, verify live key + accepted ping, and **reconcile the apex→www redirect with D10**. Now also carries setting `CRON_SECRET` (the #27 purge cron is inert without it). | `ready-for-human` — **blocked on the client**: prod's Vercel + GoDaddy sit under the client's email (2026-07-26; recovery email drafted, key generated). |

### Gated chains (fire when the gate opens; they preempt the Now queue)

**Commerce chain: done.** Every gate was answered (the 2026-07-13 decisions; the 2026-07-14 rulings on the sender, rush availability, and revisions) — #26 shipped 2026-07-15; #30, #19, and #24 shipped 2026-07-24. The lane is closed.

**Lifecycle queue: done.** D7b answered 2026-07-26 (tombstone) and [#27](https://github.com/novaspatial/nova/issues/27) shipped the same day — see Completed. Only the production `CRON_SECRET` activation remains, folded into #33's ops item. (#13 S17 closed 2026-07-25 as already-live — see Completed.)

**Content/SEO queue:** [#29](https://github.com/novaspatial/nova/issues/29) **S19** GEO/LLM visibility (author `sameAs` received 2026-07-14 — `jamiekuse.com`, not on socials; **studio** URLs still outstanding; **bundle [#39](https://github.com/novaspatial/nova/issues/39) blog facade into this slice** — it touches the same metadata/JSON-LD modules). (#32 Stem Prep Guide closed 2026-07-14 — see Completed.)

**Not started until D12:** Nova Studios (Part B) — separate `/to-issues` round when the architecture decision lands.

### Critical path

```text
(empty — #24, the last slice, shipped 2026-07-24)
```

(#23, the former no-gate top of this path, shipped 2026-07-04; #40/#41 shipped 2026-07-08; #9/#31/#38/#25 shipped 2026-07-13; #26 shipped 2026-07-15; #30, #19, #24, and the #35/#37 arch slice shipped 2026-07-24; #13 closed 2026-07-25; #27, #36, and #42/#43 shipped 2026-07-26.) **The commerce and lifecycle critical paths are complete.** Everything remaining (#33, #29, #39) is parallel-safe, gated only by D12 and the ops inputs named in their Notes.

---

## Architecture lane (review of 2026-07-04)

Six refactors from `/improve-codebase-architecture` (report vocabulary: seam/depth/locality). #34 shipped 2026-07-04 (`aa5b70f`), #38 shipped 2026-07-13 (`0764def`), the #35/#37 slice shipped 2026-07-24 (`c2e1a23`), and #36 shipped 2026-07-26 (`7b43587`); #39 stays `architecture` + `needs-triage`. Summarized here:

| Issue | Strength | One-liner | Slot |
| --- | --- | --- | --- |
| [#34](https://github.com/novaspatial/nova/issues/34) ✅ | Strong (`bug`) | Transition + gating guards in `workflow.ts` + `20260705` DB status fence | **Shipped** (`aa5b70f`) |
| [#35](https://github.com/novaspatial/nova/issues/35) ✅ | Strong | One storage seam: buckets, path templates, signed-URL choreography, size/MIME | **Shipped** (`c2e1a23`) |
| [#36](https://github.com/novaspatial/nova/issues/36) ✅ | Strong | `useCommentClock` extraction; Listen step becomes testable | **Shipped** (`7b43587`) |
| [#37](https://github.com/novaspatial/nova/issues/37) ✅ | Worth exploring | `requireProjectChild` — one project-child authz helper | **Shipped** (`c2e1a23`, with #35) |
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
| arch | #35, #37 | Storage seam (`src/lib/portal/storage.ts`: buckets/tables/paths/TTL/size-MIME validation, `createUpload` per kind, `signedDownload`, 3 download handlers from one factory) + client `uploadRunner.ts` (ADR-0003 dance de-triplicated across useFileUpload/NewProjectForm/ReviewTimeline) + `requireProjectChild` in `auth/server.ts` replacing 6 inline child-row preambles; `formatFileSize` deduped; no migration, RLS untouched; unblocks #27/#13 (`c2e1a23`) |
| S4b | #25 | Code redemption at checkout: order-form code field + live discounted quote (validate endpoint), server-side re-validation in the #38 seam (`lookup_discount_code` RPC, D5 eligibility via `hasPriorPaidProject`), `applied_coupon_code` persisted + frozen (`20260713`), welcome offer code-based per D11 (the welcome code from the shared constant, flag path = no-code fallback); consumption deferred to #26 (`5c83862`) |
| S22 | #32 | Stem Prep Guide — resolved in-portal: the `UploadPrep` collapsible guide on the client dashboard (`da43cb3`); no public page, and the live T&C deliberately omits the guide link (`terms/page.tsx` guard — adding it later bumps `TERMS_VERSION`). Closed 2026-07-14 |
| S20 | #30 | Homepage price calculator (`8df8b5a`): `#pricing` section quoting live from `computeOrderPrice`, welcome-vs-bulk comparison advertises the code only when it strictly wins, CTA deep-links `?songs/addons/code` into `/portal/new` parsed server-side (`newProjectParams.ts`, survives the login redirect); `QuoteBreakdown` shared with the order form, `NumberInput` primitive, `MAX_SONG_COUNT` hoisted to the pricing module; `addons=` parsed but unconsumed until #19 |
| S5 | #26 | Single-use code consumption (`20260715`, applied to the remote): `reserved_count`/`redeemed_count` + `discount_redemptions` ledger, service-role-only reserve/restore/consume RPCs (first-mix-pattern CAS), hold acquired in `reserveOrderDiscount`, webhook finalize per D6 (idempotent; must-500, replay re-attempts), poll/dev-bypass best-effort, restore hoisted to the DELETE route (delete-returning row = exactly-once), one-WELCOME-per-owner index closes the D5 race, D-floor-private `allow_below_floor` through lookup→OrderCode→`computeOrderPrice` (+ sub-50¢ checkout reject), `exhausted`/`welcome_in_use` rejections, admin below-floor checkbox + redeemed counters |
| S8 | #24 | Order-confirmation receipt: one best-effort `sendOrderConfirmationEmail` (`src/lib/email/orderConfirmation.ts`) rendering the frozen order row only (song count, `ADD_ON_LABELS` lines, coupon code, `tax_cents` with the `CA_TAX_RATES`-derived label, `formatCurrency` total, siteConfig portal/T&C links, soft delivery-estimate sentence per the T&C §6 audit note); sent exactly-once by whichever payment writer wins the `claimProjectPayment` CAS — webhook (in the #26-documented consumption → email → ack slot), poll claim, or dev-bypass insert; sender per D13; no schema change |
| S6 | #19 | Order add-ons (`8ef8b14`): form fieldset seeded from the `?addons=` prefill → strict checkout validation (400, de-dupe to canonical order) → `add_ons text[]` column with containment CHECK + freeze-trigger widened to 15 columns (`20260724_add_project_add_ons`, applied) → PaymentStep line + details-card display (rush visible to the studio on open); intent metadata `add_ons` always stamped and fail-closed-verified in payment-status like `song_count`; `ADD_ON_VALUES`/`ADD_ON_LABELS` hoisted to the pricing module. Rulings honored: no availability gate, order-time only |
| S17 | #13 | Closed 2026-07-25 **as already-live, not implemented**: studio stem download had been in-portal for a while (`UploadManager` → studio-only `stemDownloadRoute`, "studio sees all" RLS), and the deliverables half had no object — the dormant pipeline (table + bucket + 4 routes + `'deliverable'` file type + the silent PATCH `deliverable_format` no-op) was removed instead (`90c1f82`, −868 lines; `20260725_remove_deliverables` applied: guard-abort, table + 7 policies + bucket dropped, `file_type` CHECK narrowed) |
| arch | #36 | `useCommentClock` beside ReviewTimeline: the off/armed/live/locked machine, the keydown mark-start filter, the rAF end-anchor advance (re-base-on-timeupdate preserved verbatim), and the disabled derivation behind a 7-member structural `CommentClockPlayer` seam; interface = state/disabled/toggle/handleComposerKeyDown/handleAnchorBDrag/clear (event reports, not the sketched verbs — the hook owns the whole transition table); ReviewTimeline −71 lines to a caller; 29 tests, the suite's first fake-timer/rAF pattern; behaviour unchanged, no schema change, ADR-0001 untouched (`7b43587`) |
| S18 | #27 | Delivery anchor + 90-day purge (D7/D7b): `delivered_at` stamped in the PATCH status CAS on the `delivered` transition; `retentionPurge.ts` sweep (stem + mix objects via the #35 seam + their rows; `master_ref`/attachments stay; 20-batch with `mayHaveMore`; failures skip the stamp → retried) leaving the row as a `files_purged_at` tombstone (D1: it's the order record); `GET /api/cron/purge-delivered` behind `CRON_SECRET` (fail-closed), `vercel.json` cron daily 06:00 UTC; `20260726` migration applied (2 columns + 20260625-pattern UPDATE fence). 14 new tests. Cron inert until `CRON_SECRET` lands (→ #33 ops) |
| bug | #42, #43 | System-only project inserts (`13908d3` + `20260726_system_only_project_inserts`, applied): the Stripe-branch checkout insert moved to the service client (`owner_id` still session-bound, test-pinned) and the `20260708` fence replaced — non-studio client INSERTs on `projects` 42501 outright. Closes the freed-intent-id resurrection (#42 — UPDATE frozen since `20260702`, so no unprivileged intent-id writer remains; no tombstone table) and every direct-insert bypass (#43 — rate limit, consent, born-archived/deleted, hold-less coupon stamps); consent + rate limit deliberately stay route concerns. `SUPABASE_SERVICE_ROLE_KEY` now required for every checkout (fail-loud 500). Remote-probed (42501 client / sessionless pass); suite 861 |

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
| S19 | [#29](https://github.com/novaspatial/nova/issues/29) | ready-for-human | LLM/AI-search visibility (GEO) |
| S23 | [#33](https://github.com/novaspatial/nova/issues/33) | ready-for-human | IndexNow production activation |
| arch | [#39](https://github.com/novaspatial/nova/issues/39) | needs-triage, architecture | Blog facade (hydrated post) |

Closed: #2–#27, #30, #31, #32, #34–#38, #40–#43 (see Completed; #28 is a merged PR, not an issue).

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
