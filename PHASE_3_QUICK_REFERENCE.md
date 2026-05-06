# SwingZ Phase 3 - Quick Reference Guide

**Serienbuchungen & Trainer-Verfügbarkeit**

## 🚀 Quick Start

### Serienbuchungen verwenden

```tsx
import SeriesBookingForm from '@/components/booking/series-booking-form';

// In Ihrer Komponente
<SeriesBookingForm
  clubId={clubId}
  courtId={courtId}
  onSuccess={(bookingIds) => {
    console.log('Created bookings:', bookingIds);
  }}
/>;
```

### Trainer-Verfügbarkeit verwalten

```tsx
import TrainerAvailabilityManager from '@/components/trainer/trainer-availability-manager';

// Für Trainer
<TrainerAvailabilityManager
  trainerId={user.id}
  clubId={clubId}
  isAdmin={false}
/>

// Für Admins
<TrainerAvailabilityManager
  trainerId={selectedTrainerId}
  clubId={clubId}
  isAdmin={true}
/>
```

### Booking Validation Hook

```tsx
import { useBookingValidation, formatValidationError } from '@/hooks/use-booking-validation';

function MyBookingForm() {
  const { validateBooking, isValidating, lastValidation } = useBookingValidation();

  const handleValidate = async () => {
    const result = await validateBooking({
      user_id: userId,
      club_id: clubId,
      court_id: courtId,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
    });

    if (!result.is_valid) {
      toast.error(formatValidationError(result));
    }
  };
}
```

---

## 📡 API Endpoints

### Serienbuchungen

#### POST /api/bookings/series

Erstellt eine Serienbuchung.

**Request:**

```json
{
  "club_id": "uuid",
  "court_id": "uuid",
  "start_time": "2026-05-10T10:00:00Z",
  "end_time": "2026-05-10T11:30:00Z",
  "recurring_pattern": {
    "frequency": "weekly",
    "interval": 1,
    "days_of_week": [1, 3, 5],
    "occurrences": 12
  }
}
```

**Response:**

```json
{
  "success": true,
  "bookingIds": ["uuid1", "uuid2", ...],
  "errors": []
}
```

#### POST /api/bookings/validate-series

Validiert eine Serie von Buchungen.

**Request:**

```json
{
  "club_id": "uuid",
  "court_id": "uuid",
  "bookings": [
    {
      "date": "2026-05-10",
      "start_time": "10:00",
      "end_time": "11:30"
    }
  ]
}
```

**Response:**

```json
{
  "results": [
    {
      "date": "2026-05-10",
      "valid": true
    }
  ],
  "summary": {
    "total": 12,
    "valid": 10,
    "invalid": 2
  }
}
```

### Trainer-Verfügbarkeit

#### GET /api/trainer-availability

Lädt Trainer-Verfügbarkeiten.

**Query Parameters:**

- `trainer_id` (optional): Filter nach Trainer
- `club_id` (optional): Filter nach Club
- `start_date` (optional): Von Datum
- `end_date` (optional): Bis Datum

**Response:**

```json
{
  "availabilities": [
    {
      "id": "uuid",
      "trainer_id": "uuid",
      "club_id": "uuid",
      "day_of_week": 1,
      "start_time": "08:00",
      "end_time": "12:00",
      "is_available": true,
      "notes": "Morgens verfügbar"
    }
  ]
}
```

#### POST /api/trainer-availability

Erstellt eine neue Verfügbarkeit.

**Request:**

```json
{
  "trainer_id": "uuid",
  "club_id": "uuid",
  "day_of_week": 1,
  "start_time": "08:00",
  "end_time": "12:00",
  "is_available": true,
  "notes": "Optional"
}
```

#### DELETE /api/trainer-availability?id={id}

Löscht eine Verfügbarkeit.

### Trainer-Abwesenheiten

#### POST /api/trainer-absences

Erstellt eine Abwesenheit.

**Request:**

```json
{
  "trainer_id": "uuid",
  "club_id": "uuid",
  "start_date": "2026-05-10",
  "end_date": "2026-05-20",
  "reason": "vacation",
  "substitute_trainer_id": "uuid"
}
```

**Reasons:**

- `vacation` - Urlaub
- `sick` - Krankheit
- `training` - Weiterbildung
- `personal` - Persönlich
- `other` - Sonstiges

---

## 🛡️ Error Handling

### Custom Error Classes

```typescript
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  formatErrorResponse,
} from '@/lib/api-errors';

// In API Route
try {
  if (!requiredField) {
    throw new ValidationError('Field is required');
  }

  if (!hasPermission) {
    throw new ForbiddenError('Insufficient permissions');
  }

  // ... your logic
} catch (error) {
  const errorResponse = formatErrorResponse(error);
  return NextResponse.json(errorResponse, {
    status: errorResponse.statusCode,
  });
}
```

### User-friendly Error Messages

