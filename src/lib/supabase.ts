import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

// Gemeinsames Projekt mit der Zähler-App: alle Tabellen liegen im Schema "gewohnheiten"
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  db: { schema: 'gewohnheiten' },
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'gewohnheiten-auth' },
})
