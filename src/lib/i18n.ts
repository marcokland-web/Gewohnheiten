import { useSyncExternalStore } from 'react'

// Sprache pro Gerät (Studio-Standard 7): Deutsch ist Standard.
// Der Schlüssel `studio-lang` ist im ganzen Studio gleich und daher ohne App-Präfix.

export type Lang = 'de' | 'en'

const KEY = 'studio-lang'

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'de'
  } catch {
    return 'de'
  }
}

let lang: Lang = readLang()
document.documentElement.lang = lang
const listeners = new Set<() => void>()

export function getLang(): Lang {
  return lang
}

export function setLang(next: Lang) {
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* nur für diese Sitzung */
  }
  lang = next
  document.documentElement.lang = next
  listeners.forEach((l) => l())
}

/** Übersetzung nach aktueller Sprache. In Komponenten zusätzlich `useLang()` aufrufen, damit neu gezeichnet wird. */
export function T(de: string, en: string): string {
  return lang === 'en' ? en : de
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => lang,
  )
}

export const locale = () => (lang === 'en' ? 'en-GB' : 'de-DE')

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString(locale(), { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

/** Prozent ohne Nachkommastellen, z. B. „87 %“ bzw. „87%“ */
export function formatPercent(rate: number): string {
  return (rate).toLocaleString(locale(), { style: 'percent', maximumFractionDigits: 0 })
}

/** Veränderung in Prozentpunkten mit Vorzeichen, z. B. „+12 Pkt.“ / „−5 pts“ */
export function formatDelta(delta: number): string {
  const pts = Math.round(delta * 100)
  const sign = pts > 0 ? '+' : pts < 0 ? '−' : '±'
  return `${sign}${Math.abs(pts)} ${T('Pkt.', 'pts')}`
}

/** Mehrzahl: plural(n, 'Tag', 'Tage', 'day', 'days') */
export function plural(n: number, deOne: string, deMany: string, enOne: string, enMany: string): string {
  return n === 1 ? T(deOne, enOne) : T(deMany, enMany)
}
