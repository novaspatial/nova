# Sitemap, robots, and IndexNow for the blog

Date: 2026-06-26

Goal: let search engines find exactly the public site — and hear about blog changes the moment they happen — while the private surface stays invisible.

Sitemap and robots: the sitemap lists the marketing pages and every published post, drawn from the same published-only query the blog renders with, so it can never advertise a URL the site would 404 and drafts never appear. Every address is absolute from the canonical-host source, and each post carries a last-modified date from its update time. The robots file allows the public site, disallows the whole non-public surface (APIs, auth routes, client portal, blog admin), and names the sitemap. Robots is static; the sitemap is generated per request, so it's fresh the moment a post publishes or comes down.

IndexNow: publishing, updating, or taking down a post now quietly tells the participating engines to recrawl. It hangs off the single publish hook rather than any individual save path, and is best-effort by contract — never blocks, never throws, does nothing until a key is configured, so dev and preview stay silent. The hook now tracks whether the post was live before the change, so unpublishing or deleting a previously-live post still notifies engines its URL is gone; a never-public post never pings. The verification key is served from 1 place, driven by an env var, and referenced back to that location in each ping. This reaches Bing, Yandex, Seznam, Naver, and Yep; Google doesn't participate and relies on robots + sitemap instead, noted in the code so expectations stay correct.

Tests cover the sitemap and robots output, the notification module (no-op without a key, correct payload, failures logged but never thrown), the key endpoint, and the hook's full fire-or-skip matrix across publish, edit, unpublish, delete, rename, and draft. Suite, lint, and production build pass; the build registers the 3 new routes.
