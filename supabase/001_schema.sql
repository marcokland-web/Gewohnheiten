-- =====================================================================
-- Gewohnheiten – Grundschema
-- Läuft im selben Supabase-Projekt wie die Zähler-App, aber im eigenen
-- Schema "gewohnheiten". So gibt es keine Namenskollisionen
-- (z. B. public.push_subscriptions) und alles lässt sich mit einem
-- "drop schema gewohnheiten cascade" wieder entfernen.
--
-- Im Supabase-Dashboard unter "SQL Editor" ausführen.
-- Danach: Project Settings → Data API → "Exposed schemas" um
-- "gewohnheiten" ergänzen.
-- =====================================================================

create schema if not exists gewohnheiten;

grant usage on schema gewohnheiten to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Profil: Zeitzone und Ruhezeiten (eine Zeile pro Nutzer)
-- ---------------------------------------------------------------------
create table if not exists gewohnheiten.profiles (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  timezone    text not null default 'Europe/Berlin',
  quiet_from  time,            -- z. B. 22:00, null = keine Ruhezeit
  quiet_to    time,            -- z. B. 07:00
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Gewohnheiten
-- ---------------------------------------------------------------------
create table if not exists gewohnheiten.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  icon           text not null default '✅',
  color          text not null default 'blue',
  schedule_type  text not null check (schedule_type in ('daily', 'weekdays', 'per_week', 'per_month')),
  weekdays       smallint[] not null default '{}',   -- ISO: 1 = Mo … 7 = So, nur bei 'weekdays'
  target         smallint not null default 1 check (target between 1 and 31),
  reminder_time  time,                               -- null = keine Erinnerung
  last_call_time time,                               -- optionale zweite Erinnerung
  sort_order     integer not null default 0,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint weekdays_valid check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  constraint weekdays_required check (schedule_type <> 'weekdays' or cardinality(weekdays) > 0),
  constraint target_fits check (
    (schedule_type = 'per_week'  and target <= 7) or
    (schedule_type = 'per_month' and target <= 31) or
    schedule_type in ('daily', 'weekdays')
  )
);

create index if not exists habits_user_idx on gewohnheiten.habits (user_id);

-- ---------------------------------------------------------------------
-- Einträge: höchstens einer pro Gewohnheit und Tag.
-- "day" ist das Datum in der Zeitzone des Nutzers, nicht UTC.
-- (habit_id, day) ist der natürliche Schlüssel – dadurch sind
-- Offline-Wiederholungen automatisch idempotent.
-- ---------------------------------------------------------------------
create table if not exists gewohnheiten.checkins (
  habit_id    uuid not null references gewohnheiten.habits(id) on delete cascade,
  day         date not null,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note        text check (note is null or char_length(note) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (habit_id, day)
);

create index if not exists checkins_user_day_idx on gewohnheiten.checkins (user_id, day);

-- Ein Eintrag darf nur zu einer eigenen Gewohnheit gehören
create or replace function gewohnheiten.owns_habit(p_habit uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from gewohnheiten.habits h
    where h.id = p_habit and h.user_id = auth.uid()
  );
$$;

revoke all on function gewohnheiten.owns_habit(uuid) from public, anon;
grant execute on function gewohnheiten.owns_habit(uuid) to authenticated;

-- updated_at automatisch pflegen
create or replace function gewohnheiten.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on gewohnheiten.profiles;
create trigger profiles_touch before update on gewohnheiten.profiles
  for each row execute function gewohnheiten.touch_updated_at();

drop trigger if exists checkins_touch on gewohnheiten.checkins;
create trigger checkins_touch before update on gewohnheiten.checkins
  for each row execute function gewohnheiten.touch_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security: jeder sieht nur seine eigenen Zeilen
-- ---------------------------------------------------------------------
alter table gewohnheiten.profiles enable row level security;
alter table gewohnheiten.habits   enable row level security;
alter table gewohnheiten.checkins enable row level security;

drop policy if exists profiles_own on gewohnheiten.profiles;
create policy profiles_own on gewohnheiten.profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists habits_own on gewohnheiten.habits;
create policy habits_own on gewohnheiten.habits
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists checkins_own on gewohnheiten.checkins;
create policy checkins_own on gewohnheiten.checkins
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and gewohnheiten.owns_habit(habit_id));

-- Rechte für die Data API (ohne Grants sieht PostgREST die Tabellen nicht)
grant select, insert, update, delete on all tables in schema gewohnheiten to authenticated;
grant all on all tables in schema gewohnheiten to service_role;
