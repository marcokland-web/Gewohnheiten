import type { User } from '@supabase/supabase-js'

// Reine Hilfsfunktionen der Google-Anmeldung (ohne Seiteneffekte, per Unit-Test geprüft)

/** Fehlerarten; der Text wird erst beim Zeichnen übersetzt (Sprache umschaltbar). */
export type AuthErrorKind = 'offline' | 'expired' | 'no-account' | 'provider' | 'unknown'
export interface AuthError {
  kind: AuthErrorKind
  /** Technische Angabe für die Fehlersuche (nicht übersetzt) */
  detail?: string
}

/** Adresse, auf die Google/Supabase zurückleitet: aktuelle App-Adresse inkl. Basis-Pfad, ohne Abfrage. */
export function redirectUrl(loc: Pick<Location, 'origin'> = window.location): string {
  return new URL(import.meta.env.BASE_URL, loc.origin).href
}

// ---------------------------------------------------------------------
// Rückleitung auswerten
// ---------------------------------------------------------------------

export type Callback =
  | { type: 'none' }
  | { type: 'code'; code: string }
  | { type: 'cancelled' }
  | { type: 'error'; error: AuthError }

const CALLBACK_PARAMS = ['code', 'error', 'error_code', 'error_description', 'state', 'sb_flow_id']

const EXPIRED_CODES = ['pkce_code_verifier_not_found', 'flow_state_not_found', 'flow_state_expired', 'bad_code_verifier', 'bad_oauth_state', 'bad_oauth_callback']
// Ohne Versions-Header liefert Supabase keinen Fehlercode, nur den Text (z. B. „invalid flow state, no valid flow state found“)
const EXPIRED_TEXT = /flow state|code verifier|code challenge|oauth state/i

/** Registrierung gesperrt: `signup_disabled` oder Ablehnung durch einen Auth-Hook (HTTP 403). */
export function isNoAccess(code: string | null | undefined, text: string | null | undefined, status?: number): boolean {
  if (code === 'signup_disabled' || /^hook/.test(code ?? '')) return true
  if (/signups? not allowed|hook/i.test(text ?? '')) return true
  if (/\b403\b|forbidden/i.test(`${code ?? ''} ${text ?? ''}`)) return true
  return status === 403
}

/** Liest `?code=` bzw. `?error=` (auch im `#`-Teil, so meldet Supabase manche Fehler). */
export function parseCallback(href: string): Callback {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const get = (k: string) => url.searchParams.get(k) ?? hash.get(k)

  const error = get('error')
  const errorCode = get('error_code')
  const description = get('error_description') ?? undefined
  if (error || errorCode) {
    // Registrierung gesperrt (Einstellung oder Before-User-Created-Hook mit HTTP 403): kein Abbruch
    if (isNoAccess(errorCode, description)) {
      return { type: 'error', error: { kind: 'no-account', detail: description ?? errorCode ?? undefined } }
    }
    // Abbruch bei Google („Abbrechen“ oder Fenster geschlossen) ist kein Fehler
    if (error === 'access_denied' && (!errorCode || errorCode === 'access_denied')) return { type: 'cancelled' }
    if (EXPIRED_CODES.includes(errorCode ?? '') || EXPIRED_TEXT.test(description ?? '')) {
      return { type: 'error', error: { kind: 'expired', detail: errorCode ?? description } }
    }
    if (errorCode === 'provider_disabled' || errorCode === 'validation_failed') {
      return { type: 'error', error: { kind: 'provider', detail: description ?? errorCode } }
    }
    return { type: 'error', error: { kind: 'unknown', detail: description ?? errorCode ?? error ?? undefined } }
  }
  const code = url.searchParams.get('code')
  return code ? { type: 'code', code } : { type: 'none' }
}

/** Adresse ohne Anmelde-Parameter (Code darf nicht in Verlauf oder Lesezeichen bleiben). */
export function cleanUrl(href: string): string {
  const url = new URL(href)
  for (const k of CALLBACK_PARAMS) url.searchParams.delete(k)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  if (CALLBACK_PARAMS.some((k) => hash.has(k)) || hash.has('access_token')) url.hash = ''
  return url.pathname + url.search + url.hash
}

/** Supabase-Fehler beim Code-Tausch in eine Fehlerart übersetzen. */
export function classifyExchangeError(e: { name?: string; code?: string; message?: string; status?: number }): AuthError {
  const code = e.code ?? ''
  if (e.name === 'AuthRetryableFetchError' || (typeof navigator !== 'undefined' && navigator.onLine === false) || /failed to fetch|network/i.test(e.message ?? '')) {
    return { kind: 'offline', detail: e.message }
  }
  if (e.name === 'AuthPKCECodeVerifierMissingError' || EXPIRED_CODES.includes(code) || EXPIRED_TEXT.test(e.message ?? '')) {
    return { kind: 'expired', detail: code || e.name }
  }
  if (isNoAccess(code, e.message, e.status)) return { kind: 'no-account', detail: code || e.message }
  return { kind: 'unknown', detail: code || e.message }
}

/** Anzeige-Daten des angemeldeten Nutzers (Google-Name und -Foto, sonst nur E-Mail). */
export interface Account {
  name: string | null
  email: string | null
  photo: string | null
}

export function accountOf(user: Pick<User, 'email' | 'user_metadata'> | null | undefined): Account | null {
  if (!user) return null
  const m = (user.user_metadata ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const photo = str(m.avatar_url) ?? str(m.picture)
  return {
    name: str(m.full_name) ?? str(m.name),
    email: str(user.email) ?? str(m.email),
    // Nur https-Bilder (Google liefert lh3.googleusercontent.com)
    photo: photo && /^https:\/\//.test(photo) ? photo : null,
  }
}

