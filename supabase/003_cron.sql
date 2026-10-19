-- =====================================================================
-- Gewohnheiten – Zeitplan für die Erinnerungen
-- Voraussetzung: 002_reminders.sql, Edge Function "gewohnheiten-reminders"
-- ist deployt und im Vault liegt das Secret "gewohnheiten_cron_secret"
-- (gleicher Wert wie das Function-Secret GW_CRON_SECRET):
--
--   select vault.create_secret('<GW_CRON_SECRET>', 'gewohnheiten_cron_secret');
--
-- Das Secret gehört NICHT in diese Datei.
-- =====================================================================

-- Alle 5 Minuten fällige Erinnerungen verschicken
select cron.schedule(
  'gewohnheiten-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://asfwbuptsfcrgmmgdgim.supabase.co/functions/v1/gewohnheiten-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gewohnheiten_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Protokoll nach 60 Tagen aufräumen (täglich 03:17 UTC)
select cron.schedule(
  'gewohnheiten-reminder-log-cleanup',
  '17 3 * * *',
  $$ delete from gewohnheiten.reminder_log where day < current_date - 60 $$
);
