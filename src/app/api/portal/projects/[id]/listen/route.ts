import { NextResponse, type NextRequest } from 'next/server'
import {
  getProjectOrApiNotFound,
  requireApiProfile,
} from '@/lib/auth/server'

interface IncomingAttachment {
  storagePath: string
  fileName: string
  fileSize: number
  mimeType: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, profile } = auth

  const projectResult = await getProjectOrApiNotFound<{ id: string }>(
    supabase,
    projectId,
    'id',
    profile?.role,
  )
  if ('response' in projectResult) {
    return projectResult.response
  }

  const { data: comments, error } = await supabase
    .from('project_comments')
    .select(
      '*, author:profiles!project_comments_author_id_fkey(display_name, avatar_url, role), attachments:project_comment_attachments(id, comment_id, project_id, file_name, file_size, mime_type, storage_path, created_at)',
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(comments)
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

  const projectResult = await getProjectOrApiNotFound<{ id: string }>(
    supabase,
    projectId,
    'id',
    profile?.role,
  )
  if ('response' in projectResult) {
    return projectResult.response
  }

  const reqBody = await request.json()
  const {
    body,
    timestampMs,
    timestampEndMs,
    parentId,
    trackId,
    attachments,
  } = reqBody as {
    body?: string
    timestampMs?: number | null
    timestampEndMs?: number | null
    parentId?: string | null
    trackId?: string
    attachments?: IncomingAttachment[]
  }

  const effectiveTimestampEndMs = parentId ? null : (timestampEndMs ?? null)

  const trimmedBody = typeof body === 'string' ? body.trim() : ''
  const attachmentList = Array.isArray(attachments) ? attachments : []

  if (!trimmedBody && attachmentList.length === 0) {
    return NextResponse.json(
      { error: 'Comment must have a body or at least one attachment' },
      { status: 400 },
    )
  }

  if (typeof trackId !== 'string' || trackId.length === 0) {
    return NextResponse.json(
      { error: 'trackId is required' },
      { status: 400 },
    )
  }

  const { data: track, error: trackError } = await supabase
    .from('project_files')
    .select('id')
    .eq('id', trackId)
    .eq('project_id', projectId)
    .eq('file_type', 'mix')
    .maybeSingle()

  if (trackError) {
    return NextResponse.json({ error: trackError.message }, { status: 500 })
  }
  if (!track) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 })
  }

  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from('project_comments')
      .select('track_id')
      .eq('id', parentId)
      .eq('project_id', projectId)
      .maybeSingle()

    if (parentError) {
      return NextResponse.json({ error: parentError.message }, { status: 500 })
    }
    if (!parent) {
      return NextResponse.json(
        { error: 'Parent comment not found' },
        { status: 404 },
      )
    }
    if (parent.track_id !== trackId) {
      return NextResponse.json(
        { error: 'Reply must belong to the same track as its parent' },
        { status: 400 },
      )
    }
  }

  for (const attachment of attachmentList) {
    if (
      !attachment.storagePath ||
      !attachment.fileName ||
      typeof attachment.fileSize !== 'number' ||
      !attachment.mimeType ||
      !attachment.storagePath.includes(`/${projectId}/comments/`)
    ) {
      return NextResponse.json(
        { error: 'Invalid attachment payload' },
        { status: 400 },
      )
    }
  }

  const { data: comment, error } = await supabase
    .from('project_comments')
    .insert({
      project_id: projectId,
      track_id: trackId,
      author_id: user.id,
      body: trimmedBody.length > 0 ? trimmedBody : null,
      timestamp_ms: timestampMs ?? null,
      timestamp_end_ms: effectiveTimestampEndMs,
      parent_id: parentId ?? null,
    })
    .select(
      '*, author:profiles!project_comments_author_id_fkey(display_name, avatar_url, role)',
    )
    .single()

  if (error || !comment) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create comment' },
      { status: 500 },
    )
  }

  let insertedAttachments: unknown[] = []
  if (attachmentList.length > 0) {
    const { data: rows, error: attachmentError } = await supabase
      .from('project_comment_attachments')
      .insert(
        attachmentList.map((attachment) => ({
          comment_id: comment.id,
          project_id: projectId,
          file_name: attachment.fileName,
          file_size: attachment.fileSize,
          mime_type: attachment.mimeType,
          storage_path: attachment.storagePath,
        })),
      )
      .select(
        'id, comment_id, project_id, file_name, file_size, mime_type, storage_path, created_at',
      )

    if (attachmentError) {
      // Roll back the comment so the client can retry cleanly
      await supabase.from('project_comments').delete().eq('id', comment.id)
      return NextResponse.json(
        { error: attachmentError.message },
        { status: 500 },
      )
    }
    insertedAttachments = rows ?? []
  }

  return NextResponse.json({ ...comment, attachments: insertedAttachments })
}
