import { useEffect, type ReactNode } from 'react'

export const HABIT_COLORS: Record<string, string> = {
  blue: '#2563eb',
  sky: '#0ea5e9',
  indigo: '#4f46e5',
  cyan: '#0891b2',
  teal: '#0d9488',
  violet: '#7c3aed',
}

export const habitColor = (c: string) => HABIT_COLORS[c] ?? HABIT_COLORS.blue

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-bg px-4 pt-4 pb-safe shadow-2xl sm:max-w-lg sm:rounded-3xl sm:pb-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Schließen">
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-accent text-accent-ink hover:brightness-110',
    ghost: 'bg-surface-2 text-ink border border-line hover:brightness-105',
    danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
  }[variant]
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition disabled:opacity-50 ${styles} ${className}`}
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25'

const svg = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const IconX = () => (
  <svg {...svg}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
export const IconCheck = ({ size = 20 }: { size?: number }) => (
  <svg {...svg} width={size} height={size} strokeWidth={3}><path d="M20 6 9 17l-5-5" /></svg>
)
export const IconPlus = () => (
  <svg {...svg}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconGear = () => (
  <svg {...svg}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
)
export const IconBack = () => (
  <svg {...svg}><path d="m15 18-6-6 6-6" /></svg>
)
export const IconNote = () => (
  <svg {...svg} width={16} height={16}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
export const IconBell = () => (
  <svg {...svg} width={14} height={14}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
)
export const IconFlame = () => (
  <svg {...svg} width={14} height={14}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
)
export const IconCloudOff = () => (
  <svg {...svg} width={14} height={14}><path d="m2 2 20 20M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.2M21.53 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 9.5 5.06" /></svg>
)
export const IconUp = () => (
  <svg {...svg} width={16} height={16}><path d="m18 15-6-6-6 6" /></svg>
)
export const IconDown = () => (
  <svg {...svg} width={16} height={16}><path d="m6 9 6 6 6-6" /></svg>
)
