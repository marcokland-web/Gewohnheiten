import { useState, type FormEvent } from 'react'
import { T, useLang } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { Settings } from './Settings'
import { Brand, Page } from './Shell'
import { Button, Field, GlassIconButton, IconGear, inputClass } from './ui'

export function Login() {
  useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message === 'Invalid login credentials' ? T('E-Mail oder Passwort falsch.', 'Wrong email or password.') : error.message)
  }

  return (
    <Page
      left={<Brand />}
      actions={
        <GlassIconButton label={T('Einstellungen', 'Settings')} onClick={() => setSettings(true)}>
          <IconGear />
        </GlassIconButton>
      }
    >
      <div className="mx-auto max-w-sm pt-[8vh]">
        <div className="mb-6 text-center">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="mx-auto size-20 rounded-[18px] shadow-lg" />
          <h1 className="t-title mt-4">Gewohnheiten</h1>
          <p className="t-sub mt-1 text-ink-2">{T('Jeden Tag ein kleines Stück.', 'A little bit every day.')}</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-5">
          <Field label={T('E-Mail', 'Email')}>
            <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={T('Passwort', 'Password')}>
            <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p className="t-sub text-danger" role="alert">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? T('Anmelden …', 'Signing in …') : T('Anmelden', 'Sign in')}
          </Button>
          <p className="t-foot text-center text-ink-2">{T('Gleiches Konto wie in der Zähler-App.', 'Same account as in the meter app.')}</p>
        </form>
      </div>
      {settings && <Settings signedIn={false} onClose={() => setSettings(false)} />}
    </Page>
  )
}
