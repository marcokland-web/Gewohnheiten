import { useEffect, useState, type FormEvent } from 'react'
import { loadProfile, saveProfile, updateHabit, useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useTheme, type ThemeMode } from '../lib/theme'
import type { Profile } from '../lib/types'
import { Button, Field, IconBack, inputClass } from './ui'

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Automatisch' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
]

export function Settings({ onBack }: { onBack: () => void }) {
  const [theme, setTheme] = useTheme()
  const { habits } = useStore()
  const archived = habits.filter((h) => h.archived_at)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    loadProfile().then(setProfile)
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  async function saveQuiet(patch: Partial<Profile>) {
    if (!profile) return
    const next = { ...profile, ...patch }
    setProfile(next)
    try {
      await saveProfile({ quiet_from: next.quiet_from || null, quiet_to: next.quiet_to || null })
      setSaved('Gespeichert')
    } catch (e) {
      setSaved((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-safe pb-safe">
      <header className="hero rounded-3xl p-5 text-white shadow-xl shadow-blue-900/25">
        <button onClick={onBack} className="-ml-2 flex items-center gap-1 rounded-full py-1 pr-3 pl-1 text-white/85 hover:bg-white/15">
          <IconBack /> Zurück
        </button>
        <h1 className="mt-3 text-2xl font-bold">Einstellungen</h1>
        {email && <p className="text-sm text-white/80">{email}</p>}
      </header>

      <section className="glass mt-4 rounded-3xl p-4">
        <h2 className="mb-3 font-semibold">Darstellung</h2>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={`rounded-lg py-2 text-sm font-medium transition ${theme === t.value ? 'bg-accent text-accent-ink shadow' : 'text-muted'}`}
              aria-pressed={theme === t.value}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="glass mt-4 rounded-3xl p-4">
        <h2 className="font-semibold">Ruhezeit</h2>
        <p className="mb-3 text-sm text-muted">In dieser Zeit kommen keine Erinnerungen.</p>
        {profile ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Von">
                <input className={inputClass} type="time" value={profile.quiet_from?.slice(0, 5) ?? ''} onChange={(e) => saveQuiet({ quiet_from: e.target.value })} />
              </Field>
              <Field label="Bis">
                <input className={inputClass} type="time" value={profile.quiet_to?.slice(0, 5) ?? ''} onChange={(e) => saveQuiet({ quiet_to: e.target.value })} />
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted">
              Zeitzone: {profile.timezone}
              {saved && ` · ${saved}`}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">Nur online verfügbar.</p>
        )}
      </section>

      {archived.length > 0 && (
        <section className="glass mt-4 rounded-3xl p-4">
          <h2 className="mb-2 font-semibold">Archiv</h2>
          <ul className="divide-y divide-line">
            {archived.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">{h.icon} {h.name}</span>
                <button className="text-sm font-medium text-accent" onClick={() => updateHabit(h.id, { archived_at: null }).catch((e) => alert(e.message))}>
                  Wiederherstellen
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PasswordChange email={email} />

      <Button variant="ghost" className="mt-5 w-full" onClick={() => supabase.auth.signOut()}>
        Abmelden
      </Button>
      <p className="mt-4 text-center text-xs text-muted">Gewohnheiten · Version {__APP_VERSION__}</p>
    </div>
  )
}

function PasswordChange({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setMessage({ ok: false, text: error.message })
    setPassword('')
    setOpen(false)
    setMessage({ ok: true, text: 'Passwort geändert – gilt auch für die Zähler-App.' })
  }

  return (
    <section className="glass mt-4 rounded-3xl p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Passwort</h2>
        {!open && (
          <button className="text-sm font-medium text-accent" onClick={() => setOpen(true)}>
            Ändern
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          {/* Verstecktes Benutzerfeld, damit der Passwort-Manager weiß, zu welchem Konto das Passwort gehört */}
          <input type="email" autoComplete="username" value={email} readOnly hidden />
          <Field label="Neues Passwort">
            <input className={inputClass} type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <p className="text-xs text-muted">
            Tipp ins Feld – iPhone, iPad und Mac schlagen dann ein starkes Passwort vor und speichern es im Schlüsselbund. Mindestens 12 Zeichen.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" className="flex-1" disabled={busy}>{busy ? 'Speichern …' : 'Speichern'}</Button>
          </div>
        </form>
      )}
      {message && <p className={`mt-2 text-sm ${message.ok ? 'text-muted' : 'text-danger'}`}>{message.text}</p>}
    </section>
  )
}
