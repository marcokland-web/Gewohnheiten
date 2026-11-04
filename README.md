# 🌱 Gewohnheiten

Gewohnheiten-Tracker als installierbare Web-App (Browser, iPad, iPhone) im Studio-Design,
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
Anmeldung **nur mit Google** (kein Passwort). Supabase verknüpft die Google-Identität automatisch mit
einem vorhandenen Konto gleicher, bestätigter E-Mail-Adresse – die `user_id` und damit alle Daten bleiben.

1. **Datenbank:** Supabase → *SQL Editor* → Inhalt von [`supabase/001_schema.sql`](supabase/001_schema.sql) ausführen.
2. **Schema freigeben:** Supabase → *Project Settings* → *Data API* → *Exposed schemas* um `gewohnheiten` ergänzen.
3. **Lokal:** `.env.example` nach `.env.local` kopieren, URL + anon key eintragen, dann
   ```bash
   npm install
   npm run dev
   ```
4. **Google-Anmeldung in Supabase einrichten** (einmalig, im Dashboard):
   - *Authentication → Sign In / Providers → Google* einschalten, Client-ID und Client-Secret aus der
     Google Cloud Console eintragen (OAuth-Client „Webanwendung“, autorisierte Weiterleitungs-URI:
     `https://asfwbuptsfcrgmmgdgim.supabase.co/auth/v1/callback`).
   - *Authentication → URL Configuration → Redirect URLs* um
     `https://marcokland-web.github.io/Gewohnheiten/` und `http://localhost:5173/Gewohnheiten/` ergänzen.
     Fehlt die Adresse, leitet Supabase auf die *Site URL* (Zähler-App) zurück.
5. **Veröffentlichung:** passiert automatisch bei jedem Push auf `main` (GitHub Actions → GitHub Pages).
   Dafür im Repo unter *Settings → Secrets and variables → Actions* `VITE_SUPABASE_URL` und
   `VITE_SUPABASE_ANON_KEY` setzen.

## Anmeldung

- „Mit Google anmelden“ leitet weiter (kein Pop-up, damit es auch in der installierten App geht),
  PKCE-Flow. Nach der Rückkehr tauscht `src/lib/auth.ts` den `?code=` gegen eine Sitzung und säubert die
  Adresse. Abbrechen bei Google ist kein Fehler; andere Fehler erscheinen verständlich auf Deutsch/Englisch.
- Abmelden (*Einstellungen → Konto*) nur auf diesem Gerät, mit Rückfrage: „Abmelden und vom Gerät löschen“
  (Zwischenspeicher, Warteschlange, Erinnerungen dieses Geräts) oder „Nur abmelden“ (nicht übertragene
  Einträge werden bei der nächsten Anmeldung nachgereicht).
- Ist die Registrierung gesperrt (Einstellung oder Before-User-Created-Hook mit 403), erscheint „Kein Zugang – bitte von der Familie freischalten lassen.“
- Content-Security-Policy: `connect-src` nur zur eigenen Seite und zum Supabase-Projekt (siehe `vite.config.ts`).
- Serverseitig hängt nichts von der Anmeldeart ab (RLS über `auth.uid()`, Edge Function prüft nur das JWT).

## Tests

```bash
npm test          # Unit-Tests (Vitest, tests/unit)
npm run test:e2e  # Browser-Tests (Playwright, tests/e2e) gegen ein erfundenes Supabase
```

Die Browser-Tests fangen alle Anfragen an `*.supabase.co` ab (Google-Weiterleitung, Code-Tausch, REST),
die echte Datenbank wird nie berührt. `tests/e2e/ansicht.spec.ts` prüft Desktop, iPad und iPhone in Hell
und Dunkel und legt Bilder in `test-results/ansicht/` ab. Einmalig: `npx playwright install chromium`.

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
