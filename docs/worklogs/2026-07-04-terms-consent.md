T&C page + required checkout consent

Date: 2026-07-04.

Closed the top launch-debt: priced checkout has taken real money since July 2 with no terms and no consent record. Added a `/terms` page (server component on the about-page shell, linked from the Footer legal group and the sitemap) with a minimal, neutral first draft — accurate clauses only, no refund policy yet and no stem-prep guide link. `src/lib/legal/terms.ts` holds `TERMS_VERSION` as the single source of truth; bumping it on any material copy change forces re-consent. Migration `20260704_record_terms_consent` adds `terms_accepted_at` and `terms_version` to `projects` and extends the `enforce_studio_only_order_fields` freeze trigger to cover them; applied and verified on the remote.

Consent is captured at order time. `NewProjectForm` gates submit on a required checkbox and echoes the displayed version; the checkout route rejects with 400 unless it matches the current `TERMS_VERSION` — before any Stripe or discount-reservation side effect, so a rejection never creates a PaymentIntent or burns the first-mix code. The server records its own version and timestamp, never the client value, through the shared `orderFields`, so both the real Stripe and dev-bypass paths persist it. The freeze trigger then makes consent immutable: an owner trying to rewrite `terms_accepted_at` is blocked with `42501`, verified on the remote in a rolled-back transaction.

Four new tests (three version-gate rejections, one submit-blocked-until-consent), plus updated insert-assertion and sitemap expectations. Full suite 507, lint/types/build clean. The copy is a first draft pending legal; the version-bump mechanism re-collects consent when the final wording — including refunds — lands.
