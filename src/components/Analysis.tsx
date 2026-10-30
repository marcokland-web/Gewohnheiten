import { useMemo, useState } from 'react'
import { addDays, formatDay, formatMonth, todayKey, weekdayLong, weekdayShort } from '../lib/dates'
import { formatDelta, formatNumber, formatPercent, plural, T, useLang } from '../lib/i18n'
import { averageRate, entriesInRange, habitStats, habitStart, perfectDays, rateInRange, trend, weekdayBreakdown } from '../lib/stats'
import { useStore } from '../lib/store'
import { BarChart } from './BarChart'
import { Brand, LargeTitle, Page } from './Shell'
import { useDaysByHabit } from './Today'
import { habitColor, habitTint, IconChevron, Segmented } from './ui'

type Range = '7' | '30' | '90' | '365'

export function Analysis({ onOpen }: { onOpen: (id: string) => void }) {
  useLang()
  const { habits, loaded } = useStore()
  const daysByHabit = useDaysByHabit()
  const today = todayKey()
  const [range, setRange] = useState<Range>('30')
  const [trendUnit, setTrendUnit] = useState<'week' | 'month'>('week')

  const active = useMemo(() => habits.filter((h) => !h.archived_at), [habits])
  const len = Number(range)
  const from = addDays(today, -(len - 1))
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(prevTo, -(len - 1))

  const data = useMemo(() => {
    const perHabit = active.map((h) => {
      const days = daysByHabit.get(h.id) ?? new Set<string>()
      const start = habitStart(h, days)
      const now = rateInRange(h, days, from, today, today, start)
      const prev = rateInRange(h, days, prevFrom, prevTo, today, start)
      const stats = habitStats(h, days, today, start)
      return { habit: h, now, prev, stats, entries: entriesInRange(days, from, today), prevEntries: entriesInRange(days, prevFrom, prevTo) }
    })
    const rate = averageRate(perHabit.map((p) => p.now))
    // Für den Vergleich nur Gewohnheiten, die in beiden Zeiträumen einen Wert haben
    const both = perHabit.filter((p) => p.now.rate !== null && p.prev.rate !== null)
    const delta = both.length ? averageRate(both.map((p) => p.now))! - averageRate(both.map((p) => p.prev))! : null
    const entries = perHabit.reduce((s, p) => s + p.entries, 0)
    const prevEntries = perHabit.reduce((s, p) => s + p.prevEntries, 0)
    const perfect = perfectDays(active, daysByHabit, from, today, today)
    const weekdays = weekdayBreakdown(active, daysByHabit, from, today, today)
    const bestStreak = [...perHabit].filter((p) => p.stats.current > 0).sort((a, b) => b.stats.current - a.stats.current)[0]
    return { perHabit, rate, delta, entries, prevEntries, perfect, weekdays, bestStreak }
  }, [active, daysByHabit, from, today, prevFrom, prevTo])

  const buckets = useMemo(() => trend(active, daysByHabit, trendUnit, 12, today), [active, daysByHabit, trendUnit, today])

  const ranges: { value: Range; label: string }[] = [
    { value: '7', label: T('7 Tage', '7 days') },
    { value: '30', label: T('30 Tage', '30 days') },
    { value: '90', label: T('3 Monate', '3 months') },
    { value: '365', label: T('1 Jahr', '1 year') },
  ]

  const header = (
    <LargeTitle sub={`${formatDay(from, { day: 'numeric', month: 'short', year: 'numeric' })} – ${formatDay(today, { day: 'numeric', month: 'short', year: 'numeric' })}`}>
      {T('Analyse', 'Insights')}
    </LargeTitle>
  )

  if (loaded && active.length === 0) {
    return (
      <Page left={<Brand className="lg:hidden" />} title={T('Analyse', 'Insights')} wide>
        {header}
        <div className="card p-8 text-center">
          <div className="text-4xl" aria-hidden>📊</div>
          <p className="t-headline mt-3">{T('Noch nichts auszuwerten', 'Nothing to analyse yet')}</p>
          <p className="t-sub mt-1 text-ink-2">{T('Lege eine Gewohnheit an und hake sie ab – hier siehst du dann, wie es läuft.', 'Create a habit and tick it off – this is where you’ll see how it’s going.')}</p>
        </div>
      </Page>
    )
  }

  // Wochentage: Quote, wenn es tägliche Gewohnheiten gibt, sonst Anzahl Einträge
  const useRate = data.weekdays.some((w) => w.rate !== null)
  const wdValue = (w: (typeof data.weekdays)[number]) => (useRate ? w.rate : w.entries)
  const wdMax = useRate ? 1 : Math.max(1, ...data.weekdays.map((w) => w.entries))
  const wdValid = data.weekdays.filter((w) => wdValue(w) !== null)
  const strongest = wdValid.length ? wdValid.reduce((a, b) => (wdValue(b)! > wdValue(a)! ? b : a)) : null
  const weakest = wdValid.length ? wdValid.reduce((a, b) => (wdValue(b)! < wdValue(a)! ? b : a)) : null
  const wdSummary =
    strongest && weakest && wdValue(strongest) !== wdValue(weakest)
      ? T(`Am besten: ${weekdayLong(strongest.dow)} · am schwächsten: ${weekdayLong(weakest.dow)}`, `Best: ${weekdayLong(strongest.dow)} · weakest: ${weekdayLong(weakest.dow)}`)
      : T('Noch kein Unterschied zwischen den Wochentagen', 'No difference between weekdays yet')

  const trendValid = buckets.filter((b) => b.rate !== null)
  const trendAvg = trendValid.length ? trendValid.reduce((s, b) => s + b.rate!, 0) / trendValid.length : null

  const ranked = [...data.perHabit].sort((a, b) => (b.now.rate ?? -1) - (a.now.rate ?? -1))

  return (
    <Page left={<Brand className="lg:hidden" />} title={T('Analyse', 'Insights')} wide>
      {header}

      <Segmented label={T('Zeitraum', 'Period')} value={range} options={ranges} onChange={setRange} className="mb-4" />

      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4" aria-label={T('Kennzahlen', 'Key figures')}>
        <Tile
          label={T('Erfüllt', 'Completed')}
          value={data.rate === null ? '–' : formatPercent(data.rate)}
          delta={data.delta}
          sub={T('Ø aller Gewohnheiten', 'avg. of all habits')}
        />
        <Tile
          label={T('Einträge', 'Entries')}
          value={formatNumber(data.entries)}
          sub={data.prevEntries || data.entries ? T(`vorher ${formatNumber(data.prevEntries)}`, `before: ${formatNumber(data.prevEntries)}`) : T('im Zeitraum', 'in period')}
        />
        <Tile
          label={T('Perfekte Tage', 'Perfect days')}
          value={data.perfect.eligible ? `${formatNumber(data.perfect.perfect)}` : '–'}
          sub={data.perfect.eligible ? T(`von ${data.perfect.eligible} · alles Tägliche erledigt`, `of ${data.perfect.eligible} · all daily habits done`) : T('nur für tägliche Gewohnheiten', 'daily habits only')}
        />
        <Tile
          label={T('Beste laufende Serie', 'Best current streak')}
          value={data.bestStreak ? formatNumber(data.bestStreak.stats.current) : '–'}
          sub={data.bestStreak ? `${data.bestStreak.stats.unit} · ${data.bestStreak.habit.icon} ${data.bestStreak.habit.name}` : ''}
        />
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="t-headline">{T('Verlauf', 'Trend')}</h2>
            <Segmented
              label={T('Einheit', 'Unit')}
              value={trendUnit}
              options={[
                { value: 'week', label: T('Wochen', 'Weeks') },
                { value: 'month', label: T('Monate', 'Months') },
              ]}
              onChange={setTrendUnit}
              className="w-44"
            />
          </div>
          <BarChart
            summary={trendAvg === null ? T('Noch keine abgeschlossenen Zeiträume', 'No completed periods yet') : T(`Ø ${formatPercent(trendAvg)} erfüllt in den letzten 12 ${trendUnit === 'week' ? 'Wochen' : 'Monaten'}`, `Avg. ${formatPercent(trendAvg)} completed over the last 12 ${trendUnit === 'week' ? 'weeks' : 'months'}`)}
            bars={buckets.map((b, i) => ({
              label: trendUnit === 'week' ? formatDay(b.from, { day: 'numeric', month: 'numeric' }) : formatMonth(b.from),
              title:
                trendUnit === 'week'
                  ? `${formatDay(b.from, { day: 'numeric', month: 'short' })} – ${formatDay(b.to, { day: 'numeric', month: 'short' })}`
                  : formatMonth(b.from, { month: 'long', year: 'numeric' }),
              value: b.rate,
              display: b.rate === null ? '' : formatPercent(b.rate),
              highlight: i === buckets.length - 1,
            }))}
          />
          <p className="t-foot mt-2 text-ink-2">{T('Schraffiert: laufender Zeitraum – noch offene Tage, Wochen und Monate zählen erst, wenn erledigt.', 'Hatched: current period – open days, weeks and months only count once done.')}</p>
        </section>

        <section className="card p-4">
          <h2 className="t-headline mb-3 flex min-h-10 items-center">{useRate ? T('Wochentage', 'Weekdays') : T('Einträge nach Wochentag', 'Entries by weekday')}</h2>
          <BarChart
            summary={wdSummary}
            max={wdMax}
            bars={data.weekdays.map((w) => ({
              label: weekdayShort(w.dow),
              title: weekdayLong(w.dow),
              value: wdValue(w),
              display: useRate ? (w.rate === null ? '' : `${formatPercent(w.rate)} (${w.done}/${w.total})`) : `${formatNumber(w.entries)} ${plural(w.entries, 'Eintrag', 'Einträge', 'entry', 'entries')}`,
            }))}
          />
          {useRate && <p className="t-foot mt-2 text-ink-2">{T('Anteil erledigter geplanter Tage (tägliche Gewohnheiten).', 'Share of planned days done (daily habits).')}</p>}
        </section>
      </div>

      <h2 className="t-foot mt-6 mb-1.5 px-4 font-medium text-ink-2 uppercase">{T('Gewohnheiten im Vergleich', 'Habits compared')}</h2>
      <ul className="card overflow-hidden">
        {ranked.map(({ habit, now, prev, stats }) => {
          const delta = now.rate !== null && prev.rate !== null ? now.rate - prev.rate : null
          return (
            <li key={habit.id} className="relative [&+&]:before:absolute [&+&]:before:top-0 [&+&]:before:right-0 [&+&]:before:left-[72px] [&+&]:before:h-px [&+&]:before:bg-separator">
              <button onClick={() => onOpen(habit.id)} className="flex w-full items-center gap-3 py-3 pr-3 pl-4 text-left hover:bg-fill/60">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-2xl" style={{ background: habitTint(habit.color, 16) }} aria-hidden>
                  {habit.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{habit.name}</span>
                    <span className="t-num shrink-0 font-semibold">{now.rate === null ? '–' : formatPercent(now.rate)}</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${(now.rate ?? 0) * 100}%`, background: habitColor(habit.color) }} />
                  </span>
                  <span className="t-foot mt-1 flex items-start justify-between gap-2 text-ink-2">
                    <span className="flex min-w-0 flex-wrap gap-x-1.5">
                      <span>{now.total ? T(`${now.done} von ${now.total} erfüllt`, `${now.done} of ${now.total} completed`) : T('noch nichts abgeschlossen', 'nothing completed yet')}</span>
                      {stats.current > 0 && <span className="whitespace-nowrap">· {T('Serie', 'Streak')} {stats.current} {stats.unit}</span>}
                    </span>
                    {delta !== null && <Delta value={delta} />}
                  </span>
                </span>
                <span className="text-ink-2"><IconChevron /></span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="t-foot mt-1.5 px-4 text-ink-2">
        {T(
          'Erfüllt heißt: Tag, Woche oder Monat mit erreichtem Ziel. Der Vergleich bezieht sich auf den gleich langen Zeitraum davor.',
          'Completed means a day, week or month with the goal reached. The comparison refers to the period of equal length before.',
        )}
      </p>
    </Page>
  )
}

function Tile({ label, value, sub, delta }: { label: string; value: string; sub: string; delta?: number | null }) {
  return (
    <div className="card min-w-0 p-3.5">
      <div className="t-foot font-medium text-ink-2">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="t-num text-[28px] leading-[34px] font-semibold">{value}</span>
        {delta !== undefined && delta !== null && <Delta value={delta} />}
      </div>
      <div className="t-foot line-clamp-2 text-ink-2">{sub}</div>
    </div>
  )
}

/** Veränderung mit Vorzeichen und Farbe (Farbe nie allein) */
function Delta({ value }: { value: number }) {
  const pts = Math.round(value * 100)
  const cls = pts > 0 ? 'text-success' : pts < 0 ? 'text-danger' : 'text-ink-2'
  return (
    <span className={`t-foot t-num shrink-0 font-medium ${cls}`} title={T('gegenüber dem Zeitraum davor', 'compared with the previous period')}>
      {formatDelta(value)}
    </span>
  )
}
