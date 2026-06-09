# SwingZ Rollenkonzept

## Rollen-Hierarchie

| Rolle          | Level | Beschreibung                                      |
| -------------- | ----- | ------------------------------------------------- |
| **superadmin** | 4     | Plattform-Admin mit vollem Zugriff auf alle Clubs |
| **admin**      | 3     | Club-Admin mit vollzugriff auf einen Club         |
| **trainer**    | 2     | Trainer mit Zugriff auf zugewiesene Mitglieder    |
| **member**     | 1     | Mitglied mit Zugriff auf eigene Daten             |

## Berechtigungen nach Rolle

### Superadmin (Level 4)

- **Dashboard:** Plattform-weite Übersicht
- **Bookings:** Alle Buchungen aller Clubs
- **Scheduler:** Alle Trainer-Schedules
- **Analytics:** Plattform-weite Metriken
- **Members:** Vollzugriff auf alle Mitglieder aller Clubs
- **Clubs:** Alle Studios verwalten
- **Settings:** Plattform-Konfiguration
- **Billing:** Revenue, Payouts, Invoices aller Clubs

### Admin (Level 3)

- **Dashboard:** Studio-Übersicht
- **Bookings:** Alle Buchungen des eigenen Clubs
- **Scheduler:** Full Schedule des eigenen Clubs
- **Analytics:** Studio-level Metriken
- **Members:** Alle Mitglieder des eigenen Clubs
- **Settings:** Studio-Konfiguration
- **Billing:** Invoices, Payouts des eigenen Clubs
- ** Kann NICHT:** Andere Studios einsehen, Plattform-Settings ändern

### Trainer (Level 2)

- **Dashboard:** Persönlicher Schedule
- **Bookings:** Nur zugewiesene Clients
- **Scheduler:** Nur eigener Schedule
- **Analytics:** Persönliche Metriken
- **Members:** Nur zugewiesene Mitglieder
- **Settings:** Persönliches Profil
- **Billing:** Earnings Summary

### Member (Level 1)

- **Dashboard:** Eigener Schedule
- **Bookings:** Eigene Buchungen
- **Scheduler:** View-only (nur eigene Klassen)
- **Analytics:** Persönlicher Fortschritt
- **Members:** Nur eigenes Profil
- **Settings:** Persönliches Profil
- **Billing:** Eigene Billing History

## API-Routen Schutz

### Beispiel-Implementierung

```typescript
import { withApiAuth, verifyRole, forbiddenResponse, isSuperadmin } from '@/lib/api-auth';

// Nur für Admins und höher
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }
    // ... Logik
  });
}

// Superadmin-spezifische Checks
export async function DELETE(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!isSuperadmin(auth)) {
      return forbiddenResponse('Superadmin access required');
    }
    // ... Logik
  });
}
```

## Frontend-Rollen-Prüfung

### React Hooks

```typescript
import { useHasRole, useIsSuperadmin, useIsAdminOrAbove } from '@/hooks/use-user-data';

// In einer Komponente
function AdminPanel() {
  const { hasRole, currentRole } = useHasRole('admin');

  if (!hasRole) {
    return <div>Kein Zugriff</div>;
  }

  return <div>Admin Content für {currentRole}</div>;
}

// Superadmin-Check
function SuperadminOnly() {
  const { hasRole } = useIsSuperadmin();
  return hasRole ? <SuperAdminControls /> : null;
}
```

## Datenbank-Schema

```sql
-- user_club_memberships Tabelle
CREATE TABLE user_club_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  club_id UUID REFERENCES clubs(id) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member', -- 'member' | 'trainer' | 'admin' | 'superadmin'
  joined_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, club_id)
);
```

## RLS Policies

Alle RLS-Policies prüfen die Rolle über `user_club_memberships`:

```sql
-- Beispiel: Admin-Zugriff auf Billing
CREATE POLICY "admins_can_view_billing"
ON billing FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid()
    AND club_id = billing.club_id
    AND role IN ('admin', 'superadmin')
  )
);
```

## Navigation Matrix

| Navigation | Superadmin        | Admin         | Trainer     | Member     |
| ---------- | ----------------- | ------------- | ----------- | ---------- |
| Dashboard  | Plattform         | Studio        | Persönlich  | Eigener    |
| Bookings   | Alle (alle Clubs) | Alle (Studio) | Zugewiesene | Eigene     |
| Scheduler  | Alle              | Alle (Studio) | Persönlich  | View-only  |
| Analytics  | Plattform         | Studio        | Persönlich  | Persönlich |
| Members    | Alle              | Studio        | Zugewiesene | Eigenes    |
| Clubs      | Alle              | Eigenes       | Eigenes     | N/A        |
| Settings   | Plattform         | Studio        | Profil      | Profil     |
| Billing    | Alle              | Studio        | Earnings    | History    |

## Seed-User

Test-Accounts sind in `sql/seed-roles.sql` definiert:

- `superadmin@swingz.com` - Superadmin
- `admin@swingz.com` - Admin
- `trainer@swingz.com` - Trainer
- `member@swingz.com` - Member

## Letzte Aktualisierung

- 2026-05-04: superadmin-Rolle zu verifyRole() hinzugefügt
- 2026-05-04: useHasRole() Hooks implementiert
