'use client'

import Link from 'next/link'
import { useState } from 'react'
import { TrashIcon, UserCircleIcon } from '@heroicons/react/24/outline'
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
  isNewProject = false,
}: {
  project: ProjectWithOwner
  canDelete?: boolean
  onDeleted?: () => void
  isNewProject?: boolean
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      onDeleted?.()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to delete project',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div
        className={`group relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/5 ${
          isNewProject
            ? 'border-violet-500/40 bg-violet-500/5 shadow-violet-500/15 hover:border-violet-400/60 hover:shadow-violet-500/20'
            : 'border-white/10 bg-white/2 shadow-violet-500/5 hover:border-white/20 hover:shadow-violet-500/10'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/3 via-transparent to-violet-400/3 opacity-0 transition duration-300 group-hover:opacity-100" />
        {isNewProject && (
          <div className="flex items-center gap-2 border-b border-violet-500/20 bg-violet-500/10 px-4 py-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-violet-400" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-violet-300 uppercase">
              New Project!
            </span>
          </div>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null)
              setIsDialogOpen(true)
            }}
            className="absolute top-4 right-4 z-10 inline-flex items-center justify-center rounded-xl border border-rose-400/15 bg-rose-500/10 p-2 text-rose-200 transition hover:border-rose-300/30 hover:bg-rose-500/15 hover:text-white"
            aria-label={`Remove ${project.title}`}
          >
            <TrashIcon className="size-4" />
          </button>
        )}

        <Link href={href} className="block p-4 sm:p-6">
          <div className="flex items-start gap-3 pr-12">
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
