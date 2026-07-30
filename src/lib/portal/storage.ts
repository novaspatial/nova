import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  requireApiProfile,
  requireProjectChild,
  type ServerSupabaseClient,
} from '@/lib/auth/server'

// The single seam for portal file storage (#35): buckets, tables, path
// templates, signed-URL TTL, and server-side upload validation exist only
// here. The register→PUT→confirm choreography is unchanged — the
// server half of the register step lives in `createUpload`, the client half
// in `src/lib/portal/uploadRunner.ts`. RLS and storage policies are the
// enforcement floor and are untouched by this module.

export type StorageKind =
  | 'stem'
  | 'master_ref'
  | 'mix'
  | 'comment_attachment'

export type StorageBucket = 'project-uploads'

export const SIGNED_URL_TTL_SECONDS = 3600

// Mirrors the bucket cap set in 20260428_raise_storage_file_size_limits.sql
// (5 GiB) so oversized registrations fail with a friendly 400 instead of an
// opaque storage PUT failure. Raising the bucket limit means raising this.
export const MAX_UPLOAD_BYTES = 5 * 1024 ** 3

// One bucket since 20260725 removed project-deliverables; the kind parameter
// stays so a second bucket is a mapping change, not a call-site change.
export function bucketFor(kind: StorageKind): StorageBucket {
  void kind
  return 'project-uploads'
}

export function tableFor(
  kind: StorageKind,
): 'project_files' | 'project_comment_attachments' {
  return kind === 'comment_attachment'
    ? 'project_comment_attachments'
    : 'project_files'
}

export type StoragePathContext = {
  ownerId: string
  projectId: string
  fileName: string
  attachmentId?: string
}

export function pathFor(kind: StorageKind, ctx: StoragePathContext): string {
  const { ownerId, projectId, fileName, attachmentId } = ctx
  switch (kind) {
    case 'mix':
      return `${ownerId}/${projectId}/mixes/${fileName}`
    case 'comment_attachment': {
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
      return `${ownerId}/${projectId}/comments/${attachmentId}/${safeFileName}`
    }
    default:
      return `${ownerId}/${projectId}/${fileName}`
  }
}

// Deliberately owner-agnostic: the register endpoint stamps the owner prefix,
// so the listen POST only checks that a client-echoed path is scoped to this
// project's comments subtree.
export function isCommentAttachmentPath(
  projectId: string,
  storagePath: string,
): boolean {
  return storagePath.includes(`/${projectId}/comments/`)
}

const MIME_SYNTAX = /^[\w.+-]+\/[\w.+-]+$/

// Browsers strip directories from File.name, so no legitimate client sends
// separators — anything path-like here is a crafted request.
function hasUnsafePathSegment(fileName: string): boolean {
  return (
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName === '.' ||
    fileName === '..'
  )
}

export type UploadInput = {
  fileName?: unknown
  fileSize?: unknown
  mimeType?: unknown
}

/**
 * Server-side size/MIME validation (the checks the register routes never
 * had). Returns a 400-ready message or null. The presence messages are the
 * exact strings the routes have always returned; only the size cap, MIME
 * syntax, and path-safety rejections are new.
 */
export function validateUploadInput(
  _kind: StorageKind,
  { fileName, fileSize, mimeType }: UploadInput,
): string | null {
  if (!fileName || !fileSize || !mimeType) {
    return 'fileName, fileSize, and mimeType are required'
  }

  if (typeof fileName !== 'string' || hasUnsafePathSegment(fileName)) {
    return 'fileName must be a plain file name'
  }

  if (
    typeof fileSize !== 'number' ||
    !Number.isFinite(fileSize) ||
    fileSize <= 0
  ) {
    return 'fileSize must be a positive number of bytes'
  }

  if (fileSize > MAX_UPLOAD_BYTES) {
    return 'File exceeds the 5 GB upload limit'
  }

  if (typeof mimeType !== 'string' || !MIME_SYNTAX.test(mimeType)) {
    return 'mimeType must be a valid MIME type'
  }

  return null
}

type AnySupabase = ServerSupabaseClient | SupabaseClient

export type CreateUploadContext = {
  projectId: string
  ownerId: string
  // Unvalidated request-body values — createUpload runs validateUploadInput
  // before touching them, so callers pass them straight through.
  fileName: unknown
  fileSize: unknown
  mimeType?: unknown
  /** stems/master refs/mixes only — stamped into `uploaded_by`. */
  uploadedBy?: string
}

export type CreateUploadResult =
  | {
      ok: true
      /** Absent for comment attachments — their row is created by the listen POST. */
      row?: { id: string } & Record<string, unknown>
      storagePath: string
      uploadUrl: string
    }
  | { ok: false; status: number; error: string; details?: unknown }

/**
 * The server half of the register step, per kind and with each kind's
 * existing choreography preserved:
 *  - stem/master_ref/mix: signed upload URL FIRST (a storage collision must
 *    not leave a dangling project_files row), then insert the row. Mixes
 *    upsert so the studio can re-upload updated mixes.
 *  - comment_attachment: signed URL only under a fresh UUID — no row; the
 *    listen POST creates rows when the comment is submitted.
 */
