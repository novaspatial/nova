import type { SupabaseClient } from '@supabase/supabase-js'

type CleanupProject = {
  id: string
}

/**
 * Remove every storage object tied to a project, ahead of deleting the
 * project row. Postgres cascades the child *rows*, but the Storage
 * *objects* they point at do not cascade — they must be swept here.
 *
 * Sweeps three sources:
 *   - project_files               -> project-uploads
 *   - project_comment_attachments -> project-uploads
 *   - deliverables                -> project-deliverables
 *
 * The comment-attachment sweep is the correctness fix this library exists for:
 * the old inline delete removed only project_files and deliverables paths,
 * leaking every comment attachment object in project-uploads.
 *
 * Storage only since #26: the unpaid-discount restore moved to the DELETE
 * route, keyed on the delete-returning row, so concurrent deletes can't
 * double-restore a hold (`restoreUnpaidOrderDiscount`'s exactly-once
 * contract). Pre-delete cleanup must not release what a surviving row
 * still owns.
 *
 * Returns the first lookup/storage error as `{ error }` so the caller can
 * surface a 500.
 */
export async function cleanupProjectArtifacts(
  supabase: SupabaseClient,
  project: CleanupProject,
): Promise<{ error: string | null }> {
  const [files, attachments, deliverables] = await Promise.all([
    supabase
      .from('project_files')
      .select('storage_path')
      .eq('project_id', project.id),
    supabase
      .from('project_comment_attachments')
      .select('storage_path')
      .eq('project_id', project.id),
    supabase
      .from('deliverables')
      .select('storage_path')
      .eq('project_id', project.id),
  ])

  if (files.error) return { error: files.error.message }
  if (attachments.error) return { error: attachments.error.message }
  if (deliverables.error) return { error: deliverables.error.message }

  // project_files and comment attachments both live in project-uploads.
  const uploadPaths = [...(files.data ?? []), ...(attachments.data ?? [])].map(
    (row) => row.storage_path,
  )
  const deliverablePaths = (deliverables.data ?? []).map(
    (row) => row.storage_path,
  )

  if (uploadPaths.length > 0) {
    const { error } = await supabase.storage
      .from('project-uploads')
      .remove(uploadPaths)
    if (error) return { error: error.message }
  }

  if (deliverablePaths.length > 0) {
    const { error } = await supabase.storage
      .from('project-deliverables')
      .remove(deliverablePaths)
    if (error) return { error: error.message }
  }

  return { error: null }
}
