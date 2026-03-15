'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { AnimatePresence, motion } from 'framer-motion'
import { FadeIn, FadeInStagger } from '@/components/ui/FadeIn'
import { ProjectCard } from './ProjectCard'
import type { Project } from '@/types/portal'

const PROJECTS_PER_PAGE = 8

type ProjectWithOwner = Project & {
  owner?: { display_name: string | null; email: string | null } | null
}

const SEEN_KEY = 'studio:seen_projects'

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function markSeen(id: string) {
  try {
    const seen = getSeenIds()
    seen.add(id)
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    // ignore storage errors
  }
}

export function ProjectList({
  projects,
  isStudio,
  userId,
}: {
  projects: ProjectWithOwner[]
  isStudio: boolean
  userId: string
}) {
  const router = useRouter()
  const [showSuccess, setShowSuccess] = useState(false)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  const visibleProjects = useMemo(
    () => {
      let filtered = projects.filter((p) => !deletedIds.has(p.id))
      if (isStudio && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        filtered = filtered.filter((p) => p.title.toLowerCase().includes(q))
      }
      return filtered
    },
    [projects, deletedIds, isStudio, searchQuery],
  )
  const totalPages = Math.max(1, Math.ceil(visibleProjects.length / PROJECTS_PER_PAGE))
  const paginatedProjects = visibleProjects.slice(
    (currentPage - 1) * PROJECTS_PER_PAGE,
    currentPage * PROJECTS_PER_PAGE,
  )

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  useEffect(() => {
    if (!isStudio) return
    setSeenIds(getSeenIds())
  }, [isStudio])

  function handleOpened(id: string) {
    markSeen(id)
    setSeenIds((prev) => new Set([...prev, id]))
  }

  useEffect(() => {
    if (!showSuccess) return
    const timer = setTimeout(() => {
      setShowSuccess(false)
      router.refresh()
    }, 2000)
    return () => clearTimeout(timer)
  }, [showSuccess, router])

  function handleDeleted(id: string) {
    setDeletedIds((prev) => new Set([...prev, id]))
    setShowSuccess(true)
  }

  function handleSearch(value: string) {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  return (
    <div>
      {isStudio && (
        <div className="relative mb-6">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search projects by title…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-11 pr-4 text-sm text-white placeholder-zinc-500 outline-none backdrop-blur-sm transition focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/30"
          />
        </div>
      )}

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-5 py-3.5">
              <CheckCircleIcon className="size-5 shrink-0 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-100">
                Project removed successfully
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {visibleProjects.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/2 p-8 text-center shadow-2xl shadow-violet-500/5 backdrop-blur-sm">
          <p className="text-sm text-zinc-400">
            {isStudio && searchQuery.trim()
              ? <>No projects matching &ldquo;{searchQuery.trim()}&rdquo;</>
              : 'No projects'}
          </p>
        </div>
      )}

      <FadeInStagger faster key={`${currentPage}-${searchQuery}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {paginatedProjects.map((project) => {
            const isMixing = project.status === 'mixing' || project.status === 'processing'
            return (
              <FadeIn key={project.id}>
                <ProjectCard
                  project={project}
                  canDelete={isStudio || project.owner_id === userId}
                  onDeleted={handleDeleted}
                  isNewProject={isStudio && isMixing && !seenIds.has(project.id)}
                  isInProgress={isMixing && (!isStudio || seenIds.has(project.id))}
                  onOpened={isStudio ? handleOpened : undefined}
                />
              </FadeIn>
            )
          })}
        </div>
      </FadeInStagger>

      {totalPages >= 1 && (
        <div className={`flex items-center justify-center gap-2 ${paginatedProjects.length < PROJECTS_PER_PAGE ? 'mt-16' : 'mt-8'}`}>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="size-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setCurrentPage(page)}
              className={`inline-flex size-9 items-center justify-center rounded-xl border text-sm font-medium transition ${
                page === currentPage
                  ? 'border-violet-500/40 bg-violet-500/15 text-white'
                  : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:bg-white/10 hover:text-white'
              }`}
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
