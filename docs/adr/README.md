# Architecture Decision Records

Short records of decisions that are **hard to reverse**, **surprising without context**, and the result of a **real trade-off**. Each one captures *that* a decision was made and *why*, so a future reader doesn't undo it by accident.

New ADRs use the next sequential number: `NNNN-slug.md`.

| ADR | Decision |
| --- | --- |
| [0001](./0001-native-supabase-audio.md) | Native Supabase audio playback and comments (Samply removed) |
| [0002](./0002-rls-first-authorization.md) | RLS-first authorization, with app-layer checks as defense-in-depth |
| [0003](./0003-signed-url-direct-storage.md) | Direct-to-storage uploads via signed URLs (register → PUT → confirm) |
| [0004](./0004-stripe-payment-gating.md) | Stripe gates project work; first-mix discount reserved atomically |
