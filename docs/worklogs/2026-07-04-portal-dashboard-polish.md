# Portal dashboard and checkout UI polish

Date: 2026-07-04

Goal: make the portal read clearly at the 3 moments a client can stall — a paid project waiting on stems, a returning client wanting a new order, and the terms consent at checkout.

The uploading status now reads as what it is: a paid project waiting on the client, not a system action. It's relabelled "Awaiting Stems" and recoloured orange in workflow.ts, and ProjectCard grows a matching orange "Finish Uploading" banner — a static upload icon, not a pulsing dot, so it reads as "your move". ProjectList lights it up only for clients on uploading in the non-archived view. Also fixed the pager rendering for a single page — it now shows only when totalPages > 1.

A returning client is no longer stuck: a non-empty project list now shows a New Project button and the collapsible stem-prep guide above the projects (the studio, which doesn't create projects, is opted out of both; empty-state and studio views unchanged). The upload page now surfaces the project's notes and reference tracks so the client can see what they asked for while uploading.

New-project flow and terms: the song-count field got a custom chevron stepper (native spinners hidden for house style; empty/invalid resolves to 1), the redundant page heading and card wrapper are gone, and the terms consent moved inline into the checkbox label — the link opens /terms in a new tab and stops propagation so it doesn't toggle the box. /terms itself was restyled (staggered fade, larger body type) and its dangling bare-mailto contact section removed. Also condensed the 2 earlier 2026-07-04 worklogs to house style. No schema or route changes; the only test touch is the "Awaiting Stems" label assertion.
