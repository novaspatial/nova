# Blog long-read overhaul

**Date:** 2026-06-25 · **Issues:** #10 (S11), #11 (S11b) · **Phase:** Faz 0

Typography pass on the post layout: reading column narrowed 768→660px
(`max-w-165`), body `line-height` ~1.7, H2 raised to 32px (`--text-4xl`) with added
top margin, and blockquote styling. Added an `apple-music` fenced shortcode that the
markdown renderer maps to a callout card. Unblocks per-post SEO (#20).

Two structural fixes. The first inline image is now split out via `extractHeroImage`
and rendered once as a priority `next/image` hero before the first H2, eliminating
the `GrayscaleTransitionImage` double-paint. The nav pill hides on scroll-down and
restores on scroll-up via `useScroll` + `useReducedMotion`. Byline name separated
from role. The duplicate footer H2 was malformed content (first H2 fused to the
byline paragraph), not a code bug — corrected in Supabase so it renders once.
