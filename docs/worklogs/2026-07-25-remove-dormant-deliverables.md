# Remove the dormant deliverables pipeline

Date: 2026-07-25

Goal: settle #13 (admin file download) and drop infrastructure nothing uses. #13 turned out to be already satisfied: the studio can open any project in the portal and download its stems (UploadManager's studio-only button over stemDownloadRoute), and the deliverables half had nothing to download — no UI ever called the deliverables table, the project-deliverables bucket, or their 4 API routes, and the 'deliverable' file type was unwritable. Delivery in practice is mix files on the Listen page. So #13 closed as already-live, and the dead pipeline was removed instead of built out.

The removal (90c1f82, −868 lines) deletes the 4 routes and strips the 'deliverable' kind from the #35 storage seam, uploadRunner, projectCleanup, requireProjectChild, and the portal types. The PATCH deliverable_format side-write went too — a silent no-op in production, since the table had no UPDATE RLS policy. Lint clean; 817 tests in 69 files pass.

The DB half, 20260725_remove_deliverables.sql (applied post-deploy; remote verified empty first; guard-aborts if a replay finds data), drops the table with its 3 RLS policies, the 4 storage policies, and the bucket row, then narrows the file_type CHECK to stem/master_ref/mix. 1 gotcha: storage.protect_delete() rejects direct storage.buckets deletes, so the migration sets the transaction-local storage.allow_delete_query opt-in first (2d27502). Ripple: D7's "stems and deliverables" purge scope now maps to stem + mix rows — noted on #27 for confirmation; CONTEXT.md keeps Deliverable as the business term for the signed-off mixes.
