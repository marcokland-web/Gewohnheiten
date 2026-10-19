import { useEffect, useState } from 'react'
import { HabitDetail } from './components/HabitDetail'
import { HabitEditor } from './components/HabitEditor'
import { Login } from './components/Login'
import { Settings } from './components/Settings'
import { Today } from './components/Today'
import { IconX } from './components/ui'
import { dismissError, endSession, startSession, useStore } from './lib/store'
import { supabase, supabaseConfigured } from './lib/supabase'
import { useTheme } from './lib/theme'

type View = { name: 'today' } | { name: 'detail'; id: string } | { name: 'settings' }
type Editor = { habitId?: string } | null

export default function App() {
  useTheme()
  const [authState, setAuthState] = useState<'loading' | 'in' | 'out'>('loading')
  const [view, setView] = useState<View>({ name: 'today' })
  const [editor, setEditor] = useState<Editor>(null)
  const { habits, error } = useStore()

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAuthState('in')
        void startSession(session.user.id)
      } else {
        setAuthState('out')
        void endSession()
        setView({ name: 'today' })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => window.scrollTo(0, 0), [view])

  if (!supabaseConfigured) {
    return (
      <div className="p-6 text-center text-muted">
        Supabase ist nicht konfiguriert: <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code> fehlen.
      </div>
    )
  }
  if (authState === 'loading') return null
  if (authState === 'out') return <Login />

  const detailHabit = view.name === 'detail' ? habits.find((h) => h.id === view.id) : undefined
  const editHabit = editor?.habitId ? habits.find((h) => h.id === editor.habitId) : undefined

  return (
    <>
      {view.name === 'settings' ? (
        <Settings onBack={() => setView({ name: 'today' })} />
      ) : detailHabit ? (
        <HabitDetail habit={detailHabit} onBack={() => setView({ name: 'today' })} onEdit={() => setEditor({ habitId: detailHabit.id })} />
      ) : (
        <Today onOpen={(id) => setView({ name: 'detail', id })} onNew={() => setEditor({})} onSettings={() => setView({ name: 'settings' })} />
      )}

      {editor && <HabitEditor habit={editHabit} onClose={() => setEditor(null)} />}

      {error && (
        <div className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-danger px-4 py-3 text-sm text-white shadow-xl" role="alert">
          <span className="flex-1">{error}</span>
          <button onClick={dismissError} aria-label="Meldung schließen"><IconX /></button>
        </div>
      )}
    </>
  )
}
