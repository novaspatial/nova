'use client'

import Link from 'next/link'
import { UserCircleIcon } from '@heroicons/react/24/outline'
import type { Project } from '@/types/portal'
import { StatusBadge } from './StatusBadge'

type ProjectWithOwner = Project & {
  owner?: { display_name: string | null; email: string | null } | null
}

export function ProjectCard({ project }: { project: ProjectWithOwner }) {
  const date = new Date(project.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const owner = project.owner

  return (
    <Link href={`/portal/${project.id}`}>
      <div className="group rounded-2xl border border-white/10 bg-white/2 p-4 shadow-2xl shadow-violet-500/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/5 hover:shadow-violet-500/10 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
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
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-400">
            {project.format === 'both'
              ? 'Atmos + Binaural'
              : project.format === 'atmos'
                ? 'Dolby Atmos'
                : 'Binaural'}
          </span>
        </div>
      </div>
    </Link>
  )
}
