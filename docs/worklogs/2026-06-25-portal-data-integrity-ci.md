# Portal data integrity & CI hardening

**Date:** 2026-06-25 · **Issues:** #12 (S16), #3 (P5) · **Phase:** Faz 0

Archive authorization moved from app-layer checks to the database. The `20260625`
migration adds a Postgres trigger that rejects any non-studio write to
`projects.archived_at`, enforced under RLS regardless of caller. Verified against
the live project: client write returns `42501` (insufficient privilege), studio
write succeeds. ARCHITECTURE.md and CLAUDE.md updated to match.

Storage cleanup extracted into `projectCleanup.ts`, covering stems, comment
attachments, and deliverables. The project DELETE route now delegates to it,
closing the comment-attachment leak where deleted projects left orphaned objects in
the bucket; the planned purge job (#27) consumes the same helper.

CI (`main.yml`) now runs `npx vitest run` after lint and build, gating all ~42
co-located suites on every push and PR.
