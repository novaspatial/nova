Studio project archive feature

Date: 2026-06-24

Implemented and shipped the studio-side project archive feature end to end in a single session. A new migration adds the archived_at column and its index, and the Project type and the RLS-aware queries were extended so archived projects drop off both the main studio dashboard and the new-project count.

The archive itself is a studio-only POST/DELETE route handler, reversible by design, with co-located tests covering the auth, not-found, success, and failure paths. A dedicated /portal/archived page lists archived projects and restores them, and the archive and unarchive controls plus their success messaging were wired into ProjectCard and ProjectList. The client's own view of a project is left untouched throughout. The whole change landed as a single atomic feat(portal) commit.
