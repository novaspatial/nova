# Agent tooling and project documentation foundation

Date: 2026-06-24

Goal: make the repo a place an agent (or a new human) can work without tribal knowledge — every convention, decision, and plan written down and discoverable.

Installed the Matt Pocock skill set (codebase-design, tdd, grilling, domain-modeling, and related skills) with a lockfile pinning each skill to its source, so the setup can be reproduced exactly.

Wrote the core docs: CLAUDE.md (working conventions), ARCHITECTURE.md (system structure — auth and RLS, storage, payments), CONTEXT.md (domain glossary), plus the ADRs and agent docs under docs/. The README grew from a stub into a real project overview, and Jamie Kuse's devplan.docx was turned into a sequenced, issue-by-issue development plan. Tooling and binary artifacts were gitignored to keep the tree clean.
