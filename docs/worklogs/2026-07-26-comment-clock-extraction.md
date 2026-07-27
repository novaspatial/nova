# Comment clock extraction

Date: 2026-07-26

Goal: make the Listen step's core interaction testable (#36). The comment clock — the off/armed/live/locked state machine that tracks which time range a comment refers to — was inline state scattered across ReviewTimeline (1,332 lines, untested): a toggle handler, a keydown handler, a drag callback, 2 effects, and the submit path. It's now a hook, useCommentClock (7b43587), and ReviewTimeline shrank by 71 lines to a caller that renders state and reports events.

Two interface decisions. The issue sketched per-verb methods (arm/cancel/lockEnd/clear); instead the hook exposes event handlers (toggle, handleComposerKeyDown, handleAnchorBDrag, clear) — the component says what happened, the hook decides what it means, so the transition logic stays in one place. And the player parameter is CommentClockPlayer, a 7-member structural subset of the AudioProvider api (the full type is unexported, and a conflicting AudioPlayerAPI already exists in player/types.ts) — which also keeps the test fake small. Behaviour is unchanged, including the quirks: locked-toggle and clear drop the selection, losing the track does not, and the rAF loop still re-bases on every native timeupdate.

29 new tests cover the transitions, the disabled derivation, the keydown filter, and the rAF end-anchor advance — the suite's first fake-timer/rAF tests, so use this file as the pattern reference. Suite 860, lint and build green; no schema change. Follow-on: useWaveformBinding has a near-identical rAF loop; extract a shared primitive if either changes.
