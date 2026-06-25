import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The project fields cleanup needs: enough to restore a dangling first-mix
 * discount reservation. `id` and `owner_id` are required; the payment flags
 * are optional so callers that don't track payments can pass a lean object.
 */
type CleanupProject = {
  id: string
  owner_id: string
  discount_applied?: boolean | null
  paid_at?: string | null
}

/**
 * Remove every storage object and reservation tied to a project, ahead of
 * deleting the project row. Postgres cascades the child *rows*, but the
 * Storage *objects* they point at do not cascade — they must be swept here.
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
 * Also restores the first-mix discount when the project reserved it but was
 * never paid, so an abandoned checkout doesn't burn the user's reservation.
 *
 * Returns the first lookup/storage error as `{ error }` so the caller can
 * surface a 500. A failed discount restore is logged, not fatal — it matches
 * the prior route behavior and must not block the delete.
 */
export async function cleanupProjectArtifacts(
  supabase: SupabaseClient,
  project: CleanupProject,
): Promise<{ error: string | null }> {
  // Return an unpaid first-mix reservation to the user's pool.
  if (project.discount_applied && !project.paid_at) {
    const { error: restoreError } = await supabase.rpc(
      'restore_first_mix_discount',
      { p_user_id: project.owner_id },
    )
    if (restoreError) {
      console.error(
        '[cleanupProjectArtifacts] discount restore failed',
        restoreError,
      )
    }
  }

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
