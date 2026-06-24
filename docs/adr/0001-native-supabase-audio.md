# Native Supabase audio playback and comments

The portal originally hosted audio playback and timestamped comments through the third-party Samply service. We removed it (migration `20260301_remove_samply.sql`, dropping the `samply_*` columns) and now store mixes in Supabase Storage and comments in `project_comments` — anchored to a Mix via `track_id` with a `timestamp_ms`/`timestamp_end_ms` range — played back through our own waveform UI.

This was chosen to own the review experience end to end (custom waveform, the armed/live/locked comment clock, attachments) and to avoid a per-seat external dependency, at the cost of building and maintaining playback/comment UI ourselves. It is hard to reverse: the schema and the entire Listen step now assume native storage.

A future reader seeing custom audio/comment code instead of an off-the-shelf service should know this was deliberate — do not reintroduce Samply or describe it as current.
