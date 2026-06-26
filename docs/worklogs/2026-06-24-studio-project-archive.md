# Studio project archive feature

**Date:** 2026-06-24 · **Commit:** `eb0f015`

Implemented and shipped the studio-side project archive feature end to end. Added an
`archived_at` migration (column plus index) and extended the `Project` type and
RLS-aware queries so archived projects drop off the main studio dashboard and the
new-project count.

Built a POST/DELETE archive route handler — studio-only, reversible, with co-located
tests covering auth, not-found, success, and failure paths — and a dedicated
`/portal/archived` page to list and restore them. Wired archive/unarchive controls
and success messaging into `ProjectCard` and `ProjectList`, leaving the client's
view untouched.

Started and finished within the session, committed as a single atomic
`feat(portal)` change.
