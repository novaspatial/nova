-- Stop anonymous enumeration of the blog-assets bucket (advisor
-- `public_bucket_allows_listing`, found while working #59).
--
-- 20260425 gave the bucket a broad `for select ... using (bucket_id =
-- 'blog-assets')` policy. The bucket is `public`, so object reads go
-- through /object/public/ and never consult RLS — the policy's only
-- effect is to let any anon caller POST /object/list/blog-assets and walk
-- the whole bucket, including drafts and anything uploaded but never
-- published. Verified against production: an anon list returned the
-- bucket's folder listing.
--
-- Call-site audit: the only reader is `uploadBlogImage`, which resolves
-- images with `getPublicUrl` (the public path, unaffected), and the only
-- writer is the studio insert policy below it, which this does not touch.
-- Nothing in the repo calls `.list()` on this bucket.

drop policy if exists "Blog assets readable by anyone" on storage.objects;
