import { expect, test, type Page } from '@playwright/test'
import { idbKeys, mockSupabase, USER } from './mock'

const googleButton = (page: Page) => page.getByRole('button', { name: /Mit Google anmelden|Sign in with Google/ })

async function signIn(page: Page) {
  await page.goto('./')
  await googleButton(page).click()
  await expect(page.getByRole('heading', { name: 'Heute' })).toBeVisible()
}

test('Anmeldebildschirm zeigt nur den Google-Knopf', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('./')
  await expect(googleButton(page)).toBeVisible()
  await expect(page.locator('input[type=email], input[type=password]')).toHaveCount(0)
  await expect(page.getByText(/Passwort|Registrieren/)).toHaveCount(0)
  // Offizielles „G“ mit den vier Google-Farben
  const fills = await googleButton(page).locator('svg path').evaluateAll((ps) => ps.map((p) => p.getAttribute('fill')))
  expect(fills).toEqual(['#EA4335', '#4285F4', '#FBBC05', '#34A853'])
})

test('Anmelden mit Google: Weiterleitung, Code-Tausch, saubere Adresse', async ({ page }) => {
  const log = await mockSupabase(page)
  await signIn(page)

  // Weiterleitung mit PKCE und Rückkehr auf die App-Adresse inkl. Basis-Pfad
  expect(log.authorize).toHaveLength(1)
  const auth = log.authorize[0]
  expect(auth.searchParams.get('provider')).toBe('google')
  expect(auth.searchParams.get('redirect_to')).toBe('http://localhost:5199/Gewohnheiten/')
  expect(auth.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256')
  expect(auth.searchParams.get('prompt')).toBe('select_account')
  // Code wird genau einmal eingelöst, mit Verifier
  expect(log.token).toHaveLength(1)
  expect(log.token[0]).toMatchObject({ auth_code: 'test-code' })
  expect((log.token[0] as { code_verifier: string }).code_verifier.length).toBeGreaterThan(20)
  // Adresse ohne Code
  expect(new URL(page.url()).search).toBe('')
  expect(page.url()).toBe('http://localhost:5199/Gewohnheiten/')
  await expect(page.getByText('Lesen')).toBeVisible()

  // Nach dem Neuladen weiterhin angemeldet, kein zweiter Code-Tausch
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Heute' })).toBeVisible()
  expect(log.token).toHaveLength(1)
})

test('Einstellungen zeigen Google-Konto; „Nur abmelden“ behält die Daten', async ({ page }) => {
  const log = await mockSupabase(page)
  await signIn(page)
  await expect.poll(() => idbKeys(page)).toContain(`gewohnheiten:cache:${USER.id}`)

  await page.getByRole('button', { name: 'Einstellungen' }).click()
  const settings = page.getByRole('dialog', { name: 'Einstellungen' })
  await expect(settings.getByText('Anna Test')).toBeVisible()
  await expect(settings.getByText(USER.email)).toBeVisible()
  await expect(settings.getByText('Angemeldet mit Google')).toBeVisible()
  await expect(settings.locator('img[src*="googleusercontent"]')).toBeVisible()
  await expect(settings.getByText(/Passwort/)).toHaveCount(0)

  await settings.getByRole('button', { name: 'Abmelden' }).click()
  const ask = page.getByRole('dialog', { name: 'Abmelden?' })
  await expect(ask).toBeVisible()
  // Startfokus auf „Abbrechen“
  await expect(ask.getByRole('button', { name: 'Abbrechen' })).toBeFocused()
  await ask.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(ask).toBeHidden()

  await settings.getByRole('button', { name: 'Abmelden' }).click()
  await page.getByRole('dialog', { name: 'Abmelden?' }).getByRole('button', { name: 'Nur abmelden' }).click()
  await expect(googleButton(page)).toBeVisible()
  await expect(googleButton(page)).toBeEnabled()
  expect(log.logout).toBe(1)
  expect(await idbKeys(page)).toContain(`gewohnheiten:cache:${USER.id}`)
  expect(await page.evaluate(() => localStorage.getItem('gewohnheiten-auth'))).toBeNull()
  // Seite bleibt bedienbar (kein hängengebliebenes inert)
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await expect(page.getByRole('dialog', { name: 'Einstellungen' })).toBeVisible()
})

test('„Abmelden und vom Gerät löschen“ löscht den Zwischenspeicher', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  await expect.poll(() => idbKeys(page)).toContain(`gewohnheiten:cache:${USER.id}`)
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await page.getByRole('dialog', { name: 'Einstellungen' }).getByRole('button', { name: 'Abmelden' }).click()
  await page.getByRole('button', { name: 'Abmelden und vom Gerät löschen' }).click()
  await expect(googleButton(page)).toBeVisible()
  await expect.poll(() => idbKeys(page)).not.toContain(`gewohnheiten:cache:${USER.id}`)
  expect(await idbKeys(page)).not.toContain(`gewohnheiten:queue:${USER.id}`)
})

