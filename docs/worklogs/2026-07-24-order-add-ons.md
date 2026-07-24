# Order add-ons

Date: 2026-07-24

Goal: make the 2 add-ons the homepage calculator was already selling — extra revision round (+$50) and 48-hour rush (+$149) — actually purchasable: priced, persisted, tamper-proof, and visible to the studio (#19, 8ef8b14).

The order form grew an add-ons fieldset between the song count and reference tracks, seeded from the ?addons= prefill the page had been parsing and dropping; toggling feeds the live quote through computeOrderPrice, so the D4 order of operations (after discounts, outside cap/floor, taxed as part of the consideration) applies unchanged. Per the 2026-07-14 rulings nothing else was built: no rush availability gate, and post-order revisions stay manually invoiced.

Checkout validates addOns strictly (400 on anything outside the union — the parser filters silently, the payment boundary rejects), de-dupes into canonical ADD_ON_VALUES order, prices through the same quote → discount → tax → charge path, and persists the array in a new projects.add_ons text[] column (20260724 migration, applied to the remote: containment CHECK, no default — null keeps meaning pre-#19 rows, [] means none selected — and the order-field freeze trigger widened to 15 columns). The intent metadata now carries add_ons (always stamped; '' = none, absent = pre-#19 intent), and the payment-status poll verifies it against the row fail-closed, exactly like song_count — so a forged pending row can't bolt a rush onto a rush-less paid intent.

Display landed on all 3 surfaces: QuoteBreakdown already had the line, PaymentStep gained one (a charge row, no discount strikethrough), and the project details card lists purchased add-ons first — a 48-hour rush is the first thing the studio sees on open, which the T&C's contact-or-refund fallback depends on. ADD_ON_VALUES/ADD_ON_LABELS hoisted into the pricing module as the single source for the parser, calculator, form, and card. 15 new tests across checkout, payment-status, form, and PaymentStep; suite (804), lint, and build green; remote column and trigger verified via SQL probe.
