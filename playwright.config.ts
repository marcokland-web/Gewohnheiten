import { defineConfig, devices } from '@playwright/test'

// Browser-Tests gegen den Vite-Dev-Server mit einem erfundenen Supabase-Projekt.
// Alle Anfragen an *.supabase.co werden im Test abgefangen (tests/e2e/mock.ts),
// die echte Datenbank wird nie berührt.
const PORT = 5199

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/Gewohnheiten/`,
    serviceWorkers: 'block',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/Gewohnheiten/`,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'https://fake-test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_VAPID_PUBLIC_KEY: '',
    },
  },
})
