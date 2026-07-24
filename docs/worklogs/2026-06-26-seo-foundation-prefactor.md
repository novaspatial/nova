# SEO automation foundation — site origin and publish hook

Date: 2026-06-26

Goal: give the coming blog and SEO automation 2 stable attachment points — 1 source of truth for the site's address, and 1 hook where all publish side effects live. The canonical host was settled first: the bare domain, no www (www redirects at the infrastructure layer), matching the project and email domain.

src/lib/site.ts now exports the canonical origin — from NEXT_PUBLIC_SITE_URL, falling back to the bare domain, trailing slash stripped — plus the site name and an absolute-URL helper. The root layout reads from it instead of a hardcoded www literal, and the variable is documented in the example env file. The sitemap, robots file, search-engine pings, per-post social-image URLs, and share-image route will all draw the host from here.

The blog publish side effects — previously duplicated as cache-revalidation calls in the create route plus a near-copy in update/delete — collapsed into 1 shared hook, onPostMutated, given the post's type, slug, and published state. Future publish-time effects like the search-engine notification attach there without touching the routes again. Cache behavior is preserved exactly: creating a draft refreshes only the blog index (no public page exists yet), while updating or deleting also refreshes the post's own page and handles both old and new slug on rename.

Co-located tests cover the env-variable handling and every revalidation branch; build, lint, and affected tests pass.
