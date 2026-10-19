import { useMemo, useState } from 'react'
import { addDays, formatDay, todayKey } from '../lib/dates'
import { todayStatus, type TodayStatus } from '../lib/stats'
import { ckey, moveHabit, setChecked, setNote, useStore } from '../lib/store'
import type { Habit } from '../lib/types'
import { Button, habitColor, IconBell, IconCheck, IconCloudOff, IconDown, IconGear, IconNote, IconPlus, IconUp, inputClass, Sheet } from './ui'

interface Props {
  onOpen: (id: string) => void
  onNew: () => void
  onSettings: () => void
}

/** Tage mit Eintrag pro Gewohnheit */
export function useDaysByHabit() {
  const { checkins } = useStore()
  return useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of Object.values(checkins)) {
      if (!map.has(c.habit_id)) map.set(c.habit_id, new Set())
      map.get(c.habit_id)!.add(c.day)
    }
    return map
  }, [checkins])
}

export function Today({ onOpen, onNew, onSettings }: Props) {
  const { habits, checkins, loaded, queue, online, syncing } = useStore()
  const daysByHabit = useDaysByHabit()
  const today = todayKey()
  const [day, setDay] = useState(today)
  const [sorting, setSorting] = useState(false)
  const [noteFor, setNoteFor] = useState<Habit | null>(null)

  const active = habits.filter((h) => !h.archived_at)
  const rows = active.map((h) => ({ habit: h, status: todayStatus(h, daysByHabit.get(h.id) ?? new Set(), day) }))
  const relevant = rows.filter((r) => r.status.scheduledToday)
  const doneCount = relevant.filter((r) => r.status.checkedToday || r.status.done).length
  // Offene zuerst, Erledigtes und "heute frei" nach unten
  const ordered = sorting ? rows : [...rows].sort((a, b) => rank(a.status) - rank(b.status))

  const strip = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))

  return (
    <div className="mx-auto max-w-2xl px-4 pt-safe pb-28">
      <header className="hero relative overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-blue-900/25">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-white/75">{day === today ? 'Heute' : formatDay(day, { weekday: 'long' })}</p>
            <h1 className="text-2xl font-bold">{formatDay(day, { day: 'numeric', month: 'long' })}</h1>
            <SyncBadge online={online} pending={queue.length} syncing={syncing} />
          </div>
          <div className="flex items-center gap-3">
            <ProgressRing value={relevant.length ? doneCount / relevant.length : 0} label={`${doneCount}/${relevant.length}`} />
            <button onClick={onSettings} className="rounded-full bg-white/15 p-2.5 hover:bg-white/25" aria-label="Einstellungen">
              <IconGear />
            </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-1.5">
          {strip.map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`rounded-xl py-1.5 text-center transition ${d === day ? 'bg-white text-blue-800 shadow' : 'bg-white/10 text-white/85 hover:bg-white/20'}`}
              aria-pressed={d === day}
            >
              <div className="text-[11px] uppercase">{formatDay(d, { weekday: 'short' }).replace('.', '')}</div>
              <div className="text-base font-semibold">{formatDay(d, { day: 'numeric' }).replace('.', '')}</div>
            </button>
          ))}
        </div>
      </header>

      <div className="mt-5 mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Gewohnheiten</h2>
        {active.length > 1 && (
          <button onClick={() => setSorting((s) => !s)} className="text-sm font-medium text-accent">
            {sorting ? 'Fertig' : 'Sortieren'}
          </button>
        )}
      </div>

      {!loaded ? (
        <p className="py-10 text-center text-muted">Lade …</p>
      ) : active.length === 0 ? (
        <div className="glass rounded-3xl p-8 text-center">
          <div className="text-4xl">🌱</div>
          <p className="mt-3 font-medium">Noch keine Gewohnheiten</p>
          <p className="mt-1 text-sm text-muted">Fang mit einer einzigen an – klein und machbar.</p>
          <Button className="mt-5" onClick={onNew}><IconPlus /> Erste Gewohnheit</Button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {ordered.map(({ habit, status }, idx) => (
            <li key={habit.id}>
              <HabitRow
                habit={habit}
                status={status}
                hasNote={Boolean(checkins[ckey(habit.id, day)]?.note)}
                sorting={sorting}
                isFirst={idx === 0}
                isLast={idx === ordered.length - 1}
                onToggle={() => setChecked(habit.id, day, !status.checkedToday)}
                onOpen={() => onOpen(habit.id)}
                onNote={() => setNoteFor(habit)}
              />
            </li>
          ))}
        </ul>
      )}

      {!sorting && (
        <button
          onClick={onNew}
          className="hero fixed right-5 bottom-[max(env(safe-area-inset-bottom),1.25rem)] flex size-14 items-center justify-center rounded-full text-white shadow-xl shadow-blue-900/30 transition hover:scale-105"
          aria-label="Neue Gewohnheit"
        >
          <IconPlus />
        </button>
      )}

      {noteFor && <NoteSheet habit={noteFor} day={day} onClose={() => setNoteFor(null)} />}
    </div>
  )
}

