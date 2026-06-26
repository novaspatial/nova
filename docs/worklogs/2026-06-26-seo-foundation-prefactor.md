SEO automation foundation — site-origin source and publish hook

Date: 2026-06-26

Built the shared groundwork that the blog and SEO automation work attaches to, after settling the canonical host: the site commits to the bare domain, with no www, matching the project and email domain. The www form redirects to it at the infrastructure layer.

Created one source of truth for the site's official address. A new module, src/lib/site.ts, exports the canonical origin — driven by the NEXT_PUBLIC_SITE_URL environment variable, with a fallback to the bare domain and any trailing slash stripped — along with the site name and a small helper for building absolute URLs from a path. The root layout now reads the origin from this module instead of a hardcoded www literal, and the variable is documented in the example env file. The sitemap, robots file, search-engine pings, per-post social-image URLs, and the share-image route will all draw the host from here.

Consolidated the blog publish side effects, which had been duplicated as cache-revalidation calls in the create route plus a near-identical local helper in the update and delete route. All three admin save paths now call one shared hook, onPostMutated, given the post's type, slug, and published state. That hook is the single place future publish-time side effects, such as the search-engine notification, will attach without touching the routes again. The existing cache behavior is preserved exactly: creating a draft refreshes only the blog index, since no public page exists yet, while updating or deleting also refreshes the post's own page and handles both the old and new slug when a post is renamed.

Added co-located tests for both new modules, covering the environment-variable handling and every revalidation branch. The build, lint, and affected tests all pass.
