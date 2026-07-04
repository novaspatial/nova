import type { ProjectStatus } from '@/types/portal'

export const PROJECT_STATUSES = [
  'pending_payment',
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
    case 'pending_payment':
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

// The client and studio tables are intentionally identical today (both
// roles see the same steps once payment clears). Keeping them separate
// means the two roles can diverge later — e.g. giving studio early access
// to `listen` during `processing` — without restructuring callers.
const clientUnlockedSteps: Record<ProjectStatus, PortalStep[]> = {
  pending_payment: [],
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
  pending_payment: [],
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
  pending_payment: {
    label: 'Pending Payment',
    color: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  },
  uploading: {
    // Not an in-progress system action — the project is paid and waiting on
    // the client to upload stems and submit. Labelled/coloured to read as
    // "your move", not a passive "we're uploading". See ProjectCard banner.
    label: 'Awaiting Stems',
    color: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
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
  pending_payment: 'uploaded',
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
