import { useEffect, useState } from 'react'
import { Analysis } from './components/Analysis'
import { HabitDetail } from './components/HabitDetail'
import { HabitEditor } from './components/HabitEditor'
import { Login } from './components/Login'
import { Settings } from './components/Settings'
import { NavContext, type Tab } from './components/Shell'
import { Today } from './components/Today'
import { IconX } from './components/ui'
import { handleAuthCallback } from './lib/auth'
import { T, useLang } from './lib/i18n'
import { dismissError, endSession, startSession, useStore } from './lib/store'
import { supabase, supabaseConfigured } from './lib/supabase'
import { useTheme } from './lib/theme'

type Editor = { habitId?: string } | null

export default function App() {
  useTheme()
  useLang()
  const [authState, setAuthState] = useState<'loading' | 'in' | 'out'>('loading')
  const [tab, setTab] = useState<Tab>('today')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { habits, error } = useStore()

  useEffect(() => {
    // Rückkehr von Google: Code gegen Sitzung tauschen, Adresse säubern
    void handleAuthCallback()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAuthState('in')
        void startSession(session.user.id)
      } else {
        setAuthState('out')
        void endSession()
        setTab('today')
        setDetailId(null)
        setSettingsOpen(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => window.scrollTo(0, 0), [tab, detailId])

  if (!supabaseConfigured) {
    return (
      <div className="t-sub p-6 text-center text-ink-2">
        {T('Supabase ist nicht konfiguriert', 'Supabase is not configured')}: <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>
      </div>
    )
  }
  if (authState === 'loading') return null
  if (authState === 'out') return <Login />

  const detailHabit = detailId ? habits.find((h) => h.id === detailId) : undefined
  const editHabit = editor?.habitId ? habits.find((h) => h.id === editor.habitId) : undefined
  const nav = {
    tab,
    setTab: (t: Tab) => {
      setTab(t)
      setDetailId(null)
    },
    openSettings: () => setSettingsOpen(true),
  }

  return (
    <NavContext.Provider value={nav}>
      {detailHabit ? (
        <HabitDetail habit={detailHabit} onBack={() => setDetailId(null)} onEdit={() => setEditor({ habitId: detailHabit.id })} />
      ) : tab === 'analysis' ? (
        <Analysis onOpen={setDetailId} />
      ) : (
        <Today onOpen={setDetailId} onNew={() => setEditor({})} />
      )}

      {editor && <HabitEditor habit={editHabit} onClose={() => setEditor(null)} />}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}

      {error && (
        <div className="glass-strong fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom,0px))] z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 md:bottom-6" role="alert">
          <span className="t-sub flex-1 text-danger">{error}</span>
          <button onClick={dismissError} className="-m-2 flex size-11 shrink-0 items-center justify-center text-ink-2" aria-label={T('Meldung schließen', 'Dismiss message')}>
            <IconX />
          </button>
        </div>
      )}
    </NavContext.Provider>
  )
}
