import { useMemo, useState } from 'react'
import { addDays, formatDay, formatMonth, todayKey, weekdayLong, weekdayShort, weekStart } from '../lib/dates'
import { formatNumber, formatPercent, plural, T, useLang } from '../lib/i18n'
import { entriesInRange, habitStart, habitStats, isScheduledOn, scheduleLabel, trend, weekdayBreakdown } from '../lib/stats'
import { deleteHabit, setChecked, updateHabit, useStore } from '../lib/store'
import type { Habit } from '../lib/types'
import { BarChart } from './BarChart'
import { Page } from './Shell'
import { NoteSheet, useDaysByHabit } from './Today'
import { Button, ConfirmSheet, Field, habitColor, habitTint, IconBack, IconBell, inputClass, Segmented, Sheet } from './ui'

const WEEKS = 26

export function HabitDetail({ habit, onBack, onEdit }: { habit: Habit; onBack: () => void; onEdit: () => void }) {
  useLang()
  const { checkins } = useStore()
  const daysByHabit = useDaysByHabit()
  const days = daysByHabit.get(habit.id) ?? new Set<string>()
  const today = todayKey()
  const start = habitStart(habit, days)
  const stats = habitStats(habit, days, today, start)
  const color = habitColor(habit.color)
  const [noteDay, setNoteDay] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [backfill, setBackfill] = useState(false)
  const [trendUnit, setTrendUnit] = useState<'week' | 'month'>('month')

  const notes = Object.values(checkins)
    .filter((c) => c.habit_id === habit.id && c.note)
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 30)

  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  const firstWeek = addDays(weekStart(today), -7 * (WEEKS - 1))
  const buckets = useMemo(() => trend([habit], daysByHabit, trendUnit, 12, today), [habit, daysByHabit, trendUnit, today])
  const weekdays = useMemo(() => weekdayBreakdown([habit], daysByHabit, addDays(today, -364), today, today), [habit, daysByHabit, today])
  const daily = habit.schedule_type === 'daily' || habit.schedule_type === 'weekdays'
  const wdMax = daily ? 1 : Math.max(1, ...weekdays.map((w) => w.entries))
  const best = [...weekdays].filter((w) => (daily ? w.rate !== null : w.entries > 0)).sort((a, b) => (daily ? b.rate! - a.rate! : b.entries - a.entries))[0]

  // Durchschnitt pro Woche seit dem Start
  const daysSinceStart = Math.round((Date.parse(today) - Date.parse(start)) / 86400000) + 1
  const perWeek = stats.total / Math.max(1, daysSinceStart / 7)
  const thisMonth = entriesInRange(days, today.slice(0, 8) + '01', today)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <Page
      wide
      left={
        <button onClick={onBack} className="flex min-h-11 items-center gap-0.5 rounded-full pr-3 font-medium text-brand">
          <IconBack /> {T('Zurück', 'Back')}
        </button>
      }
      actions={
        <button onClick={onEdit} className="min-h-11 rounded-full px-3 font-semibold text-brand">
          {T('Bearbeiten', 'Edit')}
        </button>
      }
    >
      <div className="mb-4 flex items-center gap-3 px-1">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[14px] text-3xl" style={{ background: habitTint(habit.color, 16) }} aria-hidden>
          {habit.icon}
        </span>
        <div className="min-w-0">
          <h1 className="t-title truncate">{habit.name}</h1>
          <p className="t-sub flex flex-wrap items-center gap-1.5 text-ink-2">
            {scheduleLabel(habit)}
            {habit.reminder_time && (
              <>
                {' · '}
                <IconBell /> {habit.reminder_time.slice(0, 5)}
                {habit.last_call_time && ` / ${habit.last_call_time.slice(0, 5)}`}
              </>
            )}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
        <Stat label={T('Aktuelle Serie', 'Current streak')} value={formatNumber(stats.current)} sub={stats.unit} />
        <Stat label={T('Rekord', 'Best streak')} value={formatNumber(stats.best)} sub={stats.bestUnit} />
        <Stat label={T('Quote', 'Rate')} value={stats.rate === null ? '–' : formatPercent(stats.rate)} sub={stats.rateLabel} />
        <Stat label={T('Einträge', 'Entries')} value={formatNumber(stats.total)} sub={T('insgesamt', 'in total')} />
        <Stat label={T('Diesen Monat', 'This month')} value={formatNumber(thisMonth)} sub={plural(thisMonth, 'Eintrag', 'Einträge', 'entry', 'entries')} />
        <Stat label={T('Ø pro Woche', 'Avg. per week')} value={formatNumber(perWeek, 1)} sub={T(`seit ${formatDay(start, { day: 'numeric', month: 'short', year: 'numeric' })}`, `since ${formatDay(start, { day: 'numeric', month: 'short', year: 'numeric' })}`)} />
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
            summary={T('Anteil erfüllter Zeiträume, zum Ansehen antippen', 'Share of completed periods, tap to see')}
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
        </section>

        <section className="card p-4">
          <h2 className="t-headline mb-3 flex min-h-10 items-center">{T('Wochentage (12 Monate)', 'Weekdays (12 months)')}</h2>
          <BarChart
            summary={best ? T(`Am besten klappt es am ${weekdayLong(best.dow)}`, `Works best on ${weekdayLong(best.dow)}`) : T('Noch keine Einträge', 'No entries yet')}
            max={wdMax}
            bars={weekdays.map((w) => ({
              label: weekdayShort(w.dow),
              title: weekdayLong(w.dow),
              value: daily ? w.rate : w.entries,
              display: daily ? (w.rate === null ? '' : `${formatPercent(w.rate)} (${w.done}/${w.total})`) : `${formatNumber(w.entries)} ${plural(w.entries, 'Eintrag', 'Einträge', 'entry', 'entries')}`,
            }))}
          />
        </section>
      </div>

      <section className="card mt-4 p-4">
        <h2 className="t-headline mb-3">{T(`Letzte ${WEEKS} Wochen`, `Last ${WEEKS} weeks`)}</h2>
        <div className="flex gap-1.5">
          <div className="t-foot grid grid-rows-7 gap-[3px] pr-0.5 text-ink-2" aria-hidden>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <span key={d} className="flex items-center">{d % 2 === 1 ? weekdayShort(d) : ''}</span>
            ))}
          </div>
          {/* Am iPhone sind die Zellen zu klein zum Tippen: dort nur Anzeige, Nachtragen über „Tag nachtragen“ */}
          <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px] max-md:pointer-events-none" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
            {Array.from({ length: WEEKS * 7 }, (_, i) => {
              const d = addDays(firstWeek, i)
              const future = d > today
              const checked = days.has(d)
              const scheduled = isScheduledOn(habit, d)
              const title = `${formatDay(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${checked ? T(' · erledigt', ' · done') : ''}`
              return (
                <button
                  key={d}
                  disabled={future}
                  onClick={() => setChecked(habit.id, d, !checked)}
                  title={title}
                  aria-label={title}
                  aria-pressed={checked}
                  tabIndex={narrow ? -1 : undefined}
                  className={`aspect-square rounded-[3px] transition ${future ? 'invisible' : ''} ${d === today ? 'ring-2 ring-brand ring-inset' : ''}`}
                  style={{
                    background: checked ? color : 'var(--fill)',
                    opacity: checked || scheduled ? 1 : 0.45,
                  }}
                />
              )
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="t-foot hidden text-ink-2 md:block">{T('Antippen, um einen Tag nachzutragen oder zu entfernen.', 'Click to add or remove a day.')}</p>
          <Button variant="tinted" className="max-md:w-full" onClick={() => setBackfill(true)}>{T('Tag nachtragen', 'Add past day')}</Button>
        </div>
      </section>

      {notes.length > 0 && (
        <>
          <h2 className="t-foot mt-6 mb-1.5 px-4 font-medium text-ink-2 uppercase">{T('Notizen', 'Notes')}</h2>
          <ul className="card overflow-hidden">
            {notes.map((n) => (
              <li key={n.day} className="relative [&+&]:before:absolute [&+&]:before:top-0 [&+&]:before:right-0 [&+&]:before:left-4 [&+&]:before:h-px [&+&]:before:bg-separator">
                <button onClick={() => setNoteDay(n.day)} className="w-full px-4 py-2.5 text-left hover:bg-fill/60">
                  <span className="t-foot text-ink-2">{formatDay(n.day, { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                  <span className="block whitespace-pre-wrap">{n.note}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && <p className="t-sub mt-4 text-danger">{error}</p>}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="tinted" disabled={busy} onClick={() => run(async () => { await updateHabit(habit.id, { archived_at: new Date().toISOString() }); onBack() })}>
          {T('Archivieren', 'Archive')}
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
          {T('Löschen', 'Delete')}
        </Button>
      </div>

      {backfill && <BackfillSheet habit={habit} days={days} start={start} onClose={() => setBackfill(false)} />}
      {noteDay && <NoteSheet habit={habit} day={noteDay} onClose={() => setNoteDay(null)} />}
      {confirmDelete && (
        <ConfirmSheet
          title={T('Gewohnheit löschen?', 'Delete habit?')}
          message={T(
            `„${habit.name}“ wird mit allen ${stats.total} Einträgen endgültig gelöscht. Wenn du sie nur pausieren willst, nimm „Archivieren“.`,
            `“${habit.name}” will be deleted permanently with all ${stats.total} entries. To just pause it, use “Archive”.`,
          )}
          confirmLabel={T('Löschen', 'Delete')}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            void run(async () => {
              await deleteHabit(habit.id)
              onBack()
            })
          }}
        />
      )}
    </Page>
  )
}

/** Einen vergangenen Tag eintragen oder entfernen */
function BackfillSheet({ habit, days, start, onClose }: { habit: Habit; days: Set<string>; start: string; onClose: () => void }) {
  const today = todayKey()
  const [day, setDay] = useState(addDays(today, -1))
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today
  const checked = days.has(day)
  return (
    <Sheet title={`${habit.icon} ${T('Tag nachtragen', 'Add past day')}`} onClose={onClose}>
      <Field label={T('Datum', 'Date')}>
        <input className={inputClass} type="date" max={today} min={addDays(start, -365)} value={day} onChange={(e) => setDay(e.target.value)} />
      </Field>
      <p className="t-sub mt-3 text-ink-2" aria-live="polite">
        {!valid ? T('Bitte ein Datum bis heute wählen.', 'Please choose a date up to today.') : checked ? T('An diesem Tag ist schon eingetragen.', 'Already entered on this day.') : T('An diesem Tag ist noch nichts eingetragen.', 'Nothing entered on this day yet.')}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="tinted" onClick={onClose}>{T('Abbrechen', 'Cancel')}</Button>
        {checked ? (
          <Button variant="danger" disabled={!valid} onClick={() => { setChecked(habit.id, day, false); onClose() }}>{T('Eintrag entfernen', 'Remove entry')}</Button>
        ) : (
          <Button disabled={!valid} onClick={() => { setChecked(habit.id, day, true); onClose() }}>{T('Eintragen', 'Add entry')}</Button>
        )}
      </div>
    </Sheet>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card min-w-0 p-3.5">
      <div className="t-foot font-medium text-ink-2">{label}</div>
      <div className="t-num mt-1 text-[28px] leading-[34px] font-semibold">{value}</div>
      <div className="t-foot line-clamp-2 text-ink-2">{sub}</div>
    </div>
  )
}
