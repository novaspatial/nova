# Agent tooling & project documentation foundation

**Date:** 2026-06-24 · **Commits:** `476470f`, `8b23eb5`, `bd5825a`

Stood up the repository's agent and documentation foundation. Integrated the Matt
Pocock skill set (codebase-design, tdd, grilling, domain-modeling, and related
skills) into the workflow, with a lockfile pinning each skill to its source.

Authored a comprehensive set of development markdown files — CLAUDE.md (working
conventions), ARCHITECTURE.md (system structure, auth/RLS, storage, payments),
CONTEXT.md (domain glossary), and supporting ADRs and agent docs under `docs/` — and
expanded the README into a proper project overview. Translated the `devplan.docx`
planning document supplied by Jamie Kuse into a sequenced, issue-by-issue
development plan.

Tooling and binary artifacts were gitignored to keep the tree clean.
