import { useState } from 'react'
import { T } from '../lib/i18n'

export interface Bar {
  /** Kurz unter dem Balken, z. B. „Mo“ oder „Okt“ */
  label: string
  /** Ausführlich für Hover und Screenreader, z. B. „Oktober 2026“ */
  title: string
  /** Wert 0..max, null = keine Daten */
  value: number | null
  /** Anzeige des Werts, z. B. „82 %“ */
  display: string
  highlight?: boolean
}

/**
 * Einfaches Säulendiagramm (eine Reihe, Farbe --brand).
 * Antippen, Hover oder Tastatur zeigt den Wert in der Kopfzeile des Diagramms.
 */
export function BarChart({ bars, max = 1, summary, height = 120 }: { bars: Bar[]; max?: number; summary: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null)
  const a = active !== null ? bars[active] : null
  const every = bars.length > 8 ? 3 : 1

  function pick(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setActive(Math.max(0, Math.min(bars.length - 1, Math.floor(((e.clientX - r.left) / r.width) * bars.length))))
  }

  return (
    <div>
      <p className="t-sub mb-2 min-h-5 text-ink-2" aria-live="polite">
        {a ? (
          <>
            <span className="text-ink">{a.title}</span> · <span className="t-num font-semibold text-ink">{a.value === null ? T('keine Daten', 'no data') : a.display}</span>
          </>
        ) : (
          summary
        )}
      </p>
      <div
        className="relative touch-pan-y"
        style={{ height }}
        onMouseLeave={() => setActive(null)}
        // Antippen und Wischen über die ganze Fläche wählt den Balken unter dem Finger
        onPointerDown={(e) => e.pointerType !== 'mouse' && pick(e)}
        onPointerMove={(e) => e.pointerType !== 'mouse' && e.buttons && pick(e)}
      >
        {/* zurückhaltende Hilfslinien bei 50 % und 100 % */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-separator" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-separator" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-separator" aria-hidden />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {bars.map((b, i) => {
            const h = b.value === null ? 0 : Math.max(0, Math.min(1, b.value / max))
            return (
              <button
                key={i}
                type="button"
                className="group flex h-full min-w-0 flex-1 items-end justify-center"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${b.title}: ${b.value === null ? T('keine Daten', 'no data') : b.display}`}
              >
                {b.value === null ? (
                  <span className="mb-0 h-[3px] w-full max-w-7 rounded-full bg-fill" />
                ) : (
                  <span
                    className={`w-full max-w-7 rounded-t-[4px] transition-[height,opacity] duration-300 ${active !== null && active !== i ? 'opacity-45' : ''}`}
                    style={{
                      height: `${Math.max(h * 100, 1.5)}%`,
                      // Laufender Zeitraum: Gold mit Schraffur, damit er nicht nur am Farbton erkennbar ist
                      background: b.highlight
                        ? 'repeating-linear-gradient(135deg, var(--gold-ink) 0 4px, color-mix(in srgb, var(--gold-ink) 55%, transparent) 4px 7px)'
                        : 'var(--brand)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px]" aria-hidden>
        {bars.map((b, i) => (
          <span key={i} className={`t-foot flex min-w-0 flex-1 justify-center overflow-visible whitespace-nowrap ${active === i ? 'font-semibold text-ink' : 'text-ink-2'}`}>
            {i % every === (bars.length - 1) % every ? b.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
