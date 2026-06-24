# Direct-to-storage uploads via signed URLs

Audio files (stems, mixes, deliverables) can be up to 5 GiB. Rather than streaming them through Next.js route handlers, the client uploads **directly to Supabase Storage** using a server-issued signed upload URL, in a three-step dance: the API registers a `project_files` row and returns a signed URL (`register`), the client `PUT`s the bytes straight to storage, then calls back to mark it uploaded (`confirm`). Downloads and playback use short-lived signed download URLs the same way.

This was chosen because serverless function request/response bodies can't carry multi-gigabyte audio, and proxying them would be slow and costly. The trade-off is a more complex multi-request client flow and an intermediate `pending` upload state, rather than a single POST.

Consequence: an upload exists in storage before its row is confirmed, so treat unconfirmed files as incomplete, and keep storage cleanup in mind when deleting projects.
