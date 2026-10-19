import { del, get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import type { Checkin, Habit, HabitDraft, Profile } from './types'

// ---------------------------------------------------------------------
// Datenhaltung mit Offline-Warteschlange
//
// Einträge (abhaken, Notiz) wirken sofort lokal und landen in einer
// Warteschlange in IndexedDB, die abgearbeitet wird, sobald Netz da ist.
// Weil (habit_id, day) der Schlüssel ist, sind Wiederholungen harmlos.
// Gewohnheiten selbst anlegen/ändern geht nur online.
// ---------------------------------------------------------------------

type Op =
  | { kind: 'upsert'; habit_id: string; day: string; note: string | null }
  | { kind: 'delete'; habit_id: string; day: string }

interface State {
  userId: string | null
  habits: Habit[]
  /** Schlüssel: `${habit_id}|${day}` */
  checkins: Record<string, Checkin>
  queue: Op[]
  loaded: boolean
  syncing: boolean
  online: boolean
  error: string | null
}

let state: State = {
  userId: null,
  habits: [],
  checkins: {},
  queue: [],
  loaded: false,
  syncing: false,
  online: navigator.onLine,
  error: null,
}

const listeners = new Set<() => void>()

function setState(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useStore(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export const ckey = (habitId: string, day: string) => `${habitId}|${day}`

// Gleicher Origin wie andere GitHub-Pages-Apps → Schlüssel mit Präfix
const cacheKey = (uid: string) => `gewohnheiten:cache:${uid}`
const queueKey = (uid: string) => `gewohnheiten:queue:${uid}`

async function persist() {
  const { userId, habits, checkins, queue } = state
  if (!userId) return
  try {
    await set(cacheKey(userId), { habits, checkins })
    await set(queueKey(userId), queue)
  } catch {
    // privater Modus o. ä.: dann eben nur im Speicher
  }
}

function applyOp(checkins: Record<string, Checkin>, op: Op): Record<string, Checkin> {
  const next = { ...checkins }
  const k = ckey(op.habit_id, op.day)
  if (op.kind === 'delete') delete next[k]
  else next[k] = { habit_id: op.habit_id, day: op.day, note: op.note }
  return next
}

// ---------------------------------------------------------------------
// Start / Laden
// ---------------------------------------------------------------------

export async function startSession(userId: string) {
  if (state.userId === userId && state.loaded) return
  let cached: { habits: Habit[]; checkins: Record<string, Checkin> } | undefined
  let queue: Op[] = []
  try {
    cached = await get(cacheKey(userId))
    queue = (await get(queueKey(userId))) ?? []
  } catch {
    /* ohne Cache weiter */
  }
  setState({
    userId,
    habits: cached?.habits ?? [],
    checkins: cached?.checkins ?? {},
    queue,
    loaded: Boolean(cached),
    error: null,
  })
  await syncProfile()
  await refresh()
}

export async function endSession() {
  const uid = state.userId
  if (uid) {
    try {
      await del(cacheKey(uid))
      await del(queueKey(uid))
    } catch {
      /* egal */
    }
  }
  setState({ userId: null, habits: [], checkins: {}, queue: [], loaded: false, error: null })
}

async function syncProfile() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  // Zeitzone mitschicken, damit der Server "heute" richtig berechnet
  await supabase.from('profiles').upsert({ user_id: state.userId, timezone }, { onConflict: 'user_id' })
}

export async function loadProfile(): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('timezone, quiet_from, quiet_to').maybeSingle()
  return data
}

export async function saveProfile(patch: Partial<Profile>) {
  const { error } = await supabase.from('profiles').update(patch).eq('user_id', state.userId!)
  if (error) throw new Error(error.message)
}

/** Holt alles vom Server und legt noch nicht gesendete Einträge oben drauf. */
export async function refresh() {
  if (!state.userId) return
  await flush()

  const { data: habits, error: hErr } = await supabase
    .from('habits')
    .select('*')
    .order('sort_order')
    .order('created_at')
  if (hErr) return setState({ error: offline(hErr) ? null : hErr.message, loaded: true })

  // PostgREST liefert höchstens 1000 Zeilen pro Anfrage
  const rows: Checkin[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('checkins')
      .select('habit_id, day, note')
      .order('day')
      .range(from, from + 999)
    if (error) return setState({ error: offline(error) ? null : error.message, loaded: true })
    rows.push(...data)
    if (data.length < 1000) break
  }

  let checkins: Record<string, Checkin> = {}
  for (const c of rows) checkins[ckey(c.habit_id, c.day)] = c
  for (const op of state.queue) checkins = applyOp(checkins, op)

  setState({ habits: habits as Habit[], checkins, loaded: true, error: null })
  await persist()
}

// ---------------------------------------------------------------------
// Einträge (offline-fähig)
// ---------------------------------------------------------------------

function enqueue(op: Op) {
  // Pro Gewohnheit und Tag zählt nur die letzte Aktion
  const queue = state.queue.filter((q) => !(q.habit_id === op.habit_id && q.day === op.day)).concat(op)
  setState({ queue, checkins: applyOp(state.checkins, op) })
  void persist()
  void flush()
}

export function setChecked(habitId: string, day: string, checked: boolean) {
  if (checked) {
    const note = state.checkins[ckey(habitId, day)]?.note ?? null
    enqueue({ kind: 'upsert', habit_id: habitId, day, note })
  } else {
    enqueue({ kind: 'delete', habit_id: habitId, day })
  }
}

export function setNote(habitId: string, day: string, note: string) {
  enqueue({ kind: 'upsert', habit_id: habitId, day, note: note.trim() || null })
}

function offline(error: { code?: string; message: string }): boolean {
  // Netzwerkfehler haben keinen Postgres-/PostgREST-Code
  return !navigator.onLine || !error.code
}

let flushing: Promise<void> | null = null

export function flush(): Promise<void> {
  flushing ??= doFlush().finally(() => (flushing = null))
  return flushing
}

async function doFlush() {
  if (!state.userId || !state.queue.length) return
  setState({ syncing: true })
  while (state.queue.length) {
    const op = state.queue[0]
    const { error } =
      op.kind === 'upsert'
        ? await supabase
            .from('checkins')
            .upsert({ habit_id: op.habit_id, day: op.day, note: op.note }, { onConflict: 'habit_id,day' })
        : await supabase.from('checkins').delete().eq('habit_id', op.habit_id).eq('day', op.day)

    if (error && offline(error)) break // später erneut versuchen
    if (error) setState({ error: `Eintrag verworfen: ${error.message}` })
    // Nur entfernen, wenn in der Zwischenzeit keine neuere Aktion dazukam
    if (state.queue[0] === op) setState({ queue: state.queue.slice(1) })
    else setState({ queue: state.queue.filter((q) => q !== op) })
    await persist()
  }
  setState({ syncing: false })
}

window.addEventListener('online', () => {
  setState({ online: true })
  void refresh()
})
window.addEventListener('offline', () => setState({ online: false }))
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void refresh()
})

