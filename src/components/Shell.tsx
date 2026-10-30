import { createContext, useContext, type ReactNode } from 'react'
import { T, useLang } from '../lib/i18n'
import { GlassIconButton, IconChart, IconGear, IconToday } from './ui'

export type Tab = 'today' | 'analysis'

interface Nav {
  tab: Tab
  setTab: (t: Tab) => void
  openSettings: () => void
}

export const NavContext = createContext<Nav | null>(null)

const useNav = () => useContext(NavContext)

function tabs(): { id: Tab; label: string; icon: (size?: number) => ReactNode }[] {
  return [
    { id: 'today', label: T('Heute', 'Today'), icon: (s) => <IconToday size={s} /> },
    { id: 'analysis', label: T('Analyse', 'Insights'), icon: (s) => <IconChart size={s} /> },
  ]
}

/**
 * Seitengerüst: schwebende Glas-Kopfzeile mit Zahnrad oben rechts,
 * Navigation als Tab-Leiste (iPhone), Pille (iPad) oder Seitenleiste (Desktop).
 */
export function Page({ left, title, actions, children, wide = false }: { left?: ReactNode; title?: string; actions?: ReactNode; children: ReactNode; wide?: boolean }) {
  useLang()
  const nav = useNav()
  return (
    <div className="lg:flex lg:gap-5 lg:px-5">
      {nav && <Sidebar nav={nav} />}
      <div className={`mx-auto w-full min-w-0 px-4 md:px-5 lg:px-0 ${wide ? 'max-w-4xl' : 'max-w-2xl'} ${nav ? 'pb-tabbar' : 'pb-safe'}`}>
        <header className="glass top-safe mt-safe sticky z-30 flex min-h-[60px] items-center gap-2 rounded-[26px] py-1.5 pr-2 pl-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {left}
            {/* Desktop: Name der App steht in der Seitenleiste, hier der Seitentitel */}
            {title && <span className="t-headline hidden truncate pl-2 lg:inline">{title}</span>}
          </div>
          {nav && <Pill nav={nav} />}
          <div className="flex flex-1 items-center justify-end gap-2">
            {actions}
            {nav && (
              <GlassIconButton label={T('Einstellungen', 'Settings')} onClick={nav.openSettings}>
                <IconGear />
              </GlassIconButton>
            )}
          </div>
        </header>
        <main className="pt-4">{children}</main>
      </div>
      {nav && <TabBar nav={nav} />}
    </div>
  )
}

/** Name der App mit Icon, links in der Kopfzeile */
export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 pl-1 ${className}`}>
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="size-8 shrink-0 rounded-[8px]" />
      <span className="t-headline truncate">Gewohnheiten</span>
    </span>
  )
}

function TabBar({ nav }: { nav: Nav }) {
  return (
    <nav className="glass bottom-tabbar fixed inset-x-4 z-30 mx-auto flex max-w-[520px] gap-1 rounded-[32px] px-2 py-1.5 md:hidden" aria-label={T('Bereiche', 'Sections')}>
      {tabs().map((t) => (
        <button
          key={t.id}
          onClick={() => nav.setTab(t.id)}
          aria-current={nav.tab === t.id ? 'page' : undefined}
          className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-3xl text-[11px] leading-[13px] font-medium ${nav.tab === t.id ? 'bg-[var(--glass-tint)] text-brand' : 'text-ink-2'}`}
        >
          {t.icon(24)}
          {t.label}
        </button>
      ))}
    </nav>
  )
}

function Pill({ nav }: { nav: Nav }) {
  return (
    <nav className="glass hidden shrink-0 gap-1 rounded-full p-1 md:flex lg:hidden" aria-label={T('Bereiche', 'Sections')}>
      {tabs().map((t) => (
        <button
          key={t.id}
          onClick={() => nav.setTab(t.id)}
          aria-current={nav.tab === t.id ? 'page' : undefined}
          className={`t-sub flex min-h-11 items-center gap-1.5 rounded-full px-4 font-medium ${nav.tab === t.id ? 'glass-strong text-brand' : 'text-ink-2'}`}
        >
          {t.icon(18)}
          {t.label}
        </button>
      ))}
    </nav>
  )
}

function Sidebar({ nav }: { nav: Nav }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col py-3 lg:flex">
      <div className="glass flex flex-1 flex-col gap-1 rounded-[26px] p-3">
        <div className="mb-3 px-1 pt-1">
          <Brand />
        </div>
        <nav className="flex flex-col gap-1" aria-label={T('Bereiche', 'Sections')}>
          {tabs().map((t) => (
            <button
              key={t.id}
              onClick={() => nav.setTab(t.id)}
              aria-current={nav.tab === t.id ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-2.5 rounded-[10px] px-3 text-left font-medium ${nav.tab === t.id ? 'bg-brand-tint text-brand' : 'text-ink hover:bg-fill'}`}
            >
              {t.icon(20)}
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}

/** Großer Titel unter der Kopfzeile */
export function LargeTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4 px-1">
      <h1 className="t-title">{children}</h1>
      {sub && <div className="t-sub mt-0.5 text-ink-2">{sub}</div>}
    </div>
  )
}
