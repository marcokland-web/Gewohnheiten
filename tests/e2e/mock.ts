import type { Page, Route } from '@playwright/test'

// Erfundenes Supabase für die Browser-Tests: Google-Weiterleitung, Code-Tausch, REST.

export const SUPABASE = 'https://fake-test.supabase.co'
export const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'anna.test@example.com',
  app_metadata: { provider: 'google', providers: ['email', 'google'] },
  user_metadata: { full_name: 'Anna Test', avatar_url: 'https://lh3.googleusercontent.com/a/test-photo' },
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
function fakeJwt() {
  const exp = Math.floor(Date.now() / 1000) + 3600
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, aud: 'authenticated', role: 'authenticated', exp, email: USER.email })}.sig`
}

export const HABITS = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Lesen',
    icon: '📖',
    color: 'blue',
    schedule_type: 'daily',
    weekdays: [],
    target: 1,
    reminder_time: null,
    last_call_time: null,
    sort_order: 1,
    archived_at: null,
    created_at: '2026-01-01T00:00:00Z',
  },
]

export interface MockOptions {
  /** Was Google/Supabase an die App zurückgibt: Code (Standard) oder Fehler-Parameter */
  callback?: string
  /** Antwort beim Code-Tausch */
  token?: { status: number; body: object }
}

export interface MockLog {
  authorize: URL[]
  token: object[]
  logout: number
}

export async function mockSupabase(page: Page, opts: MockOptions = {}): Promise<MockLog> {
  const log: MockLog = { authorize: [], token: [], logout: 0 }
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })

  // Sicherheitsnetz: nichts an echte Supabase-Projekte
  await page.route(/https:\/\/(?!fake-test\.)[a-z0-9-]+\.supabase\.co\//, (r) => r.abort())

  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    }
    if (url.pathname === '/auth/v1/authorize') {
      log.authorize.push(url)
      const back = new URL(url.searchParams.get('redirect_to')!)
      const cb = opts.callback ?? 'code=test-code'
      return route.fulfill({ status: 302, headers: { location: `${back.href}${cb.startsWith('#') ? '' : '?'}${cb}` } })
    }
    if (url.pathname === '/auth/v1/token') {
      log.token.push(req.postDataJSON())
      if (opts.token) return json(route, opts.token.body, opts.token.status)
      const now = Math.floor(Date.now() / 1000)
      return json(route, { access_token: fakeJwt(), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'refresh-test', user: USER })
    }
    if (url.pathname === '/auth/v1/logout') {
      log.logout++
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
    }
    if (url.pathname === '/auth/v1/user') return json(route, USER)
    if (url.pathname === '/rest/v1/habits') return json(route, HABITS)
    if (url.pathname === '/rest/v1/checkins') return json(route, [])
    if (url.pathname === '/rest/v1/profiles') {
      if (req.method() === 'GET') return json(route, { timezone: 'Europe/Berlin', quiet_from: null, quiet_to: null })
      return json(route, [], 201)
    }
    if (url.pathname === '/rest/v1/push_subscriptions') return json(route, [])
    return json(route, { message: `nicht gemockt: ${url.pathname}` }, 404)
  })

  // Google-Profilbild
  await page.route('https://lh3.googleusercontent.com/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#C8963E"/><circle cx="20" cy="16" r="7" fill="#fff"/><rect x="8" y="26" width="24" height="14" rx="7" fill="#fff"/></svg>',
    }),
  )
  return log
}

/** Schlüssel in IndexedDB (idb-keyval) */
export function idbKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('keyval-store')
        open.onerror = () => reject(open.error)
        open.onupgradeneeded = () => open.result.createObjectStore('keyval')
        open.onsuccess = () => {
          const req = open.result.transaction('keyval').objectStore('keyval').getAllKeys()
          req.onsuccess = () => resolve(req.result.map(String))
          req.onerror = () => reject(req.error)
        }
      }),
  )
}
