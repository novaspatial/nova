import type { User } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'
import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/supabaseServer'
import type { UserRole } from '@/types/portal'

export type ServerSupabaseClient = NonNullable<
  Awaited<ReturnType<typeof createClient>>
>

export type AuthProfile = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  role: UserRole
}

export type AuthContext = {
  supabase: ServerSupabaseClient
  user: User
}

type ApiFailure = {
  response: NextResponse<{ error: string }>
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function notFoundResponse(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 })
}

async function createAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient()

  if (!supabase) {
    return null
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return null
    }

    return { supabase, user }
  } catch {
    return null
  }
}

export async function getAuthProfile(
  supabase: ServerSupabaseClient,
  userId: string,
) {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url, role')
    .eq('id', userId)
    .single()

  return (data as AuthProfile | null) ?? null
}

export async function requirePageUser() {
  const auth = await createAuthContext()

  if (!auth) {
    redirect('/login')
  }

  return auth
}

export async function requirePageProfile() {
  const auth = await requirePageUser()
  const profile = await getAuthProfile(auth.supabase, auth.user.id)

  return { ...auth, profile }
}

export async function requirePageStudioUser() {
  const auth = await requirePageProfile()

  if (auth.profile?.role !== 'studio') {
    redirect('/portal')
  }

  return auth
}

type ProjectVisibilityFields = {
  client_deleted_at?: string | null
  studio_deleted_at?: string | null
}

function isProjectVisibleToRole(
  project: ProjectVisibilityFields,
  viewerRole: UserRole | null | undefined,
) {
  if (viewerRole === 'studio') {
    return !project.studio_deleted_at
  }

  return !project.client_deleted_at
}

export async function getProjectOrNotFound<T extends object>(
  supabase: ServerSupabaseClient,
  projectId: string,
  select: string,
  viewerRole?: UserRole | null,
) {
  const expandedSelect = select.includes('*')
    ? select
    : `${select}, client_deleted_at, studio_deleted_at`

  const { data } = await supabase
    .from('projects')
    .select(expandedSelect)
    .eq('id', projectId)
    .single()

  if (!data || !isProjectVisibleToRole(data as ProjectVisibilityFields, viewerRole)) {
    notFound()
  }

  const project = { ...((data as unknown) as T & ProjectVisibilityFields) }
  delete project.client_deleted_at
  delete project.studio_deleted_at

  return project as T
}

export async function requireApiUser() {
  const auth = await createAuthContext()

  if (!auth) {
    return { response: unauthorizedResponse() } as ApiFailure
  }

  return auth
}

export async function requireApiProfile() {
  const auth = await requireApiUser()

  if ('response' in auth) {
    return auth
  }

  const profile = await getAuthProfile(auth.supabase, auth.user.id)

  return { ...auth, profile }
}

export async function requireApiStudioUser() {
  const auth = await requireApiProfile()

  if ('response' in auth) {
    return auth
  }

  if (auth.profile?.role !== 'studio') {
    return { response: forbiddenResponse() } as ApiFailure
  }

  return auth
}

export async function getProjectOrApiNotFound<T extends object>(
  supabase: ServerSupabaseClient,
  projectId: string,
  select: string,
  viewerRole?: UserRole | null,
) {
  const expandedSelect = select.includes('*')
    ? select
    : `${select}, client_deleted_at, studio_deleted_at`

  const { data } = await supabase
    .from('projects')
    .select(expandedSelect)
    .eq('id', projectId)
    .single()

  if (!data || !isProjectVisibleToRole(data as ProjectVisibilityFields, viewerRole)) {
    return { response: notFoundResponse('Project not found') } as ApiFailure
  }

  const project = { ...((data as unknown) as T & ProjectVisibilityFields) }
  delete project.client_deleted_at
  delete project.studio_deleted_at

  return { project: project as T }
}

type ProjectChildOptions = {
  projectId: string
  table:
    | 'project_files'
    | 'project_comments'
    | 'project_comment_attachments'
    | 'deliverables'
  rowId: string
  select: string
  authorField?: 'uploaded_by' | 'author_id'
  notFoundMessage?: string
  projectSelect?: string
}

/**
 * Project-child authorization: loads the project (soft-delete visibility per
 * the caller's role), then the child row scoped to it, and derives the three
 * facts every child handler used to hand-roll. RLS stays the enforcement
 * floor (ADR-0002) — this is the app-layer defense-in-depth, deduplicated.
 *
 * `isOwner` is project ownership; `isAuthor` is row creatorship via
 * `authorField` (false when the table has no author column). Forbidden (403)
 * decisions stay in the handlers — they are domain gates, not row loading.
 */
export async function requireProjectChild<
  Row extends object,
  Project extends object = { id: string; owner_id: string },
>(
  auth: { supabase: ServerSupabaseClient; user: User; profile: AuthProfile | null },
  {
    projectId,
    table,
    rowId,
    select,
    authorField,
    notFoundMessage = 'Not found',
    projectSelect = 'id, owner_id',
  }: ProjectChildOptions,
): Promise<
  | {
      project: Project
      row: Row
      isStudio: boolean
      isOwner: boolean
      isAuthor: boolean
    }
  | ApiFailure
> {
  const { supabase, user, profile } = auth

  const projectResult = await getProjectOrApiNotFound<
    Project & { owner_id?: string }
  >(supabase, projectId, projectSelect, profile?.role)
  if ('response' in projectResult) {
    return projectResult
  }
  const { project } = projectResult

  const { data: row } = await supabase
    .from(table)
    .select(select)
    .eq('id', rowId)
    .eq('project_id', projectId)
    .single()

  if (!row) {
    return { response: notFoundResponse(notFoundMessage) } as ApiFailure
  }

  return {
    project: project as Project,
    row: row as unknown as Row,
    isStudio: profile?.role === 'studio',
    isOwner: project.owner_id === user.id,
    isAuthor: authorField
      ? (row as unknown as Record<string, unknown>)[authorField] === user.id
      : false,
  }
}
