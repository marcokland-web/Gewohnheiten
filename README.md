# 🌱 Gewohnheiten

Gewohnheiten-Tracker als installierbare Web-App (Browser, iPad, iPhone) mit blauem Verlauf,
Hell-/Dunkelmodus, Serien, Statistik, Notizen und Offline-Einträgen.

**Technik:** Vite · React · TypeScript · Tailwind CSS · vite-plugin-pwa · Supabase

**Live:** https://marcokland-web.github.io/Gewohnheiten/

## Arten von Zeiträumen

| Art | Erfüllt, wenn … | Serie zählt in |
|---|---|---|
| Täglich | an dem Tag eingetragen | Tagen |
| Feste Wochentage | an jedem geplanten Tag eingetragen | geplanten Tagen |
| X× pro Woche (Mo–So) | mindestens X Tage in der Woche | Wochen |
| X× pro Monat | mindestens X Tage im Monat | Monaten |

Erinnerungen sind „sanft": bei Wochen-/Monatszielen erst, wenn das Ziel ohne heutigen Eintrag
knapp wird (fehlende Einträge ≥ verbleibende Tage). Die App markiert solche Gewohnheiten orange.

## Einrichtung

Die App nutzt das **Supabase-Projekt der Zähler-App** mit, aber im eigenen Schema `gewohnheiten`.
Login mit demselben Konto (E-Mail + Passwort).

1. **Datenbank:** Supabase → *SQL Editor* → Inhalt von [`supabase/001_schema.sql`](supabase/001_schema.sql) ausführen.
2. **Schema freigeben:** Supabase → *Project Settings* → *Data API* → *Exposed schemas* um `gewohnheiten` ergänzen.
3. **Lokal:** `.env.example` nach `.env.local` kopieren, URL + anon key eintragen, dann
   ```bash
   npm install
   npm run dev
   ```
4. **Veröffentlichung:** passiert automatisch bei jedem Push auf `main` (GitHub Actions → GitHub Pages).
   Dafür im Repo unter *Settings → Secrets and variables → Actions* `VITE_SUPABASE_URL` und
   `VITE_SUPABASE_ANON_KEY` setzen.

Auf iPhone/iPad: in Safari öffnen → Teilen → *Zum Home-Bildschirm*. (Nur so funktionieren später
die Push-Erinnerungen.)

## Erinnerungen

```
pg_cron (alle 5 Min) ──► Edge Function gewohnheiten-reminders ──► Web Push ──► iPhone/iPad/Browser
                              │
                              └─ gewohnheiten.claim_due_reminders(): ermittelt fällige Erinnerungen
                                 und trägt sie gleichzeitig in reminder_log ein (nie doppelt)
```

- Erinnerung kommt im 60-Minuten-Fenster ab der eingestellten Zeit, nur wenn heute noch nichts
  eingetragen ist, nicht in der Ruhezeit und bei Wochen-/Monatszielen nur, wenn es knapp wird.
- Aktivieren pro Gerät unter *Einstellungen → Erinnerungen auf diesem Gerät* (iPhone/iPad: nur in der
  installierten App).
- SQL: `supabase/002_reminders.sql` (Tabellen, Logik), `supabase/003_cron.sql` (Zeitplan; das Secret
  `gewohnheiten_cron_secret` liegt im Supabase Vault).
- Function-Secrets (`GW_VAPID_PUBLIC_KEY`, `GW_VAPID_PRIVATE_KEY`, `GW_VAPID_SUBJECT`, `GW_CRON_SECRET`)
  liegen lokal in `.env.secrets.local` (nicht im Repo) und werden mit
  `npx supabase secrets set --project-ref asfwbuptsfcrgmmgdgim --env-file .env.secrets.local` gesetzt.
- Function deployen: `npm run deploy:function`

## Offline

Abhaken und Notizen funktionieren offline und werden nachgereicht. Gewohnheiten anlegen und
bearbeiten geht nur online. Der Schlüssel `(habit_id, day)` macht doppelte Übertragungen harmlos.

## Roadmap

- [x] Schritt 1: App, Datenbank, Offline-Einträge, Statistik, automatische Veröffentlichung
- [x] Schritt 2: Push-Erinnerungen (Supabase Edge Function + `pg_cron`, Web Push mit VAPID)
