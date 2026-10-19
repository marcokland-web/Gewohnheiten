// Tage werden durchgehend als "YYYY-MM-DD" in lokaler Zeit behandelt.
// Rechnen immer über 12:00 Uhr, damit Sommer-/Winterzeit nie einen Tag verschiebt.

export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayKey(): string {
  return dayKey(new Date())
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

export function addMonths(key: string, n: number): string {
  const d = parseDay(key)
  return dayKey(new Date(d.getFullYear(), d.getMonth() + n, 1, 12))
}

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag */
export function isoDow(key: string): number {
  return ((parseDay(key).getDay() + 6) % 7) + 1
}

/** Montag der Woche */
export function weekStart(key: string): string {
  return addDays(key, 1 - isoDow(key))
}

export function monthStart(key: string): string {
  return key.slice(0, 8) + '01'
}

export function daysInMonth(key: string): number {
  const d = parseDay(key)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export function formatDay(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return parseDay(key).toLocaleDateString('de-DE', opts)
}
