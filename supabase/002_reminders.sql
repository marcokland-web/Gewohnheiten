-- =====================================================================
-- Gewohnheiten – Push-Erinnerungen
-- Im Supabase-Dashboard unter "SQL Editor" ausführen (nach 001_schema.sql).
-- Den Zeitplan (pg_cron) legt 003_cron.sql an.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- Ein Eintrag pro Gerät, das Erinnerungen aktiviert hat
-- ---------------------------------------------------------------------
create table if not exists gewohnheiten.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  device      text,
  created_at  timestamptz not null default now()
);

alter table gewohnheiten.push_subscriptions enable row level security;

drop policy if exists push_own on gewohnheiten.push_subscriptions;
create policy push_own on gewohnheiten.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on gewohnheiten.push_subscriptions to authenticated;
grant all on gewohnheiten.push_subscriptions to service_role;

-- ---------------------------------------------------------------------
-- Protokoll: höchstens eine Erinnerung pro Gewohnheit, Tag und Art
-- ---------------------------------------------------------------------
create table if not exists gewohnheiten.reminder_log (
  habit_id  uuid not null references gewohnheiten.habits(id) on delete cascade,
  day       date not null,
  kind      text not null check (kind in ('first', 'last')),
  sent_at   timestamptz not null default now(),
  primary key (habit_id, day, kind)
);

alter table gewohnheiten.reminder_log enable row level security;
-- keine Policy: nur service_role (Edge Function) greift darauf zu
grant all on gewohnheiten.reminder_log to service_role;

-- ---------------------------------------------------------------------
-- Fällige Erinnerungen ermitteln und gleichzeitig als gesendet markieren.
-- Durch das Markieren im selben Statement verschicken sich überlappende
-- Läufe nie doppelt.
--
-- Regeln (müssen zu src/lib/stats.ts passen):
--   * Erinnerungszeit erreicht (Fenster 60 Minuten, danach verfällt sie)
--   * nicht in der Ruhezeit
--   * heute noch kein Eintrag
--   * Wochentage: nur an geplanten Tagen
--   * X× pro Woche/Monat ("sanft"): nur wenn fehlende Einträge >= verbleibende Tage
-- ---------------------------------------------------------------------
create or replace function gewohnheiten.claim_due_reminders(p_now timestamptz default now())
returns table (user_id uuid, habit_id uuid, name text, icon text, kind text, body text)
language sql
security definer
set search_path = ''
as $$
  with base as (
    select h.id, h.user_id, h.name, h.icon, h.schedule_type, h.weekdays, h.target,
           h.reminder_time, h.last_call_time, p.quiet_from, p.quiet_to,
           (p_now at time zone coalesce(p.timezone, 'Europe/Berlin')) as local_ts
    from gewohnheiten.habits h
    left join gewohnheiten.profiles p on p.user_id = h.user_id
    where h.archived_at is null and h.reminder_time is not null
  ),
  cand as (
    select b.*, b.local_ts::date as d, b.local_ts::time as t, k.kind,
           case b.schedule_type
             when 'per_week'  then date_trunc('week', b.local_ts)::date
             when 'per_month' then date_trunc('month', b.local_ts)::date
             else b.local_ts::date
           end as p_start,
           case b.schedule_type
             when 'per_week'  then date_trunc('week', b.local_ts)::date + 6
             when 'per_month' then (date_trunc('month', b.local_ts) + interval '1 month - 1 day')::date
             else b.local_ts::date
           end as p_end
    from base b
    cross join lateral (values ('first', b.reminder_time), ('last', b.last_call_time)) as k(kind, at)
    where k.at is not null
      and b.local_ts::time >= k.at
      and b.local_ts::time - k.at < interval '60 minutes'
  ),
  due as (
    select c.*,
           (select count(*) from gewohnheiten.checkins ci
             where ci.habit_id = c.id and ci.day between c.p_start and c.p_end)::int as cnt
    from cand c
    where not exists (select 1 from gewohnheiten.checkins ci where ci.habit_id = c.id and ci.day = c.d)
      and (c.schedule_type <> 'weekdays' or extract(isodow from c.d)::smallint = any (c.weekdays))
      and not (
        c.quiet_from is not null and c.quiet_to is not null and (
          case when c.quiet_from <= c.quiet_to
            then c.t >= c.quiet_from and c.t < c.quiet_to
            else c.t >= c.quiet_from or c.t < c.quiet_to
          end
        )
      )
  ),
  urgent as (
    select * from due
    where schedule_type in ('daily', 'weekdays')
       or (target - cnt) >= (p_end - d + 1)
  ),
  claimed as (
    insert into gewohnheiten.reminder_log (habit_id, day, kind)
    select id, d, kind from urgent
    on conflict do nothing
    returning habit_id, day, kind
  )
  select u.user_id, u.id, u.name, u.icon, u.kind,
         case
           when u.kind = 'last' then 'Letzte Chance für heute.'
           when u.schedule_type = 'per_week'
             then format('Noch %s von %s diese Woche – heute wäre ein guter Tag.', u.target - u.cnt, u.target)
           when u.schedule_type = 'per_month'
             then format('Noch %s von %s diesen Monat – heute wäre ein guter Tag.', u.target - u.cnt, u.target)
           else 'Heute noch offen.'
         end
  from urgent u
  join claimed cl on cl.habit_id = u.id and cl.day = u.d and cl.kind = u.kind;
$$;

revoke all on function gewohnheiten.claim_due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function gewohnheiten.claim_due_reminders(timestamptz) to service_role;
