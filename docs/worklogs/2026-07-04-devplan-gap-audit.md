Devplan gap audit — 3 missed slices found

Date: 2026-07-04.

Re-compared `devplan.docx` line-by-line against the issue set (160 atomic items extracted by a multi-agent sweep; candidate gaps adversarially verified from 3 lenses each): 117 covered, 27 deliberately excluded, and the rest resolved into 3 new issues, 2 new decision items, and 6 issue notes.

New issues: #31 (S21) — no open issue owned computing/charging GST after #16 closed with `taxCents = 0` stubbed and #24 scoped to an email display line, so live checkout charges tax-free; #32 (S22) — the drafted T&C says "see our Stem Prep Guide" but no such page exists anywhere, a dangling reference in a legal doc if #23 ships as-is; #33 (S23) — IndexNow is inert (`INDEXNOW_KEY` unset, live key URL 404s) and the live apex→www 307 contradicts D10.

Decision items added to #1: D-floor-private (devplan wants private codes down to ~$200 USD for indie acquisition, but the shipped $225 USD/song floor applies to all codes and forecloses it) and D-revisions (T&C makes the sale final only when included revisions are "used or waived", yet nothing tracks rounds or waiver). Notes on #19 (rush is sold unconditionally vs T&C "subject to availability"; post-order revision purchase unowned), #24 (estimated-delivery promise unowned; tax line should consume #31), #9 (PhD credential missing from marketing copy), #10 (body-font idea recorded as implicitly dropped).

Biggest sequencing change: #23 pulled to the front of the commerce lane — the devplan required T&C before checkout went live, and checkout has been charging real money without terms or consent since 2026-07-02. Plan doc and CLAUDE.md known-gaps updated accordingly.