test('Abbruch bei Google ist kein Fehler', async ({ page }) => {
  const log = await mockSupabase(page, { callback: 'error=access_denied&error_description=The+user+denied+the+request' })
  await page.goto('./')
  await googleButton(page).click()
  await page.waitForURL('http://localhost:5199/Gewohnheiten/')
  await expect(googleButton(page)).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(log.token).toHaveLength(0)
})

test('Fehler von Supabase wird verständlich angezeigt, auf Deutsch und Englisch', async ({ page }) => {
  await mockSupabase(page, { callback: '#error=server_error&error_code=unexpected_failure&error_description=Database+error' })
  await page.goto('./')
  await googleButton(page).click()
  await expect(page.getByRole('alert')).toHaveText('Anmelden hat nicht geklappt. Versuch es noch einmal.')
  expect(page.url()).toBe('http://localhost:5199/Gewohnheiten/')

  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await page.getByRole('radio', { name: 'English' }).check()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('alert')).toHaveText("Sign-in didn't work. Please try again.")
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('Abgelaufener Code: Hinweis, nochmal anzumelden', async ({ page }) => {
  await mockSupabase(page, { token: { status: 404, body: { code: 'flow_state_not_found', error_code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' } } })
  await page.goto('./')
  await googleButton(page).click()
  await expect(page.getByRole('alert')).toContainText('Die Anmeldung ist abgelaufen')
  expect(page.url()).toBe('http://localhost:5199/Gewohnheiten/')
  await expect(googleButton(page)).toBeEnabled()
})

test('Ohne Netz: klare Meldung statt Weiterleitung', async ({ page, context }) => {
  const log = await mockSupabase(page)
  await page.goto('./')
  await context.setOffline(true)
  await googleButton(page).click()
  await expect(page.getByRole('alert')).toContainText('Keine Verbindung')
  expect(log.authorize).toHaveLength(0)
  await context.setOffline(false)
})

test('Lade-Zustand während des Code-Tauschs', async ({ page }) => {
  await mockSupabase(page)
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  await page.route('https://fake-test.supabase.co/auth/v1/token*', async (route) => {
    await gate
    await route.fallback()
  })
  await page.goto('./')
  await googleButton(page).click()
  await expect(page.getByRole('status')).toHaveText('Anmeldung wird abgeschlossen …')
  await expect(googleButton(page)).toHaveCount(0)
  release()
  await expect(page.getByRole('heading', { name: 'Heute' })).toBeVisible()
})

test('Esc in der Abmelden-Rückfrage schließt nur die Rückfrage', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  const settings = page.getByRole('dialog', { name: 'Einstellungen' })
  await settings.getByRole('button', { name: 'Abmelden' }).click()
  const ask = page.getByRole('dialog', { name: 'Abmelden?' })
  await expect(ask).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(ask).toBeHidden()
  await expect(settings).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(settings).toBeHidden()
})

test('Registrierung gesperrt (Auth-Hook, HTTP 403): Hinweis „Kein Zugang“, kein Abbruch', async ({ page }) => {
  await mockSupabase(page, { callback: 'error=access_denied&error_code=hook_rejected&error_description=Error+running+hook+URI%3A+status+code+403' })
  await page.goto('./')
  await googleButton(page).click()
  await expect(page.getByRole('alert')).toHaveText('Kein Zugang – bitte von der Familie freischalten lassen.')
})

test('Registrierung abgeschaltet (signup_disabled) beim Code-Tausch', async ({ page }) => {
  await mockSupabase(page, { token: { status: 422, body: { error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' } } })
  await page.goto('./')
  await googleButton(page).click()
  await expect(page.getByRole('alert')).toHaveText('Kein Zugang – bitte von der Familie freischalten lassen.')
})

test('Abgelaufener Code ohne Fehlercode (nur Text): Hinweis „abgelaufen“', async ({ page }) => {
  await mockSupabase(page, { token: { status: 404, body: { msg: 'invalid flow state, no valid flow state found' } } })
  await page.goto('./')
  await googleButton(page).click()
  await expect(page.getByRole('alert')).toContainText('Die Anmeldung ist abgelaufen')
})

test('Neuladen ohne Netz mit abgelaufener Sitzung: nach kurzer Zeit gespeicherte Daten statt leerer Seite', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  await expect(page.getByText('Lesen')).toBeVisible()
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('gewohnheiten-auth')!)
    s.expires_at = Math.floor(Date.now() / 1000) - 60
    localStorage.setItem('gewohnheiten-auth', JSON.stringify(s))
  })
  await page.route('https://fake-test.supabase.co/**', (r) => r.abort('internetdisconnected'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Heute' })).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('Lesen')).toBeVisible()
})

test('Ohne gespeicherte Sitzung und ohne Netz: Anmeldung erscheint schnell', async ({ page }) => {
  await mockSupabase(page)
  await page.route('https://fake-test.supabase.co/**', (r) => r.abort('internetdisconnected'))
  await page.goto('./')
  await expect(googleButton(page)).toBeVisible({ timeout: 8000 })
})

test('Content-Security-Policy ist gesetzt und blockiert nichts', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(m.text())
  })
  await mockSupabase(page)
  await signIn(page)
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(policy).toContain("connect-src 'self' https://fake-test.supabase.co")
  expect(policy).toContain('img-src')
  expect(policy).toContain('https://lh3.googleusercontent.com')
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await expect(page.getByRole('dialog', { name: 'Einstellungen' }).locator('img[src*="googleusercontent"]')).toBeVisible()
  // Fremde Adressen werden blockiert
  const blocked = await page.evaluate(() => fetch('https://example.com/').then(() => false, () => true))
  expect(blocked).toBe(true)
  expect(violations.filter((v) => !v.includes('example.com'))).toEqual([])
})

test('Echte Hook-Antwort beim Code-Tausch (403, error_code unknown): „Kein Zugang“', async ({ page }) => {
  await mockSupabase(page, { token: { status: 403, body: { code: 403, error_code: 'unknown', msg: 'Kein Zugang – bitte von der Familie freischalten lassen.' } } })
  await page.goto('./')
  await googleButton(page).click()
  await expect(page.getByRole('alert')).toHaveText('Kein Zugang – bitte von der Familie freischalten lassen.')
})

test('Echte Hook-Antwort in der Rückleitung (server_error/unknown): „Kein Zugang“, auch auf Englisch', async ({ page }) => {
  const q = new URLSearchParams({ error: 'server_error', error_code: 'unknown', error_description: 'Kein Zugang – bitte von der Familie freischalten lassen.' }).toString()
  await mockSupabase(page, { callback: `#${q}` })
  await page.goto('./')
  await googleButton(page).click()
  await expect(page.getByRole('alert')).toHaveText('Kein Zugang – bitte von der Familie freischalten lassen.')
  expect(page.url()).toBe('http://localhost:5199/Gewohnheiten/')
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await page.getByRole('radio', { name: 'English' }).check()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('alert')).toHaveText('No access – ask your family to add you.')
})
