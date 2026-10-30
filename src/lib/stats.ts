import { addDays, addMonths, dayKey, daysInMonth, isoDow, monthStart, weekdayShort, weekStart } from './dates'
import { plural, T } from './i18n'
import type { Habit } from './types'

export function scheduleLabel(h: Pick<Habit, 'schedule_type' | 'weekdays' | 'target'>): string {
  switch (h.schedule_type) {
    case 'daily':
      return T('Täglich', 'Daily')
    case 'weekdays':
      return [...h.weekdays].sort().map(weekdayShort).join(', ')
    case 'per_week':
      return T(`${h.target}× pro Woche`, `${h.target}× a week`)
    case 'per_month':
      return T(`${h.target}× pro Monat`, `${h.target}× a month`)
  }
}

export function isScheduledOn(h: Habit, day: string): boolean {
  return h.schedule_type !== 'weekdays' || h.weekdays.includes(isoDow(day))
}

function countBetween(days: Set<string>, from: string, toInclusive: string): number {
  let n = 0
  for (const d of days) if (d >= from && d <= toInclusive) n++
  return n
}

export interface TodayStatus {
  checkedToday: boolean
  scheduledToday: boolean
  /** Ziel für den aktuellen Zeitraum erreicht */
  done: boolean
  count: number
  target: number
  /** Kurzer Hinweis unter dem Namen */
  hint: string
  /** Gleiche Regel wie die "sanfte" Erinnerung: es wird knapp */
  urgent: boolean
}

export function todayStatus(h: Habit, days: Set<string>, today: string): TodayStatus {
  const checkedToday = days.has(today)
  const scheduledToday = isScheduledOn(h, today)

  if (h.schedule_type === 'daily' || h.schedule_type === 'weekdays') {
    return {
      checkedToday,
      scheduledToday,
      done: checkedToday,
      count: checkedToday ? 1 : 0,
      target: 1,
      hint: scheduledToday ? scheduleLabel(h) : `${T('Heute frei', 'Day off')} · ${scheduleLabel(h)}`,
      urgent: false,
    }
  }

  const start = h.schedule_type === 'per_week' ? weekStart(today) : monthStart(today)
  const end = h.schedule_type === 'per_week' ? addDays(start, 6) : addDays(start, daysInMonth(today) - 1)
  const count = countBetween(days, start, end)
  const remaining = Math.max(0, h.target - count)
  // Tage, an denen noch eingetragen werden kann (heute nur, wenn noch offen)
  const daysLeft = countDaysBetween(today, end) + 1 - (checkedToday ? 1 : 0)
  const period = h.schedule_type === 'per_week' ? T('diese Woche', 'this week') : T('diesen Monat', 'this month')

  let hint: string
  if (remaining === 0) hint = `${T('Ziel erreicht', 'Goal reached')} · ${count}/${h.target} ${period}`
  else if (remaining > daysLeft) hint = `${count}/${h.target} · ${T('nicht mehr schaffbar', 'out of reach')}`
  else hint = `${count}/${h.target} · ${T(`noch ${remaining} in ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tagen'}`, `${remaining} to go in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`)}`

  return {
    checkedToday,
    scheduledToday: true,
    done: remaining === 0,
    count,
    target: h.target,
    hint,
    urgent: remaining > 0 && !checkedToday && remaining >= daysLeft,
  }
}

function countDaysBetween(from: string, to: string): number {
  let n = 0
  for (let d = from; d < to; d = addDays(d, 1)) n++
  return n
}

interface Period {
  fulfilled: boolean
  current: boolean
}

/**
 * Alle Zeiträume vom Start bis heute in der Einheit der Gewohnheit:
 * Tage (täglich), geplante Tage (Wochentage), Wochen oder Monate.
 */
function periods(h: Habit, days: Set<string>, start: string, today: string): Period[] {
  const out: Period[] = []
  if (h.schedule_type === 'daily' || h.schedule_type === 'weekdays') {
    for (let d = start; d <= today; d = addDays(d, 1)) {
      if (!isScheduledOn(h, d)) continue
      out.push({ fulfilled: days.has(d), current: d === today })
    }
  } else if (h.schedule_type === 'per_week') {
    for (let w = weekStart(start); w <= today; w = addDays(w, 7)) {
      out.push({ fulfilled: countBetween(days, w, addDays(w, 6)) >= h.target, current: w === weekStart(today) })
    }
  } else {
    for (let m = monthStart(start); m <= today; m = addMonths(m, 1)) {
      const end = addDays(m, daysInMonth(m) - 1)
      out.push({ fulfilled: countBetween(days, m, end) >= h.target, current: m === monthStart(today) })
    }
  }
  return out
}

