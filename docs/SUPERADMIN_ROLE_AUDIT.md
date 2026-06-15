# Rollen-Audit: Superadmin

> Stand: 15. Juni 2026 | SwingZ Plattform

## Übersicht

Die **Superadmin**-Rolle ist die höchste Berechtigungsstufe auf der Plattform. Superadmins können **alle Vereine** verwalten, neue Clubs erstellen, plattformweite Analytics einsehen und in jeden Club als Admin wechseln.

**Layout-Guard:** `app/(protected)/superadmin/layout.tsx` — Prüft auf `superadmin` Rolle. Redirect zu Onboarding-Wizard wenn `superadmin_setup_completed_at` fehlt. Nicht-Superadmins werden zu ihrer Rolle umgeleitet.

---

## Navigation (Sidebar)

### Primäre Navigation — Sektion "Plattform"

| Name              | Link                  | Icon   | Beschreibung                  |
| ----------------- | --------------------- | ------ | ----------------------------- |
| Dashboard         | `/superadmin`         | Home   | Plattform-KPIs, Club-Liste    |
| Vereinsübersicht  | `/superadmin/tenants` | Shield | Alle Vereine als Karten       |
| Club-Verwaltung   | `/superadmin/clubs`   | Shield | Vereine erstellen/verwalten   |
| Plattform-Analyse | `/admin/analytics`    | Shield | Analytics (gleiche wie Admin) |

### Primäre Navigation — Sektion "Verwaltung"

| Name                 | Link              | Icon     | Beschreibung                      |
| -------------------- | ----------------- | -------- | --------------------------------- |
| Billing-Verwaltung   | `/admin/billing`  | Settings | Rechnungen (gleiche wie Admin)    |
| System-Einstellungen | `/admin/settings` | Settings | Einstellungen (gleiche wie Admin) |

### Sekundäre Navigation ("Allgemein")

| Name        | Link        | Icon          | Beschreibung              |
| ----------- | ----------- | ------------- | ------------------------- |
| Mein Profil | `/profile`  | User          | Eigenes Profil bearbeiten |
| Nachrichten | `/messages` | MessageSquare | Interne Nachrichten       |

### Quick Actions (Dashboard)

| Aktion            | Link                  | Icon       |
| ----------------- | --------------------- | ---------- |
| Vereine verwalten | `/superadmin/clubs`   | Building2  |
| Vereinsübersicht  | `/superadmin/tenants` | TrendingUp |
| Analytics         | `/admin/analytics`    | Activity   |
| Einstellungen     | `/admin/settings`     | Settings   |

### Club-Switcher

Superadmins mit Zugriff auf mehrere Clubs sehen einen **Club-Switcher** in der Sidebar:

- Dropdown mit allen verfügbaren Clubs
- Aktuell ausgewählter Club hervorgehoben
- Wechsel via `/api/admin/switch-club` (POST, setzt Cookie + Reload)

---

## Seiten & Funktionen im Detail

### 1. Superadmin-Dashboard (`/superadmin`)

**Datei:** `app/(protected)/superadmin/page.tsx` (Server Component)

**Funktionen:**

- **Plattform-KPIs (4×):**
  - Vereine (Gesamtanzahl)
  - Nutzer gesamt
  - Aktive Mitgliedschaften
  - Aktive Trainer
- **Alle Vereine-Liste:** Jeder Club mit:
  - Name, Mitgliederzahl, Trainerzahl
  - Status-Badge (aktiv/inaktiv)
  - "Als Admin →" Link (wechselt Club-Kontext via Cookie)
- **Quick Actions:** 4 Verwaltungslinks

**API-Abhängigkeiten:**

- Supabase Direktzugriff: `clubs`, `users`, `user_club_memberships` (alle Clubs, kein Club-Filter)

---

### 2. Vereinsübersicht / Tenants (`/superadmin/tenants`)

**Datei:** `app/(protected)/superadmin/tenants/page.tsx` (Client Component)

**Funktionen:**

- **Karten-Grid** aller aktiven Vereine mit:
  - Clubname (Header mit Gradient)
  - Mitgliederzahl / Max. Mitglieder
  - Trainer-Anzahl
  - Aktive Sessions
  - Umsatz (letzte 30 Tage, via Rechnungen)
  - "Verein verwalten"-Button → Setzt `admin_club_id` Cookie, leitet zu `/admin/members`

**API-Abhängigkeiten:**

- Supabase Client: `clubs` mit `club_memberships(count)`, `trainers(count)`, `sessions(count)`
- Supabase Client: `invoices` (Umsatz-Berechnung)

---

### 3. Club-Verwaltung (`/superadmin/clubs`)

**Datei:** `app/(protected)/superadmin/clubs/page.tsx` (Client Component)

**Funktionen:**

- **Alle Vereine** als Karten-Grid (Name, Status, Mitglieder/max)
- **Neuen Verein erstellen:** Formular mit Name + Max. Mitglieder
- Vereine via `/api/clubs` laden

**API-Endpunkte:**

