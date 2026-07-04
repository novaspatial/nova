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

// --- Lifecycle transitions -------------------------------------------------
//
// Three actors drive the lifecycle (ARCHITECTURE.md): the payment machinery
// ('system': Stripe webhook, payment-status poll) moves pending_payment →
// uploading; the client submits their stems (uploading → in_review); the
// studio drives everything after. The table is a forward-only allowlist —
// no self-loops, nothing targets pending_payment, and delivery is reachable
// only from review/revision/approved. The DB mirrors the client rule with a
// role-fence trigger (20260705_harden_status_writes.sql); this table is the
// single app-level source of transition truth.

export type Actor = 'client' | 'studio' | 'system'

// The one place that knows `processing` is the legacy synonym of `mixing`
// (CONTEXT.md). Existing rows may still hold it, so it keeps mixing's
// outgoing edges — but no transition targets it, which retires the value.
export function canonicalStatus(status: ProjectStatus): ProjectStatus {
  return status === 'processing' ? 'mixing' : status
}

const transitions: Record<
  Actor,
  Partial<Record<ProjectStatus, readonly ProjectStatus[]>>
> = {
  system: {
    pending_payment: ['uploading'],
  },
  client: {
    uploading: ['in_review'],
  },
  studio: {
    // uploading → in_review lets the studio force-advance a stalled client;
    // in_review offers only mixing (no mix can exist before mixing starts).
    uploading: ['in_review'],
    in_review: ['mixing'],
    mixing: ['review'],
    review: ['revision', 'approved', 'delivered'],
    revision: ['review', 'delivered'],
    approved: ['delivered'],
  },
}

export function canTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  actor: Actor,
): boolean {
  return (transitions[actor][canonicalStatus(from)] ?? []).includes(to)
}

export function canUploadStems(status: ProjectStatus): boolean {
  return status === 'uploading'
}

export function canUploadMix(status: ProjectStatus): boolean {
  const canonical = canonicalStatus(status)
  return canonical === 'mixing' || canonical === 'review' || canonical === 'revision'
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === 'string' &&
    (PROJECT_STATUSES as readonly string[]).includes(value)
  )
}

// Statuses that email the client when entered. An explicit list, not derived
// from the transition table: revision/approved are deliberately silent.
export const NOTIFIABLE_STATUSES = [
  'in_review',
  'processing',
  'mixing',
  'review',
  'delivered',
] as const

export type NotifiableStatus = (typeof NOTIFIABLE_STATUSES)[number]

export function isNotifiableStatus(value: string): value is NotifiableStatus {
  return (NOTIFIABLE_STATUSES as readonly string[]).includes(value)
}
