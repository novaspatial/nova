Marketing site accessibility and polish

Date: 2026-06-25. Phase: Faz 0

Accessibility and polish across the marketing site, in three strands: a new primitive, a motion overhaul, and a copy pass. An accessible Checkbox primitive was added on React Aria, and the Footer's legal-link structure was extracted into a dedicated nav seam, which reduces the still-to-come terms-and-conditions task to wiring.

Motion was reworked around prefers-reduced-motion. FadeIn now reveals via opacity, rising from roughly 0.4 to 1 over 0.35 seconds, and snaps straight to full opacity under reduced motion rather than only dropping the y-translate as before. A global prefers-reduced-motion media block sets animation to none on six infinite keyframes — marquee, border-flow, the nav-highlight and nav-bg pair, gradient-shimmer, and hero-glow — along with the decorative pulse, ping, and bounce, while the functional spin is retained. GridPattern stays, since the owner deems it critical, but its JavaScript hover-trail is now gated behind useReducedMotion.

The copy pass lifted secondary text from zinc-400 to zinc-300 at 18 pixels across HowItWorks, Services, and FAQ, and the hero gained the "Juno and Emmy Award-winning engineers" credential set with text-balance. Build and lint are clean.
