# Storage seam and project-child authorization

Date: 2026-07-24

Goal: collapse the portal's scattered storage knowledge and repeated auth preambles into 2 seams (#35/#37, shipped as 1 commit, c2e1a23), so the purge job and future file work have 1 place to plug in.

src/lib/portal/storage.ts now owns all storage knowledge — bucket names (previously spread across ~10 files), kind→table mapping, path templates, the 3600 s signed-URL TTL, and createUpload with each kind's register choreography preserved (stems sign before insert, deliverables insert then upsert, attachments sign under a UUID with no row). The 3 download handlers collapsed into 1 factory; the route files are 1-line re-exports. Register gained validation: a 5 GiB cap mirroring the bucket config, a syntactic MIME check (no allowlist), path-safe file names, and /files rejecting any fileType outside stem/master_ref/mix.

Client-side, the register → PUT → confirm dance that was hand-copied 3× is now runUploadDance in uploadRunner.ts — useFileUpload, NewProjectForm, and ReviewTimeline keep their own state and consume it — and formatFileSize deduped into src/lib/formatFileSize.ts. requireProjectChild joined getProjectOrApiNotFound in auth/server.ts and replaced all 6 inline child-row preambles; per the re-anchor rulings the claimProjectPayment/consume/receipt and #26-restore choreographies are untouched, and the duplicate profile refetch in /files is gone. No migration; RLS and storage policies unchanged (ADR-0002/0003).

Tests collapsed toward the seams: the 3 download test files deleted, choreography now in storage.test.ts (29), uploadRunner.test.ts (7), and a requireProjectChild block in server.test.ts (4); route tests dropped 8 duplicated preamble cases and gained 1 for the fileType 400. Suite 832, lint and build green. Unblocks #27 (bucketFor/removeStorageObjects) and #13, which flipped ready-for-agent and consumes signedDownload.
