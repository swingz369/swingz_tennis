# SwingZ — Production Audit TEIL 3: Buchungen & Training

---

## TEIL 3: BUCHUNGEN & TRAINING (Score: 30/100)

| Komponente | Status | Datenquelle |
|---|---|---|
| `court-bookings.tsx` | DUMMY | `Math.random()` + Hartkodiert |
| `my-bookings.tsx` | DUMMY | Hartkodierte Testdaten Mai 2026 |
| `session-bookings.tsx` | PRODUKTIONSREIF | Echter API-Hook |
| `series-booking-form.tsx` | TEILWEISE | Echte API-Calls |
| `trainer-weekly-view.tsx` | MOCK | setTimeout + hartkodiert |
| `trainer-availability-calendar.tsx` | PRODUKTIONSREIF | Echter API-Call |

### BU1 — KRITISCH: Court-Booking komplett Dummy

`components/bookings/court-bookings.tsx:13,75` — Kommentar: "Placeholder data". `Math.random() > 0.3` bestimmt Belegung. Kein API-Call, keine Persistenz.

### BU2 — KRITISCH: "Meine Buchungen" zeigt Testdaten

`components/bookings/my-bookings.tsx:12` — Hartkodierte Buchungen aus Mai 2026. Kein Fetch. `window.location.href` statt `useRouter()`.

### BU3 — KRITISCH: Court-Kalender "Buchung bestätigen" ohne Handler

`components/courts/court-calendar.tsx:383-393` — Button hat keinen `onClick`. Endzeit = Startzeit (Bug). Kein API-Call.

### BU4 — HOCH: Trainer-Wochenansicht komplett Mock

`components/trainer-weekly-view.tsx:63-195` — 5 hartkodierte Sessions nach 1s Delay. `handleCancelSession`/`handleCompleteSession` kein API-Call, Änderungen gehen beim Reload verloren.

### BU5 — HOCH: Race Condition bei Buchungserstellung

`app/api/bookings/route.ts:43-65` — Check-then-Insert ohne Transaktionssicherung. Die atomische `create_booking_safe`-RPC aus `lib/booking/safe-booking.ts` wird nicht genutzt. Sessions können überbucht werden.

### BU6 — HOCH: Fehlende Pipeline Buchung → Stunden → Billing

Alle drei Systeme vollständig entkoppelt:

| Verbindung | Status |
|---|---|
| Buchung → Stundenlog-Eintrag | FEHLT |
| Stundenlog genehmigt → Invoice | FEHLT |
| Sessions → Billing-Zeilen | FEHLT |
| `hours_logs` in `billing/`-Code | FEHLT |

Trainer müssen Stunden manuell erfassen. Admin muss manuell Rechnungen erstellen.

### BU7 — MITTEL: `prompt()` für Ablehnungsgrund

`app/(protected)/admin/hours-logs/page.tsx:329` — `prompt('Ablehnungsgrund:')` — nativer Browser-Dialog, blockiert Browser-Tab.

### BU8 — MITTEL: `trainer_availabilities`-View falsches Day-Mapping

`supabase/migrations/20260507000000_schema_consolidation.sql:57-65` — `day_of_week = 0` → `'monday'` (falsch, Standard: 0 = Sonntag). Alle Trainer-Verfügbarkeitsabfragen über diese View liefern falsche Wochentage.

### BU9 — MITTEL: N+1-Abfragen in ScheduleService

`lib/booking/schedule.service.ts:124-156` — Für Wochenabfrage = 7 × n Datenbankabfragen. Kein Batching.

### Buchungs-Positives

- Session-Buchungen (Training buchen) vollständig implementiert ✓
- Kapazitätsprüfung + Doppelbuchungscheck in `/api/bookings` ✓
- `booking_rules`-Enforcement (rollenbasiert) ✓
- Atomische RPC `create_booking_safe` existiert (wird aber noch nicht genutzt) ✓
- Trainer-Verfügbarkeitskalender mit echter API ✓
- Stunden-Log-Backend vollständig ✓
