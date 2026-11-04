import { expect, test, type Page } from '@playwright/test'
import { mockSupabase } from './mock'

// Team-Standard 1: Desktop, iPad, iPhone, jeweils hell und dunkel.
// Bilder landen in test-results/ansicht/ (nicht im Repo) zum Ansehen.
const VIEWS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'ipad', width: 820, height: 1180, mobile: true },
  { name: 'iphone', width: 390, height: 844, mobile: true },
] as const

async function noSideScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(over).toBeLessThanOrEqual(0)
}

for (const v of VIEWS) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`${v.name} ${theme}`, () => {
      test.use({ viewport: { width: v.width, height: v.height }, isMobile: v.mobile, hasTouch: v.mobile, colorScheme: theme })

      test('Anmeldung und Konto', async ({ page }) => {
        await mockSupabase(page)
        // Ohne Einblend-Animationen, damit die Bilder den Endzustand zeigen
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto('./')
        const button = page.getByRole('button', { name: 'Mit Google anmelden' })
        await expect(button).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        const box = (await button.boundingBox())!
        expect(box.height).toBeGreaterThanOrEqual(44)
        // Knopf in Google-Farben je Thema
        const bg = await button.evaluate((b) => getComputedStyle(b).backgroundColor)
        expect(bg).toBe(theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(19, 19, 20)')
        await noSideScroll(page)
        await page.screenshot({ path: `test-results/ansicht/${v.name}-${theme}-1-anmeldung.png` })

        await button.click()
        await expect(page.getByRole('heading', { name: 'Heute' })).toBeVisible()
        await page.getByRole('button', { name: 'Einstellungen' }).click()
        const settings = page.getByRole('dialog', { name: 'Einstellungen' })
        const account = settings.getByText('Anna Test')
        await account.scrollIntoViewIfNeeded()
        await expect(account).toBeInViewport()
        await noSideScroll(page)
        await page.screenshot({ path: `test-results/ansicht/${v.name}-${theme}-2-konto.png` })

        await settings.getByRole('button', { name: 'Abmelden' }).click()
        const ask = page.getByRole('dialog', { name: 'Abmelden?' })
        for (const name of ['Abmelden und vom Gerät löschen', 'Nur abmelden', 'Abbrechen']) {
          const b = ask.getByRole('button', { name })
          await expect(b).toBeInViewport()
          expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        }
        // „Nur abmelden“ hat einen sichtbaren Rand (im Dunkeln sonst unsichtbar)
        const edge = await ask.getByRole('button', { name: 'Nur abmelden' }).evaluate((b) => getComputedStyle(b).borderTopWidth)
        expect(edge).toBe('1px')
        await noSideScroll(page)
        await page.screenshot({ path: `test-results/ansicht/${v.name}-${theme}-3-abmelden.png` })
      })
    })
  }
}
