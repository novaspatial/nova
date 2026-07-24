# Payment-write hardening: creation fence and service-side claim

Date: 2026-07-08

Goal: close the 2 payment-write holes the lifecycle work uncovered — live on checkout since July 2 — so a project can't be born looking paid and a slow webhook can't strand a paying client.

The holes: a client could create a project straight on the database already looking paid (the 2 existing locks guard edits, not creation), then upload stems for free. And the fallback that confirms payment when the Stripe webhook is slow had been dead since the freeze — it wrote the paid timestamp as the signed-in client, which the freeze rejects — so paid clients sat waiting until the webhook landed.

The fix adds a 4th lock, a creation-time fence: a client may only create a project unpaid and pending, while the payment system (service credentials) and the studio pass through. The dead fallback and the dev-only $0 checkout both moved onto the service credentials the webhook already uses, and the 1 idempotent claim write — paid timestamp, legal-edge advance, safe when webhook and poll race — now lives in 1 shared module both paths call. The poll also checks the Stripe intent belongs to this exact project, not merely this client, closing a reuse angle the service move would have opened.

Proven with 596 passing tests and a live rehearsal: 8 rolled-back probes on the remote confirmed each rule, then a throwaway account replayed the attack over HTTPS — every forged creation came back 403, the legitimate order went through unpaid, the self-claim bounced, every trace deleted after. An adversarial review caught that nulling a field sidestepped the reuse cross-check; tightened to fail closed. 2 narrower residuals were filed rather than folded in: resurrecting a deleted paid project by re-attaching its freed Stripe intent id, and direct database inserts skipping the checkout rate limit and consent gate.
