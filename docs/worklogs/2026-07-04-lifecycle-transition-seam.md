# 2026-07-04 — Lifecycle transition guards

The portal had no rules for which project stage may move where: an owner could drag a delivered project back to review (firing a bogus "files received" email), the studio side accepted any jump, and — worse than the ticket said — a client could skip the site entirely and set any stage straight on the database, including making an unpaid project look paid to upload files for free.

Fixed with 1 central rulebook of legal moves that every route, button, and email now reads — 5 conflicting stage lists deleted — plus a matching database lock, so even direct access allows a client only the 1 intended move: handing a finished upload over for review. 4 judgment calls were settled with Onur up front: build as scoped, lock the database too, drop the send-for-review button from the stage where no mix can exist yet, keep a studio-only shortcut for advancing a stalled client. 2 leftover holes (faking a paid project at creation time; the payment-check fallback quietly broken since July 2) were filed as their own tickets.

Proven with 580 passing tests and a live rehearsal: throwaway account, $0 test order, the full flow walked through, the old cheats bouncing off, every trace deleted after. The order-confirmation email and the file purge can now read the rulebook instead of inventing their own lists.
