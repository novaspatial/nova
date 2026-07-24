# Portal data integrity and CI hardening

Date: 2026-06-25

Goal: make 3 guarantees hold even when the app layer is bypassed — only the studio can archive, deleting a project deletes all its files, and nothing lands on main without the tests passing.

Archive authorization moved into the database itself: the 20260625 migration adds a Postgres trigger that rejects any non-studio write to projects.archived_at, enforced under RLS regardless of caller. Verified against the live project — a client write fails with 42501 (insufficient privilege), a studio write succeeds. ARCHITECTURE.md and CLAUDE.md updated to match.

Storage cleanup was extracted into projectCleanup.ts, covering stems, comment attachments, and deliverables. The project DELETE route now delegates to it, closing the leak where deleting a project left orphaned comment attachments in the bucket; the planned purge job will reuse the same helper.

CI now runs npx vitest run after lint and build, so all ~42 co-located suites gate every push and pull request.
