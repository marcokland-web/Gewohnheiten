# Gewohnheiten

Vite + React + TS + Tailwind v4 PWA, gehostet auf GitHub Pages unter `/Gewohnheiten/` (siehe `base` in `vite.config.ts`).

- **Supabase:** geteiltes Projekt mit `~/Apps/zaehler-app`. Alles liegt im Schema `gewohnheiten` – niemals Objekte in `public` anlegen oder ändern. SQL-Änderungen als neue nummerierte Datei in `supabase/` ablegen, sie werden manuell im SQL Editor ausgeführt.
- **Origin wird geteilt** mit anderen GitHub-Pages-Apps von marcokland-web: localStorage/IndexedDB-Schlüssel immer mit `gewohnheiten:` präfixen.
- **Tage** sind `YYYY-MM-DD` in lokaler Zeit (`src/lib/dates.ts`), Woche beginnt Montag, Wochentage ISO 1–7.
- **Datenfluss:** `src/lib/store.ts` (externer Store via `useSyncExternalStore`). Einträge laufen über die Offline-Warteschlange, Gewohnheiten nur online.
- **Statistik/Fälligkeit:** `src/lib/stats.ts`. Die „knapp"-Regel muss mit `gewohnheiten.claim_due_reminders` in `supabase/002_reminders.sql` übereinstimmen.
- **Erinnerungen:** pg_cron → Edge Function `supabase/functions/gewohnheiten-reminders` (Deploy: `npm run deploy:function`). Supabase-Secrets im geteilten Projekt immer mit `GW_` präfixen. SQL ausführen per `npx supabase db query --linked --project-ref asfwbuptsfcrgmmgdgim -f <datei>`.
- Push-Handler im Service Worker: `public/push-sw.js` (per Workbox `importScripts`).
- UI-Texte auf Deutsch. Farben nur über die CSS-Tokens in `src/index.css`.
