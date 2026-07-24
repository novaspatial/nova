# Pricing approval — module finalization and tracker records

Date: 2026-07-02

Goal: turn the pricing sign-off into finished code and an accurate tracker, so the checkout slice can start on solid ground. Mike and Jamie approved the per-song pricing; Mike ruled the tax policy (Canadian clients pay GST, not PST) and Jamie asked for the price calculator to start the new-project flow and replace the homepage's static call-to-action.

The module was finalized per the parked plan, with 2 defensive fixes: percent codes clamped to 0–100 (a negative code could inflate the price above list) and add-ons de-duplicated. Tests grew from 3 to 44, including a 405-point invariant grid. Lint, the full 461-test suite, and type-check stayed clean.

Tracker: the decisions issue records the approval, the tax ruling, and a new question for Mike (HST provinces make "GST yes, PST no" ambiguous). The pricing issues were closed against the commits — the pure-math one retitled CAD → USD floor — plus 2 stale June-shipped issues (per-post SEO, share image), and Jamie's calculator request was filed as a new issue. Docs: CI notes corrected, and known-gaps now names the 1 real gap — live checkout still charges the flat legacy price until the checkout slice rewires it.
