Pricing approval — module finalization and tracker records

Date: 2026-07-02.

Mike and Jamie approved the per-song pricing. Mike ruled the tax policy — Canadian clients pay GST, not PST — and Jamie asked for the price calculator to start the new-project flow and replace the front page's static call-to-action.

The module was finalized per the parked plan, with two defensive fixes: percent codes clamped to 0–100 (a negative code could inflate the price above list) and add-ons de-duplicated. Tests grew from 3 to 44, including a 405-point invariant grid. Lint, the full 461-test suite, and type-check stayed clean.

Tracker: the decisions issue records the approval, the tax ruling, and a new question for Mike (HST provinces make "GST yes, PST no" ambiguous). Pricing issues were closed against the commits — the pure-math one retitled CAD → USD floor — plus two stale June-shipped issues (per-post SEO, share image); Jamie's calculator request was filed as a new issue. Docs: CI notes corrected, and known-gaps now names the one real gap — live checkout still charges the flat legacy price until the checkout slice rewires it.
