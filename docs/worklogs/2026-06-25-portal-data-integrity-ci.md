Portal data integrity and CI hardening

Date: 2026-06-25. Phase: Faz 0

Three pieces of portal hardening: moving archive authorization into the database, closing a storage leak, and gating CI on the test suite. Archive authorization moved from app-layer checks down to the database itself. The 20260625 migration adds a Postgres trigger that rejects any non-studio write to projects.archived_at, enforced under RLS regardless of caller. It was verified against the live project — a client write returns 42501, insufficient privilege, while a studio write succeeds — and ARCHITECTURE.md and CLAUDE.md were updated to match.

Storage cleanup was extracted into projectCleanup.ts, covering stems, comment attachments, and deliverables. The project DELETE route now delegates to it, closing the comment-attachment leak where deleting a project used to leave orphaned objects behind in the bucket; the planned purge job will consume the same helper.

CI now runs npx vitest run after lint and build, so all roughly 42 co-located suites gate on every push and pull request.
