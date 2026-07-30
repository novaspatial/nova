import type { SupabaseClient } from '@supabase/supabase-js'

import { removeStorageObjects } from '@/lib/portal/storage'

type CleanupProject = {
  id: string
}

/**
 * List every storage object tied to a project. Postgres cascades the child
 * *rows* when the project row goes, but the Storage *objects* they point at
 * do not cascade — so the paths must be read **before** the delete and
 * swept after it (#48: sweeping first meant a failed row delete left the
 * audio gone and the rows pointing at nothing).
 *
 * Collects two sources:
 *   - project_files               -> project-uploads
 *   - project_comment_attachments -> project-uploads
 *
 * The comment-attachment paths are the correctness fix this library exists
 * for: the old inline delete missed them, leaking every comment attachment
 * object in project-uploads.
 *
 * Storage only since #26: the unpaid-discount restore lives in the DELETE
 * route, keyed on the delete-returning row, so concurrent deletes can't
 * double-restore a hold.
 */
export async function collectProjectStoragePaths(
  supabase: SupabaseClient,
  project: CleanupProject,
): Promise<{ paths: string[]; error: string | null }> {
  const [files, attachments] = await Promise.all([
    supabase
      .from('project_files')
      .select('storage_path')
      .eq('project_id', project.id),
    supabase
      .from('project_comment_attachments')
      .select('storage_path')
      .eq('project_id', project.id),
  ])

  if (files.error) return { paths: [], error: files.error.message }
  if (attachments.error) return { paths: [], error: attachments.error.message }

  // project_files and comment attachments share the uploads bucket
  // (bucketFor maps both kinds there), so their paths sweep together.
  const paths = [...(files.data ?? []), ...(attachments.data ?? [])].map(
    (row) => row.storage_path,
  )

  return { paths, error: null }
}

/**
 * Sweep the collected objects, after the project row is gone. The caller
 * treats a failure here as loggable, not fatal: the delete already
 * committed, so a 500 would only invite a retry of a completed operation.
 */
export async function removeProjectStorageObjects(
  supabase: SupabaseClient,
  paths: string[],
): Promise<{ error: string | null }> {
  return removeStorageObjects(supabase, 'stem', paths)
}
