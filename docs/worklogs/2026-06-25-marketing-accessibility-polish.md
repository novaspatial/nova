# Marketing site accessibility & polish

**Date:** 2026-06-25 · **Issues:** #2 (P4), #7 (S9), #8 (S9b) · **Phase:** Faz 0

Added an accessible `Checkbox` primitive (React Aria) and extracted the Footer's
legal-link structure into a dedicated nav seam, reducing the T&C task (#23) to
wiring.

Motion reworked for `prefers-reduced-motion`. `FadeIn` now reveals via opacity
(~0.4→1 over 0.35s) and snaps opacity to 1 instantly under reduced motion instead
of only dropping the y-translate. A global `@media (prefers-reduced-motion: reduce)`
block sets `animation: none` on six infinite keyframes (marquee, border-flow,
nav-highlight/-bg, gradient-shimmer, hero-glow) plus decorative pulse/ping/bounce;
functional `spin` is retained. GridPattern stays (owner deems it critical), so its
JS hover-trail is gated by `useReducedMotion()`.

Secondary copy lifted `zinc-400`→`zinc-300` at 18px across HowItWorks, Services, and
FAQ; hero gains the "Juno & Emmy Award-winning engineers" credential with
`text-balance`. Build and lint clean.
