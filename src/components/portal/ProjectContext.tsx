'use client'

import { createContext, useContext } from 'react'
import type { ProjectStatus } from '@/types/portal'

interface ProjectContextValue {
  projectId: string
  projectTitle: string
  projectStatus: ProjectStatus
  userRole: 'client' | 'studio'
  isStudio: boolean
}

export const ProjectContext = createContext<ProjectContextValue | null>(null)

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within <ProjectProvider>')
  return ctx
}

export function ProjectProvider({
  value,
  children,
}: {
  value: ProjectContextValue
  children: React.ReactNode
}) {
  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}
