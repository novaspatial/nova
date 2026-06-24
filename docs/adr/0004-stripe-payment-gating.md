# Stripe payment gates project work; first-mix discount reserved atomically

A Project starts in `pending_payment` and cannot accept stems until paid. Checkout creates a Stripe PaymentIntent and the project transitions to `uploading` only when payment confirms — driven by the signature-verified Stripe webhook (idempotent on `paid_at`), with a client-side `payment-status` poll that reconciles against Stripe as a fallback.

The one-time first-mix discount is **reserved atomically** at checkout via the `reserve_first_mix_discount` RPC (flipping the profile flag true→false in one statement) to prevent two concurrent checkouts from both claiming it; an abandoned/deleted unpaid project calls `restore_first_mix_discount` to return it. A `PAYMENTS_DEV_BYPASS` flag skips Stripe entirely in local dev, creating paid $0 projects.

These choices are recorded because the webhook-plus-poll reconciliation, the RPC-based discount reservation, and the dev bypass are non-obvious and easy to break: payment state must stay idempotent, and the discount flag must never be consumed without a corresponding paid project.
