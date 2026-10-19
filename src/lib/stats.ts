import { addDays, addMonths, daysInMonth, isoDow, monthStart, WEEKDAY_SHORT, weekStart } from './dates'
import type { Habit } from './types'

export function scheduleLabel(h: Pick<Habit, 'schedule_type' | 'weekdays' | 'target'>): string {
  switch (h.schedule_type) {
    case 'daily':
      return 'Täglich'
    case 'weekdays':
      return [...h.weekdays].sort().map((d) => WEEKDAY_SHORT[d - 1]).join(', ')
    case 'per_week':
      return `${h.target}× pro Woche`
    case 'per_month':
      return `${h.target}× pro Monat`
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
      hint: scheduledToday ? scheduleLabel(h) : `Heute frei · ${scheduleLabel(h)}`,
      urgent: false,
    }
  }

  const start = h.schedule_type === 'per_week' ? weekStart(today) : monthStart(today)
  const end = h.schedule_type === 'per_week' ? addDays(start, 6) : addDays(start, daysInMonth(today) - 1)
  const count = countBetween(days, start, end)
  const remaining = Math.max(0, h.target - count)
  // Tage, an denen noch eingetragen werden kann (heute nur, wenn noch offen)
  const daysLeft = countDaysBetween(today, end) + 1 - (checkedToday ? 1 : 0)
  const period = h.schedule_type === 'per_week' ? 'diese Woche' : 'diesen Monat'

  let hint: string
  if (remaining === 0) hint = `Ziel erreicht · ${count}/${h.target} ${period}`
  else if (remaining > daysLeft) hint = `${count}/${h.target} · nicht mehr schaffbar`
  else hint = `${count}/${h.target} · noch ${remaining} in ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tagen'}`

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
    h.schedule_type === 'per_week' ? [12, 'letzte 12 Wochen'] :
    h.schedule_type === 'per_month' ? [6, 'letzte 6 Monate'] :
    h.schedule_type === 'weekdays' ? [12, 'letzte 12 geplante Tage'] :
    [30, 'letzte 30 Tage']
  const recent = all.slice(-window)
  const rate = recent.length ? recent.filter((p) => p.fulfilled).length / recent.length : null

  const unit = (n: number) =>
    h.schedule_type === 'per_week' ? (n === 1 ? 'Woche' : 'Wochen') :
    h.schedule_type === 'per_month' ? (n === 1 ? 'Monat' : 'Monate') :
    n === 1 ? 'Tag' : 'Tage'

  return { current, best, unit: unit(current), bestUnit: unit(best), rate, rateLabel, total: days.size }
}
