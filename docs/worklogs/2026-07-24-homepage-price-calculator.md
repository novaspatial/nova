Homepage price calculator

Date: 2026-07-24.

The homepage now quotes real prices (#30): a Price Your Mix section between the testimonials and the how-it-works walkthrough, with a song-count stepper, add-on checkboxes, and a live pre-tax breakdown — every figure from `computeOrderPrice`, the module the checkout charge uses. The calculator computes the quote twice, with and without the welcome code, and prices the 15% offer into the breakdown only when it strictly beats the album discount; from 3 songs the bulk tier ties or wins, the welcome line drops out, and a caption says so. The marketing CTAs in Services and How It Works now land on `/#pricing` instead of dropping visitors straight into the portal.

Start Your Project deep-links the configuration into `/portal/new?songs=…&addons=…&code=…` (the code rides along only when it wins), and the params survive the login redirect through middleware's `?next=`. They're parsed server-side in the page (`parseNewProjectParams` — clamped and validated, invalid values dropped silently since checkout re-validates everything anyway) and seed the order form's stepper and code field; a prefilled code is honored at submit without pressing Apply. Add-ons are parsed and their contract pinned by tests, but stay unconsumed until #19 wires them into the form.

Three extractions keep the 2 surfaces from drifting: the form's quote render became the shared `QuoteBreakdown` (now with an add-ons line), the custom stepper became the `NumberInput` primitive, and `MAX_SONG_COUNT` moved into the pricing module so the form, the checkout route, the calculator, and the parser share 1 clamp. New tests cover the welcome comparison, the deep-link contract, the parser edges, and the prefill; suite, lint, and build verified green.
