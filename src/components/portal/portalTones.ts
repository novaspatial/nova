// The portal's tone vocabulary, in one place. PortalConfirmDialog established
// it (gradient rail + tinted icon/eyebrow/note pair + error block + confirm
// button); every portal surface that speaks in tones imports from here so a
// tone renders identically wherever it appears. Field names are the dialog's
// original ones — callers with a different anatomy map onto them locally.

export type PortalTone = 'danger' | 'success' | 'violet' | 'amber'

export const portalToneStyles: Record<
  PortalTone,
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
    rail: 'bg-linear-to-r from-red-800 via-rose-500 to-pink-400',
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
      'bg-linear-to-r from-red-800 via-rose-500 to-pink-400 shadow-rose-900/30 hover:brightness-110',
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

// The portal's overlay surface — the confirm dialog's card, minus its radius
// so each caller can size it (dialog: rounded-3xl, toast: rounded-2xl).
export const portalOverlaySurface =
  'overflow-hidden border border-white/10 bg-zinc-950/95 shadow-2xl'

// One spring for portal surfaces entering and leaving.
export const portalSpring = {
  type: 'spring',
  stiffness: 280,
  damping: 28,
} as const
