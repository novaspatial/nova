# Marketing site accessibility and polish

Date: 2026-06-25

Goal: make the marketing site respect reduced-motion users and lift its text to readable contrast, without losing the visual identity. Groundwork came first: an accessible Checkbox primitive on React Aria, and the Footer's legal links extracted into their own nav seam — so the upcoming terms-and-conditions page is just wiring.

Motion now honors prefers-reduced-motion. FadeIn reveals via opacity (~0.4 → 1 over 0.35 s) and snaps straight to full opacity under reduced motion, instead of only dropping the y-translate as before. A global media block disables the 6 infinite keyframes (marquee, border-flow, the nav-highlight/nav-bg pair, gradient-shimmer, hero-glow) plus the decorative pulse, ping, and bounce; the functional spin stays. GridPattern stays too — the owner considers it critical — but its JavaScript hover-trail is now gated behind useReducedMotion.

Copy: secondary text lifted from zinc-400 to zinc-300 at 18 px across HowItWorks, Services, and FAQ, and the hero gained the "Juno and Emmy Award-winning engineers" credential with text-balance. Build and lint clean.
