Blog long-read overhaul

Date: 2026-06-25. Phase: Faz 0

A typography pass on the post layout, plus two structural fixes to how a post renders. The reading column was narrowed from 768 to 660 pixels (max-w-165), the body line-height set to roughly 1.7, the H2 raised to 32 pixels (--text-4xl) with added top margin, and blockquotes given their own styling. An apple-music fenced shortcode was added that the markdown renderer maps to a callout card. Together this unblocks the per-post SEO work.

The first structural fix splits the first inline image out via extractHeroImage and renders it once as a priority next/image hero before the first H2, eliminating the GrayscaleTransitionImage double-paint. The second hides the nav pill on scroll-down and restores it on scroll-up, driven by useScroll and useReducedMotion. The byline name was separated from the role. The duplicate footer H2 turned out to be malformed content rather than a code bug — the first H2 had been fused to the byline paragraph — and was corrected in Supabase so it now renders once.
