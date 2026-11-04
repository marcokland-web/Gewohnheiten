import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { T, useLang } from '../lib/i18n'

// Gespeicherte Schlüssel bleiben (blue, sky, …), die Farben kommen aus der Familienpalette
// und sind je Thema in index.css als --hc-* hinterlegt.
export const HABIT_COLORS = ['blue', 'sky', 'indigo', 'cyan', 'teal', 'violet'] as const

export const habitColor = (c: string) => `var(--hc-${(HABIT_COLORS as readonly string[]).includes(c) ? c : 'blue'})`

/** Farbe mit Deckkraft, z. B. für Symbol-Hintergründe */
export const habitTint = (c: string, pct: number) => `color-mix(in srgb, ${habitColor(c)} ${pct}%, transparent)`

export function habitColorName(c: string): string {
  const names: Record<string, [string, string]> = {
    blue: ['Bordeaux', 'Burgundy'],
    sky: ['Gold', 'Gold'],
    indigo: ['Rosé', 'Rose'],
    cyan: ['Salbei', 'Sage'],
    teal: ['Tanne', 'Fir'],
    violet: ['Pflaume', 'Plum'],
  }
  const [de, en] = names[c] ?? names.blue
  return T(de, en)
}

/** Offene Sheets, oberstes zuletzt: Esc und Tab wirken nur im obersten */
const sheetStack: object[] = []

/** iPhone: Sheet von unten mit Griff. iPad/Desktop: Dialog in der Mitte (max. 440 px). */
export function Sheet({
  title,
  onClose,
  children,
  done,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  /** Beschriftung des Knopfs oben rechts, z. B. „Fertig“. Ohne: runder Schließen-Knopf. */
  done?: string
}) {
  useLang()
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Startfokus: Element mit data-autofocus, sonst das erste Eingabefeld, sonst der Dialog selbst
    const el = panel.current!
    if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus()

    const token = {}
    sheetStack.push(token)

    const onKey = (e: KeyboardEvent) => {
      if (sheetStack[sheetStack.length - 1] !== token) return
      if (e.key === 'Escape') return closeRef.current()
      if (e.key !== 'Tab') return
      // Fokus bleibt im Dialog
      const items = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type=hidden]):not([hidden]), textarea, select, [tabindex]:not([tabindex="-1"])')]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      sheetStack.splice(sheetStack.indexOf(token), 1)
      document.body.style.overflow = prev
      // Nur entsperren, wenn kein weiteres Sheet offen ist
      if (!document.querySelector('[data-sheet]')) root?.removeAttribute('inert')
      opener?.focus?.()
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-labelledby={titleId} data-sheet>
      <div className="absolute inset-0 bg-[rgb(20_10_15/0.32)] backdrop-blur-[6px]" onClick={onClose} />
      <div ref={panel} tabIndex={-1} className="glass-strong sheet-in relative max-h-[92dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-[20px] px-4 pb-safe outline-none md:max-w-[440px] md:rounded-[20px] md:px-5 md:pb-5">
        <div className="sticky top-0 z-10 -mx-4 mb-4 bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-4 pt-2 md:-mx-5 md:px-5 md:pt-4">
        <div className="mx-auto mb-2 h-1.5 w-9 rounded-full bg-separator md:hidden" aria-hidden />
        <div className="flex min-h-11 items-center justify-between gap-3 pb-1">
          <h2 id={titleId} className="t-headline min-w-0 truncate">{title}</h2>
          {done ? (
            <button onClick={onClose} className="-mr-2 min-h-11 rounded-[10px] px-2 font-semibold text-brand">
              {done}
            </button>
          ) : (
            <button onClick={onClose} className="glass -mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2" aria-label={T('Schließen', 'Close')}>
              <IconX />
            </button>
          )}
        </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Rückfrage mit rotem Knopf, z. B. vor dem Löschen */
export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="t-sub text-ink-2">{message}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="tinted" onClick={onClose} data-autofocus>{T('Abbrechen', 'Cancel')}</Button>
        <Button variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Sheet>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'tinted' | 'danger' | 'destructive' }) {
  const styles = {
    primary: 'btn-primary hover:brightness-110',
    tinted: 'bg-fill text-ink hover:brightness-[0.97] dark:hover:brightness-110',
    danger: 'bg-fill text-danger hover:brightness-[0.97] dark:hover:brightness-110',
    destructive: 'bg-danger text-white dark:text-[#141012] hover:brightness-110',
  }[variant]
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 font-semibold transition disabled:opacity-50 ${styles} ${className}`}
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="t-foot mb-1.5 block font-medium text-ink-2">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full min-h-11 rounded-lg border border-separator bg-surface px-3 py-2.5 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25'

/** Segment-Steuerung als Radio-Gruppe (Tastatur und Screenreader) */
export function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string
  value: V
  options: { value: V; label: string }[]
  onChange: (v: V) => void
  className?: string
}) {
  const name = useId()
  return (
    <div className={`seg ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.value}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  )
}

/** Gruppierte Liste im iOS-Stil mit Überschrift */
export function Group({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      {title && <h3 className="t-foot mb-1.5 px-4 font-medium text-ink-2 uppercase">{title}</h3>}
      <div className="card overflow-hidden">{children}</div>
      {footer && <div className="t-foot mt-1.5 px-4 text-ink-2">{footer}</div>}
    </section>
  )
}

/** Zeile in einer gruppierten Liste; Trennlinie ab Textanfang */
export function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`relative flex min-h-11 items-center gap-3 px-4 py-2.5 [&+&]:before:absolute [&+&]:before:top-0 [&+&]:before:right-0 [&+&]:before:left-4 [&+&]:before:h-px [&+&]:before:bg-separator ${className}`}>{children}</div>
}

/** Rundes Glas-Knöpfchen (44 × 44) für die Kopfzeile */
export function GlassIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="glass flex size-11 shrink-0 items-center justify-center rounded-full text-ink" aria-label={label} title={label}>
      {children}
    </button>
  )
}

const svg = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export const IconX = () => (
  <svg {...svg}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
export const IconCheck = ({ size = 20 }: { size?: number }) => (
  <svg {...svg} width={size} height={size} strokeWidth={3}><path d="M20 6 9 17l-5-5" /></svg>
)
export const IconPlus = () => (
  <svg {...svg} width={22} height={22}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconGear = () => (
  <svg {...svg} width={22} height={22} strokeWidth={1.8}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
)
export const IconBack = () => (
  <svg {...svg} width={22} height={22}><path d="m15 18-6-6 6-6" /></svg>
)
export const IconNote = () => (
  <svg {...svg} width={18} height={18}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
export const IconBell = () => (
  <svg {...svg} width={14} height={14}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
)
export const IconCloudOff = () => (
  <svg {...svg} width={14} height={14}><path d="m2 2 20 20M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.2M21.53 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 9.5 5.06" /></svg>
)
export const IconUp = () => (
  <svg {...svg} width={18} height={18}><path d="m18 15-6-6-6 6" /></svg>
)
export const IconDown = () => (
  <svg {...svg} width={18} height={18}><path d="m6 9 6 6 6-6" /></svg>
)
export const IconToday = ({ size = 24 }: { size?: number }) => (
  <svg {...svg} width={size} height={size} strokeWidth={1.8}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
)
export const IconChart = ({ size = 24 }: { size?: number }) => (
  <svg {...svg} width={size} height={size} strokeWidth={1.8}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
)
export const IconChevron = () => (
  <svg {...svg} width={16} height={16}><path d="m9 18 6-6-6-6" /></svg>
)
