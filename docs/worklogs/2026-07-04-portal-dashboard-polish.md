Portal dashboard + checkout UI polish

Date: 2026-07-04.

Gave the `uploading` status a clearer read. It's a paid project waiting on the client, not a system action, so it's relabelled "Awaiting Stems" and recoloured orange in `workflow.ts`, and `ProjectCard` grows a matching orange "Finish Uploading" banner (a static upload icon, not a pulsing dot, so it reads as "your move"). `ProjectList` only lights it up for clients on `uploading` in the non-archived view. Also fixed the pager showing for a single page — the control now renders only when `totalPages > 1`.

Reworked the client dashboard so a returning client isn't stuck. When the list is non-empty they now get a New Project button and the collapsible stem-prep guide above their projects; the studio, which doesn't create projects, is opted out of both. The empty-state and studio views are unchanged. The upload page now surfaces the project's notes and reference tracks so the client can see what they asked for while uploading.

Polished the new-project flow and terms. The song-count field gets a custom chevron stepper (native number spinners hidden for house style; empty/invalid resolves to 1), the redundant page heading and card wrapper are dropped, and the Terms consent moved inline into the checkbox label — the link opens `/terms` in a new tab and stops propagation so it doesn't toggle the box. The `/terms` page itself was restyled with a staggered fade and larger body type, and its dangling contact section (a bare mailto) removed.

Also condensed the two earlier 2026-07-04 worklogs (gap-audit, terms-consent) to house style. No schema or route changes; the only test touch was the "Awaiting Stems" label assertion.
