-- Raise per-file upload limit on portal buckets now that the project is on Supabase Pro.
-- 5 GiB = 5368709120 bytes. Covers typical stems (100-500 MB) and zipped multitrack
-- sessions (multi-GB) while still bounding runaway uploads.
update storage.buckets
   set file_size_limit = 5368709120
 where id in ('project-uploads', 'project-deliverables');
