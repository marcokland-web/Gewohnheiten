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

## Offline

Abhaken und Notizen funktionieren offline und werden nachgereicht. Gewohnheiten anlegen und
bearbeiten geht nur online. Der Schlüssel `(habit_id, day)` macht doppelte Übertragungen harmlos.

## Roadmap

- [x] Schritt 1: App, Datenbank, Offline-Einträge, Statistik, automatische Veröffentlichung
- [ ] Schritt 2: Push-Erinnerungen (Supabase Edge Function + `pg_cron`, Web Push mit VAPID)
