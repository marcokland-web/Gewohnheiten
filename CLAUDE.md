# Gewohnheiten

Vite + React + TS + Tailwind v4 PWA, gehostet auf GitHub Pages unter `/Gewohnheiten/` (siehe `base` in `vite.config.ts`).

- **Supabase:** geteiltes Projekt mit `~/Apps/zaehler-app`. Alles liegt im Schema `gewohnheiten` – niemals Objekte in `public` anlegen oder ändern. SQL-Änderungen als neue nummerierte Datei in `supabase/` ablegen, sie werden manuell im SQL Editor ausgeführt.
- **Origin wird geteilt** mit anderen GitHub-Pages-Apps von marcokland-web: localStorage/IndexedDB-Schlüssel immer mit `gewohnheiten:` präfixen.
- **Tage** sind `YYYY-MM-DD` in lokaler Zeit (`src/lib/dates.ts`), Woche beginnt Montag, Wochentage ISO 1–7.
- **Datenfluss:** `src/lib/store.ts` (externer Store via `useSyncExternalStore`). Einträge laufen über die Offline-Warteschlange, Gewohnheiten nur online.
- **Statistik/Fälligkeit:** `src/lib/stats.ts`. Die „knapp"-Regel muss mit `gewohnheiten.claim_due_reminders` in `supabase/002_reminders.sql` übereinstimmen.
- **Erinnerungen:** pg_cron → Edge Function `supabase/functions/gewohnheiten-reminders` (Deploy: `npm run deploy:function`). Supabase-Secrets im geteilten Projekt immer mit `GW_` präfixen. SQL ausführen per `npx supabase db query --linked --project-ref asfwbuptsfcrgmmgdgim -f <datei>`.
- Push-Handler im Service Worker: `public/push-sw.js` (per Workbox `importScripts`).
- **Studio-Design:** Farben nur über die Studio-Tokens in `src/index.css` (Bordeaux/Gold, Liquid Glass nur für Navigation: `.glass`, Inhalte `.card`). Gewohnheitsfarben: gespeicherte Schlüssel (`blue`, `sky`, …) bleiben, Farbwerte kommen aus `--hc-*`.
- **Sprache:** Alle sichtbaren Texte über `T(de, en)` aus `src/lib/i18n.ts`, Datum/Zahlen über `locale()`. Komponenten rufen `useLang()` auf. Standard Deutsch.
- **Thema/Sprache pro Gerät:** `studio-theme` (`light|dark`, fehlt = automatisch) und `studio-lang` – studioweit gleiche Schlüssel, daher ohne `gewohnheiten:`-Präfix. Vor dem ersten Zeichnen gesetzt im `<head>` von `index.html` (`data-theme` auf `<html>`).
- **Aufbau:** `Shell.tsx` (Kopfzeile mit Zahnrad, Tab-Leiste iPhone / Pille iPad / Seitenleiste Desktop), Tabs „Heute“ und „Analyse“, Einstellungen als Sheet.
- **Analyse:** `rateInRange` u. a. in `src/lib/stats.ts`; „erfüllt“ = Tag/Woche/Monat mit erreichtem Ziel, laufende offene Zeiträume zählen nicht. Gesamtquote = Durchschnitt der Gewohnheiten.
- **Anmeldung:** nur Google (Supabase Auth, PKCE, Weiterleitung statt Pop-up). Client mit `detectSessionInUrl: false`, die Rückleitung wertet `handleAuthCallback()` in `src/lib/auth.ts` genau einmal aus (Code-Tausch, Adresse säubern); reine Hilfsfunktionen in `src/lib/auth-core.ts`. Abmelden mit `scope: 'local'` und Rückfrage (Daten vom Gerät löschen oder behalten). In Supabase müssen der Google-Anbieter eingeschaltet und `https://marcokland-web.github.io/Gewohnheiten/` sowie `http://localhost:5173/Gewohnheiten/` als Redirect-URLs eingetragen sein. Kein Passwort-Code mehr einbauen (Marcos Entscheidung).
- **Tests:** `npm test` (Vitest, `tests/unit`), `npm run test:e2e` (Playwright, `tests/e2e`, Supabase komplett gemockt in `tests/e2e/mock.ts`, Port 5199). Vor jeder Auslieferung beide grün.
- **Icons:** aus DasTeam `studio/brand/gewohnheiten*.svg` (apple-touch-icon 180, icon-192/512, maskable-512, favicon-32, icon.svg).
