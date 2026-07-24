# Portal de-indexing and bare entry-point redirect (retro log)

Date: 2026-06-26 (logged retroactively on 2026-07-02)

Goal: get the private portal and profile pages out of Google, and stop search visitors landing on a bare login form.

The robots file already disallowed crawling, but a disallow doesn't remove an already-indexed URL — Google kept listing the bare portal URL with a generic snippet, and visitors who clicked it bounced off a login form. The middleware now attaches a noindex, nofollow header to every response on the private surface, including the redirects a crawler hits, so the URLs actually drop out of the index.

Signed-out visitors hitting the bare portal or profile entry points — typed, bookmarked, or found in search — are sent to the public home page, where they meet the marketing site and can log in from the navbar. Deeper links, like the per-project review link emailed to clients, keep the login-then-return flow, so a client still lands on the exact page they were sent. Shipped with updated middleware tests covering the new header and both redirect behaviors.