```typescript
import { getUserFriendlyError } from '@/lib/api-errors';

const message = getUserFriendlyError('TIME_SLOT_UNAVAILABLE');
// Returns: "Dieser Zeitslot ist nicht mehr verfügbar."
```

---

## 🧪 Testing

### Migration Testing

```bash
# Run migration tests
./scripts/test-migrations.sh

# Check migration syntax
cd supabase/migrations
cat 20260506_trainer_availability.sql | head -100

# Apply migrations (development)
supabase db push

# Verify migrations
supabase db diff
```

### Manual Testing Checklist

#### Serienbuchungen

- [ ] Wöchentliche Buchung (12 Termine)
- [ ] Monatliche Buchung (6 Termine)
- [ ] Konfliktprüfung
- [ ] Maximale Anzahl (52 Buchungen)
- [ ] Wochentag-Auswahl
- [ ] End-Datum vs. Anzahl Termine

#### Trainer-Verfügbarkeit

- [ ] Verfügbarkeit für Montag 08:00-12:00 erstellen
- [ ] Abwesenheit vom 10.-20.05. eintragen
- [ ] Vertretung zuweisen
- [ ] Konfliktprüfung (überlappende Zeiten)
- [ ] Trainer kann nur eigene Daten bearbeiten
- [ ] Admin kann alle Daten bearbeiten

#### Booking Validation

- [ ] Zu kurze Dauer → Fehler
- [ ] Zu lange Dauer → Fehler
- [ ] Zu weit im Voraus → Fehler
- [ ] Maximale Buchungen pro Tag erreicht → Fehler
- [ ] Zeitslot bereits gebucht → Fehler

---

## 🔧 Troubleshooting

### Problem: Serienbuchung schlägt fehl

**Ursache:** Konflikte mit bestehenden Buchungen

**Lösung:**

1. Nutzen Sie die Validierungs-API zuerst
2. Prüfen Sie die `errors` im Response
3. Zeigen Sie dem User die Konflikte an

### Problem: Trainer-Verfügbarkeit wird nicht gespeichert

**Ursache:** Berechtigungsfehler oder Konflikt

**Lösung:**

1. Prüfen Sie die User-Rolle (Trainer/Admin)
2. Checken Sie auf überlappende Zeitfenster
3. Prüfen Sie die Konsole für API-Fehler

### Problem: Validierung gibt falsche Fehler

**Ursache:** Booking Rules nicht korrekt konfiguriert

**Lösung:**

1. Prüfen Sie die `booking_rules` Tabelle
2. Stellen Sie sicher, dass `is_active = true`
3. Prüfen Sie die Werte für min/max Dauer

---

## 📚 Database Schema

### trainer_availability

```sql
CREATE TABLE trainer_availability (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  club_id uuid REFERENCES clubs(id),
  day_of_week integer CHECK (0-6), -- 0=Sunday, 6=Saturday
  start_time time,
  end_time time,
  is_available boolean DEFAULT true,
  notes text
);
```

### trainer_absences

```sql
CREATE TABLE trainer_absences (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  club_id uuid REFERENCES clubs(id),
  start_date date,
  end_date date,
  reason varchar(100),
  substitute_trainer_id uuid REFERENCES users(id)
);
```

### bookings (erweitert)

```sql
-- Neue Felder:
booking_type varchar(50) DEFAULT 'single', -- 'single' | 'recurring'
series_id uuid, -- Für Gruppierung von Serienbuchungen
```

---

## 🎯 Best Practices

### Serienbuchungen

1. Immer zuerst validieren
2. Max. 52 Buchungen pro Serie
3. Konflikte dem User klar anzeigen
4. Erfolgreiche + fehlgeschlagene Buchungen trennen

### Trainer-Verfügbarkeit

1. Wöchentliche Muster verwenden
2. Abwesenheiten im Voraus planen
3. Vertretungen frühzeitig zuweisen
4. Konflikte vor dem Speichern prüfen

### Error Handling

1. Immer spezifische Error-Codes verwenden
2. User-friendly Messages anzeigen
3. Technische Details nur im Log
4. Validation vor DB-Operationen

### Performance

1. Indexe auf häufig abgefragte Felder
2. RLS Policies für Security
3. Caching für wiederholte Queries
4. Batch-Operationen für Serienbuchungen

---

## 📞 Support

Bei Fragen oder Problemen:

1. Prüfen Sie die Dokumentation (`PHASE_3_UPDATES.md`)
2. Schauen Sie in die API-Logs
3. Testen Sie mit dem Migration-Script
4. Prüfen Sie die Supabase-Console für DB-Fehler

**Wichtige Dateien:**

- API Errors: `/lib/api-errors.ts`
- Booking Validation: `/hooks/use-booking-validation.ts`
- Database Migrations: `/supabase/migrations/20260506_*.sql`
- Testing Script: `/scripts/test-migrations.sh`
