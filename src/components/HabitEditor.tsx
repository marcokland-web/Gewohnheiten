import { useState, type FormEvent } from 'react'
import { WEEKDAY_SHORT } from '../lib/dates'
import { createHabit, updateHabit } from '../lib/store'
import type { Habit, HabitDraft, ScheduleType } from '../lib/types'
import { Button, Field, HABIT_COLORS, inputClass, Sheet } from './ui'

const ICONS = ['✅', '💧', '🏃', '🧘', '📚', '🦷', '💪', '🥗', '😴', '🚭', '💊', '🧹', '✍️', '🎸', '🌿', '📵']

const SCHEDULES: { value: ScheduleType; label: string }[] = [
  { value: 'daily', label: 'Täglich' },
  { value: 'weekdays', label: 'Wochentage' },
  { value: 'per_week', label: 'X× / Woche' },
  { value: 'per_month', label: 'X× / Monat' },
]

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')

export function HabitEditor({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const [draft, setDraft] = useState<HabitDraft>(() => ({
    name: habit?.name ?? '',
    icon: habit?.icon ?? '✅',
    color: habit?.color ?? 'blue',
    schedule_type: habit?.schedule_type ?? 'daily',
    weekdays: habit?.weekdays ?? [1, 2, 3, 4, 5],
    target: habit?.target ?? 3,
    reminder_time: hhmm(habit?.reminder_time ?? '19:00'),
    last_call_time: hhmm(habit?.last_call_time ?? null),
  }))
  const [remind, setRemind] = useState(habit ? Boolean(habit.reminder_time) : true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (p: Partial<HabitDraft>) => setDraft((d) => ({ ...d, ...p }))
  const maxTarget = draft.schedule_type === 'per_week' ? 7 : 31

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (draft.schedule_type === 'weekdays' && !draft.weekdays.length) return setError('Mindestens einen Wochentag wählen.')
    setBusy(true)
    setError(null)
    const payload: HabitDraft = {
      ...draft,
      name: draft.name.trim(),
      weekdays: draft.schedule_type === 'weekdays' ? [...draft.weekdays].sort() : [],
      target: draft.schedule_type === 'per_week' || draft.schedule_type === 'per_month' ? Math.min(draft.target, maxTarget) : 1,
      reminder_time: remind && draft.reminder_time ? draft.reminder_time : null,
      last_call_time: remind && draft.last_call_time ? draft.last_call_time : null,
    }
    try {
      if (habit) await updateHabit(habit.id, payload)
      else await createHabit(payload)
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet title={habit ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Name">
          <input className={inputClass} required maxLength={80} placeholder="z. B. 2 Liter trinken" value={draft.name} onChange={(e) => patch({ name: e.target.value })} autoFocus={!habit} />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">Symbol</span>
          <div className="grid grid-cols-8 gap-1.5">
            {ICONS.map((i) => (
              <button
                type="button"
                key={i}
                onClick={() => patch({ icon: i })}
                className={`aspect-square rounded-xl text-xl transition ${draft.icon === i ? 'bg-accent/20 ring-2 ring-accent' : 'bg-surface-2'}`}
                aria-label={`Symbol ${i}`}
                aria-pressed={draft.icon === i}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">Farbe</span>
          <div className="flex gap-2">
            {Object.entries(HABIT_COLORS).map(([name, hex]) => (
              <button
                type="button"
                key={name}
                onClick={() => patch({ color: name })}
                className={`size-9 rounded-full transition ${draft.color === name ? 'ring-2 ring-ink ring-offset-2 ring-offset-bg' : ''}`}
                style={{ background: hex }}
                aria-label={`Farbe ${name}`}
                aria-pressed={draft.color === name}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">Wie oft?</span>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
            {SCHEDULES.map((s) => (
              <button
                type="button"
                key={s.value}
                onClick={() => patch({ schedule_type: s.value })}
                className={`rounded-lg px-1 py-2 text-sm font-medium transition ${draft.schedule_type === s.value ? 'bg-accent text-accent-ink shadow' : 'text-muted'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {draft.schedule_type === 'weekdays' && (
            <div className="mt-3 grid grid-cols-7 gap-1">
              {WEEKDAY_SHORT.map((label, idx) => {
                const d = idx + 1
                const on = draft.weekdays.includes(d)
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => patch({ weekdays: on ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d] })}
                    className={`rounded-lg py-2 text-sm font-medium ${on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'}`}
                    aria-pressed={on}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {(draft.schedule_type === 'per_week' || draft.schedule_type === 'per_month') && (
            <div className="mt-3 flex items-center gap-3">
              <button type="button" className="size-10 rounded-xl bg-surface-2 text-xl" onClick={() => patch({ target: Math.max(1, draft.target - 1) })} aria-label="Weniger">−</button>
              <span className="min-w-24 text-center font-semibold">
                {Math.min(draft.target, maxTarget)}× pro {draft.schedule_type === 'per_week' ? 'Woche' : 'Monat'}
              </span>
              <button type="button" className="size-10 rounded-xl bg-surface-2 text-xl" onClick={() => patch({ target: Math.min(maxTarget, draft.target + 1) })} aria-label="Mehr">+</button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <label className="flex items-center justify-between gap-3">
            <span className="font-medium">Erinnern, wenn noch offen</span>
            <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          </label>
          {remind && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Um">
                <input className={inputClass} type="time" required value={draft.reminder_time ?? ''} onChange={(e) => patch({ reminder_time: e.target.value })} />
              </Field>
              <Field label="Letzte Chance (optional)">
                <input className={inputClass} type="time" value={draft.last_call_time ?? ''} onChange={(e) => patch({ last_call_time: e.target.value })} />
              </Field>
              <p className="col-span-2 text-xs text-muted">
                {draft.schedule_type === 'per_week' || draft.schedule_type === 'per_month'
                  ? 'Sanft: Erinnerung erst, wenn das Ziel ohne heutigen Eintrag knapp wird.'
                  : 'Nur wenn an dem Tag noch nichts eingetragen ist.'}
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Abbrechen</Button>
          <Button type="submit" disabled={busy} className="flex-1">{busy ? 'Speichern …' : 'Speichern'}</Button>
        </div>
      </form>
    </Sheet>
  )
}
