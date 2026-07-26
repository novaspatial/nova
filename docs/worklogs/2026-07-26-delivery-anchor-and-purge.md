# Delivery anchor + 90-day purge; hosting access blocked

Date: 2026-07-26

Decisions landed and #27 shipped. Onur ruled D7b as tombstone: 90 days after delivery the client's audio (stems + mixes) is deleted, but the project record stays — it holds the order, tax, and consent history. The portal now records the delivery date the moment a project is marked delivered, and a daily scheduled job cleans up projects past the window and marks them purged. 14 new tests, full suite green, DB change applied to the remote. Same day #36 and #42/#43 got their triage go.

1 catch: the cleanup job can't switch on in production yet. While activating IndexNow (#33) we discovered nobody on our side can sign in to the hosting — the Vercel account running nova-spatial.com, its DNS, and the GoDaddy account for the domain are all tied to Mike's personal email, and the old GitHub sign-in route closed when that login got attached to Jamie's Vercel account. There is no workaround without the client, because the DNS lives in the same locked account.

An email to Mike (cc Jamie) went out asking for two small favours: forward a one-time sign-in code, and grant the studio delegate access in GoDaddy. Once we're in: turn on IndexNow, fix the www/apex redirect, set the secret that activates the purge job, and set up permanent studio access so this can't happen again. Waiting on their reply.
