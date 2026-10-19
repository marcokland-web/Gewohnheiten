import { supabase } from './supabase'

// Web Push für Erinnerungen. Auf iPhone/iPad nur in der installierten App
// (Zum Home-Bildschirm), ab iOS 16.4.

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(VAPID_PUBLIC_KEY)
}

function deviceLabel(): string {
  const ua = navigator.userAgent
  const device = /iPad/.test(ua) || (isIOS() && !/iPhone/.test(ua)) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Gerät'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : 'Safari'
  return isStandalone() ? `${device} (App)` : `${device} · ${browser}`
}

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function save(sub: PushSubscription) {
  const { keys } = sub.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, p256dh: keys!.p256dh, auth: keys!.auth, device: deviceLabel() }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return 'off'
  // Abo am Server auffrischen (z. B. nach Neuinstallation)
  await save(sub).catch(() => undefined)
  return 'on'
}

export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt.')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY!) }))
  await save(sub)
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTestPush(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('gewohnheiten-reminders', { body: { test: true } })
  if (error) throw new Error(error.message)
  const { sent, errors } = data as { sent: number; errors: string[] }
  if (sent > 0) return `Test an ${sent} ${sent === 1 ? 'Gerät' : 'Geräte'} geschickt.`
  throw new Error(errors[0] ?? 'Nichts gesendet.')
}
