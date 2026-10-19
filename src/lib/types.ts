export type ScheduleType = 'daily' | 'weekdays' | 'per_week' | 'per_month'

export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  schedule_type: ScheduleType
  /** ISO-Wochentage: 1 = Mo … 7 = So */
  weekdays: number[]
  target: number
  /** "HH:MM:SS" oder null */
  reminder_time: string | null
  last_call_time: string | null
  sort_order: number
  archived_at: string | null
  created_at: string
}

export type HabitDraft = Omit<Habit, 'id' | 'created_at' | 'archived_at' | 'sort_order'>

export interface Checkin {
  habit_id: string
  /** "YYYY-MM-DD" in lokaler Zeit */
  day: string
  note: string | null
}

export interface Profile {
  timezone: string
  quiet_from: string | null
  quiet_to: string | null
}