- `GET /api/clubs` — Alle Clubs laden
- `POST /api/clubs` — Neuen Club erstellen

---

### 4. Superadmin Dashboard V2 (`/superadmin/dashboard`)

**Datei:** `app/(protected)/superadmin/dashboard/page.tsx` (Server Component) → `admin-panel-v2-client.tsx`

**Funktionen:**

- Erweiterte Plattform-Übersicht
- Club-Liste mit Member/Trainer-Counts
- Plattform-Statistiken aggregiert
- Nutzt `AdminPanelV2Client`-Component

---

### 5. Onboarding-Wizard (`/superadmin/onboarding`)

**Datei:** `app/(protected)/superadmin/onboarding/page.tsx`

**Funktionen:**

- **Ersteinrichtung** für neue Superadmins
- Verein erstellen (Name, Stadt)
- Admin einladen (E-Mail)
- Wird einmalig durchlaufen (`superadmin_setup_completed_at` in `users` Tabelle)
- Auto-Redirect wenn bereits abgeschlossen

**Layout-Guard:** Layout prüft `superadmin_setup_completed_at` und redirectet zu `/superadmin/onboarding` wenn nicht gesetzt.

---

### 6. Admin-Bereiche (shared)

Superadmins haben Zugriff auf **ausgewählte Admin-Seiten** über die Sidebar:

| Admin-Route        | Beschreibung                 | Superadmin-Zugriff   |
| ------------------ | ---------------------------- | -------------------- |
| `/admin/analytics` | Analytics & Berichte         | ✅ Plattform-weit    |
| `/admin/billing`   | Abrechnung & Kategorien      | ✅ Plattform-weit    |
| `/admin/settings`  | Vereinseinstellungen         | ✅ Plattform-weit    |
| `/admin/members`   | Mitglieder (via Club-Switch) | ✅ Nach Club-Wechsel |

---

## API-Endpunkte (Zusammenfassung)

| Endpoint                          | Methode  | Beschreibung                   |
| --------------------------------- | -------- | ------------------------------ |
| `/api/clubs`                      | GET      | Alle Clubs laden               |
| `/api/clubs`                      | POST     | Neuen Club erstellen           |
| `/api/admin/switch-club`          | POST     | Club-Kontext wechseln          |
| `/api/admin/switch-club-redirect` | GET      | Club-Redirect (Cookie-basiert) |
| `/api/messages`                   | GET/POST | Nachrichten                    |
| `/api/messages/{id}/read`         | PATCH    | Als gelesen markieren          |

**Hinweis:** Superadmins nutzen für die meisten Operationen die **Supabase Direktzugriffe** (Service Role) statt API-Endpunkte, da sie plattformweite Berechtigung haben.

---

## Feature-Flags

Superadmins unterliegen **keinen** Feature-Flags. Sie haben Zugriff auf alle Features.

---

## Berechtigungen (RBAC)

- **Zugriff:** ALLE Vereine, ALLE Nutzer, ALLE Daten (plattformweit)
- **Club-Isolation:** Superadmins können via Club-Switcher den Kontext wechseln
- **Multi-Tenant:** `club_id = NULL` in `user_club_memberships` für Superadmin-Eintrag
- **Layout-Guard:** Onboarding-Zwang bei Erstnutzung
- **Cookie-basiert:** Club-Wechsel via `admin_club_id` Cookie (24h Gültigkeit)

---

## Unterschiede zu Admin

| Feature        | Admin            | Superadmin          |
| -------------- | ---------------- | ------------------- |
| Vereine        | Nur eigener Club | Alle Vereine        |
| Dashboard      | Club-spezifisch  | Plattformweit       |
| Club erstellen | ❌               | ✅                  |
| Club-Switcher  | ❌ (nur eigener) | ✅ (alle Clubs)     |
| Onboarding     | Club-Onboarding  | Superadmin-Setup    |
| Feature-Flags  | Ja (pro Club)    | Nein (alle aktiv)   |
| Mitglieder     | Eigener Club     | Alle Clubs          |
| Analytics      | Club-Analytics   | Plattform-Analytics |
| Billing        | Club-Billing     | Plattform-Billing   |
| Settings       | Club-Settings    | Plattform-Settings  |

---

## Datenfluss

```
Superadmin Login
  ↓
Layout: superadmin_setup_completed_at?
  ├─ Nein → /superadmin/onboarding (Einmalig)
  └─ Ja → /superadmin (Dashboard)
              ↓
         Club-Switcher (Cookie: admin_club_id)
              ↓
         /admin/members (als Admin im Club-Kontext)
```

---

## Sicherheitsaspekte

- **Service Role Zugriff:** Superadmins nutzen `SUPABASE_SERVICE_ROLE_KEY` für plattformweite Queries
- **Cookie-Isolation:** `admin_club_id` Cookie für Club-Kontext (SameSite=Lax)
- **Kein RLS-Bypass in UI:** Trotz Service Role werden Club-Daten nur nach explizitem Club-Switch angezeigt
- **Audit-Log:** Club-Wechsel und Erstellungsaktionen werden geloggt
