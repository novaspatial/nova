'use client'

import { useCallback, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useProject } from '@/components/portal/ProjectContext'
import { PortalConfirmDialog } from '@/components/portal/PortalConfirmDialog'

export function DeliverBanner() {
  const router = useRouter()
  const pathname = usePathname()
  const { projectId, projectStatus, isStudio } = useProject()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [delivering, setDelivering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDeliver = useCallback(async () => {
    setDelivering(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Failed to deliver project.')
      }
      setDialogOpen(false)
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Network error while delivering the project.',
      )
    } finally {
      setDelivering(false)
    }
  }, [projectId, router])

  const onListenPage = pathname.endsWith('/listen')
  const canDeliver = isStudio && projectStatus !== 'delivered' && onListenPage

  if (!canDeliver) return null

  return (
    <>
      <div className="flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-6 text-center backdrop-blur-sm">
        <p className="text-sm font-semibold text-emerald-300">
          Ready to deliver?
        </p>
        <p className="mt-1 text-sm text-emerald-300/60">
          Finalize this project and notify the client that their mix has been
          delivered.
        </p>
        {error && (
          <p className="mt-3 w-full rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setError(null)
            setDialogOpen(true)
          }}
          disabled={delivering}
          className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 backdrop-blur-sm transition hover:bg-emerald-500/90 hover:shadow-emerald-500/35 disabled:opacity-50"
        >
          Deliver
        </button>
      </div>

      <PortalConfirmDialog
        isOpen={dialogOpen}
        tone="success"
        eyebrow="Deliver"
        title="Deliver this project?"
        description="This will mark the project as delivered and email the client that their mix is ready."
        noteTitle="Delivery is the final step."
        noteBody="Make sure any outstanding revisions are resolved before delivering."
        confirmLabel="Deliver"
        busyLabel="Delivering..."
        cancelLabel="Not Yet"
        isBusy={delivering}
        errorMessage={error}
        onClose={() => {
          if (!delivering) {
            setDialogOpen(false)
          }
        }}
        onConfirm={() => void handleDeliver()}
      />
    </>
  )
}
