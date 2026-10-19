import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Field, inputClass } from './ui'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'E-Mail oder Passwort falsch.' : error.message)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <div className="hero mb-6 rounded-3xl p-6 text-white shadow-xl shadow-blue-900/20">
          <div className="text-4xl">🌱</div>
          <h1 className="mt-3 text-2xl font-bold">Gewohnheiten</h1>
          <p className="mt-1 text-white/80">Jeden Tag ein kleines Stück.</p>
        </div>
        <form onSubmit={submit} className="glass space-y-4 rounded-3xl p-5">
          <Field label="E-Mail">
            <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Passwort">
            <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Anmelden …' : 'Anmelden'}
          </Button>
          <p className="text-center text-xs text-muted">Gleiches Konto wie in der Zähler-App.</p>
        </form>
      </div>
    </div>
  )
}
