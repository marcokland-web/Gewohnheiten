import { useMemo, useState } from 'react'
import { addDays, formatDay, relativeDay, todayKey } from '../lib/dates'
import { plural, T, useLang } from '../lib/i18n'
import { todayStatus, type TodayStatus } from '../lib/stats'
import { ckey, moveHabit, setChecked, setNote, useStore } from '../lib/store'
import type { Habit } from '../lib/types'
import { Brand, LargeTitle, Page } from './Shell'
import { Button, GlassIconButton, habitColor, habitTint, IconBell, IconCheck, IconCloudOff, IconDown, IconNote, IconPlus, IconUp, inputClass, Sheet } from './ui'

interface Props {
  onOpen: (id: string) => void
  onNew: () => void
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

export function Today({ onOpen, onNew }: Props) {
  useLang()
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
    <Page
      left={<Brand className="lg:hidden" />}
      title={T('Heute', 'Today')}
      actions={
        !sorting && (
          <GlassIconButton label={T('Neue Gewohnheit', 'New habit')} onClick={onNew}>
            <IconPlus />
          </GlassIconButton>
        )
      }
    >
      <div className="flex items-start justify-between gap-3">
        <LargeTitle sub={<>{formatDay(day, { day: 'numeric', month: 'long', year: 'numeric' })} <SyncBadge online={online} pending={queue.length} syncing={syncing} /></>}>
          {relativeDay(day, today)}
        </LargeTitle>
        {relevant.length > 0 && <ProgressRing value={doneCount / relevant.length} label={`${doneCount}/${relevant.length}`} />}
      </div>

      <div className="card mb-5 grid grid-cols-7 gap-1 p-1.5" role="group" aria-label={T('Tag wählen', 'Choose day')}>
        {strip.map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`flex min-h-12 flex-col items-center justify-center rounded-[10px] transition ${d === day ? 'bg-brand text-on-brand' : 'text-ink hover:bg-fill'}`}
            aria-pressed={d === day}
            aria-label={formatDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}
          >
            <span className={`text-[11px] leading-[13px] uppercase ${d === day ? '' : 'text-ink-2'}`}>{formatDay(d, { weekday: 'short' }).replace('.', '')}</span>
            <span className="t-num text-[17px] leading-[22px] font-semibold">{formatDay(d, { day: 'numeric' }).replace('.', '')}</span>
          </button>
        ))}
      </div>

      <div className="mb-1.5 flex min-h-11 items-center justify-between px-1">
        <h2 className="t-foot font-medium text-ink-2 uppercase">{T('Gewohnheiten', 'Habits')}</h2>
        {active.length > 1 && (
          <button onClick={() => setSorting((s) => !s)} className="-mr-2 min-h-11 px-2 font-semibold text-brand">
            {sorting ? T('Fertig', 'Done') : T('Sortieren', 'Reorder')}
          </button>
        )}
      </div>

      {!loaded ? (
        <p className="py-10 text-center text-ink-2">{T('Lade …', 'Loading …')}</p>
      ) : active.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl" aria-hidden>🌱</div>
          <p className="t-headline mt-3">{T('Noch keine Gewohnheiten', 'No habits yet')}</p>
          <p className="t-sub mt-1 text-ink-2">{T('Fang mit einer einzigen an – klein und machbar.', 'Start with just one – small and doable.')}</p>
          <Button className="mt-5" onClick={onNew}><IconPlus /> {T('Erste Gewohnheit', 'First habit')}</Button>
        </div>
      ) : (
        <ul className="card overflow-hidden">
          {ordered.map(({ habit, status }, idx) => (
            <li key={habit.id} className="relative [&+&]:before:absolute [&+&]:before:top-0 [&+&]:before:right-0 [&+&]:before:left-[72px] [&+&]:before:h-px [&+&]:before:bg-separator">
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

      {noteFor && <NoteSheet habit={noteFor} day={day} onClose={() => setNoteFor(null)} />}
    </Page>
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
    <div className="flex items-center gap-2 py-2.5 pr-3 pl-4">
      <button onClick={props.onOpen} className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left ${muted ? 'opacity-65' : ''}`}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-2xl" style={{ background: habitTint(habit.color, 16) }} aria-hidden>
          {habit.icon}
        </span>
        <span className="min-w-0">
          <span className={`block truncate font-semibold ${status.checkedToday ? 'text-ink-2 line-through decoration-2' : ''}`}>{habit.name}</span>
          <span className={`t-sub flex items-center gap-1 truncate ${status.urgent ? 'font-medium text-warning' : 'text-ink-2'}`}>
            {habit.reminder_time && <IconBell />}
            {status.urgent && <span aria-hidden>!</span>}
            {status.hint}
          </span>
        </span>
      </button>

      {sorting ? (
        <div className="flex">
          <button disabled={props.isFirst} onClick={() => moveHabit(habit.id, -1)} className="flex size-11 items-center justify-center rounded-full text-ink-2 disabled:opacity-30" aria-label={T(`${habit.name} nach oben`, `Move ${habit.name} up`)}><IconUp /></button>
          <button disabled={props.isLast} onClick={() => moveHabit(habit.id, 1)} className="flex size-11 items-center justify-center rounded-full text-ink-2 disabled:opacity-30" aria-label={T(`${habit.name} nach unten`, `Move ${habit.name} down`)}><IconDown /></button>
        </div>
      ) : (
        <>
          {status.checkedToday && (
            <button onClick={props.onNote} className={`flex size-11 items-center justify-center rounded-full ${hasNote ? 'text-brand' : 'text-ink-2'}`} aria-label={hasNote ? T('Notiz bearbeiten', 'Edit note') : T('Notiz hinzufügen', 'Add note')}>
              <IconNote />
            </button>
          )}
          <button
            onClick={props.onToggle}
            key={String(status.checkedToday)}
            className={`flex size-12 shrink-0 items-center justify-center rounded-full border-2 transition ${status.checkedToday ? 'pop border-transparent text-white dark:text-[#141012]' : 'border-separator text-transparent hover:border-brand/60'}`}
            style={status.checkedToday ? { background: color } : undefined}
            aria-label={status.checkedToday ? T(`${habit.name}: Eintrag entfernen`, `${habit.name}: remove entry`) : T(`${habit.name}: erledigt`, `${habit.name}: done`)}
            aria-pressed={status.checkedToday}
          >
            <IconCheck size={22} />
          </button>
        </>
      )}
    </div>
  )
}

export function ProgressRing({ value, label, size = 56 }: { value: number; label: string; size?: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <div className="relative mt-1 shrink-0" style={{ width: size, height: size }} role="img" aria-label={T(`${label} erledigt`, `${label} done`)}>
      <svg viewBox="0 0 52 52" className="size-full -rotate-90" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--fill)" strokeWidth="5" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--gold)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="transition-[stroke-dashoffset] duration-500" />
      </svg>
      <span className="t-num t-foot absolute inset-0 flex items-center justify-center font-bold" aria-hidden>{label}</span>
    </div>
  )
}

function SyncBadge({ online, pending, syncing }: { online: boolean; pending: number; syncing: boolean }) {
  if (online && !pending) return null
  return (
    <span className="t-foot ml-1 inline-flex items-center gap-1 rounded-full bg-fill px-2 py-0.5 align-middle text-ink-2">
      {!online && <IconCloudOff />}
      {!online ? 'Offline' : syncing ? T('Synchronisiere', 'Syncing') : T('Ausstehend', 'Pending')}
      {pending > 0 && ` · ${pending} ${plural(pending, 'Eintrag wartet', 'Einträge warten', 'entry waiting', 'entries waiting')}`}
    </span>
  )
}

export function NoteSheet({ habit, day, onClose }: { habit: Habit; day: string; onClose: () => void }) {
  const { checkins } = useStore()
  const [text, setText] = useState(checkins[ckey(habit.id, day)]?.note ?? '')
  return (
    <Sheet title={`${habit.icon} ${T('Notiz', 'Note')} · ${formatDay(day)}`} onClose={onClose}>
      <textarea className={`${inputClass} min-h-32`} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={T('Wie lief’s?', 'How did it go?')} aria-label={T('Notiz', 'Note')} autoFocus />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="tinted" onClick={onClose}>{T('Abbrechen', 'Cancel')}</Button>
        <Button
          onClick={() => {
            setNote(habit.id, day, text)
            onClose()
          }}
        >
          {T('Speichern', 'Save')}
        </Button>
      </div>
    </Sheet>
  )
}
