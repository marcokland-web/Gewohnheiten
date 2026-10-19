import { useState } from 'react'
import { addDays, dayKey, formatDay, todayKey, weekStart, WEEKDAY_SHORT } from '../lib/dates'
import { habitStats, isScheduledOn, scheduleLabel } from '../lib/stats'
import { deleteHabit, setChecked, updateHabit, useStore } from '../lib/store'
import type { Habit } from '../lib/types'
import { NoteSheet, useDaysByHabit } from './Today'
import { Button, habitColor, IconBack, IconBell } from './ui'

const WEEKS = 26

export function HabitDetail({ habit, onBack, onEdit }: { habit: Habit; onBack: () => void; onEdit: () => void }) {
  const { checkins } = useStore()
  const days = useDaysByHabit().get(habit.id) ?? new Set<string>()
  const today = todayKey()
  const createdDay = dayKey(new Date(habit.created_at))
  const stats = habitStats(habit, days, today, createdDay)
  const color = habitColor(habit.color)
  const [noteDay, setNoteDay] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const notes = Object.values(checkins)
    .filter((c) => c.habit_id === habit.id && c.note)
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 30)

  const firstWeek = addDays(weekStart(today), -7 * (WEEKS - 1))

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
    <div className="mx-auto max-w-2xl px-4 pt-safe pb-safe">
      <header className="hero rounded-3xl p-5 text-white shadow-xl shadow-blue-900/25">
        <button onClick={onBack} className="-ml-2 flex items-center gap-1 rounded-full py-1 pr-3 pl-1 text-white/85 hover:bg-white/15">
          <IconBack /> Zurück
        </button>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-4xl">{habit.icon}</span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{habit.name}</h1>
            <p className="flex items-center gap-1.5 text-sm text-white/80">
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
      </header>

      <section className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Aktuelle Serie" value={`${stats.current}`} sub={stats.unit} />
        <Stat label="Rekord" value={`${stats.best}`} sub={stats.bestUnit} />
        <Stat label="Quote" value={stats.rate === null ? '–' : `${Math.round(stats.rate * 100)} %`} sub={stats.rateLabel} />
        <Stat label="Einträge" value={`${stats.total}`} sub="insgesamt" />
      </section>

      <section className="glass mt-4 rounded-3xl p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Letzte {WEEKS} Wochen</h2>
        <div className="flex gap-1.5">
          <div className="grid grid-rows-7 gap-[3px] pr-0.5 text-[10px] leading-none text-muted">
            {WEEKDAY_SHORT.map((d, i) => (
              <span key={d} className="flex items-center">{i % 2 === 0 ? d : ''}</span>
            ))}
          </div>
          <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
            {Array.from({ length: WEEKS * 7 }, (_, i) => {
              const d = addDays(firstWeek, i)
              const future = d > today
              const checked = days.has(d)
              const scheduled = isScheduledOn(habit, d)
              const title = `${formatDay(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${checked ? ' · erledigt' : ''}`
              return (
                <button
                  key={d}
                  disabled={future}
                  onClick={() => setChecked(habit.id, d, !checked)}
                  title={title}
                  aria-label={title}
                  className={`aspect-square rounded-[3px] transition ${future ? 'invisible' : ''} ${d === today ? 'ring-1 ring-accent' : ''}`}
                  style={{
                    background: checked ? color : 'var(--surface-2)',
                    opacity: checked || scheduled ? 1 : 0.45,
                    boxShadow: checked ? 'none' : 'inset 0 0 0 1px var(--line)',
                  }}
                />
              )
            })}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">Antippen, um einen Tag nachzutragen oder zu entfernen.</p>
      </section>

      {notes.length > 0 && (
        <section className="glass mt-4 rounded-3xl p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Notizen</h2>
          <ul className="divide-y divide-line">
            {notes.map((n) => (
              <li key={n.day}>
                <button onClick={() => setNoteDay(n.day)} className="w-full py-2.5 text-left">
                  <span className="text-xs text-muted">{formatDay(n.day, { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                  <span className="block whitespace-pre-wrap">{n.note}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onEdit}>Bearbeiten</Button>
        <Button variant="ghost" disabled={busy} onClick={() => run(async () => { await updateHabit(habit.id, { archived_at: new Date().toISOString() }); onBack() })}>
          Archivieren
        </Button>
        <Button
          variant="danger"
          className="col-span-2"
          disabled={busy}
          onClick={() => {
            if (confirm(`„${habit.name}“ mit allen ${stats.total} Einträgen endgültig löschen?`)) run(async () => { await deleteHabit(habit.id); onBack() })
          }}
        >
          Löschen
        </Button>
      </div>

      {noteDay && <NoteSheet habit={habit} day={noteDay} onClose={() => setNoteDay(null)} />}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="glass rounded-2xl p-3.5">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="truncate text-xs text-muted">{sub}</div>
    </div>
  )
}