export interface HabitStats {
  current: number
  best: number
  unit: string
  bestUnit: string
  /** Erfolgsquote 0..1 über die letzten abgeschlossenen Zeiträume, null wenn noch keine */
  rate: number | null
  rateLabel: string
  total: number
}

export function habitStats(h: Habit, days: Set<string>, today: string, createdDay: string): HabitStats {
  let start = createdDay
  for (const d of days) if (d < start) start = d

  // Ein laufender, noch nicht erfüllter Zeitraum bricht keine Serie
  const all = periods(h, days, start, today).filter((p) => !(p.current && !p.fulfilled))

  let current = 0
  for (let i = all.length - 1; i >= 0 && all[i].fulfilled; i--) current++

  let best = 0
  let run = 0
  for (const p of all) {
    run = p.fulfilled ? run + 1 : 0
    best = Math.max(best, run)
  }

  const [window, rateLabel] =
    h.schedule_type === 'per_week' ? [12, T('letzte 12 Wochen', 'last 12 weeks')] :
    h.schedule_type === 'per_month' ? [6, T('letzte 6 Monate', 'last 6 months')] :
    h.schedule_type === 'weekdays' ? [12, T('letzte 12 geplante Tage', 'last 12 planned days')] :
    [30, T('letzte 30 Tage', 'last 30 days')]
  const recent = all.slice(-window)
  const rate = recent.length ? recent.filter((p) => p.fulfilled).length / recent.length : null

  const unit = (n: number) =>
    h.schedule_type === 'per_week' ? plural(n, 'Woche', 'Wochen', 'week', 'weeks') :
    h.schedule_type === 'per_month' ? plural(n, 'Monat', 'Monate', 'month', 'months') :
    plural(n, 'Tag', 'Tage', 'day', 'days')

  return { current, best, unit: unit(current), bestUnit: unit(best), rate, rateLabel, total: days.size }
}

// ---------------------------------------------------------------------
// Analyse: Quoten über beliebige Zeiträume, Verlauf, Wochentage
// ---------------------------------------------------------------------

/** Erster Tag, ab dem die Gewohnheit zählt: Anlage oder früherer Eintrag */
export function habitStart(h: Habit, days: Set<string>): string {
  let start = dayKey(new Date(h.created_at))
  for (const d of days) if (d < start) start = d
  return start
}

export interface Rate {
  done: number
  total: number
  /** 0..1, null wenn im Zeitraum nichts zu bewerten war */
  rate: number | null
}

/**
 * Erfüllte Zeiträume im Bereich [from, to] in der Einheit der Gewohnheit.
 * Laufende, noch offene Zeiträume (heute, diese Woche, dieser Monat) zählen nicht,
 * ebenso der angebrochene erste Zeitraum vor dem Start, wenn er nicht erfüllt wurde.
 * Wochen und Monate zählen nur in dem Bereich, in dem sie enden (bzw. heute liegen),
 * damit aneinandergrenzende Bereiche keinen Zeitraum doppelt zählen.
 */
export function rateInRange(h: Habit, days: Set<string>, from: string, to: string, today: string, start = habitStart(h, days)): Rate {
  let done = 0
  let total = 0
  const last = to < today ? to : today
  const first = from > start ? from : start
  if (first > last) return { done, total, rate: null }

  if (h.schedule_type === 'daily' || h.schedule_type === 'weekdays') {
    for (let d = first; d <= last; d = addDays(d, 1)) {
      if (!isScheduledOn(h, d)) continue
      const checked = days.has(d)
      if (d === today && !checked) continue
      total++
      if (checked) done++
    }
  } else {
    const weekly = h.schedule_type === 'per_week'
    const startOf = weekly ? weekStart : monthStart
    for (let p = startOf(first); p <= last; p = weekly ? addDays(p, 7) : addMonths(p, 1)) {
      const end = weekly ? addDays(p, 6) : addDays(p, daysInMonth(p) - 1)
      const effectiveEnd = end < today ? end : today
      if (effectiveEnd < from || effectiveEnd > to) continue
      const fulfilled = countBetween(days, p, end) >= h.target
      const running = end >= today
      const partialStart = p < start
      if (!fulfilled && (running || partialStart)) continue
      total++
      if (fulfilled) done++
    }
  }
  return { done, total, rate: total ? done / total : null }
}

