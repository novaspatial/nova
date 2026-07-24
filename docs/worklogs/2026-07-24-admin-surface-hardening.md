# Admin surface hardening

Date: 2026-07-24

Goal: give /blog/admin the same protection and polish the rest of the private surface already has — edge auth, no search indexing, house UI — and drop the referral feature nobody used.

/blog/admin joined the middleware matcher, so it now gets what /portal and /profile always had: an edge redirect to login with ?next= and the noindex header that keeps it out of search results. Behind it the role check collapsed into 1 helper — requirePageStudioUser, redirecting non-studio users to the portal — used by the admin layout and, defense-in-depth, by the discount-codes page directly; RLS stays the enforcement floor underneath.

The admin screens moved onto the shared UI primitives: the blog post list extracted into a client AdminPostsList, both it and the discount-code list paginate at 5 per page through a new Pagination component, and the code form swapped native selects and checkboxes for the house Select (Headless UI Listbox), Checkbox, and NumberInput stepper, with its layout centered. Navigation reshuffled — the blog page's admin corner now links to both admin tools, and the discount-codes page backs out to the blog.

Referral attribution is gone end-to-end — form field, API parameter, list line, and the DiscountCode type — with the 20260724 migration dropping the column, applied to the remote (the lookup RPC never exposed it, so no grants or policies change). The only stored value was test data. Suite, lint, and build green.
