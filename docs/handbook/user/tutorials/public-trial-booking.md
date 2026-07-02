# Tutorial · Probetraining anfragen (kein Login nötig)

> Komponente: [`components/public-trial-booking.tsx`](../../../../components/public-trial-booking.tsx) · Server Page: [`app/(public)/trial-training/page.tsx`](<../../../../app/(public)/trial-training/page.tsx>) · API: `POST /api/public/trial-training`

## Wann nutzt man das?

Interessenten, die **noch kein Mitglied** sind, füllen dieses Formular aus. Es erzeugt einen `trial_trainings`-Eintrag mit Status `requested`. Der zuständige Administrator prüft die Anfrage und entscheidet (siehe [`admin-trial-approvals.md`](./admin-trial-approvals.md)).

## Schritt 1 — URL aufrufen

URL-Format: **`/trial-training?club=<club-uuid>`**

- `club`-Param ist optional. Ohne `club` zeigt das Formular das SWINGZ-Branding; mit gültiger UUID zeigt es Club-Logo + Club-Name aus `clubs`-Tabelle.
- Die Page ist statisch gerendert (`dynamic = 'force-dynamic'`), lädt Club-Info via Drizzle: `db.select({ name: clubs.name, logoUrl: clubs.logo_url }).from(clubs).where(eq(clubs.id, clubId))`.

## Schritt 2 — Persönliche Daten ausfüllen (Pflicht)

> 4 Felder — alle werden client-seitig validiert in `validate()`.

| Feld         | Typ      | Validierung                                        | Beispiel          |
| ------------ | -------- | -------------------------------------------------- | ----------------- |
| Vorname      | `string` | mind. 2 Zeichen                                    | `Max`             |
| Nachname     | `string` | mind. 2 Zeichen                                    | `Mustermann`      |
| E-Mail       | `email`  | enthält `@`, später in Kleinbuchstaben konvertiert | `max@example.com` |
| Telefon      | `tel`    | mind. 5 Zeichen                                    | `+49 123 456789`  |
| Geburtsdatum | `date`   | nicht leer                                         | `1990-05-15`      |

**Erwartung:** Inline-Fehlermeldungen unterhalb des jeweiligen Feldes (rot markiertes Input + Text darunter).

## Schritt 3 — Wunschtermin angeben (Pflicht)

| Feld        | Typ        | Validierung             | Bemerkung                                                                           |
| ----------- | ---------- | ----------------------- | ----------------------------------------------------------------------------------- |
| Wunschdatum | `date`     | ≥ heute (`min={today}`) | Browser verhindert alte Daten                                                       |
| Wunschzeit  | `time`     | nicht leer              | z. B. `14:00`                                                                       |
| Spielstärke | `select`   | Default `intermediate`  | Optionen: `beginner`, `advanced_beginner`, `intermediate`, `advanced`, `tournament` |
| Anmerkungen | `textarea` | optional                | z. B. Schulterprobleme, Wunsch nach Gruppentraining                                 |

## Schritt 4 — Absenden

Klick auf Button **„Probetraining anfragen"** (Spinner → disabled während Request).

**Erwartung:**

1. POST an `/api/public/trial-training` mit Payload:
   ```json
   {
     "firstName": "Max",
     "lastName": "Mustermann",
     "email": "max@example.com",
     "phone": "+49 123 456789",
     "dateOfBirth": "1990-05-15",
     "preferredDate": "2026-07-15",
     "preferredTime": "14:00",
     "experienceLevel": "intermediate",
     "notes": null,
     "clubId": "<aus URL>"
   }
   ```
2. Bei `res.ok` (HTTP 2xx): Formular wird ersetzt durch grüne Erfolgs-Karte mit Club-Logo + Text „Probetraining angefragt!" + Bestätigungs-Email an übergebene Adresse.
3. Bei Fehler: rote Error-Banner oberhalb des Formulars (`data.error` aus Response).

## Schritt 5 — Was passiert danach?

1. Der Eintrag liegt in der DB-Tabelle `trial_trainings` (`status: 'requested'`, `id` = UUID).
2. Admin sieht die Anfrage in seinem Dashboard unter Pending-Approvals (siehe `INBOX`-Banner in `/admin`).
3. Bei Annahme: Status → `scheduled`, Trainer + Platz wird zugewiesen, Confirmation-Email an Interessenten.
4. Bei Konvertierung: Supabase-Account wird erstellt + `user_club_memberships`-Row wird mit `role: 'member'` angelegt.

## Edge-Cases

| Problem                             | Hinweis                                                                                                                                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formular doppelt absenden           | Button wird disabled während Request — doppelte Einträge werden vom Server verhindert (kein expliziter Idempotency-Key in `public-trial-training/route.ts` — validierungs-bedingte Doppel-Submits können in einem Zeitfenster passieren). |
| E-Mail schon als Mitglied vorhanden | API gibt 409 mit klarer Fehlermeldung — Anfrage muss über das Admin-Konvertieren laufen.                                                                                                                                                  |
| Ungültige `club`-UUID               | Server akzeptiert stillschweigend (Page rendert SWINGZ-Branding statt Club-Logo, aber das Formular funktioniert trotzdem mit `clubId: undefined`).                                                                                        |
| Datenschutz-Hinweis verpasst        | Footer-Link „Datenschutzerklärung" führt auf `/datenschutz`.                                                                                                                                                                              |
