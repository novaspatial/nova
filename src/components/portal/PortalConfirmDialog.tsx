'use client'

import { useId } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

type PortalConfirmTone = 'danger' | 'success' | 'violet' | 'amber'

const toneStyles: Record<
  PortalConfirmTone,
  {
    rail: string
    iconWrap: string
    icon: string
    eyebrow: string
    noteBorder: string
    noteBg: string
    noteTitle: string
    noteBody: string
    errorBorder: string
    errorBg: string
    errorText: string
    confirmButton: string
  }
> = {
  danger: {
    rail: 'bg-linear-to-r from-rose-500 via-orange-400 to-amber-300',
    iconWrap: 'bg-rose-500/12 ring-1 ring-rose-400/20',
    icon: 'text-rose-300',
    eyebrow: 'text-rose-300/80',
    noteBorder: 'border-white/10',
    noteBg: 'bg-white/5',
    noteTitle: 'text-white',
    noteBody: 'text-zinc-400',
    errorBorder: 'border-rose-500/20',
    errorBg: 'bg-rose-500/10',
    errorText: 'text-rose-200',
    confirmButton:
      'bg-linear-to-r from-rose-600 via-rose-500 to-orange-400 shadow-rose-900/30 hover:brightness-110',
  },
  success: {
    rail: 'bg-linear-to-r from-emerald-500 via-teal-400 to-cyan-300',
    iconWrap: 'bg-emerald-500/12 ring-1 ring-emerald-400/20',
    icon: 'text-emerald-300',
    eyebrow: 'text-emerald-300/80',
    noteBorder: 'border-emerald-500/20',
    noteBg: 'bg-emerald-500/10',
    noteTitle: 'text-emerald-100',
    noteBody: 'text-emerald-200/70',
    errorBorder: 'border-rose-500/20',
    errorBg: 'bg-rose-500/10',
    errorText: 'text-rose-200',
    confirmButton:
      'bg-linear-to-r from-emerald-600 via-emerald-500 to-teal-400 shadow-emerald-950/30 hover:brightness-110',
  },
  violet: {
    rail: 'bg-linear-to-r from-violet-500 via-fuchsia-400 to-sky-300',
    iconWrap: 'bg-violet-500/12 ring-1 ring-violet-400/20',
    icon: 'text-violet-300',
    eyebrow: 'text-violet-300/80',
    noteBorder: 'border-violet-500/20',
    noteBg: 'bg-violet-500/10',
    noteTitle: 'text-violet-100',
    noteBody: 'text-violet-200/70',
    errorBorder: 'border-rose-500/20',
    errorBg: 'bg-rose-500/10',
    errorText: 'text-rose-200',
    confirmButton:
      'bg-linear-to-r from-violet-600 via-violet-500 to-fuchsia-400 shadow-violet-950/30 hover:brightness-110',
  },
  amber: {
    rail: 'bg-linear-to-r from-amber-500 via-orange-400 to-yellow-300',
    iconWrap: 'bg-amber-500/12 ring-1 ring-amber-400/20',
    icon: 'text-amber-300',
    eyebrow: 'text-amber-300/80',
    noteBorder: 'border-amber-500/20',
    noteBg: 'bg-amber-500/10',
    noteTitle: 'text-amber-100',
    noteBody: 'text-amber-200/70',
    errorBorder: 'border-rose-500/20',
    errorBg: 'bg-rose-500/10',
    errorText: 'text-rose-200',
    confirmButton:
      'bg-linear-to-r from-amber-600 via-orange-500 to-yellow-400 shadow-amber-950/30 hover:brightness-110',
  },
}

export function PortalConfirmDialog({
  isOpen,
  title,
  description,
  eyebrow,
  noteTitle,
  noteBody,
  confirmLabel,
  busyLabel,
  cancelLabel = 'Cancel',
  isBusy = false,
  errorMessage,
  tone = 'violet',
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  title: string
  description?: React.ReactNode
  eyebrow?: string
  noteTitle?: string
  noteBody?: string
  confirmLabel: string
  busyLabel?: string
  cancelLabel?: string
  isBusy?: boolean
  errorMessage?: string | null
  tone?: PortalConfirmTone
  onClose: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  const styles = toneStyles[tone]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className={`h-1 w-full ${styles.rail}`} />
            <div className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  {eyebrow && (
                    <p
                      className={`text-xs font-semibold uppercase tracking-[0.22em] ${styles.eyebrow}`}
                    >
                      {eyebrow}
                    </p>
                  )}
                  <h3
                    id={titleId}
                    className="mt-2 font-display text-2xl font-semibold text-white"
                  >
                    {title}
                  </h3>
                  {description && (
                    <div className="mt-2 text-sm leading-6 text-zinc-400">
                      {description}
                    </div>
                  )}
                </div>
                <div
                  className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${styles.iconWrap}`}
                >
                  <ExclamationTriangleIcon className={`size-7 ${styles.icon}`} />
                </div>
              </div>

              {(noteTitle || noteBody) && (
                <div
                  className={`mt-5 rounded-2xl border p-4 ${styles.noteBorder} ${styles.noteBg}`}
                >
                  {noteTitle && (
                    <p className={`text-sm font-medium ${styles.noteTitle}`}>
                      {noteTitle}
                    </p>
                  )}
                  {noteBody && (
                    <p className={`mt-1 text-sm ${styles.noteBody}`}>{noteBody}</p>
                  )}
                </div>
              )}

              {errorMessage && (
                <p
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${styles.errorBorder} ${styles.errorBg} ${styles.errorText}`}
                >
                  {errorMessage}
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isBusy}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isBusy}
                  className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${styles.confirmButton}`}
                >
                  {isBusy ? busyLabel || 'Working...' : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
