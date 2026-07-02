# Tutorial · Platzbuchungen & Anwesenheitshistorie (Mitglied)

> Komponente 1: [`components/member-court-bookings.tsx`](../../../../components/member-court-bookings.tsx) (Page: `/bookings`)
> Komponente 2: [`components/attendance-history.tsx`](../../../../components/attendance-history.tsx) (genutzt auf `/attendance-history` o. ä.)
> Hooks: `useSessions`, `useCourts`, `useUserClub`, `useUserMember`

## A) „Meine Platzbuchungen" — `/bookings`

### Was wird angezeigt?

Eine 3-Sektionen-Ansicht:

#### A.1 Stat-Reihe oben (3 Cards)

- **Platzbuchungen** — Anzahl im aktuellen Monat
- **Kommende** — Anzahl mit `timeslotStart >= now`, blau markiert
- **Verschiedene Plätze** — `new Set(monthBookings.map(b => b.courtId)).size`

#### A.2 „Nächste Buchungen" (Top 5)

Wenn `upcomingBookings.length > 0`:

- Karten mit großem Kalender-Icon + Wochentag + Datum + Uhrzeit-Range + Platzname + Surface-Badge (z. B. „Sand") + Trainer-Name + Status-Badge.

**Status-Badge-Logik** (aus `getBookingStatus()`):
| Bedingung | Label | Farbe | Icon |
|-----------|-------|-------|------|
| `bookingStatus === 'cancelled'` | Storniert | rot | XCircle |
| Datum in Vergangenheit + `completed` | Abgeschlossen | grün | CheckCircle |
| Datum in Vergangenheit + `no_show` | Nicht erschienen | grau | XCircle |
| Datum in Vergangenheit, sonst | Vergangen | grau | Clock |
| `bookingStatus === 'confirmed'` | Bestätigt | blau | CheckCircle |
| Sonst | Ausstehend | gelb | Clock |

#### A.3 „Buchungen <Monat>" (alle dieses Monats)

- Monatswechsler: **Heute** / **< Monat** **>** Buttons (Monatsname + Jahr mittig)
- Wenn `monthBookings.length === 0`: Empty-State „Keine Platzbuchungen für diesen Monat"
- Sonst: pro Eintrag eine Zeile mit Datum (mit „Heute"-Badge falls heute), Zeit-Range, Platzname, Surface, Trainer. Status-Logik wie oben.

#### A.4 „Platznutzung" (Zusammenfassung unten)

Pro **distinct courtId** im aktuellen Monat:

- Platzname + Surface + „Nx gebucht"-Counter.
- Sinnvoll: sieht den Lieblings-Platz.

### Datenquellen

- `useSessions(clubId)` → alle Club-Sessions.
- `useCourts(clubId)` → alle Club-Plätze.
- Filter: nur Sessions mit `bookedByUser === true` (kommt aus dem Session-Hook).

### Klick-Verhalten

- Monatswechsel: `<` / `>` Buttons → `setCurrentMonth(subMonths(...))` / `setCurrentMonth(addMonths(...))`.
- Klick auf „Heute" → `setCurrentMonth(new Date())`.
- Buchung-Cards selbst sind nicht klickbar (Read-Only-Ansicht).

## B) Anwesenheitshistorie

> Komponente liefert pro Eintrag: `session_date`, `start_time`, `end_time`, optional Court/Group, `attended: boolean`, optional Notiz.

### Was wird angezeigt?

1. **4-Stat-Reihe** oben:
   - Gesamt (Calendar-Icon, blau)
   - Anwesend (CheckCircle, grün)
   - Verpasst (XCircle, rot)
   - Quote = `Math.round(anwesend / gesamt * 100) + '%'` (Clock, gelb)

2. **Filter-Buttons**: **Alle** | **Anwesend** | **Verpasst** (Default = „Alle")

3. **Records-Liste** (15 pro Seite):
   - Linke Seite: IconBox (grün `CheckCircle` oder rot `XCircle`)
   - Mitte: Court/Group-Name (falls vorhanden) + Badge „Anwesend"/„Abwesend"
   - Datum + Zeit-Range unter dem Titel
   - Notiz (italic, falls vorhanden)

4. **Pagination** unten (Compact-Mode): `PaginationNav` aus `@/components/ui/pagination-nav` + `buildPaginationMeta(page, 15, total)`.

### Klick-Verhalten

- Filter-Tab-Klick → `setFilter(f)` + `setPage(1)` → Re-Fetch via `apiFetch('/api/attendance-records?page=...&pageSize=15&filter=...')`.
- Seitenwechsel → `setPage(n)`.
- Kein Eintrag-Klick — Read-Only.

## Edge-Cases

| Problem                                    | Bedeutung                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Liste leer trotz Training gehabt           | Attendance-Records wurden nicht geschrieben (Trainer muss dich bei der Session einchecken — siehe `trainer-sessions-and-checkin.md`) |
| `monthBookings.length` < `bookings.length` | Es gibt Buchungen in anderen Monaten — Monatswechsler nutzen                                                                         |
| Ein bestimmter Monat fehlt komplett        | Saisonpause / noch nicht gepflegte `schedules`-Einträge                                                                              |
| Anwesenheitsquote niedrig                  | Trainingshistorie zeigt korrekten Wert — überprüfe mit deinem Trainer, ob die Check-ins korrekt durchgeführt wurden                  |
