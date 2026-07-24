# Studio project archive

Date: 2026-06-24

Goal: let the studio clear finished projects off its dashboard without deleting anything — reversible, and invisible to the client.

A migration added the archived_at column and its index, and the Project type and RLS-aware queries were extended so archived projects drop out of the main studio dashboard and the new-project count. Archiving is a studio-only POST/DELETE route, with co-located tests covering the auth, not-found, success, and failure paths.

A new /portal/archived page lists archived projects and restores them, and ProjectCard and ProjectList gained the archive/unarchive controls with success messaging. The client's own view of a project is untouched throughout. Landed as 1 atomic feat(portal) commit.
