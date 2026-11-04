import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { mockSupabase, USER } from './mock'

// Randfälle der Google-Anmeldung (Bug-Bodo, 03.11.2026). Supabase komplett gemockt.

const googleButton = (page: Page) => page.getByRole('button', { name: /Mit Google anmelden|Sign in with Google/ })

async function signIn(page: Page) {
  await page.goto('./')
  await googleButton(page).click()
  await expect(page.getByRole('heading', { name: 'Heute' })).toBeVisible()
}

// Behoben: signOut() prüft das Ergebnis und entfernt die Sitzung sonst selbst.
test('Abmelden offline mit abgelaufener Sitzung: App landet bei der Anmeldung, Sitzung ist weg', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  // Sitzung läuft ab (Handy lag über Nacht), Netz ist weg
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('gewohnheiten-auth')!)
    s.expires_at = Math.floor(Date.now() / 1000) - 60
    localStorage.setItem('gewohnheiten-auth', JSON.stringify(s))
  })
  await page.route('https://fake-test.supabase.co/auth/v1/**', (r) => r.abort('internetdisconnected'))
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await page.getByRole('dialog', { name: 'Einstellungen' }).getByRole('button', { name: 'Abmelden' }).click()
  await page.getByRole('dialog', { name: 'Abmelden?' }).getByRole('button', { name: 'Nur abmelden' }).click()
  await expect(googleButton(page)).toBeVisible({ timeout: 8000 })
  expect(await page.evaluate(() => localStorage.getItem('gewohnheiten-auth'))).toBeNull()
})

test('Alte Adresse mit verbrauchtem Code bei bestehender Sitzung: kein Fehler, der später auftaucht', async ({ page }) => {
  await mockSupabase(page, { token: undefined })
  await signIn(page)
  // z. B. Lesezeichen/Verlauf mit ?code=… oder zweiter Tab
  await page.route('https://fake-test.supabase.co/auth/v1/token*', (r) =>
    r.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'flow_state_not_found', msg: 'invalid flow state' }) }),
  )
  await page.goto('./?code=alter-code')
  await expect(page.getByRole('heading', { name: 'Heute' })).toBeVisible()
  await page.unroute('https://fake-test.supabase.co/auth/v1/token*')
  // Danach abmelden: auf der Anmeldeseite darf keine veraltete Fehlermeldung stehen
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await page.getByRole('dialog', { name: 'Einstellungen' }).getByRole('button', { name: 'Abmelden' }).click()
  await page.getByRole('dialog', { name: 'Abmelden?' }).getByRole('button', { name: 'Nur abmelden' }).click()
  await expect(googleButton(page)).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  void USER
})

// Bewusst so gelassen (kein appendPkceFlowIdToRedirects): Wird die Anmeldung in zwei Tabs begonnen,
// gilt nur der jüngste Ablauf. Kehrt der erste zurück, lehnt Supabase den Verifier ab und die App
// zeigt eine verständliche Meldung.
test('Zweimal angefangen (zwei Tabs): Rückkehr des ersten Ablaufs zeigt verständliche Meldung', async ({ page, context }) => {
  const log = await mockSupabase(page)
  await page.route('https://fake-test.supabase.co/auth/v1/authorize*', (r) => {
    log.authorize.push(new URL(r.request().url()))
    return r.fulfill({ status: 200, body: 'google' })
  })
  await page.goto('./')
  await googleButton(page).click()
  await page.waitForURL(/authorize/)
  const challenge1 = log.authorize[0].searchParams.get('code_challenge')!
  const p2 = await context.newPage()
  await p2.route('https://fake-test.supabase.co/auth/v1/authorize*', (r) => r.fulfill({ status: 200, body: 'google' }))
  await p2.goto('http://localhost:5199/Gewohnheiten/')
  await googleButton(p2).click()
  await p2.waitForURL(/authorize/)
  // Supabase prüft den gesendeten Verifier gegen die Challenge des ersten Ablaufs
  await page.unroute('https://fake-test.supabase.co/auth/v1/authorize*')
  await page.route('https://fake-test.supabase.co/auth/v1/token*', (r) => {
    const sent = (r.request().postDataJSON() as { code_verifier: string }).code_verifier
    if (createHash('sha256').update(sent).digest('base64url') === challenge1) return r.fallback()
    return r.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'bad_code_verifier', msg: 'code challenge does not match previously saved code verifier' }) })
  })
  await page.goto('./?code=code-ablauf-1')
  await expect(page.getByRole('alert')).toContainText('Die Anmeldung ist abgelaufen')
  await expect(googleButton(page)).toBeEnabled()
})
