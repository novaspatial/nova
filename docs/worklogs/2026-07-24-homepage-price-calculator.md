# Homepage price calculator

Date: 2026-07-24

Goal: let a visitor price their mix on the homepage with the exact numbers checkout will charge (#30), and carry that configuration straight into the order form.

A Price Your Mix section now sits between the testimonials and the how-it-works walkthrough: a song-count stepper, add-on checkboxes, and a live pre-tax breakdown — every figure from computeOrderPrice, the same module the charge uses. The calculator prices the quote twice, with and without the welcome code, and shows the 15% offer only when it strictly beats the album discount; from 3 songs the bulk tier ties or wins, the welcome line drops out, and a caption says so. The marketing CTAs in Services and How It Works now land on /#pricing instead of dropping visitors straight into the portal.

Start Your Project deep-links the configuration into /portal/new?songs=…&addons=…&code=… (the code rides along only when it wins), and the params survive the login redirect through middleware's ?next=. They're parsed server-side (parseNewProjectParams — clamped and validated, invalid values dropped silently since checkout re-validates everything anyway) and seed the order form's stepper and code field; a prefilled code is honored at submit without pressing Apply. Add-ons are parsed and their contract pinned by tests, but stay unconsumed until #19 wires them into the form.

3 extractions keep the 2 surfaces from drifting: the form's quote render became the shared QuoteBreakdown (now with an add-ons line), the custom stepper became the NumberInput primitive, and MAX_SONG_COUNT moved into the pricing module so the form, the checkout route, the calculator, and the parser share 1 clamp. New tests cover the welcome comparison, the deep-link contract, the parser edges, and the prefill; suite, lint, and build green.
