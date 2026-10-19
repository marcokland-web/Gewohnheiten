// Gewohnheiten – Push-Erinnerungen
//
// Zwei Aufrufarten:
//   * pg_cron (alle 5 Minuten) mit Header "x-cron-secret": verschickt alle
//     fälligen Erinnerungen (Logik in gewohnheiten.claim_due_reminders).
//   * App mit Nutzer-JWT: schickt eine Test-Nachricht an die eigenen Geräte.
//
// Deploy: npm run deploy:function

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const env = (name: string) => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Secret ${name} fehlt`)
  return v
}

const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  db: { schema: 'gewohnheiten' },
  auth: { persistSession: false },
})

webpush.setVapidDetails(env('GW_VAPID_SUBJECT'), env('GW_VAPID_PUBLIC_KEY'), env('GW_VAPID_PRIVATE_KEY'))

const APP_URL = '/Gewohnheiten/'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

interface Subscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface Message {
  title: string
  body: string
  tag: string
}

/** Schickt an alle Geräte; abgelaufene Abos (404/410) werden gelöscht. */
async function send(subs: Subscription[], msg: Message) {
  let sent = 0
  const errors: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...msg, url: APP_URL }),
          { TTL: 60 * 60, urgency: 'high' },
        )
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
        else errors.push(`${status ?? ''} ${(e as Error).message}`.trim())
      }
    }),
  )
  return { sent, errors }
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function runReminders() {
  const { data: due, error } = await db.rpc('claim_due_reminders')
  if (error) throw new Error(error.message)
  if (!due?.length) return { due: 0, sent: 0, errors: [] }

  const userIds = [...new Set(due.map((d: { user_id: string }) => d.user_id))]
  const { data: subs, error: subErr } = await db.from('push_subscriptions').select('*').in('user_id', userIds)
  if (subErr) throw new Error(subErr.message)

  let sent = 0
  const errors: string[] = []
  for (const d of due as { user_id: string; habit_id: string; name: string; icon: string; kind: string; body: string }[]) {
    const r = await send(
      (subs as Subscription[]).filter((s) => s.user_id === d.user_id),
      { title: `${d.icon} ${d.name}`, body: d.body, tag: `${d.habit_id}-${d.kind}` },
    )
    sent += r.sent
    errors.push(...r.errors)
  }
  return { due: due.length, sent, errors }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const cronSecret = req.headers.get('x-cron-secret')
    if (cronSecret) {
      if (!safeEqual(cronSecret, env('GW_CRON_SECRET'))) return json({ error: 'forbidden' }, 403)
      return json(await runReminders())
    }

    // Test-Nachricht für den angemeldeten Nutzer
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'unauthorized' }, 401)
    const { data: auth, error } = await db.auth.getUser(token)
    if (error || !auth.user) return json({ error: 'unauthorized' }, 401)

    const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', auth.user.id)
    if (!subs?.length) return json({ sent: 0, errors: ['Kein Gerät für Erinnerungen aktiviert.'] })
    return json(await send(subs as Subscription[], { title: '🔔 Test', body: 'Erinnerungen funktionieren auf diesem Gerät.', tag: 'test' }))
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
