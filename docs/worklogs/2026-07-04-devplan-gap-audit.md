Devplan gap audit — 3 missed slices found; plan rewritten around 20 open issues

Date: 2026-07-04.

Checked `devplan.docx` line by line against every open issue (160 atomic items, each gap double-checked). Most already covered, some deliberately excluded, and the rest became 3 new issues, 2 decision items, and a few smaller notes.

New issues cover: checkout still charging no tax (the field is an unowned stub); the drafted terms-and-conditions page referencing a stem-prep guide that doesn't exist yet; and IndexNow being dead in production while the live redirect contradicts an earlier decision. Also flagged: whether private discount codes can go as low as the devplan wants (the shipped price floor currently blocks that), and how revision tracking should work given the terms' "used or waived" language, which nothing tracks today. A few smaller notes went on other open issues.

Biggest change: the terms-and-conditions work jumped to the front of the queue, since checkout has taken real payments with no terms in place since July 2nd. A same-day architecture review also filed six refactor issues, one of which doubles as a real bug (illegal status jumps during upload finalization). The dev plan doc itself was rewritten agent-first around all this: a goal statement, a "now" queue of unblocked work, decision-gated chains after it, constraints written inline, refactors slotted into the path, and the old history compressed to a table.
