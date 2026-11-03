import { describe, expect, it } from 'vitest'
import { accountOf, classifyExchangeError, cleanUrl, parseCallback, redirectUrl } from '../../src/lib/auth-core'

const APP = 'https://marcokland-web.github.io/Gewohnheiten/'

describe('redirectUrl', () => {
  it('nimmt Herkunft und Basis-Pfad, ohne Abfrage', () => {
    // In Vitest ist BASE_URL "/"; im Build "/Gewohnheiten/"
    expect(redirectUrl({ origin: 'https://marcokland-web.github.io' })).toBe(new URL(import.meta.env.BASE_URL, 'https://marcokland-web.github.io').href)
  })
})

describe('parseCallback', () => {
  it('ohne Parameter: nichts zu tun', () => {
    expect(parseCallback(APP)).toEqual({ type: 'none' })
  })
  it('liest den Code', () => {
    expect(parseCallback(`${APP}?code=abc-123`)).toEqual({ type: 'code', code: 'abc-123' })
  })
  it('Abbruch bei Google ist kein Fehler', () => {
    expect(parseCallback(`${APP}?error=access_denied&error_description=The+user+denied`)).toEqual({ type: 'cancelled' })
    expect(parseCallback(`${APP}#error=access_denied&error_code=access_denied`)).toEqual({ type: 'cancelled' })
  })
  it('Registrierung gesperrt: eigener Hinweis', () => {
    const r = parseCallback(`${APP}?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance`)
    expect(r).toMatchObject({ type: 'error', error: { kind: 'no-account' } })
  })
  it('abgelaufene Anmeldung', () => {
    expect(parseCallback(`${APP}?error=invalid_request&error_code=flow_state_expired`)).toMatchObject({ type: 'error', error: { kind: 'expired' } })
  })
  it('Anbieter nicht eingeschaltet', () => {
    expect(parseCallback(`${APP}?error=invalid_request&error_code=provider_disabled`)).toMatchObject({ type: 'error', error: { kind: 'provider' } })
  })
  it('sonstige Fehler mit Beschreibung', () => {
    expect(parseCallback(`${APP}#error=server_error&error_description=Database+error`)).toEqual({
      type: 'error',
      error: { kind: 'unknown', detail: 'Database error' },
    })
  })
  it('Fehler geht vor Code', () => {
    expect(parseCallback(`${APP}?code=x&error=server_error`).type).toBe('error')
  })
})

describe('cleanUrl', () => {
  it('entfernt Code und Fehler, behält Pfad und fremde Parameter', () => {
    expect(cleanUrl(`${APP}?code=abc&foo=1`)).toBe('/Gewohnheiten/?foo=1')
    expect(cleanUrl(`${APP}?error=access_denied&error_code=x&error_description=y`)).toBe('/Gewohnheiten/')
    expect(cleanUrl(`${APP}#error=server_error&error_description=y`)).toBe('/Gewohnheiten/')
  })
  it('lässt eine saubere Adresse unverändert', () => {
    expect(cleanUrl(`${APP}#abschnitt`)).toBe('/Gewohnheiten/#abschnitt')
  })
})

describe('classifyExchangeError', () => {
  it('fehlender PKCE-Schlüssel → abgelaufen', () => {
    expect(classifyExchangeError({ name: 'AuthPKCECodeVerifierMissingError', code: 'pkce_code_verifier_not_found' }).kind).toBe('expired')
    expect(classifyExchangeError({ name: 'AuthApiError', code: 'flow_state_not_found', status: 404 }).kind).toBe('expired')
  })
  it('Netz weg → offline', () => {
    expect(classifyExchangeError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }).kind).toBe('offline')
  })
  it('Unbekanntes behält den Code für die Fehlersuche', () => {
    expect(classifyExchangeError({ name: 'AuthApiError', code: 'unexpected_failure' })).toEqual({ kind: 'unknown', detail: 'unexpected_failure' })
  })
})

describe('accountOf', () => {
  it('Google-Name, Foto und E-Mail', () => {
    expect(
      accountOf({ email: 'a@example.com', user_metadata: { full_name: 'Anna Beispiel', avatar_url: 'https://lh3.googleusercontent.com/a/x' } }),
    ).toEqual({ name: 'Anna Beispiel', email: 'a@example.com', photo: 'https://lh3.googleusercontent.com/a/x' })
  })
  it('altes Konto ohne Google-Daten: nur E-Mail', () => {
    expect(accountOf({ email: 'a@example.com', user_metadata: {} })).toEqual({ name: null, email: 'a@example.com', photo: null })
  })
  it('nimmt nur https-Bilder', () => {
    expect(accountOf({ email: 'a@example.com', user_metadata: { picture: 'javascript:alert(1)' } })?.photo).toBeNull()
  })
  it('ohne Nutzer: null', () => {
    expect(accountOf(null)).toBeNull()
  })
})
