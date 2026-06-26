Commerce pricing foundation — pricing decisions and Project type sync

Date: 2026-06-26. Phase: Faz 1–2

Settled the three top-priority commerce decisions that block the order and checkout work, then started building against them.

The decisions:

Where orders live. An order is stored on its projects row (one order equals one project) rather than in a separate orders table, keeping the existing Stripe Elements and PaymentIntent flow intact.

Currency. Prices are listed in USD, with the per-song price floor expressed natively in USD, so no fixed-rate CAD conversion is needed.

The pricing algorithm. From a per-song list price, apply in order: bulk discount tiers for multi-song albums and EPs, one discount code per order (percentage or fixed; private codes turn off the bulk tier), an overall cap on the total percentage discount, a per-song price floor, and finally any add-ons (extra revision, rush delivery) layered on after discounts and exempt from the cap and floor. All math runs in integer cents with half-up rounding. The floor binds before the cap is reached, so the cap is a deliberate secondary safeguard rather than the rule that normally kicks in.

Type sync. With the storage decision fixed, the Project TypeScript type was aligned with the payment columns already added by migration. New order- and lifecycle-related fields are optional and nullable so existing select-star reads stay type-safe, and supporting types (Currency, AddOn, DiscountCode, PriceBreakdown) were added. Build and the full 344-test suite stayed green.

Pricing module. Drafted a pure computeOrderPrice function (order input in, price breakdown out) in src/lib/stripe/pricing.ts implementing the new algorithm; the legacy computePrice stays in use until the checkout slice switches over. An adversarial review confirmed the algorithm correct against every rule and flagged two defensive gaps: clamp percentage codes to a valid 0-to-100 range and de-duplicate add-ons. Finalizing the module (those two fixes, a roughly 30-case test suite, and a property-based invariant check) is parked pending manager approval; a ready-to-run coding-agent prompt captures it so it can be executed as-is once approved.
