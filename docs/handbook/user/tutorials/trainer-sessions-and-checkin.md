# Tutorial · Sessions einsehen & Anwesenheits-Check-in (Trainer)

> Komponente (Dashboard-Bereich): eingebettet auf Trainer-Dashboard [`app/(protected)/trainer/page.tsx`](<../../../../app/(protected)/trainer/page.tsx>)
> Komponente (Click-in): [`components/trainer-rsvp-list.tsx`](../../../../components/trainer-rsvp-list.tsx)
> Hook: `useSessionRsvps` · API: `POST /api/attendance-records`

## Übersicht: Was zeigt das Trainer-Dashboard?

Server-Component lädt beim Aufruf von `/trainer`:

1. Trainer-Eintrag: `trainers` Tabelle mit Per Trainer-E-Mail-Lookup. **Wenn kein Trainer-Profil UND keine aktive Verein-Membership → Redirect nach `/login`** (Layout-Guard; siehe `app/(protected)/trainer/layout.tsx` Zeile 25).
2. Sessions: Query gegen `sessions`-Tabelle mit Filter auf den Trainer (typischerweise `trainer_id = trainerRecord.id`, ggf. zusätzlich `user.id` wegen historischer ID-Variante in der Saison-Planung — Implementations-Detail in `app/(protected)/trainer/page.tsx`).
3. Member-Namen über `users`-Tabelle (1 n-query → Batch).
4. Stats:
   - `totalSessions`, `upcomingSessions` (≥ now), `thisWeekSessions` (≥ now-7d), `attendanceRate`.
5. Attendance-Rate: `(totalAttendees - noShow) / totalAttendees * 100`.

## Session-Teilnehmer-Komponente (embed)

Diese Komponente ist auf dem Dashboard-Client eingebettet (`TrainerDashboardClient`).

### Session-Selector (oben)

Wenn `sessions.length === 0`: leerer Text „Keine bevorstehenden Sessions".

Sonst: horizontale Liste von bis zu **10 Pillen**, je eine pro kommender Session.

- Pill-Inhalt: Wochentag + Datum (z. B. „Montag, 14.07.") + Start-Uhrzeit.
- Aktive Pill: brand-primary Hintergrund, weiße Schrift, Schatten.
- Klick auf Pill → `setSelectedSessionId(session.id)` → triggert `useSessionRsvps(selectedSessionId)`.

> **Initial-Selection**: `useEffect` wählt automatisch die **erste** Session beim Mount.

### RSVP-Summary-Badges (3 Stück)

| Badge      | Bedeutung                     | Farbe | Quelle                  |
| ---------- | ----------------------------- | ----- | ----------------------- |
| Zugesagt   | Count `status === 'accepted'` | grün  | `useSessionRsvps`-Daten |
| Abgesagt   | Count `status === 'declined'` | rot   | dito                    |
| Vielleicht | Count `status === 'maybe'`    | gelb  | dito                    |

### Liste „Zugesagt" mit Check-in

Pro akzeptiertem Mitglied:

- Pill links: Member-Name in fett.
- Pill rechts: **„Check-in"**-Button (UserCheck-Icon, Outline) im IDLE-State.
- Klick auf Button → `POST /api/attendance-records`:
  ```json
  {
    "sessionId": "<selected>",
    "participantId": "<memberId>",
    "participantName": "Max Mustermann",
    "trainerId": "<this>",
    "trainerName": "<this>",
    "date": "<now ISO>",
    "status": "present",
    "checkInTime": "HH:MM"
  }
  ```

**Erwartung:** Pill wechselt zu grünem Hintergrund + „Eingecheckt"-Badge (UserCheck-Icon). Toast „Teilnehmer eingecheckt ✅".

**Fehlerfall:** Toast „Check-in fehlgeschlagen". Component bleibt im IDLE-State (kein Optimistic Update).

### Liste „Vielleicht" (read-only)

Same Show-Style mit gelbem Background. **Kein Check-in-Button** — bestätigt sich selbst, wenn sie erscheinen.

### Liste „Abgesagt" (read-only)

Mit rotem Background + „Abwesend"-Badge (rot Outline).

## Tipps für den Trainer-Alltag

1. **Kurz vor Session-Start**: Dashboard öffnen, deine nächste Pill ist schon vorausgewählt.
2. **Während Session**: Mitglieder eintreffen → Klick auf „Check-in" pro Person.
3. **Wer nicht auftaucht**: Bleibt in „Zugesagt" (kein Auto-no-show) — du kannst später in der Anwesenheitshistorie ergänzen, falls dein Workflow das erlaubt (siehe `attendance-history.tsx` als Trainer-Tool).
4. **No-show später markieren**: `/admin/attendance` als Admin-Tool, oder direkt Edit über `/api/attendance-records/{id}` PATCH wenn deine Rollen-Permissions das erlauben.

## Edge-Cases

| Problem                                                    | Ursache                                                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session taucht nicht im Selector auf                       | Planungs-Assistent hat `trainer_id = NULL` gesetzt oder falsche ID-Variante verwendet. → Admin kontaktieren, Session korrigieren.                                   |
| Hook liefert „Keine RSVPs"                                 | Mitglieder haben noch nicht geantwortet (kein Buchungs-Status beim Plan).                                                                                           |
| Check-in Button tut nichts                                 | Network-Error → Toast erscheint. Sonst: Member ist in mehreren Clubs (Data-Drift) — Backend-Logs prüfen.                                                            |
| „Eingecheckt"-Badge zeigt sich, aber DB hat keinen Eintrag | Race Condition bei doppeltem Click (Button bleibt nur während `checkingIn === true` deaktiviert) — erneute Klicks in schneller Folge könnten mehrfach POSTs senden. |
| Layout-Guard redirect zu `/login`                          | Weder Trainer-Profil mit `is_active = true` für deine E-Mail noch aktive Verein-Membership vorhanden. Support / Admin-Lookup.                                       |