function rank(s: TodayStatus): number {
  if (!s.scheduledToday) return 3
  if (s.checkedToday) return 2
  if (s.done) return 1.5
  return s.urgent ? 0 : 1
}

function HabitRow(props: {
  habit: Habit
  status: TodayStatus
  hasNote: boolean
  sorting: boolean
  isFirst: boolean
  isLast: boolean
  onToggle: () => void
  onOpen: () => void
  onNote: () => void
}) {
  const { habit, status, hasNote, sorting } = props
  const color = habitColor(habit.color)
  const muted = !status.scheduledToday || (status.done && !status.checkedToday)

  return (
    <div className={`glass flex items-center gap-3 rounded-2xl p-3 pl-4 transition ${muted ? 'opacity-70' : ''}`}>
      <button onClick={props.onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `${color}22` }}>
          {habit.icon}
        </span>
        <span className="min-w-0">
          <span className={`block truncate font-semibold ${status.checkedToday ? 'text-muted line-through decoration-2' : ''}`}>{habit.name}</span>
          <span className={`flex items-center gap-1 truncate text-sm ${status.urgent ? 'font-medium text-warn' : 'text-muted'}`}>
            {habit.reminder_time && <IconBell />}
            {status.hint}
          </span>
        </span>
      </button>

      {sorting ? (
        <div className="flex flex-col">
          <button disabled={props.isFirst} onClick={() => moveHabit(habit.id, -1)} className="rounded p-1 text-muted disabled:opacity-30" aria-label="Nach oben"><IconUp /></button>
          <button disabled={props.isLast} onClick={() => moveHabit(habit.id, 1)} className="rounded p-1 text-muted disabled:opacity-30" aria-label="Nach unten"><IconDown /></button>
        </div>
      ) : (
        <>
          {status.checkedToday && (
            <button onClick={props.onNote} className={`rounded-full p-2 ${hasNote ? 'text-accent' : 'text-muted'}`} aria-label="Notiz">
              <IconNote />
            </button>
          )}
          <button
            onClick={props.onToggle}
            key={String(status.checkedToday)}
            className={`flex size-12 shrink-0 items-center justify-center rounded-full border-2 transition ${status.checkedToday ? 'pop border-transparent text-white' : 'border-line text-transparent hover:border-accent/60'}`}
            style={status.checkedToday ? { background: `linear-gradient(135deg, ${color}, #38bdf8)` } : undefined}
            aria-label={status.checkedToday ? `${habit.name}: Eintrag entfernen` : `${habit.name}: erledigt`}
            aria-pressed={status.checkedToday}
          >
            <IconCheck size={22} />
          </button>
        </>
      )}
    </div>
  )
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-14">
      <svg viewBox="0 0 52 52" className="size-14 -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgb(255 255 255 / 0.2)" strokeWidth="5" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="transition-[stroke-dashoffset] duration-500" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{label}</span>
    </div>
  )
}

function SyncBadge({ online, pending, syncing }: { online: boolean; pending: number; syncing: boolean }) {
  if (online && !pending) return null
  return (
    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs">
      {!online && <IconCloudOff />}
      {!online ? 'Offline' : syncing ? 'Synchronisiere' : 'Ausstehend'}
      {pending > 0 && ` · ${pending} ${pending === 1 ? 'Eintrag wartet' : 'Einträge warten'}`}
    </p>
  )
}

export function NoteSheet({ habit, day, onClose }: { habit: Habit; day: string; onClose: () => void }) {
  const { checkins } = useStore()
  const [text, setText] = useState(checkins[ckey(habit.id, day)]?.note ?? '')
  return (
    <Sheet title={`${habit.icon} Notiz · ${formatDay(day)}`} onClose={onClose}>
      <textarea className={`${inputClass} min-h-32`} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Wie lief's?" autoFocus />
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose}>Abbrechen</Button>
        <Button
          className="flex-1"
          onClick={() => {
            setNote(habit.id, day, text)
            onClose()
          }}
        >
          Speichern
        </Button>
      </div>
    </Sheet>
  )
}
