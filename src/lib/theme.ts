import { useSyncExternalStore } from 'react'

// Darstellung pro Gerät (Studio-Standard 6): auto | light | dark, Standard auto.
// Das kleine Skript in index.html setzt `data-theme` schon vor dem ersten Zeichnen.
// Ein Modul-Store mit genau einem Listener auf die Systemeinstellung, damit alle
// Komponenten denselben Modus sehen.

export type ThemeMode = 'auto' | 'light' | 'dark'

const KEY = 'studio-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* Standard */
  }
  return 'auto'
}

function apply() {
  const dark = mode === 'dark' || (mode === 'auto' && media.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  // Statusleiste in der Farbe des Hintergrunds (--bg)
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', dark ? '#141012' : '#FAF7F2')
}

// Alte Einstellung (vor dem Studio-Umbau) übernehmen
try {
  const old = localStorage.getItem('gewohnheiten:theme')
  if (old) {
    if (old === 'light' || old === 'dark') localStorage.setItem(KEY, old)
    localStorage.removeItem('gewohnheiten:theme')
  }
} catch {
  /* egal */
}

let mode: ThemeMode = readMode()
const listeners = new Set<() => void>()
apply()
media.addEventListener('change', apply)

function setMode(m: ThemeMode) {
  try {
    if (m === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, m)
  } catch {
    /* nur für diese Sitzung */
  }
  mode = m
  apply()
  listeners.forEach((l) => l())
}

export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => mode,
  )
  return [current, setMode]
}
