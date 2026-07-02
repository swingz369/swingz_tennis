# Tutorial · Mitglied-Onboarding & Dashboard

> Page: [`app/(protected)/member/page.tsx`](<../../../../app/(protected)/member/page.tsx>) · Layout-Guard: [`app/(protected)/member/layout.tsx`](<../../../../app/(protected)/member/layout.tsx>)

## Schritt 1 — Login

1. Aufrufen von `/login`.
2. E-Mail + Passwort eingeben → Supabase Auth prüft Credentials.
3. Bei Erfolg: Supabase legt Session-Cookie an; `proxy.ts` leitet auf `/dashboard` weiter.
4. `/dashboard` löst die Rolle auf (siehe CLAUDE.md → Dashboard-Dispatch). Für ein reines Mitglied leitet das nach `/member`.

## Schritt 2 — Was `/member` zeigt (für ein erfolgreich eingeloggt Mitglied)

> Server Component lädt 5 parallele Queries, bevor die Seite rendert. Bei Multi-Cluster-Memberships wird die ERSTE aktive verwendet (`limit(1)`).

Beim ersten Aufruf von `/member` enthält der Header:

- **„Hallo, `<Vorname>`!"** — abgeleitet aus `users.full_name.split(' ')[0]`, fallback auf E-Mail-Local-Part.
- Vereinsname + Rolle als kleiner Subtext: **„TC Rheinland e.V. · Mitglied"**

Darunter 4 Kernmodule (alle Daten aus Server-Components live geladen):

### 2.1 Hero-Card „Nächste Session" (klickbar)

Wenn `nextSessions.length > 0`: eine **farbige Hero-Card** (`bg-gradient-to-br from-brand-primary to-brand-light`) mit:

- **Platzname** (z. B. „Platz 1")
- **Datum + Uhrzeit** der nächsten Session in deinem Verein (`schedules.club_id = clubId`, `timeslot_start >= now`)
- **„HEUTE"**-Badge falls Datum = heute
- Klick auf Karte → Link `/bookings`

Wenn `nextSessions.length === 0`: **leerer Call-to-Action** „Bereit für dein erstes Training?" mit Link „Jetzt buchen →".

### 2.2 Stat-Cards-Reihe (4 Cards nebeneinander)

| Card                   | Quelle                                                                                | Bedeutung                                   |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Buchungen**          | `bookings.status = 'confirmed' AND member_id = user.id AND session_start_time >= now` | Anzahl bevorstehender bestätigter Buchungen |
| **Rechnungen**         | `invoices.member_id = user.id AND status = 'open'`                                    | Anzahl offener Rechnungen, **rot wenn > 0** |
| **Benachrichtigungen** | `notifications.user_id = user.id AND read = false`                                    | Anzahl ungelesener, **blau wenn > 0**       |
| **Training**           | `nextSessions.length`                                                                 | Kommende Vereins-Sessions                   |

Jede Card ist klickbar und führt auf die korrespondierende Unterseite (`/bookings`, `/billing`, `/notifications`, `/bookings`).

### 2.3 „Nächste Buchungen" (Liste, falls vorhanden)

Server-rendered Liste mit bis zu 3 Einträgen aus `upcomingBookings`:

- Icon „MapPin" + Platzname + Datum + Uhrzeit + grünes **„Bestätigt"**-Badge.
- Header-Link „Alle →" führt auf `/bookings`.

### 2.4 „Trainingseinheiten" (Liste, falls > 1 Session)

Slice `nextSessions[1..4]` mit ähnlichem Aufbau (ohne Bestätigt-Badge).

### 2.5 „Schnellzugriff" (Quick-Actions-Grid)

7 anklickbare Kacheln (Icon + Label) pro Code (Stand `member/page.tsx` Zeilen 331–349):

| Kachel      | Ziel                      | Beschreibung                  |
| ----------- | ------------------------- | ----------------------------- |
| Buchen      | `/bookings`               | Platz-Buchung                 |
| Training    | `/training-schedule`      | Trainingsplan deiner Gruppe   |
| Trainer     | `/member/trainer-booking` | Einzel-Trainer buchen         |
| Turniere    | `/member/tournaments`     | Vereins-Turniere              |
| Rechnungen  | `/billing`                | Deine Rechnungen / SEPA       |
| Dienste     | `/member/work-duties`     | Verein-Arbeitsdienste         |
| Präferenzen | `/member/preferences`     | Trainings-Präferenzen abgeben |

## Schritt 3 — Wo bin ich? (Role-Guard)

Wenn du auf `/member` landest aber eine höhere Rolle hast, leitet das `MemberLayout` sofort um:

| Rolle        | Redirect      |
| ------------ | ------------- |
| `superadmin` | `/superadmin` |
| `admin`      | `/admin`      |
| `trainer`    | `/trainer`    |
| nur `member` | bleibt        |

**Edge-Case:** Wenn du **gar keine** aktive Membership hast, sieht `/member` eine leere State-Card **„Keine aktive Mitgliedschaft"** mit Hinweis „Bitte wende dich an den Administrator deines Vereins." (kein Probetraining-CTA, das wäre Aufgabe des Public-Formulars).

## Schritt 4 — Sidebar-Navigation (aus dem `(protected)`-Layout)

Die Sidebar ist rollenspezifisch und wird im `ProtectedClientLayout` gerendert. Für Members typischerweise:

- Dashboard (aktuell)
- Buchungen
- Training
- Turniere
- Rechnungen
- Benachrichtigungen
- Profil
- Logout

## Edge-Cases / Häufige Fragen

| Problem                                                 | Lösung                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Alle Stats zeigen 0                                     | Normal bei frisch konvertierten Mitgliedern — Daten kommen mit der ersten Buchung         |
| „Keine aktive Mitgliedschaft" obwohl ich eingeloggt bin | Membership-Row fehlt oder `is_active = false`. Support kontaktieren.                      |
| Hero-Card fehlt                                         | Keine Sessions im aktuellen Verein geplant — `schedules` sind leer oder Saison ist vorbei |
| Sidebar zeigt Admin-/Trainer-Links                      | Du hast mehrere Rollen — Klick leitet auf den jeweils korrekten Bereich                   |
