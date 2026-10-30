import { useState, type FormEvent } from 'react'
import { weekdayShort } from '../lib/dates'
import { T, useLang } from '../lib/i18n'
import { createHabit, updateHabit } from '../lib/store'
import type { Habit, HabitDraft, ScheduleType } from '../lib/types'
import { Button, Field, HABIT_COLORS, habitColor, habitColorName, habitTint, inputClass, Segmented, Sheet } from './ui'

const ICONS = ['✅', '💧', '🏃', '🧘', '📚', '🦷', '💪', '🥗', '😴', '🚭', '💊', '🧹', '✍️', '🎸', '🌿', '📵']

const schedules = (): { value: ScheduleType; label: string }[] => [
  { value: 'daily', label: T('Täglich', 'Daily') },
  { value: 'weekdays', label: T('Wochentage', 'Weekdays') },
  { value: 'per_week', label: T('X× / Woche', 'X× / week') },
  { value: 'per_month', label: T('X× / Monat', 'X× / month') },
]

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')

export function HabitEditor({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  useLang()
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
  // Höchstens 28 pro Monat, damit das Ziel auch im Februar erreichbar ist
  const maxTarget = draft.schedule_type === 'per_week' ? 7 : 28

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (draft.schedule_type === 'weekdays' && !draft.weekdays.length) return setError(T('Mindestens einen Wochentag wählen.', 'Choose at least one weekday.'))
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
    <Sheet title={habit ? T('Gewohnheit bearbeiten', 'Edit habit') : T('Neue Gewohnheit', 'New habit')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <Field label={T('Name', 'Name')}>
          <input className={inputClass} required maxLength={80} placeholder={T('z. B. 2 Liter trinken', 'e.g. drink 2 litres')} value={draft.name} onChange={(e) => patch({ name: e.target.value })} autoFocus={!habit} />
        </Field>

        <div>
          <span className="t-foot mb-1.5 block font-medium text-ink-2">{T('Symbol', 'Icon')}</span>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {ICONS.map((i) => (
              <button
                type="button"
                key={i}
                onClick={() => patch({ icon: i })}
                className={`flex aspect-square min-h-11 items-center justify-center rounded-[10px] text-xl transition ${draft.icon === i ? 'bg-brand-tint ring-2 ring-brand' : 'bg-fill'}`}
                aria-label={`${T('Symbol', 'Icon')} ${i}`}
                aria-pressed={draft.icon === i}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="t-foot mb-1.5 block font-medium text-ink-2">{T('Farbe', 'Colour')}</span>
          <div className="flex flex-wrap gap-1">
            {HABIT_COLORS.map((name) => (
              <button
                type="button"
                key={name}
                onClick={() => patch({ color: name })}
                className="flex size-11 items-center justify-center rounded-full"
                style={{ background: draft.color === name ? habitTint(name, 18) : undefined }}
                aria-label={habitColorName(name)}
                title={habitColorName(name)}
                aria-pressed={draft.color === name}
              >
                <span className={`size-8 rounded-full ${draft.color === name ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`} style={{ background: habitColor(name) }} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="t-foot mb-1.5 block font-medium text-ink-2">{T('Wie oft?', 'How often?')}</span>
          <Segmented label={T('Wie oft?', 'How often?')} value={draft.schedule_type} options={schedules()} onChange={(v) => patch({ schedule_type: v })} className="[&_span]:text-[13px]" />

          {draft.schedule_type === 'weekdays' && (
            <div className="mt-3 grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const label = weekdayShort(d)
                const on = draft.weekdays.includes(d)
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => patch({ weekdays: on ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d] })}
                    className={`t-sub min-h-11 rounded-lg font-medium ${on ? 'bg-brand text-on-brand' : 'bg-fill text-ink-2'}`}
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
              <button type="button" className="size-11 rounded-[10px] bg-fill text-xl" onClick={() => patch({ target: Math.max(1, draft.target - 1) })} aria-label={T('Weniger', 'Fewer')}>−</button>
              <span className="t-num min-w-28 text-center font-semibold" aria-live="polite">
                {draft.schedule_type === 'per_week' ? T(`${Math.min(draft.target, maxTarget)}× pro Woche`, `${Math.min(draft.target, maxTarget)}× a week`) : T(`${Math.min(draft.target, maxTarget)}× pro Monat`, `${Math.min(draft.target, maxTarget)}× a month`)}
              </span>
              <button type="button" className="size-11 rounded-[10px] bg-fill text-xl" onClick={() => patch({ target: Math.min(maxTarget, draft.target + 1) })} aria-label={T('Mehr', 'More')}>+</button>
            </div>
          )}
        </div>

        <div className="card p-4">
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span className="font-medium">{T('Erinnern, wenn noch offen', 'Remind me if still open')}</span>
            <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          </label>
          {remind && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label={T('Um', 'At')}>
                <input className={inputClass} type="time" required value={draft.reminder_time ?? ''} onChange={(e) => patch({ reminder_time: e.target.value })} />
              </Field>
              <Field label={T('Letzte Chance (optional)', 'Last call (optional)')}>
                <input className={inputClass} type="time" value={draft.last_call_time ?? ''} onChange={(e) => patch({ last_call_time: e.target.value })} />
              </Field>
              <p className="t-foot col-span-2 text-ink-2">
                {draft.schedule_type === 'per_week' || draft.schedule_type === 'per_month'
                  ? T('Sanft: Erinnerung erst, wenn das Ziel ohne heutigen Eintrag knapp wird.', 'Gentle: you’re only reminded once the goal gets tight without today’s entry.')
                  : T('Nur wenn an dem Tag noch nichts eingetragen ist.', 'Only if nothing has been entered that day.')}
              </p>
            </div>
          )}
        </div>

        {error && <p className="t-sub text-danger" role="alert">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="tinted" onClick={onClose}>{T('Abbrechen', 'Cancel')}</Button>
          <Button type="submit" disabled={busy}>{busy ? T('Speichern …', 'Saving …') : T('Speichern', 'Save')}</Button>
        </div>
      </form>
    </Sheet>
  )
}
