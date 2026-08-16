# Tutorial · Probetraining-Genehmigungen (Admin)

> Komponente: [`components/admin-trial-approvals.tsx`](../../../../components/admin-trial-approvals.tsx) (Page: z. B. `/admin/trial-approvals`)
> APIs: `GET/PATCH /api/trial-trainings` · `POST /api/admin/trial-training/[id]/convert-to-member` · `GET /api/trainer-profiles` · `GET /api/courts`

## Übersicht

Du siehst alle eingegangenen Probetraining-Anfragen aus dem Public-Formular. Status-Gruppen:

- **Angefragt** (`requested`): Standard nach Public-Submit.
- **Geplant** (`scheduled`): Nach deiner Bestätigung mit Trainer + Platz.
- **Abgelehnt** (`cancelled`): Nach deiner Ablehnung mit Notiz.
- **Abgeschlossen** (`completed`): Training fand statt — startet den Nurture-Flow.
- **Nicht erschienen** (`no_show`): kein Follow-up.
- **Alle**: alle Gruppen.

## Schritt 1 — Filter

Pill-Buttons oben: **Angefragt** | **Geplant** | **Abgelehnt** | **Abgeschlossen** | **Nicht erschienen** | **Alle**. Default = „Angefragt" mit Badge „N ausstehend".

## Schritt 2 — Liste prüfen

Jede Anfrage ist eine Card mit:

- **Status-Badge** (gelb „Angefragt" / grün „Geplant" / rot „Abgelehnt" mit Card-tinted Background).
- **„Neu"**-Badge (Brand-Light) wenn `status === 'requested'`.
- **Name** als Heading + 4 Felder Grid:
  - E-Mail (mit Mail-Icon)
  - Telefon
  - Wunsch-Datum + Uhrzeit
  - Alter (aus `dateOfBirth` berechnet) + Dauer
- Falls `status !== 'requested'`: Trainer + Court-Subtext.
- Falls `notes` gesetzt: Italic-Text in muted Box.
- Erstellt-am Timestamp.

## Schritt 3 — Annehmen

Klick auf grünen **„Annehmen"**-Button (CheckCircle-Icon) → öffnet **Bestätigungs-Modal**.

### Modal-Inhalt

Header:

- Heading „Probetraining bestätigen"
- Subtext „Vorname Nachname · DD.MM.YYYY um HH:MM Uhr"
- X-Button (modal schließen)

Body:

- **Trainer-Dropdown** (Pflicht)
  - Quelle: `GET /api/trainer-profiles` (filtert `status !== 'inactive'` raus)
  - Empty-State falls keine Trainer: Warnung „Keine Trainer verfügbar. Bitte zuerst Trainer im System anlegen."
- **Court-Dropdown** (Pflicht)
  - Quelle: `GET /api/courts` (filtert `isActive !== false` raus)
  - Empty-State falls keine Plätze: Warnung analog.

Footer:

- **Abbrechen** (outline)
- **„Bestätigen & Einplanen"** (primary, disabled bis beide Felder gesetzt)

### Submit

API-Call: `PATCH /api/trial-trainings/{id}` mit Body:

```json
{
  "status": "scheduled",
  "trainerId": "<userId>",
  "trainerName": "Vorname Nachname",
  "courtId": "<id>",
  "courtName": "Platz 1"
}
```

**Erwartung**:

- Card-Status ändert sich zu „Geplant" (Update im State ohne Re-Fetch).
- Toast (falls implementiert; aktuell manuelles Re-Render).
- Confirmation-Mail geht an den Interessenten.

## Schritt 4 — Ablehnen

Klick auf Outline **„Ablehnen"**-Button (XCircle-Icon):

1. Inline-Form öffnet sich in der Card: Textarea „Ablehnungsgrund...".
2. Pflicht: Textarea darf nicht leer sein (`.trim()`).
3. Klick auf roten **„Ablehnen"**-Button → `PATCH /api/trial-trainings/{id}`:
   ```json
   { "status": "cancelled", "notes": "Abgelehnt: <grund>" }
   ```
4. Erwartung: Status → rot „Abgelehnt" + Notiz wird in der Card sichtbar.
5. **Abbrechen**: schließt das Inline-Form ohne API-Call.

## Schritt 5 — Zu Mitglied konvertieren (nach geplanter Session)

Nur sichtbar bei `status === 'scheduled' || status === 'completed'`:

- Button **„Zu Mitglied konvertieren"** (UserPlus-Icon, brand-light border, hover brand-light/10).

Klick → Modal **„Zu Mitglied konvertieren"**:

- Header mit Name (User-Icon) + E-Mail.
- Hinweistext: „Ein Supabase-Account wird angelegt (falls noch nicht vorhanden) und die Person wird als Mitglied im aktuellen Verein eingetragen. Die Zugangsdaten werden per E-Mail versandt."
- API: `POST /api/admin/trial-training/{trialId}/convert-to-member` mit:
  ```json
  {
    "email": "<aus participant.email>",
    "fullName": "<Vorname Nachname>",
    "clubId": "<aus useUserClub>"
  }
  ```

**Erwartung**:

- Bei Erfolg: Badge „Konvertiert" ersetzt den Button (Member-Record ist angelegt).
- Bei Fehler: rote Error-Banner innerhalb des Modals mit `data.error`.

> ⚠️ Konvertierte Personen können sich jetzt mit ihrer E-Mail einloggen (Passwort-Reset-Mail beim ersten Login, sofern implementiert).

## Schritt 6 — Abgeschlossen / Nicht erschienen

Bei `status === 'scheduled' || status === 'completed'` stehen zwei Aktionen zur Verfügung:

- **„Abgeschlossen"** (CheckCircle) → `PATCH /api/trial-trainings/{id}` mit `{ "status": "completed" }`. Startet den Nurture-Flow (Danke-Mail mit Feedback- und Anmeldelink).
- **„Nicht erschienen"** (XCircle) → `{ "status": "no_show" }`. Kein Follow-up.

Abgegebenes Feedback wird direkt in der Card angezeigt: Sternwertung, „Würde weiterempfehlen"-Badge und Kommentar.

## Bulk-Konvertierung

Es gibt **keine** Bulk-Aktion — jede Konvertierung muss einzeln bestätigt werden (DSGVO-Sorgfalt).

## Edge-Cases

| Problem                                               | Lösung                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Trainer-Dropdown leer                                 | Erst Trainer im System anlegen (siehe `/admin/trainers`, dort `trainer_profiles`-Tabelle füllen).                         |
| Court-Dropdown leer                                   | Erst Plätze unter `/admin/courts` anlegen.                                                                                |
| Bestätigen-Button bleibt disabled                     | Einer der beiden Dropdowns nicht gefüllt (oder beide Listen leer → erst Daten anlegen).                                   |
| Convert fehlgeschlagen mit „E-Mail existiert bereits" | Person hat schon einen Account — direkten `user_club_memberships`-Insert nötig (Admin-Tool nicht implementiert, Support). |
| Mehrere Vereine                                       | Konvertierung landet im aktuell aktiven Verein (ADMIN_CLUB_COOKIE).                                                       |
| Anfrage doppelt vorhanden                             | API verhindert nicht explizit — kritisch bei Spam. Public-Form-Rate-Limit fehlt (siehe Projekt-Audit-Notes).              |