export async function createUpload(
  supabase: AnySupabase,
  kind: StorageKind,
  ctx: CreateUploadContext,
): Promise<CreateUploadResult> {
  const invalid = validateUploadInput(kind, ctx)
  if (invalid) {
    return { ok: false, status: 400, error: invalid }
  }

  // Narrowed by validateUploadInput above.
  const fileName = ctx.fileName as string
  const fileSize = ctx.fileSize as number
  const mimeType = ctx.mimeType as string | undefined

  if (kind === 'comment_attachment') {
    const storagePath = pathFor(kind, {
      ownerId: ctx.ownerId,
      projectId: ctx.projectId,
      fileName,
      attachmentId: crypto.randomUUID(),
    })

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketFor(kind))
      .createSignedUploadUrl(storagePath)

    if (uploadError || !uploadData) {
      return {
        ok: false,
        status: 500,
        error: uploadError?.message || 'Failed to create upload URL',
      }
    }

    return { ok: true, storagePath, uploadUrl: uploadData.signedUrl }
  }

  const storagePath = pathFor(kind, {
    ownerId: ctx.ownerId,
    projectId: ctx.projectId,
    fileName,
  })

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucketFor(kind))
    .createSignedUploadUrl(storagePath, { upsert: kind === 'mix' })

  if (uploadError || !uploadData) {
    console.error('[storage createUpload] Storage Signed URL Error:', uploadError)
    return {
      ok: false,
      status: 500,
      error: uploadError?.message || 'Failed to create upload URL',
      details: uploadError,
    }
  }

  const { data: file, error: insertError } = await supabase
    .from('project_files')
    .insert({
      project_id: ctx.projectId,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      file_type: kind,
      storage_path: storagePath,
      upload_status: 'pending',
      uploaded_by: ctx.uploadedBy,
    })
    .select()
    .single()

  if (insertError || !file) {
    console.error('[storage createUpload] Insert Error:', insertError)
    return {
      ok: false,
      status: 500,
      error: insertError?.message || 'Failed to register file',
      details: insertError,
    }
  }

  return { ok: true, row: file, storagePath, uploadUrl: uploadData.signedUrl }
}

export async function signedUrlFor(
  supabase: AnySupabase,
  kind: StorageKind,
  storagePath: string,
  options?: { downloadName?: string },
): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabase.storage
    .from(bucketFor(kind))
    .createSignedUrl(
      storagePath,
      SIGNED_URL_TTL_SECONDS,
      options?.downloadName ? { download: options.downloadName } : undefined,
    )

  if (error || !data) {
    return { error: error?.message || 'Failed to generate download URL' }
  }

  return { url: data.signedUrl }
}

/**
 * Signed download URL for a child row, forcing the stored file name as the
 * download name.
 */
export async function signedDownload(
  supabase: AnySupabase,
  kind: StorageKind,
  file: { storage_path: string; file_name: string },
): Promise<{ url: string } | { error: string }> {
  return signedUrlFor(supabase, kind, file.storage_path, {
    downloadName: file.file_name,
  })
}

export async function removeStorageObjects(
  supabase: AnySupabase,
  kind: StorageKind,
  storagePaths: string[],
): Promise<{ error: string | null }> {
  if (storagePaths.length === 0) {
    return { error: null }
  }
  const { error } = await supabase.storage
    .from(bucketFor(kind))
    .remove(storagePaths)
  return { error: error?.message ?? null }
}

type DownloadRouteConfig = {
  kind: StorageKind
  paramName: 'fileId' | 'attachmentId'
  notFoundMessage: string
  /** 403 for non-studio callers, checked before any project load. */
  studioOnly?: boolean
}

type DownloadRow = { storage_path: string; file_name: string }

function createDownloadRoute({
  kind,
  paramName,
  notFoundMessage,
  studioOnly = false,
}: DownloadRouteConfig) {
  return async function GET(
    _request: NextRequest,
    { params }: { params: Promise<Record<string, string>> },
  ) {
    const resolvedParams = await params
    const projectId = resolvedParams.id
    const rowId = resolvedParams[paramName]

    const auth = await requireApiProfile()
    if ('response' in auth) {
      return auth.response
    }

    if (studioOnly && auth.profile?.role !== 'studio') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const childResult = await requireProjectChild<DownloadRow>(auth, {
      projectId,
      table: tableFor(kind),
      rowId,
      select: 'storage_path, file_name',
      notFoundMessage,
    })
    if ('response' in childResult) {
      return childResult.response
    }

    const signed = await signedDownload(auth.supabase, kind, childResult.row)
    if ('error' in signed) {
      return NextResponse.json({ error: signed.error }, { status: 500 })
    }

    return NextResponse.json({ url: signed.url })
  }
}

// The two production download handlers. Route files re-export these so the
// choreography is defined — and tested — exactly once. Only studio may pull
// client stems through the files endpoint; attachment downloads are open to
// any project viewer.
export const stemDownloadRoute = createDownloadRoute({
  kind: 'stem',
  paramName: 'fileId',
  notFoundMessage: 'File not found',
  studioOnly: true,
})

export const attachmentDownloadRoute = createDownloadRoute({
  kind: 'comment_attachment',
  paramName: 'attachmentId',
  notFoundMessage: 'Attachment not found',
})
