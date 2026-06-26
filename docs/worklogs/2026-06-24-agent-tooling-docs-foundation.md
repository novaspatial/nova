Agent tooling and project documentation foundation

Date: 2026-06-24

Stood up the repository's agent and documentation foundation in a single pass. Integrated the Matt Pocock skill set — codebase-design, tdd, grilling, domain-modeling, and the related skills — into the workflow, with a lockfile that pins each skill to its source so the set can be reproduced.

Authored a comprehensive set of development markdown files: CLAUDE.md for working conventions, ARCHITECTURE.md for system structure (auth and RLS, storage, payments), CONTEXT.md for the domain glossary, and the supporting ADRs and agent docs that live under docs/. The README grew from a stub into a proper project overview. The devplan.docx planning document supplied by Jamie Kuse was translated into a sequenced, issue-by-issue development plan. Tooling and binary artifacts were gitignored to keep the tree clean.
