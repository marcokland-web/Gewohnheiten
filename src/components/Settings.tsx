import { useEffect, useState, type FormEvent } from 'react'
import { todayKey } from '../lib/dates'
import { getLang, setLang, T, useLang, type Lang } from '../lib/i18n'
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from '../lib/push'
import { scheduleLabel } from '../lib/stats'
import { loadProfile, saveProfile, updateHabit, useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useTheme, type ThemeMode } from '../lib/theme'
import type { Profile } from '../lib/types'
import { Button, Field, Group, inputClass, Row, Segmented, Sheet } from './ui'

/** Einstellungsmenü im Studio-Aufbau: Darstellung, Sprache, App-Eigenes, Über. */
export function Settings({ onClose, signedIn = true }: { onClose: () => void; signedIn?: boolean }) {
  const lang = useLang()
  const [theme, setTheme] = useTheme()

  return (
    <Sheet title={T('Einstellungen', 'Settings')} onClose={onClose} done={T('Fertig', 'Done')}>
      <Group title={T('Darstellung', 'Appearance')}>
        <Row>
          <Segmented<ThemeMode>
            label={T('Darstellung', 'Appearance')}
            value={theme}
            onChange={setTheme}
            className="flex-1"
            options={[
              { value: 'auto', label: T('Automatisch', 'Automatic') },
              { value: 'light', label: T('Hell', 'Light') },
              { value: 'dark', label: T('Dunkel', 'Dark') },
            ]}
          />
        </Row>
      </Group>

      <Group title={T('Sprache', 'Language')}>
        <Row>
          <Segmented<Lang>
            label={T('Sprache', 'Language')}
            value={lang}
            onChange={setLang}
            className="flex-1"
            options={[
              { value: 'de', label: 'Deutsch' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Row>
      </Group>

      {signedIn && (
        <>
          <PushSettings />
          <QuietTime />
          <Archive />
          <Export />
          <Account />
        </>
      )}

      <Group title={T('Über', 'About')}>
        <Row className="py-3">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="size-12 shrink-0 rounded-[11px]" />
          <div className="min-w-0">
            <div className="font-semibold">Gewohnheiten</div>
            <div className="t-foot text-ink-2">{T('Gewohnheiten tracken, sanft erinnert werden', 'Track habits, get gentle reminders')}</div>
          </div>
        </Row>
        <Row>
          <span className="flex-1">{T('Version', 'Version')}</span>
          <span className="t-sub t-num text-ink-2">{__APP_VERSION__}</span>
        </Row>
        <Row>
          <span className="flex-1">{T('Aktualisieren', 'Update')}</span>
          <button className="-mr-2 min-h-11 px-2 font-semibold text-brand" onClick={() => location.reload()}>
            {T('Neu laden', 'Reload')}
          </button>
        </Row>
      </Group>
      <p className="t-foot mt-3 mb-2 text-center text-ink-2">{T('Teil des Familien-App-Studios', 'Part of the Family App Studio')}</p>
    </Sheet>
  )
}

type Message = { ok: boolean; text: string } | null

function Note({ message }: { message: Message }) {
  if (!message) return null
  return <p className={`t-foot mt-1.5 px-4 ${message.ok ? 'text-ink-2' : 'text-danger'}`} role={message.ok ? 'status' : 'alert'}>{message.text}</p>
}

function PushSettings() {
  useLang()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'))
  }, [])

  async function run(action: () => Promise<string | void>) {
    setBusy(true)
    setMessage(null)
    try {
      const text = await action()
      if (text) setMessage({ ok: true, text })
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    }
    setState(await getPushState().catch(() => 'unsupported' as const))
    setBusy(false)
  }

  return (
    <>
      <Group title={T('Erinnerungen auf diesem Gerät', 'Reminders on this device')}>
        <Row className="flex-col items-stretch py-3">
          {state === null && <p className="t-sub text-ink-2">{T('Prüfe …', 'Checking …')}</p>}
          {state === 'needs-install' && (
            <p className="t-sub text-ink-2">
              {T('Auf iPhone und iPad gehen Erinnerungen nur in der installierten App: in Safari auf ', 'On iPhone and iPad, reminders only work in the installed app: in Safari tap ')}
              <b>{T('Teilen', 'Share')}</b> → <b>{T('Zum Home-Bildschirm', 'Add to Home Screen')}</b>
              {T(', dann die App vom Home-Bildschirm öffnen.', ', then open the app from the Home Screen.')}
            </p>
          )}
          {state === 'unsupported' && <p className="t-sub text-ink-2">{T('Dieser Browser unterstützt keine Push-Benachrichtigungen.', 'This browser doesn’t support push notifications.')}</p>}
          {state === 'denied' && (
            <p className="t-sub text-ink-2">
              {T(
                'Benachrichtigungen sind blockiert. Erlaube sie in den Einstellungen des Geräts (iPhone: Einstellungen → Mitteilungen → Gewohnheiten).',
                'Notifications are blocked. Allow them in the device settings (iPhone: Settings → Notifications → Gewohnheiten).',
              )}
            </p>
          )}
          {state === 'off' && (
            <>
              <p className="t-sub text-ink-2">{T('Du wirst nur erinnert, wenn eine Gewohnheit noch offen ist.', 'You’re only reminded when a habit is still open.')}</p>
              <Button className="mt-3" disabled={busy} onClick={() => run(enablePush)}>{T('Erinnerungen aktivieren', 'Turn on reminders')}</Button>
            </>
          )}
          {state === 'on' && (
            <>
              <p className="t-sub flex items-center gap-1.5 text-ink">
                <span className="text-success" aria-hidden>●</span> {T('Aktiv', 'On')}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="tinted" disabled={busy} onClick={() => run(sendTestPush)}>{T('Test senden', 'Send test')}</Button>
                <Button variant="tinted" disabled={busy} onClick={() => run(disablePush)}>{T('Deaktivieren', 'Turn off')}</Button>
              </div>
            </>
          )}
        </Row>
      </Group>
      <Note message={message} />
    </>
  )
}

function QuietTime() {
  useLang()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  useEffect(() => {
    loadProfile()
      .then(setProfile)
      .finally(() => setLoaded(true))
  }, [])

  async function save(patch: Partial<Profile>) {
    if (!profile) return
    const next = { ...profile, ...patch }
    setProfile(next)
    try {
      await saveProfile({ quiet_from: next.quiet_from || null, quiet_to: next.quiet_to || null })
      setMessage({ ok: true, text: T('Gespeichert', 'Saved') })
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    }
  }

  return (
    <>
      <Group
        title={T('Ruhezeit', 'Quiet hours')}
        footer={profile ? `${T('In dieser Zeit kommen keine Erinnerungen.', 'No reminders during this time.')} ${T('Zeitzone', 'Time zone')}: ${profile.timezone}` : undefined}
      >
        {profile ? (
          <Row className="py-3">
            <div className="grid flex-1 grid-cols-2 gap-3">
              <Field label={T('Von', 'From')}>
                <input className={inputClass} type="time" value={profile.quiet_from?.slice(0, 5) ?? ''} onChange={(e) => save({ quiet_from: e.target.value })} />
              </Field>
              <Field label={T('Bis', 'To')}>
                <input className={inputClass} type="time" value={profile.quiet_to?.slice(0, 5) ?? ''} onChange={(e) => save({ quiet_to: e.target.value })} />
              </Field>
            </div>
          </Row>
        ) : (
          <Row>
            <span className="t-sub text-ink-2">{loaded ? T('Nur online verfügbar.', 'Only available online.') : T('Lade …', 'Loading …')}</span>
          </Row>
        )}
      </Group>
      <Note message={message} />
    </>
  )
}

function Archive() {
  useLang()
  const { habits } = useStore()
  const archived = habits.filter((h) => h.archived_at)
  const [message, setMessage] = useState<Message>(null)
  if (!archived.length) return null
  return (
    <>
      <Group title={T('Archiv', 'Archive')}>
        {archived.map((h) => (
          <Row key={h.id}>
            <span className="min-w-0 flex-1 truncate">
              {h.icon} {h.name}
            </span>
            <button
              className="-mr-2 min-h-11 shrink-0 px-2 font-semibold text-brand"
              onClick={() => updateHabit(h.id, { archived_at: null }).catch((e: Error) => setMessage({ ok: false, text: e.message }))}
            >
              {T('Wiederherstellen', 'Restore')}
            </button>
          </Row>
        ))}
      </Group>
      <Note message={message} />
    </>
  )
}

/** Alle Einträge als CSV für eigene Auswertungen (Excel, Numbers) */
function Export() {
  useLang()
  const { habits, checkins } = useStore()

  function download() {
    const de = getLang() === 'de'
    const sep = de ? ';' : ','
    // Anführungszeichen verdoppeln; führendes = + - @ entschärfen, damit Excel keine Formel daraus macht
    const q = (s: string) => `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`
    const byId = new Map(habits.map((h) => [h.id, h]))
    const header = de ? ['Datum', 'Gewohnheit', 'Rhythmus', 'Archiviert', 'Notiz'] : ['Date', 'Habit', 'Schedule', 'Archived', 'Note']
    const rows = Object.values(checkins)
      .filter((c) => byId.has(c.habit_id))
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((c) => {
        const h = byId.get(c.habit_id)!
        return [c.day, q(h.name), q(scheduleLabel(h)), h.archived_at ? (de ? 'ja' : 'yes') : (de ? 'nein' : 'no'), q(c.note ?? '')].join(sep)
      })
    // BOM, damit Excel Umlaute richtig liest
    const blob = new Blob(['﻿' + [header.join(sep), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gewohnheiten-${todayKey()}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Group title={T('Daten', 'Data')} footer={T('Alle Einträge mit Datum und Notiz, z. B. für Excel oder Numbers.', 'All entries with date and note, e.g. for Excel or Numbers.')}>
      <Row>
        <span className="flex-1">{T('Einträge exportieren (CSV)', 'Export entries (CSV)')}</span>
        <button className="-mr-2 min-h-11 px-2 font-semibold text-brand" onClick={download} disabled={!Object.keys(checkins).length}>
          {T('Exportieren', 'Export')}
        </button>
      </Row>
    </Group>
  )
}

function Account() {
  useLang()
  const [email, setEmail] = useState('')
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setMessage({ ok: false, text: error.message })
    setPassword('')
    setOpen(false)
    setMessage({ ok: true, text: T('Passwort geändert – gilt auch für die Zähler-App.', 'Password changed – also applies to the meter app.') })
  }

  return (
    <>
      <Group title={T('Konto', 'Account')}>
        {email && (
          <Row>
            <span className="flex-1">{T('Angemeldet als', 'Signed in as')}</span>
            <span className="t-sub min-w-0 truncate text-ink-2">{email}</span>
          </Row>
        )}
        <Row className={open ? 'flex-col items-stretch py-3' : ''}>
          {!open ? (
            <>
              <span className="flex-1">{T('Passwort', 'Password')}</span>
              <button className="-mr-2 min-h-11 px-2 font-semibold text-brand" onClick={() => setOpen(true)}>
                {T('Ändern', 'Change')}
              </button>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {/* Verstecktes Benutzerfeld, damit der Passwort-Manager weiß, zu welchem Konto das Passwort gehört */}
              <input type="email" autoComplete="username" value={email} readOnly hidden />
              <Field label={T('Neues Passwort', 'New password')}>
                <input className={inputClass} type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <p className="t-foot text-ink-2">
                {T(
                  'Tipp ins Feld – iPhone, iPad und Mac schlagen dann ein starkes Passwort vor und speichern es im Schlüsselbund. Mindestens 12 Zeichen.',
                  'Tap the field – iPhone, iPad and Mac will suggest a strong password and save it to the keychain. At least 12 characters.',
                )}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="tinted" onClick={() => setOpen(false)}>{T('Abbrechen', 'Cancel')}</Button>
                <Button type="submit" disabled={busy}>{busy ? T('Speichern …', 'Saving …') : T('Speichern', 'Save')}</Button>
              </div>
            </form>
          )}
        </Row>
        <Row>
          <button className="min-h-11 flex-1 text-left font-medium text-danger" onClick={() => supabase.auth.signOut()}>
            {T('Abmelden', 'Sign out')}
          </button>
        </Row>
      </Group>
      <Note message={message} />
    </>
  )
}
