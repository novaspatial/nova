# Terms page and required checkout consent

Date: 2026-07-04

Goal: close the top launch debt — checkout had taken real money since July 2 with no terms and no record of consent.

The /terms page (server component on the about-page shell, linked from the Footer legal group and the sitemap) carries a minimal, neutral first draft — accurate clauses only, no refund policy yet, no stem-prep guide link. src/lib/legal/terms.ts holds TERMS_VERSION as the single source of truth: bump it on any material copy change and every new order must re-consent. Migration 20260704_record_terms_consent adds terms_accepted_at and terms_version to projects and extends the enforce_studio_only_order_fields freeze trigger to cover them; applied and verified on the remote.

Consent is captured at order time and can't be faked or rewritten after. NewProjectForm blocks submit until the required checkbox is ticked and echoes the displayed version; the checkout route rejects with 400 unless it matches the current TERMS_VERSION — before any Stripe or discount-reservation side effect, so a rejection never creates a PaymentIntent or burns the first-mix code. The server records its own version and timestamp (never the client's) through the shared orderFields, so both the real Stripe and dev-bypass paths persist it. The freeze trigger then makes consent immutable: an owner rewriting terms_accepted_at is blocked with 42501, verified on the remote in a rolled-back transaction.

4 new tests (3 version-gate rejections, 1 submit-blocked-until-consent), plus updated insert-assertion and sitemap expectations. Suite 507, lint/types/build clean. The copy is a first draft pending legal; the version bump re-collects consent when the final wording — including refunds — lands.