/** Durchschnitt der Quoten (jede Gewohnheit zählt gleich viel) */
export function averageRate(rates: Rate[]): number | null {
  const valid = rates.filter((r) => r.rate !== null)
  return valid.length ? valid.reduce((s, r) => s + r.rate!, 0) / valid.length : null
}

export interface Bucket {
  from: string
  to: string
  rate: number | null
}

/** Verlauf: die letzten `n` Wochen oder Monate bis heute */
export function trend(habits: Habit[], daysByHabit: Map<string, Set<string>>, unit: 'week' | 'month', n: number, today: string): Bucket[] {
  const out: Bucket[] = []
  for (let i = n - 1; i >= 0; i--) {
    const from = unit === 'week' ? addDays(weekStart(today), -7 * i) : addMonths(monthStart(today), -i)
    const to = unit === 'week' ? addDays(from, 6) : addDays(from, daysInMonth(from) - 1)
    const rates = habits.map((h) => rateInRange(h, daysByHabit.get(h.id) ?? new Set(), from, to, today))
    out.push({ from, to, rate: averageRate(rates) })
  }
  return out
}

export interface WeekdayRow {
  /** ISO 1..7 */
  dow: number
  done: number
  total: number
  /** Quote für tägliche/Wochentags-Gewohnheiten, sonst null */
  rate: number | null
  /** Einträge aller Gewohnheiten an diesem Wochentag */
  entries: number
}

/** Wie gut klappt es an welchem Wochentag? */
export function weekdayBreakdown(habits: Habit[], daysByHabit: Map<string, Set<string>>, from: string, to: string, today: string): WeekdayRow[] {
  const rows: WeekdayRow[] = Array.from({ length: 7 }, (_, i) => ({ dow: i + 1, done: 0, total: 0, rate: null, entries: 0 }))
  const last = to < today ? to : today
  for (const h of habits) {
    const days = daysByHabit.get(h.id) ?? new Set<string>()
    const start = habitStart(h, days)
    const daily = h.schedule_type === 'daily' || h.schedule_type === 'weekdays'
    for (let d = from > start ? from : start; d <= last; d = addDays(d, 1)) {
      const row = rows[isoDow(d) - 1]
      const checked = days.has(d)
      if (checked) row.entries++
      if (!daily || !isScheduledOn(h, d) || (d === today && !checked)) continue
      row.total++
      if (checked) row.done++
    }
  }
  for (const r of rows) r.rate = r.total ? r.done / r.total : null
  return rows
}

export interface PerfectDays {
  perfect: number
  /** Tage, an denen mindestens eine tägliche Gewohnheit geplant war */
  eligible: number
}

/** Tage, an denen alle geplanten täglichen Gewohnheiten erledigt wurden */
export function perfectDays(habits: Habit[], daysByHabit: Map<string, Set<string>>, from: string, to: string, today: string): PerfectDays {
  const daily = habits
    .filter((h) => h.schedule_type === 'daily' || h.schedule_type === 'weekdays')
    .map((h) => {
      const days = daysByHabit.get(h.id) ?? new Set<string>()
      return { h, days, start: habitStart(h, days) }
    })
  let perfect = 0
  let eligible = 0
  const last = to < today ? to : today
  for (let d = from; d <= last; d = addDays(d, 1)) {
    const planned = daily.filter((x) => x.start <= d && isScheduledOn(x.h, d))
    if (!planned.length) continue
    const all = planned.every((x) => x.days.has(d))
    if (d === today && !all) continue
    eligible++
    if (all) perfect++
  }
  return { perfect, eligible }
}

/** Einträge im Bereich */
export function entriesInRange(days: Set<string>, from: string, to: string): number {
  return countBetween(days, from, to)
}