// ---------------------------------------------------------------------
// Gewohnheiten (nur online)
// ---------------------------------------------------------------------

export async function createHabit(draft: HabitDraft) {
  const sort_order = Math.max(0, ...state.habits.map((h) => h.sort_order)) + 1
  const { data, error } = await supabase
    .from('habits')
    .insert({ ...draft, sort_order })
    .select()
    .single()
  if (error) throw new Error(friendly(error.message))
  setState({ habits: [...state.habits, data as Habit] })
  await persist()
}

export async function updateHabit(id: string, patch: Partial<Habit>) {
  const { data, error } = await supabase.from('habits').update(patch).eq('id', id).select().single()
  if (error) throw new Error(friendly(error.message))
  setState({ habits: state.habits.map((h) => (h.id === id ? (data as Habit) : h)) })
  await persist()
}

export async function deleteHabit(id: string) {
  const { error } = await supabase.from('habits').delete().eq('id', id)
  if (error) throw new Error(friendly(error.message))
  const checkins = Object.fromEntries(Object.entries(state.checkins).filter(([, c]) => c.habit_id !== id))
  setState({ habits: state.habits.filter((h) => h.id !== id), checkins })
  await persist()
}

/** Tauscht die Position mit dem Nachbarn (−1 = nach oben, +1 = nach unten). */
export async function moveHabit(id: string, dir: -1 | 1) {
  const active = state.habits.filter((h) => !h.archived_at)
  const i = active.findIndex((h) => h.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= active.length) return
  const reordered = [...active]
  ;[reordered[i], reordered[j]] = [reordered[j], reordered[i]]
  const withOrder = reordered.map((h, idx) => ({ ...h, sort_order: idx }))
  const archived = state.habits.filter((h) => h.archived_at)
  setState({ habits: [...withOrder, ...archived] })
  const changed = withOrder.filter((h) => h.sort_order !== active.find((a) => a.id === h.id)!.sort_order)
  await Promise.all(changed.map((h) => supabase.from('habits').update({ sort_order: h.sort_order }).eq('id', h.id)))
  await persist()
}

function friendly(msg: string): string {
  if (/fetch|network/i.test(msg)) return 'Keine Verbindung – Gewohnheiten können nur online geändert werden.'
  return msg
}

export function dismissError() {
  setState({ error: null })
}
