import { useSyncExternalStore } from 'react'
import { classifyExchangeError, cleanUrl, parseCallback, redirectUrl, type AuthError } from './auth-core'
import { T } from './i18n'
import { disablePush } from './push'
import { clearDeviceData, currentUserId, endSession, pendingCount } from './store'
import { supabase } from './supabase'

// ---------------------------------------------------------------------
// Anmeldung nur mit Google (Supabase Auth, PKCE).
//
// Ablauf: Knopf → Weiterleitung zu Google (kein Pop-up, damit es auch in der
// installierten App auf dem iPhone geht) → zurück auf die App-Adresse mit
// `?code=…` → Code gegen Sitzung tauschen → Adresse säubern.
// Bestehende Konten (E-Mail + Passwort) verknüpft Supabase automatisch mit
// der Google-Identität gleicher, bestätigter E-Mail: user_id bleibt gleich.
// ---------------------------------------------------------------------

export { accountOf, type Account, type AuthError } from './auth-core'

interface AuthUiState {
  /** Code aus der Rückleitung wird gerade gegen eine Sitzung getauscht */
  finishing: boolean
  /** Weiterleitung zu Google läuft */
  redirecting: boolean
  error: AuthError | null
}

// Kommt die Seite gerade von Google zurück, gleich den Lade-Zustand zeigen (kein Aufblitzen des Knopfs)
let state: AuthUiState = { finishing: parseCallback(window.location.href).type === 'code', redirecting: false, error: null }

const listeners = new Set<() => void>()

function setState(patch: Partial<AuthUiState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useAuthUi(): AuthUiState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function dismissAuthError() {
  setState({ error: null })
}

/** Wird beim Laden der App genau einmal ausgeführt (auch unter StrictMode). */
let callbackDone: Promise<void> | null = null

export function handleAuthCallback(): Promise<void> {
  callbackDone ??= run()
  return callbackDone

  async function run() {
    const cb = parseCallback(window.location.href)
    if (cb.type === 'none') return
    // Sofort säubern: ein Neuladen soll den (einmaligen) Code nicht erneut einlösen
    window.history.replaceState(window.history.state, '', cleanUrl(window.location.href))
    if (cb.type === 'cancelled') return
    if (cb.type === 'error') return setState({ error: cb.error })

    setState({ finishing: true, error: null })
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(cb.code)
      if (error) setState({ error: classifyExchangeError(error) })
    } catch (e) {
      setState({ error: classifyExchangeError(e as Error) })
    } finally {
      setState({ finishing: false })
    }
  }
}

// ---------------------------------------------------------------------
// Anmelden / Abmelden
// ---------------------------------------------------------------------

export async function signInWithGoogle() {
  if (state.redirecting) return
  if (!navigator.onLine) return setState({ error: { kind: 'offline' } })
  setState({ redirecting: true, error: null })
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl(),
      // Kontoauswahl immer zeigen (mehrere Google-Konten in der Familie)
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) setState({ redirecting: false, error: classifyExchangeError(error) })
  // Ohne Fehler verlässt der Browser jetzt die Seite.
}

// Zurück-Wischen von der Google-Seite: Seite kommt aus dem Cache, Knopf wieder freigeben
window.addEventListener('pageshow', (e) => {
  if (e.persisted && state.redirecting) setState({ redirecting: false })
})

/** Anzahl noch nicht übertragener Einträge (für die Warnung beim Abmelden). */
export const unsyncedEntries = pendingCount

/**
 * Abmelden nur auf diesem Gerät (andere Geräte bleiben angemeldet).
 * Mit `clearLocalData` werden zwischengespeicherte Gewohnheiten, Einträge und die
 * Warteschlange gelöscht und Erinnerungen auf diesem Gerät abgemeldet.
 */
export async function signOut({ clearLocalData }: { clearLocalData: boolean }) {
  const uid = currentUserId()
  if (clearLocalData) await withTimeout(stopRemindersOnDevice(), 3000).catch(() => undefined)
  await supabase.auth.signOut({ scope: 'local' })
  await endSession()
  if (clearLocalData) await clearDeviceData(uid)
  setState({ error: null, redirecting: false })
}

/** Erinnerungen auf diesem Gerät abmelden, nur wenn ein Service Worker da ist (sonst wartet `ready` ewig). */
async function stopRemindersOnDevice() {
  if (!('serviceWorker' in navigator) || !(await navigator.serviceWorker.getRegistration())) return
  await disablePush()
}

function withTimeout<V>(p: Promise<V>, ms: number): Promise<V | undefined> {
  return Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))])
}

/** Verständlicher Text zu einem Anmeldefehler (DE/EN). */
export function authErrorText(error: AuthError): string {
  switch (error.kind) {
    case 'offline':
      return T('Keine Verbindung. Zum Anmelden brauchst du einmal Internet.', 'No connection. You need internet once to sign in.')
    case 'expired':
      return T(
        'Die Anmeldung ist abgelaufen oder wurde in einem anderen Fenster begonnen. Tippe noch einmal auf „Mit Google anmelden“.',
        'The sign-in expired or was started in another window. Tap “Sign in with Google” again.',
      )
    case 'no-account':
      return T(
        'Für dieses Google-Konto gibt es hier noch keinen Zugang. Nimm dieselbe E-Mail-Adresse wie in der Zähler-App oder frag Marco.',
        'There’s no access for this Google account yet. Use the same email address as in the meter app or ask Marco.',
      )
    case 'provider':
      return T(
        'Die Anmeldung mit Google ist gerade nicht eingerichtet. Sag Marco Bescheid.',
        'Sign-in with Google isn’t set up right now. Let Marco know.',
      )
    default:
      return T('Anmelden hat nicht geklappt. Versuch es noch einmal.', 'Sign-in didn’t work. Please try again.')
  }
}
