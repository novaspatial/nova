Portal de-indexing and bare entry-point redirect (retro log)

Date: 2026-06-26 (logged retroactively on 2026-07-02)

Protected portal and profile pages were showing up in Google. The robots file disallows crawling them, but a disallow does not remove an already-indexed URL — Google kept listing the bare portal URL with a generic snippet, and visitors who clicked it bounced straight onto a bare login form.

The middleware now attaches a noindex, nofollow header to every response on the private surface, including the redirects a crawler hits, so the URLs actually drop out of the index. Signed-out visitors who hit the bare portal or profile entry points — typed, bookmarked, or found in search — are sent to the public home page, where they meet the marketing site and can log in from the navbar when ready. Deeper links, such as the per-project review link emailed to clients, keep the login-then-return flow so the client still lands on the exact page they were sent after signing in.

Shipped with updated middleware tests covering the new header and both redirect behaviors. This log backfills work that landed after that day's other entries were written.
