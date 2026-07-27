# 2026-07-27 — Vercel access recovered; IndexNow + purge cron live, dev bypass evicted

Got into the prod Vercel team today — the access #33 was blocked on. Set `INDEXNOW_KEY` and `CRON_SECRET` in Production, flipped the domain to match D10 (`nova-spatial.com` is now primary, `www` 308s to it — it was backwards, which is why the key URL 404'd), and redeployed.

The key still 404'd at first: the variable had been pasted as a file-type value, so the app never saw a plain string. Re-added as plain text (non-Sensitive — the key is public by design) and `/indexnow-key.txt` now returns 200. The purge cron is confirmed armed without running it: a wrong bearer gets 401 instead of the no-secret 500. Also gave `pingIndexNow` a 1-line success log so an accepted ping actually shows up in the logs.

Find of the day: `PAYMENTS_DEV_BYPASS` was defined in Production+Preview — the switch that skips Stripe and creates $0 "paid" projects. Its value was unreadable (Sensitive) and probably never `'true'`, but it has no business in prod. Deleted.

Verified later the same day: a no-op re-save of the published post in `/blog/admin` fired `[indexnow] ping accepted` 202, the engine fetched `/indexnow-key.txt` (200) to validate the key, and a second save got a 200 — #33 closed, all 4 boxes ticked. The Analytics + Speed Insights toggles turned out to be on too (both `/_vercel/*/script.js` endpoints serve 200 in prod). The Owner-invite idea died: Hobby has no team invites (Pro feature), so access stays via the client's account. Left: the GoDaddy delegate.
