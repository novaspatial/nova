# Blog long-read overhaul

Date: 2026-06-25

Goal: make long posts comfortable to read and fix 2 rendering problems on the post page, clearing the way for the per-post SEO work.

Typography first: the reading column narrowed from 768 to 660 px (max-w-165), body line-height set to ~1.7, H2s raised to 32 px (--text-4xl) with more top margin, and blockquotes got their own styling. An apple-music fenced shortcode now renders as a callout card.

2 structural fixes followed. The first inline image is split out via extractHeroImage and rendered once as a priority next/image hero before the first H2, eliminating the GrayscaleTransitionImage double-paint. The nav pill now hides on scroll-down and returns on scroll-up (useScroll + useReducedMotion), and the byline name was separated from the role. The "duplicate footer H2" turned out to be bad content, not code — the first H2 was fused to the byline paragraph — and was corrected in Supabase so it renders once.
