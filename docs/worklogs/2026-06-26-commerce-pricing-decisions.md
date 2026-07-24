# Commerce pricing decisions and Project type sync

Date: 2026-06-26

Goal: unblock the order and checkout work by settling the 3 pricing decisions it hangs on, then start building against them.

The decisions: (1) an order lives on its projects row — 1 order = 1 project, no separate orders table — so the existing Stripe Elements and PaymentIntent flow stays intact; (2) prices are listed in USD with the per-song floor natively in USD, so no fixed-rate CAD conversion; (3) the pricing algorithm applies, in order: bulk discount tiers for multi-song orders, 1 discount code per order (percentage or fixed; private codes turn off the bulk tier), a cap on the total percentage discount, a per-song price floor, then add-ons (extra revision, rush) after discounts and exempt from cap and floor. All math runs in integer cents with half-up rounding. The floor normally binds before the cap, so the cap is a deliberate backstop, not the everyday rule.

Built against them: the Project type was aligned with the payment columns already added by migration — new order and lifecycle fields optional and nullable so existing select-star reads stay type-safe — plus supporting types (Currency, AddOn, DiscountCode, PriceBreakdown). A pure computeOrderPrice (order in, price breakdown out) was drafted in src/lib/stripe/pricing.ts; the legacy computePrice stays live until checkout switches over. An adversarial review confirmed the algorithm against every rule and flagged 2 defensive gaps for finalization: clamp percentage codes to 0–100 and de-duplicate add-ons. Finalization — those fixes, ~30 test cases, and a property-based invariant check — is parked pending manager approval, captured as a ready-to-run agent prompt. Build and the 344-test suite stayed green.
