'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { AnimatePresence, motion } from 'framer-motion'
import { FadeIn, FadeInStagger } from '@/components/ui/FadeIn'
import { ProjectCard } from './ProjectCard'
import type { Project } from '@/types/portal'

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
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())

  // Hydrate seen IDs from localStorage once on mount (client only)
  useEffect(() => {
    if (!isStudio) return
    setSeenIds(getSeenIds())
  }, [isStudio])

  // Mark the newest mixing project as seen after first render
  const newestMixingProject =
    isStudio &&
    projects[0] &&
    (projects[0].status === 'mixing' || projects[0].status === 'processing')
      ? projects[0]
      : null

  useEffect(() => {
    if (!newestMixingProject) return
    if (seenIds.has(newestMixingProject.id)) return
    // Give the banner a moment to render before marking seen
    const timer = setTimeout(() => {
      markSeen(newestMixingProject.id)
      setSeenIds((prev) => new Set([...prev, newestMixingProject.id]))
    }, 3000)
    return () => clearTimeout(timer)
  }, [newestMixingProject, seenIds])

  useEffect(() => {
    if (!showSuccess) return
    const timer = setTimeout(() => {
      setShowSuccess(false)
      router.refresh()
    }, 2000)
    return () => clearTimeout(timer)
  }, [showSuccess, router])

  function handleDeleted() {
    setShowSuccess(true)
  }

  return (
    <div>
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

      <FadeInStagger faster>
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const isNewProject =
              newestMixingProject?.id === project.id &&
              !seenIds.has(project.id)
            return (
              <FadeIn key={project.id}>
                <ProjectCard
                  project={project}
                  canDelete={isStudio || project.owner_id === userId}
                  onDeleted={handleDeleted}
                  isNewProject={isNewProject}
                />
              </FadeIn>
            )
          })}
        </div>
      </FadeInStagger>
    </div>
  )
}
