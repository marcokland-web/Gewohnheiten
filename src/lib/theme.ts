import { useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'gewohnheiten:theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* Standard */
  }
  return 'system'
}

function apply(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#070d1c' : '#1e40af')
}

apply(readMode())

export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(readMode)

  useEffect(() => {
    apply(mode)
    const onChange = () => apply(mode)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mode])

  return [
    mode,
    (m) => {
      try {
        localStorage.setItem(KEY, m)
      } catch {
        /* nur für diese Sitzung */
      }
      setMode(m)
    },
  ]
}
