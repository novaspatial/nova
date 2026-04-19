import type { ProjectStatus } from '@/types/portal'

export const PROJECT_STATUSES = [
  'uploading',
  'in_review',
  'processing',
  'mixing',
  'review',
  'revision',
  'approved',
  'delivered',
] as const

export type { ProjectStatus }

export type PortalStep = 'upload' | 'listen'

export type ProgressStage = 'uploaded' | 'in_progress' | 'mixed' | 'complete'

export function getStepForStatus(status: ProjectStatus): PortalStep {
  switch (status) {
    case 'uploading':
    case 'in_review':
    case 'processing':
    case 'mixing':
      return 'upload'
    case 'review':
    case 'revision':
    case 'approved':
    case 'delivered':
      return 'listen'
  }
}

const clientUnlockedSteps: Record<ProjectStatus, PortalStep[]> = {
  uploading: ['upload'],
  in_review: ['upload'],
  processing: ['upload'],
  mixing: ['upload'],
  review: ['upload', 'listen'],
  revision: ['upload', 'listen'],
  approved: ['upload', 'listen'],
  delivered: ['upload', 'listen'],
}

const studioUnlockedSteps: Record<ProjectStatus, PortalStep[]> = {
  uploading: ['upload'],
  in_review: ['upload'],
  processing: ['upload'],
  mixing: ['upload'],
  review: ['upload', 'listen'],
  revision: ['upload', 'listen'],
  approved: ['upload', 'listen'],
  delivered: ['upload', 'listen'],
}

export function getUnlockedSteps(
  status: ProjectStatus,
  role: 'client' | 'studio',
): PortalStep[] {
  return role === 'studio'
    ? studioUnlockedSteps[status]
    : clientUnlockedSteps[status]
}

const statusDisplayMap: Record<ProjectStatus, { label: string; color: string }> = {
  uploading: {
    label: 'Uploading',
    color: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  },
  in_review: {
    label: 'In Review',
    color: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  },
  processing: {
    label: 'Mixing',
    color: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
  mixing: {
    label: 'Mixing',
    color: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
  review: {
    label: 'Mix Available',
    color: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  },
  revision: {
    label: 'Revision',
    color: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
  approved: {
    label: 'Approved',
    color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  },
}

export function getStatusDisplay(status: ProjectStatus): { label: string; color: string } {
  return statusDisplayMap[status]
}

const progressStageMap: Record<ProjectStatus, ProgressStage> = {
  uploading: 'uploaded',
  in_review: 'uploaded',
  processing: 'in_progress',
  mixing: 'in_progress',
  review: 'mixed',
  revision: 'mixed',
  approved: 'complete',
  delivered: 'complete',
}

export function getProgressStage(status: ProjectStatus): ProgressStage {
  return progressStageMap[status]
}
