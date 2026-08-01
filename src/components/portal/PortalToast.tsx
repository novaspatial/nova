'use client'

// Portal-wide transient notices. Mounted in the portal root layout on purpose:
// `[projectId]/layout.tsx` keys its subtree on `project.status`, so a toast
// owned by a page component would be unmounted by the very status change it
// reports. Anything above that key survives the router.refresh() that follows
// a transition.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'

import {
  portalOverlaySurface,
  portalSpring,
  portalToneStyles,
  type PortalTone,
} from '@/components/portal/portalTones'

// The two tones a confirmation ever needs: 'success' for a handoff that
// reached the client, 'violet' for a step that only moved things forward.
type PortalToastTone = Extract<PortalTone, 'success' | 'violet'>

export interface PortalToastInput {
  title: string
  body?: string
  tone?: PortalToastTone
  durationMs?: number
}

interface PortalToastItem extends PortalToastInput {
  id: string
}

const DEFAULT_DURATION_MS = 7000
const MAX_VISIBLE = 3

const noop = () => {}

const PortalToastContext = createContext<
  ((toast: PortalToastInput) => void) | null
>(null)

// A toast is feedback, never a contract — outside a provider (a unit test
// rendering one portal component in isolation) showing one is a no-op rather
// than a throw, unlike `useProject`.
export function usePortalToast(): (toast: PortalToastInput) => void {
  return useContext(PortalToastContext) ?? noop
}

export function PortalToastProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [toasts, setToasts] = useState<PortalToastItem[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (toast: PortalToastInput) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { ...toast, id }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), toast.durationMs ?? DEFAULT_DURATION_MS),
      )
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  return (
    <PortalToastContext.Provider value={showToast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-full sm:max-w-sm"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            // A toast's title/body take the tone's note text pair — the same
            // tinted heading + muted body the dialog's note block uses.
            const styles = portalToneStyles[toast.tone ?? 'success']
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={portalSpring}
                role="status"
                className={`pointer-events-auto w-full rounded-2xl backdrop-blur-md ${portalOverlaySurface}`}
              >
                <div className={`h-1 w-full ${styles.rail}`} />
                <div className="flex items-start gap-3 p-4">
                  <CheckCircleIcon
                    className={`mt-0.5 size-5 shrink-0 ${styles.icon}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${styles.noteTitle}`}>
                      {toast.title}
                    </p>
                    {toast.body && (
                      <p className={`mt-1 text-sm ${styles.noteBody}`}>
                        {toast.body}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    aria-label={`Dismiss notification: ${toast.title}`}
                    className="-m-1 shrink-0 rounded-lg p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                  >
                    <XMarkIcon className="size-4" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </PortalToastContext.Provider>
  )
}
