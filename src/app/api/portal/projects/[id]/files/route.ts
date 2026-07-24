import { NextResponse, type NextRequest } from 'next/server'
import {
  getProjectOrApiNotFound,
  requireApiProfile,
} from '@/lib/auth/server'
import {
  createUpload,
  validateUploadInput,
  type StorageKind,
} from '@/lib/portal/storage'
import {
  canUploadMix,
  canUploadStems,
  type ProjectStatus,
} from '@/lib/portal/workflow'

const PROJECT_FILE_KINDS = ['stem', 'master_ref', 'mix'] as const
type ProjectFileKind = (typeof PROJECT_FILE_KINDS)[number]

function isProjectFileKind(value: unknown): value is ProjectFileKind {
  return PROJECT_FILE_KINDS.includes(value as ProjectFileKind)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user, profile } = auth

  const projectResult = await getProjectOrApiNotFound<{
    id: string
    owner_id: string
    status: ProjectStatus
  }>(supabase, projectId, 'id, owner_id, status', profile?.role)
  if ('response' in projectResult) {
    return projectResult.response
  }
  const { project } = projectResult

  const body = await request.json()
  const { fileName, fileSize, mimeType, fileType } = body

  const kind: StorageKind = fileType == null ? 'stem' : fileType
  if (!isProjectFileKind(kind)) {
    return NextResponse.json({ error: 'Invalid fileType' }, { status: 400 })
  }

  // Validation 400s outrank the role/status gates below (existing order).
  const invalid = validateUploadInput(kind, { fileName, fileSize, mimeType })
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 })
  }

  if (kind === 'mix') {
    if (profile?.role !== 'studio') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!canUploadMix(project.status)) {
      return NextResponse.json(
        { error: 'Cannot upload mixes in current project status' },
        { status: 400 },
      )
    }
  } else {
    // Stem uploads require a paid project.
    if (!canUploadStems(project.status)) {
      return NextResponse.json(
        { error: 'Payment required before uploading files' },
        { status: 402 },
      )
    }
  }

  const result = await createUpload(supabase, kind, {
    projectId,
    ownerId: project.owner_id,
    fileName,
    fileSize,
    mimeType,
    uploadedBy: user.id,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.details !== undefined ? { details: result.details } : {}) },
      { status: result.status },
    )
  }

  return NextResponse.json({
    fileId: result.row?.id,
    uploadUrl: result.uploadUrl,
  })
}
