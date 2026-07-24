# Devplan gap audit — 3 missed slices; plan rewritten

Date: 2026-07-04

Goal: make sure nothing in devplan.docx silently fell through the cracks, and leave behind a dev plan an agent can execute from directly.

Checked the devplan line by line against every open issue — 160 atomic items, each gap double-checked. Most were already covered or deliberately excluded; the rest became 3 new issues, 2 decision items, and a few notes on existing issues. The 3 new issues: checkout charges no tax (the field is an unowned stub), the drafted terms page references a stem-prep guide that doesn't exist yet, and IndexNow is dead in production while the live redirect contradicts an earlier decision. Also flagged for decision: whether private discount codes can go as low as the devplan wants (the shipped price floor currently blocks it), and how revision tracking should work given the terms' "used or waived" language, which nothing tracks today.

Biggest consequence: the terms-and-conditions work jumped to the front of the queue, since checkout had taken real payments with no terms in place since July 2. A same-day architecture review filed 6 refactor issues, 1 of which doubles as a real bug (illegal status jumps during upload finalization).

The dev plan doc was rewritten agent-first: a goal statement, a "now" queue of unblocked work, decision-gated chains after it, constraints inline, refactors slotted into the path, and the old history compressed to a table.
