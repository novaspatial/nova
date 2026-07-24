Admin surface hardening

Date: 2026-07-24.

`/blog/admin` joined the middleware matcher, so the admin surface now gets what `/portal` and `/profile` always had: an edge redirect to login with `?next=` and the noindex header that keeps it out of search results. Behind it the role check collapsed into 1 helper — `requirePageStudioUser`, redirecting non-studio users to the portal — used by the admin layout and, defense-in-depth, by the discount-codes page directly; RLS stays the enforcement floor underneath.

The admin screens moved onto the shared UI primitives. The blog post list extracted into a client `AdminPostsList`, and both it and the discount-code list paginate at 5 per page through a new `Pagination` component. The discount-code form swapped native selects and checkboxes for the house `Select` (Headless UI Listbox) and `Checkbox`, its number fields for the `NumberInput` stepper, and centered its layout. Navigation reshuffled: the blog page's admin corner now links to both admin tools, and the discount-codes page backs out to the blog.

Referral attribution is gone end-to-end — form field, API parameter, list line, and the `DiscountCode` type — with the `20260724` migration dropping the column (the lookup RPC never exposed it, so no grants or policies change), applied to the remote. The only stored value was test data. Suite, lint, and build verified green.
