# Vercel Analytics and Speed Insights

Date: 2026-07-27

Wired both Vercel measurement packages into the root layout: `@vercel/analytics` (page views) and `@vercel/speed-insights` (Core Web Vitals), one component each beside `{children}`, so they cover the marketing site and the portal alike. No config beyond the 2 imports — both packages detect the Vercel environment on their own.

Nothing else had to move. In production both scripts load and beacon same-origin under `/_vercel/insights/*` and `/_vercel/speed-insights/*`, which the CSP's existing `'self'` directives already cover (and the header is still Report-Only regardless), so `next.config.mjs` is untouched.

Both are inert until their per-project toggles are flipped in the Vercel dashboard — free on the Hobby tier, but the dashboard sits with the client's account, the same access gate holding #33 and the #27 cron. Until then the components render nothing and send nothing. Lint and build green; no schema change.
