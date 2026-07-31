# 2. Answered commerce, tax, and retention decisions (the D-series)

Date: 2026-07-31 (recovered; the rulings themselves are dated inline)
Status: Accepted — this file is a record of decisions already made, not a new one

## Context

The product decisions the pricing, discount, tax, and retention code implements
were recorded in `docs/devplan-issue-plan.md` and in GitHub issue #1. Both are
gone: the doc was deleted on 2026-07-30 in the fresh-restart commit (`65e2512`),
and the issue was closed out with the rest of the tracker. The rulings survived
only in git history, which is not a place anyone thinks to look.

That has already caused one concrete problem. The guard comment in
`src/app/terms/page.tsx` told every future reader "do NOT add refund/cancellation
policy (D-refund open)" — but D-refund was answered on 2026-07-14. Anyone picking
up the Terms work would have been steered away from a clause that is not blocked
at all.

So this file restores the answered decisions verbatim from
`65e2512^:docs/devplan-issue-plan.md`, with the code that implements each one
named. It is a record, not a re-decision: nothing here is open, and changing any
of it needs a new ruling and a new ADR.

## The decisions

**D1 — Order data lives on the `projects` row.** One order = one Project; the
Stripe Elements/PaymentIntent flow stays. This is why the retention purge keeps
the row as a tombstone (D7b): the row *is* the order, consent, and tax record.

**D3 — List prices are USD**, and the $225 floor is per-song in the charge
currency.

**D4 — The price ladder.** $325/song list; bulk 15/20/25% at 3–4 / 5–7 / 8+ songs;
one code max, and a private code suppresses bulk; a 35% cap on the percent stack
only; fixed codes bounded by the floor only; add-ons applied after discounts and
outside the cap and floor; integer cents, rounded half-up. Single source:
`src/lib/stripe/pricing.ts`.

**D2 (2026-07-13) — Canadian clients pay GST/HST at the full provincial rate.**
ON 13%, NS 14%, NB/NL/PE 15%, everywhere else 5% GST; no PST/QST. Non-Canadian
buyers are zero-rated. Computed in `src/lib/stripe/pricing.ts` from a billing
country + province select on the order form — deliberately not Stripe Tax — with
`tax_cents` and the buyer's location persisted on the order row.

**D5 — "Returning client" means any prior *paid* Project** (`paid_at` set);
delivery is not required. Implemented as `hasPriorPaidProject`.

**D6 — Single-use codes are consumed on confirmed payment** (webhook finalize).
Reserve-at-checkout plus restore-on-abandon stays as the concurrency mechanism —
a hold, not a consumption.

**D-floor-private — Private codes may price below the $225/song floor**, via an
explicit per-code override flag set at creation (`allow_below_floor`). The floor
remains the default everywhere else.

**D11 — The welcome discount is 15%** (it replaced a 50% launch promo). The
advertised copy and the charged constant come from the same
`WELCOME_DISCOUNT_PCT`, and enforcement is code-based.

**D13 (2026-07-14) — Transactional mail ships from the existing
`noreply@nova-spatial.com` Resend sender.** Buying an inbox provider or subdomain
is a non-repo ops item; swapping later is config-only.

**Rush availability (2026-07-14) — none.** Rush is always purchasable at
checkout; if the studio cannot meet the 48h window they contact the client or
refund the rush fee manually. No admin toggle, no availability gate. The T&C's
"subject to availability" is the backstop.

**D-revisions (2026-07-14) — revision rounds are not tracked in-portal.** The
studio handles them manually at engineer discretion, and post-order extra
revisions are invoiced manually rather than purchasable in-portal. The order-time
`extra_revision` add-on is the only in-portal revision product.

**D-refund (2026-07-14) — refunds are issued manually through the Stripe
dashboard.** Nothing is built in-portal; revisit only if volume demands. Note
what this does and does not settle: it fixes the **mechanism**, not the
**policy** — under what circumstances a client is entitled to a refund has never
been decided, and that is what the Terms clause in #55 still needs.

**D7 (2026-07-14) — audio is purged 90 days after delivery**, by a Vercel Cron,
covering stems and deliverables both (engineers keep local copies). Since the
2026-07-25 removal of the `deliverables` table, "deliverables" maps to mix-type
`project_files`, so the purge covers stem + mix rows; `master_ref` stays, and
comment attachments stay (they are conversation, not delivery). Implemented in
`src/lib/portal/retentionPurge.ts`.

**D7b (2026-07-26) — the purge keeps the project row as a tombstone.** Stored
audio is removed and `files_purged_at` stamped, while the order, consent, and tax
fields stay: per D1 the row *is* the order, so a hard delete would destroy the
financial and consent trail.

**D8/D9/D10 — SEO.** The OG image is the first inline image, falling back to
`/og-image.jpg`; share images render through `next/og` on the Node runtime; the
canonical origin is the apex `https://nova-spatial.com`.

## Consequences

- These are citable again. Code comments may reference `D7`, `D-refund`, and the
  rest without sending the reader to `git log`.
- The distinction D-refund draws — mechanism answered, policy not — is the single
  most load-bearing line here for #55.
- **D12** (a Nova Studios architecture question gating a separate site port) was
  never answered and is deliberately not restored: it gates nothing in this repo.
