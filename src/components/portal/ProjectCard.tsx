'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArchiveBoxArrowDownIcon,
  ArchiveBoxXMarkIcon,
  TrashIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import type { Project } from '@/types/portal'
import { StatusBadge } from './StatusBadge'
import { PortalConfirmDialog } from './PortalConfirmDialog'

type ProjectWithOwner = Project & {
  owner?: { display_name: string | null; email: string | null } | null
}

function formatProjectType(format: Project['format']) {
  if (format === 'both') return 'Atmos + Binaural'
  if (format === 'atmos') return 'Dolby Atmos'
  return 'Binaural'
}

export function ProjectCard({
  project,
  canDelete = false,
  onDeleted,
  canArchive = false,
  isArchived = false,
  onArchived,
  onUnarchived,
  isNewProject = false,
  isInProgress = false,
  isInReview = false,
  isMixAvailable = false,
  onOpened,
}: {
  project: ProjectWithOwner
  canDelete?: boolean
  onDeleted?: (id: string) => void
  canArchive?: boolean
  isArchived?: boolean
  onArchived?: (id: string) => void
  onUnarchived?: (id: string) => void
  isNewProject?: boolean
  isInProgress?: boolean
  isInReview?: boolean
  isMixAvailable?: boolean
  onOpened?: (id: string) => void
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const actionCount = (canArchive ? 1 : 0) + (canDelete ? 1 : 0)
  const contentPadding =
    actionCount >= 2 ? 'pr-20' : actionCount === 1 ? 'pr-12' : ''

  const date = new Date(project.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const owner = project.owner
  const href = `/portal/${project.id}`

  async function handleDelete() {
    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/portal/projects/${project.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete project')
      }

      setIsDialogOpen(false)
      onDeleted?.(project.id)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to delete project',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleArchiveToggle() {
    setIsArchiving(true)
    setActionError(null)

    try {
      const response = await fetch(
        `/api/portal/projects/${project.id}/archive`,
        { method: isArchived ? 'DELETE' : 'POST' },
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update project')
      }

      if (isArchived) {
        onUnarchived?.(project.id)
      } else {
        onArchived?.(project.id)
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Failed to update project',
      )
    } finally {
      setIsArchiving(false)
    }
  }

  return (
    <>
      <div
        className={`group relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/5 ${
          isNewProject
            ? 'border-emerald-500/40 bg-emerald-500/5 shadow-emerald-500/15 hover:border-emerald-400/60 hover:shadow-emerald-500/20'
            : isMixAvailable
              ? 'border-purple-500/40 bg-purple-500/5 shadow-purple-500/15 hover:border-purple-400/60 hover:shadow-purple-500/20'
              : isInReview
                ? 'border-blue-500/40 bg-blue-500/5 shadow-blue-500/15 hover:border-blue-400/60 hover:shadow-blue-500/20'
                : isInProgress
                  ? 'border-amber-500/40 bg-amber-500/5 shadow-amber-500/15 hover:border-amber-400/60 hover:shadow-amber-500/20'
                  : 'border-white/10 bg-white/2 shadow-violet-500/5 hover:border-white/20 hover:shadow-violet-500/10'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/3 via-transparent to-violet-400/3 opacity-0 transition duration-300 group-hover:opacity-100" />
        {isNewProject && (
          <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-emerald-300 uppercase">
              New Project
            </span>
          </div>
        )}
        {isMixAvailable && !isNewProject && (
          <div className="flex items-center gap-2 border-b border-purple-500/20 bg-purple-500/10 px-4 py-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-purple-400" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-purple-300 uppercase">
              Mix Available
            </span>
          </div>
        )}
        {isInReview && !isNewProject && !isMixAvailable && (
          <div className="flex items-center gap-2 border-b border-blue-500/20 bg-blue-500/10 px-4 py-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-blue-400" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-blue-300 uppercase">
              In Review
            </span>
          </div>
        )}
        {isInProgress && !isNewProject && !isMixAvailable && !isInReview && (
          <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-amber-300 uppercase">
              In Progress
            </span>
          </div>
        )}
        {(canArchive || canDelete) && (
          <div
            className={`absolute right-4 z-10 flex items-center gap-2 ${isNewProject || isInReview || isInProgress || isMixAvailable ? 'top-13' : 'top-4'}`}
          >
            {canArchive && (
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={isArchiving}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50"
                aria-label={`${isArchived ? 'Unarchive' : 'Archive'} ${project.title}`}
                title={isArchived ? 'Restore project' : 'Archive project'}
              >
                {isArchived ? (
                  <ArchiveBoxXMarkIcon className="size-4" />
                ) : (
                  <ArchiveBoxArrowDownIcon className="size-4" />
                )}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null)
                  setIsDialogOpen(true)
                }}
                className="inline-flex items-center justify-center rounded-xl border border-rose-400/15 bg-rose-500/10 p-2 text-rose-200 transition hover:border-rose-300/30 hover:bg-rose-500/15 hover:text-white"
                aria-label={`Remove ${project.title}`}
              >
                <TrashIcon className="size-4" />
              </button>
            )}
          </div>
        )}

        <Link href={href} className="block p-4 sm:p-6" onClick={() => onOpened?.(project.id)}>
          <div className={`flex items-start gap-3 ${contentPadding}`}>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-display text-base font-semibold text-white sm:text-lg">
                {project.title}
              </h3>
              <p className="mt-1 text-xs text-zinc-500 sm:text-sm">{date}</p>
            </div>
            <StatusBadge status={project.status} />
          </div>
          {owner && (
            <div className="mt-3 flex items-center gap-2">
              <UserCircleIcon className="size-4 shrink-0 text-zinc-500" />
              <div className="min-w-0 text-xs text-zinc-400">
                <span className="text-zinc-300">
                  {owner.display_name || 'Unnamed'}
                </span>
                {owner.email && (
                  <span className="ml-1.5 text-zinc-500">{owner.email}</span>
                )}
              </div>
            </div>
          )}
          {project.notes && (
            <p className="mt-3 line-clamp-2 text-sm text-zinc-400">
              {project.notes}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-400">
              {formatProjectType(project.format)}
            </span>
          </div>
        </Link>
        {actionError && (
          <div className="border-t border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
            {actionError}
          </div>
        )}
      </div>
      <DeleteProjectDialog
        projectTitle={project.title}
        isOpen={isDialogOpen}
        isDeleting={isDeleting}
        errorMessage={errorMessage}
        onClose={() => {
          if (!isDeleting) {
            setIsDialogOpen(false)
          }
        }}
        onConfirm={handleDelete}
      />
    </>
  )
}

function DeleteProjectDialog({
  projectTitle,
  isOpen,
  isDeleting,
  errorMessage,
  onClose,
  onConfirm,
}: {
  projectTitle: string
  isOpen: boolean
  isDeleting: boolean
  errorMessage: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <PortalConfirmDialog
      isOpen={isOpen}
      tone="danger"
      eyebrow="Delete"
      title="Remove this project?"
      description={
        <p>
          <span className="font-medium text-zinc-200">{projectTitle}</span>
        </p>
      }
      noteTitle="This action is permanent."
      noteBody="Once removed, this project will no longer appear in your portal."
      confirmLabel="Remove Project"
      busyLabel="Removing..."
      cancelLabel="Keep Project"
      isBusy={isDeleting}
      errorMessage={errorMessage}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
