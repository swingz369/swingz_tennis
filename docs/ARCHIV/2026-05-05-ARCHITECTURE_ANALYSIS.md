# SwingZ - Vollständige Architektur- und Geschäftslogik-Analyse

**Datum**: 2026-05-05  
**Version**: SwingZ v2.0  
**Analysiert von**: Kilo AI

---

## Executive Summary

**SwingZ** ist ein Multi-Tenant Tennis Club Management System auf Basis von Next.js 14, Supabase und TypeScript. Die Analyse identifiziert eine solide Grundarchitektur mit klaren Domain-Strukturen, aber **kritische Sicherheitslücken, logische Fehler und UX-Inkonsistenzen**, die vor einem produktiven Einsatz behoben werden müssen.

**Aktueller Reifegrad**: 📊 **Stufe 2 von 5** (Early Beta - Funktionsfähig, aber mit kritischen Mängeln)  
**Gesamtbewertung**: 7/10 Punkte

---

## Inhaltsverzeichnis

1. [Technologie-Stack](#1-technologie-stack)
2. [Vier Nutzerrollen - Detaillierte Analyse](#2-vier-nutzerrollen---detaillierte-analyse)
3. [Routing & Navigationsstruktur](#3-routing--navigationsstruktur)
4. [API-Architektur](#4-api-architektur)
5. [Datenbankschema](#5-datenbankschema)
6. [Authentifizierung & Autorisierung](#6-authentifizierung--autorisierung)
7. [Geschäftslogik & Business Rules](#7-geschäftslogik--business-rules)
8. [Kritische Sicherheitslücken](#8-kritische-sicherheitslücken)
9. [UX-Defizite & Inkonsistenzen](#9-ux-defizite--inkonsistenzen)
10. [Optimierungsempfehlungen](#10-optimierungsempfehlungen)
11. [Roadmap](#11-roadmap)

---

## 1. Technologie-Stack

### Frontend

- **Framework**: Next.js 14+ (App Router)
- **UI**: React 18 mit TypeScript
- **Styling**: Tailwind CSS
- **Komponenten**: shadcn/ui
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod
- **Date/Time**: date-fns

### Backend

- **API**: Next.js API Routes (App Router)
- **Datenbank**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (JWT-basiert)
- **ORM**: Supabase Client (JavaScript SDK)
- **Validierung**: Zod Schemas

### Architektur

- **Pattern**: Domain-Driven Design (teilweise)
- **Multi-Tenancy**: Row Level Security (RLS)
- **Deployment**: Vercel-ready
- **Monorepo**: Nx oder ähnliches Framework (erkennbar an Struktur)

---

## 2. Vier Nutzerrollen - Detaillierte Analyse

### 2.1 🔵 MEMBER (Basis-Mitglied)

#### Reale Akteure

Vereinsmitglieder, Freizeitspieler, Jugendspieler

#### Berechtigungen

✅ **Kann**:

- Dashboard mit eigenen Statistiken sehen
- Trainingszeiten anzeigen (alle Sessions des Clubs)
- Eigene Buchungen erstellen & stornieren
- Court-Kalender einsehen
- Eigenes Profil bearbeiten
- Anwesenheitshistorie einsehen
- Rechnungen einsehen & bezahlen (Stripe Checkout)
- News & Benachrichtigungen lesen
- Probetraining buchen

❌ **Kann nicht**:

- Fremde Member-Profile bearbeiten
- Admin-Funktionen nutzen
- Trainer-Funktionen nutzen

#### Navigation (Sidebar)

```
📍 Hauptmenü:
  - Dashboard
  - Trainingszeiten
  - Anwesenheit
  - News
  - Benachrichtigungen
  - Buchungen
  - Platz-Kalender
  - Abo & Rechnung
  - Mein Profil
```

#### Typischer Use Case

> Maria (16, Jugendspielerin) loggt sich ein, sieht auf dem Dashboard ihre nächste Session am Mittwoch um 17:00 Uhr, bucht einen zusätzlichen Platz für Samstag und prüft ihre offene Rechnung für den Monat.

#### Identifizierte Probleme

- 🔴 Kann alle Sessions des Clubs sehen (auch fremde Buchungen - Datenschutz!)
- 🟡 Keine Möglichkeit, Buchungen zu editieren (nur stornieren & neu buchen)
- 🟡 Court-Buchung ist von Session-Buchung getrennt (verwirrend)

---

### 2.2 🟢 TRAINER

#### Reale Akteure

Lizenzierte Tennislehrer, Übungsleiter, Co-Trainer

#### Zusätzliche Berechtigungen (zu Member)

✅ **Kann zusätzlich**:

- Scheduler sehen (erweiterte Kalender-Ansicht)
- Eigene Sessions erstellen
- Eigene Sessions bearbeiten & löschen
- Member-Liste einsehen (alle Mitglieder des Clubs)
- Member-Daten bearbeiten (Name, Email, Telefon)
- Attendance (Anwesenheit) erfassen
- Trial-Training-Stats sehen
- Rechnungen erstellen (für eigene Trainings)
- Analytics einsehen

❌ **Kann nicht**:

- Fremde Trainer-Sessions bearbeiten
- Members löschen
- Courts verwalten
- Admin-Settings ändern

#### Navigation (Sidebar)

```
📍 Hauptmenü:
  (wie Member) +
  - Scheduler ⭐ (Trainer-spezifisch)
```

#### Typischer Use Case

> Thomas (Trainer) erstellt eine neue Gruppen-Session für Montag 18:00-19:30 Uhr, weist sich selbst als Trainer zu, setzt das Limit auf 8 Teilnehmer und markiert die Court-Präferenz "Außen". Nach dem Training erfasst er die Anwesenheit der Teilnehmer.

#### Identifizierte Probleme

- 🔴 Kann eigene Sessions NUR auf eigenen Courts erstellen, aber validiert dies nicht
- 🟡 Keine Übersicht über eigene Einnahmen (nur Admin sieht Abrechnungen)
- 🟡 Kein Feedback-System für Member nach Training

---

### 2.3 🟠 ADMIN (Vereins-Administrator)

#### Reale Akteure

Vorstand, Geschäftsführer, Club-Manager

#### Zusätzliche Berechtigungen (zu Trainer)

✅ **Kann zusätzlich**:

- Alle Admin-Bereiche zugänglich
- Mitglieder einladen, bearbeiten & löschen
- Trainer verwalten
- Courts & Court-Types verwalten
- Schedules (Saisonpläne) verwalten
- Gruppen erstellen & verwalten
- Sessions aller Trainer bearbeiten/löschen
- Pricing Rules & Fee Configurations
- Billing-Administration (Rechnungen, Mahnungen, SEPA)
- System-Settings & Branding
- Genehmigungen (Abwesenheiten, Stundennachweise)
- Onboarding-Prozesse
- Analytics & Reports exportieren

❌ **Kann nicht**:

- Superadmin-Funktionen (Tenant-Übersicht, andere Clubs sehen)
- Clubs erstellen

#### Navigation (Sidebar)

```
📍 Hauptmenü:
  (wie Trainer)

📍 Administration:
  - Analytics ⭐
  - Onboarding ⭐
  - Clubs (nur eigener Club)
  - Mitglieder ⭐
  - Trainer ⭐
  - Schedules ⭐
  - Platzverwaltung ⭐
  - Genehmigungen ⭐
  - Einstellungen ⭐
  - Billing Admin ⭐
```

#### Typischer Use Case

> Stefan (Vereinsvorstand) loggt sich ein, genehmigt 3 offene Abwesenheitsanträge, lädt einen neuen Trainer ein, erstellt die Winterseason 2026 mit 12 Wochen Laufzeit, generiert SEPA-Lastschriften für 45 offene Rechnungen und prüft die Analytics - 320 aktive Mitglieder, 12 Trainer, 8 Courts.

#### Identifizierte Probleme

- 🔴 **KEINE Möglichkeit, Member-Rollen zu ändern** (UI existiert, API fehlt!)
- 🔴 Kann Members nicht deaktivieren (is_active Toggle fehlt in API)
- 🟡 N+1 Query Problem in Tenant-Übersicht (bei vielen Clubs)
- 🟡 Keine Bulk-Operationen (z.B. alle Members einer Gruppe löschen)

---

### 2.4 🔴 SUPERADMIN (Plattform-Administrator)

#### Reale Akteure

SaaS-Betreiber, System-Administrator, Support

#### Zusätzliche Berechtigungen (zu Admin)

✅ **Kann zusätzlich**:

- Alle Clubs sehen & verwalten (Tenant-Übersicht)
- Zwischen Clubs wechseln (via Cookie `selected-club-id`)
- Neue Clubs erstellen
- Bypass für alle Club-Isolation-Checks
- Kann Members zu Superadmin befördern

#### Navigation (Sidebar)

```
📍 Hauptmenü:
  (wie Admin) +
  - Vereinsübersicht ⭐ (nur wenn kein Club selektiert)
```

#### Spezial-Features

- Cookie `selected-club-id` zum Club-Wechsel
- Automatische Club-Isolation-Bypasses in API (`auth.role === 'superadmin'`)
- Tenant-Overview mit allen Club-Statistiken

#### Typischer Use Case

> Laura (SaaS-Betreiber) loggt sich ein, sieht die Tenant-Übersicht mit 15 Clubs, wählt "Tennis Berlin" aus, prüft warum die SEPA-Lastschriften fehlschlagen, behebt die Payment-Settings, wechselt zurück zur Übersicht und erstellt einen neuen Club "Squash Frankfurt".

#### Identifizierte Probleme

- 🔴 **Email-basierte Superadmin-Detection** (unsicher! `lib/api-auth.ts:38`)
- 🔴 Kein UI für Club-Selector (nur Cookie-Support im Backend)
- 🟡 Tenant-Overview hat Performance-Probleme (N+1 Query)

---

## 3. Routing & Navigationsstruktur

### 3.1 Protected Routes (`app/(protected)/`)

#### Member Routes (Alle authentifizierten Benutzer)

```
/dashboard                      → Dashboard (Member/Trainer/Admin spezifisch)
/training-schedule              → Trainingszeiten anzeigen
/attendance-history             → Anwesenheitshistorie
/news                          → News & Ankündigungen
/notifications                 → Benachrichtigungen
/bookings                      → Buchungsübersicht
/my-bookings                   → Eigene Buchungen
/courts                        → Platz-Kalender
/courts/daily                  → Tägliche Platzübersicht
/billing                       → Abo & Rechnung
/profile                       → Benutzerprofil
/members/[id]                  → Mitgliederprofil anzeigen
/trial-training                → Probetraining
```

#### Trainer Routes (Rolle: trainer oder höher)

```
/scheduler                     → Trainer Scheduler
/trainer                       → Trainer Dashboard
```

#### Admin Routes (Rolle: admin oder superadmin)

```
/admin/dashboard               → Admin Dashboard
/admin/analytics               → Analytics & Reports
/admin/members                 → Mitgliederverwaltung
/admin/members/[id]            → Mitglieder Details/Bearbeitung
/admin/trainers                → Trainerverwaltung
/admin/clubs                   → Vereinsverwaltung
/admin/clubs/[clubId]/dashboard → Spezifisches Club Dashboard
/admin/courts                  → Platzverwaltung
/admin/courts/manage           → Plätze verwalten
/admin/court-types             → Platztypen verwalten
/admin/schedules               → Trainingsplan-Verwaltung
/admin/onboarding              → Onboarding-Prozess
/admin/approvals               → Genehmigungen (Abwesenheiten, etc.)
/admin/settings                → System-Einstellungen
/admin/billing                 → Billing-Administration
/admin/branding                → Branding-Einstellungen
```

#### Superadmin Routes (Rolle: superadmin)

```
/admin/tenants                 → Tenant/Club-Übersicht (nur Superadmin)
```

### 3.2 Public Routes

```
/                              → Landing Page / Redirect
/landing                       → Öffentliche Landing Page
/login                         → Login-Seite
/register                      → Registrierung
/apply                         → Bewerbung/Antrag
/sepa-mandate                  → SEPA-Mandat Signing
```

### 3.3 Debug Routes

```
/debug                         → Debug-Übersicht
/debug/auth-test               → Auth-Test
/debug/admin-debug             → Admin-Debug
```

### 3.4 Identifizierte Routing-Probleme

#### Problem 1: Mehrere Dashboard-Routes

```
/dashboard → Allgemeines Dashboard (zeigt KPIs)
/admin/dashboard → Admin Dashboard (identisch?)
/trainer → Trainer Dashboard (existiert als Component, aber keine Route!)
```

**Empfehlung**: Ein dynamisches Dashboard, das sich an die Rolle anpasst.

#### Problem 2: Court-Booking vs Session-Booking

```
/courts → Court-Kalender (nur anzeigen?)
/courts/daily → Tägliche Übersicht
/bookings → Session-Buchungen
/my-bookings → Eigene Buchungen (warum getrennt von /bookings?)
```

**Empfehlung**: Vereinheitlichen zu `/bookings` mit Tabs (Courts | Sessions | Meine)

#### Problem 3: Fehlende Routes

```
/trainer → Existiert als Component, aber keine Page!
/admin/clubs/[clubId]/dashboard → Route existiert, wird aber nie verwendet
/progress → Wird in Quick-Actions verlinkt, existiert nicht!
```

### 3.5 Sidebar-Analyse (`components/layout/sidebar.tsx`)

#### ✅ Gut umgesetzt

- Klare Trennung: "Hauptmenü" vs "Administration"
- Rollenbasierte Anzeige mit Hierarchie-Check
- Conditional Rendering: `showIf` für granulare Kontrolle
- Active-State-Highlighting mit Gradient

#### 🔴 Probleme

**1. Doppelte Icons**:

```typescript
// Line 49-50
{ name: 'News', href: '/news', icon: Bell },
{ name: 'Benachrichtigungen', href: '/notifications', icon: Bell }, // Gleiche Icon!
```

**2. Fehlende Seiten**:

```typescript
// Line 53
{ name: 'Scheduler', href: '/scheduler', icon: Calendar }, // Route existiert nicht!
```

**3. Inkonsistente Benennung**:

- "Trainingszeiten" vs "Schedules" (Deutsch vs Englisch Mix)
- "Platz-Kalender" vs "Courts" vs "Platzverwaltung"

---

## 4. API-Architektur

### 4.1 API-Übersicht

**Gesamt Endpunkte**: ~100+  
**Mit Auth**: ~95%  
**Mit Rate Limit**: ~85%  
**Mit CSRF Protection**: ~1%  
**Mit Zod Validierung**: ~30%

### 4.2 Zentrale Auth-Middleware (`lib/api-auth.ts`)

```typescript
// Rollen-Hierarchie
const ROLE_HIERARCHY = {
  superadmin: 4,
  admin: 3,
  trainer: 2,
  member: 1,
};

// Hauptfunktionen
withApiAuth(request, handler); // Wrapper für authentifizierte Routen
requireAuth(request); // Extrahiert & validiert Session
verifyRole(auth, role); // Hierarchische Rollenprüfung
verifyClubAccess(auth, clubId); // Club-Zugriffsprüfung
buildAuthContext(user, supabase); // Baut AuthContext
```

#### AuthContext Struktur

```typescript
{
  user: User,
  session: Session,
  supabase: SupabaseClient,
  clubId: string,           // Effektiver Club
  selectedClubId?: string,  // Für Superadmin
  role: 'superadmin' | 'admin' | 'trainer' | 'member',
  roles: string[],
  memberships: Array<{club_id, role}>
}
```

### 4.3 API-Kategorien

#### Auth & User (5 Endpunkte)

```
POST   /api/auth/login              ❌ Keine Auth, ❌ Kein Rate Limit
GET    /api/user/me                 ✅ Auth: beliebig
GET    /api/user/club               ✅ Auth: member
GET    /api/user/member             ✅ Auth: member
GET    /api/user/roles              ✅ Auth: member, ⚠️ Demo Mode Bypass
```

#### Members (5 Endpunkte)

```
GET    /api/members                 ✅ Auth: beliebig, ⚠️ Keine Club-Filterung!
POST   /api/members                 ✅ Auth: trainer, ✅ CSRF
GET    /api/members/[id]            ✅ Auth: member, ✅ Authorization Check
PATCH  /api/members/[id]            ✅ Auth: trainer, 🔴 Ignoriert 'role' Parameter!
DELETE /api/members/[id]            ✅ Auth: admin, ⚠️ Hard Delete
POST   /api/members/invite          ✅ Auth: trainer
```

#### Sessions (3 Endpunkte)

```
GET    /api/sessions                ✅ Auth: member, ✅ Validierung
POST   /api/sessions                ✅ Auth: trainer, ⚠️ Keine Trainer-Validierung
PATCH  /api/sessions/[id]           ✅ Auth: admin OR trainer (eigene)
DELETE /api/sessions/[id]           ✅ Auth: admin OR trainer (eigene)
```

#### Bookings (4 Endpunkte)

```
GET    /api/bookings                ✅ Auth: member, ⚠️ Demo Mode
POST   /api/bookings                ✅ Auth: member, ⚠️ Keine Max-Participants-Check
PATCH  /api/bookings/[id]/status    ✅ Auth: trainer
POST   /api/bookings/[id]/cancel    ✅ Auth: member, ⚠️ Keine Frist-Prüfung
```

#### Billing (19 Endpunkte)

```
POST   /api/billing/invoices/create         ✅ Auth: trainer, ✅ Strict Rate Limit
GET    /api/billing/invoices/overview       ✅ Auth: trainer
POST   /api/billing/invoices/[id]/checkout  ✅ Auth: member (Stripe)
GET    /api/billing/open-items              ✅ Auth: trainer
POST   /api/billing/sepa-xml                ✅ Auth: admin
POST   /api/billing/sepa/pain008            ✅ Auth: admin (SEPA Lastschrift)
GET    /api/billing/trainers                ✅ Auth: admin
POST   /api/billing/trainers/[id]/pay       ✅ Auth: admin
```

#### Webhooks (3 Endpunkte)

```
POST   /api/webhooks/stripe         ❌ Keine Auth (Signature), ⚠️ Kein Rate Limit
POST   /api/webhooks/zapier         ❌ Keine Auth, 🔴 Keine Signature Validation
POST   /api/stripe/webhook          ❌ Keine Auth (Signature)
```

#### Admin (4 Endpunkte)

```
GET    /api/admin/tenants           ✅ Auth: superadmin ONLY, ⚠️ N+1 Problem
GET    /api/admin/billing/invoices  ✅ Auth: admin
GET    /api/admin/system/settings   ✅ Auth: admin
PUT    /api/admin/system/settings   ✅ Auth: admin
```

#### Courts & Court Types (7 Endpunkte)

```
GET    /api/courts                  ✅ Auth: member, ✅ Validierung
POST   /api/courts                  ✅ Auth: admin, ✅ Security Fix
GET    /api/courts/[id]             ✅ Auth: member
GET    /api/courts/[id]/schedule    ✅ Auth: member
GET    /api/court-types             ✅ Auth: member
POST   /api/court-types             ✅ Auth: admin
```

#### Clubs (3 Endpunkte)

```
GET    /api/clubs                   ✅ Auth: member, ⚠️ Alle Clubs sichtbar!
POST   /api/clubs                   ✅ Auth: superadmin ONLY, ✅ Audit Log
GET    /api/clubs/[id]              ✅ Auth: member, ⚠️ Kann fremde Clubs abrufen
```

#### Trainer Profiles (11 Endpunkte)

```
GET    /api/trainer-profiles        ✅ Auth: trainer, ✅ Club Filtering
POST   /api/trainer-profiles        ✅ Auth: trainer
GET    /api/trainer-profiles/[id]   ✅ Auth: trainer, ✅ Club Access Check
GET    /api/trainer/me              ✅ Auth: trainer (404 wenn kein Trainer)
```

#### Analytics & Statistics (9 Endpunkte)

```
GET    /api/analytics               ✅ Auth: admin
GET    /api/analytics/insights      ✅ Auth: admin (AI-generiert)
GET    /api/statistics              ✅ Auth: beliebig, ⚠️ Keine Club-Filterung
GET    /api/statistics/dashboard    ✅ Auth: trainer
GET    /api/dashboard/kpis          ✅ Auth: admin
```

#### Weitere Endpunkte (40+ weitere)

- Groups (6 Endpunkte) - CRUD + Member-Management
- Trial Trainings (9 Endpunkte) - inkl. Conversion & Stats
- Hours Logs (6 Endpunkte) - inkl. Approve/Reject
- Absences (6 Endpunkte) - inkl. Approve/Reject
- Attendance Records (3 Endpunkte)
- Payments (3 Endpunkte)
- SEPA Mandates (2 Endpunkte)
- Settings (12+ Endpunkte) - System, Branding, Fees, etc.
- Audit Logs (4 Endpunkte)
- Search & Schedule (2 Endpunkte)
- Security (3 Endpunkte) - CSRF, Health, Debug

### 4.4 Kritische API-Probleme

#### 🔴 SCHWERWIEGEND

1. **POST /api/auth/login** - Kein Rate Limit (Brute Force möglich)
2. **POST /api/webhooks/zapier** - Keine Signature Validation
3. **GET /api/members** - Keine Club-Filterung (alle Members sichtbar)
4. **PATCH /api/members/[id]** - Ignoriert 'role' Parameter (Rollenänderung funktioniert nicht!)
5. **GET /api/debug/auth** - Keine Auth, sollte nur in Development verfügbar sein

#### 🟡 MODERAT

6. **GET /api/statistics** - Keine Club-Filterung
7. **POST /api/bookings** - Keine Max-Participants-Validierung
8. **GET /api/admin/tenants** - N+1 Performance Problem
9. **Demo Mode Bypasses** - `/api/user/roles`, `/api/bookings` umgehen Auth

---

## 5. Datenbankschema

### 5.1 Haupttabellen

#### Benutzer & Rollen

```sql
users (
  id uuid PRIMARY KEY,
  email varchar(255) UNIQUE NOT NULL,
  full_name varchar(100),
  avatar_url text,
  created_at timestamp,
  updated_at timestamp
)

user_club_memberships (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  role varchar(20) DEFAULT 'member' NOT NULL,
  joined_at timestamp DEFAULT now(),
  is_active boolean DEFAULT true,
  tenant_id varchar(100),
  created_at timestamp DEFAULT now()
)
```

**Constraint**: `role IN ('member', 'trainer', 'admin', 'superadmin')`

#### Clubs & Struktur

```sql
clubs (
  id uuid PRIMARY KEY,
  name varchar(200) NOT NULL,
  max_members integer DEFAULT 500,
  opening_hours jsonb NOT NULL,
  status varchar(20) DEFAULT 'active',
  created_at timestamp,
  updated_at timestamp
)

courts (
  id uuid PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  surface varchar(20) DEFAULT 'hard',
  has_indoor boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp
)
```

#### Training & Sessions

```sql
schedules (
  id uuid PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  season_type varchar(20) NOT NULL,
  season_year integer NOT NULL,
  season_start_date timestamp NOT NULL,
  season_end_date timestamp NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp,
  updated_at timestamp
)

sessions (
  id uuid PRIMARY KEY,
  schedule_id uuid REFERENCES schedules(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES trainers(id),
  group_ids jsonb NOT NULL,
  week_number integer NOT NULL,
  timeslot_start timestamp NOT NULL,
  timeslot_end timestamp NOT NULL,
  court_id uuid REFERENCES courts(id),
  max_participants integer DEFAULT 10,
  notes text,
  created_at timestamp,
  updated_at timestamp
)

training_groups (
  id uuid PRIMARY KEY,
  schedule_id uuid REFERENCES schedules(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  level varchar(20) DEFAULT 'intermediate',
  age_group varchar(20) DEFAULT 'senior',
  is_active boolean DEFAULT true
)
```

#### Buchungen

```sql
bookings (
  id uuid PRIMARY KEY,
  club_id uuid REFERENCES clubs(id),
  member_id uuid NOT NULL,
  schedule_id uuid REFERENCES schedules(id),
  session_id uuid REFERENCES sessions(id),
  status varchar(20) DEFAULT 'pending',
  booked_at timestamp DEFAULT now(),
  cancelled_at timestamp,
  cancellation_reason varchar(50),
  cancellation_notes text
)
```

**Status**: `pending | confirmed | completed | cancelled | no_show`

#### Trainer

```sql
trainers (
  id uuid PRIMARY KEY,
  email varchar(255) UNIQUE NOT NULL,
  name varchar(100) NOT NULL,
  specialties jsonb DEFAULT '[]',
  max_hours_per_week integer DEFAULT 30,
  is_active boolean DEFAULT true,
  created_at timestamp,
  updated_at timestamp
)

trainer_club (
  trainer_id uuid REFERENCES trainers(id) ON DELETE CASCADE,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  created_at timestamp,
  PRIMARY KEY (trainer_id, club_id)
)
```

### 5.2 Row Level Security (RLS)

**Aktiviert auf allen Tabellen**:

```sql
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_club_memberships ENABLE ROW LEVEL SECURITY;
```

#### Beispiel-Policy: Club-Zugriff

```sql
CREATE POLICY "club_member_access" ON clubs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = clubs.id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );
```

#### Prinzip

- **Club-Isolation** via `user_club_memberships`
- Alle Queries gefiltert nach `club_id`
- **Superadmin**: Bypass via Service Role Key (Server-Side)

### 5.3 Indices

**Performance-kritische Indices**:

```sql
CREATE INDEX bookings_club_idx ON bookings(club_id);
CREATE INDEX bookings_member_idx ON bookings(member_id);
CREATE INDEX bookings_session_idx ON bookings(session_id);
CREATE INDEX bookings_status_idx ON bookings(status);
CREATE INDEX sessions_schedule_idx ON sessions(schedule_id);
CREATE INDEX sessions_trainer_idx ON sessions(trainer_id);
CREATE INDEX user_club_memberships_user_club_idx ON user_club_memberships(user_id, club_id);
```

### 5.4 Fehlende Constraints

#### 🔴 KRITISCH

1. **Keine Unique Constraint** auf `(member_id, session_id)` in `bookings` → Race Condition!
2. **Keine Check Constraint** für `max_participants >= 1` in `sessions`
3. **Keine Foreign Key** von `bookings.member_id` zu `users.id`

---

## 6. Authentifizierung & Autorisierung

### 6.1 Auth-Flow

```
User Login → Supabase Auth → JWT Token → Cookies
                 ↓
          user_club_memberships
                 ↓
         AuthContext (role, clubId)
                 ↓
           API/Page Access
```

### 6.2 Auth-Dateien

#### Server-Side Auth (Pages)

**Datei**: `lib/auth.ts`

```typescript
export async function requireAuth() {
  const supabase = createServerClient(...)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return { supabase, user }
}
```

#### API Auth

**Datei**: `lib/api-auth.ts`

```typescript
export async function withApiAuth(
  request: NextRequest,
  handler: (auth: AuthContext) => Promise<NextResponse>
) {
  const auth = await requireAuth(request);
  return handler(auth);
}

export function verifyRole(auth: AuthContext, requiredRole: UserRole): boolean {
  const hierarchy = { superadmin: 4, admin: 3, trainer: 2, member: 1 };
  return hierarchy[auth.role] >= hierarchy[requiredRole];
}

export function verifyClubAccess(auth: AuthContext, clubId: string): boolean {
  if (auth.role === 'superadmin') return true; // Bypass!
  return auth.clubId === clubId;
}
```

#### Client-Side Auth Guard

**Datei**: `components/layout/protected-route.tsx`

```typescript
export function ProtectedRoute({ children }) {
  const { data: user, isLoading } = useAuth()

  if (isLoading) return <LoadingSpinner />
  if (!user) redirect('/login')

  return <>{children}</>
}
```

### 6.3 Middleware

**Datei**: `middleware.ts`

```typescript
// ⚠️ Minimal - nur Locale-Cookie!
export function middleware(request: NextRequest) {
  const locale = request.cookies.get('locale') || 'de';
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**Problem**: Keine Auth-Checks in Middleware (Auth erfolgt in Layouts/Pages)

### 6.4 Sicherheits-Layer

1. **Middleware**: Minimal (nur Locale)
2. **Protected Layout**: Server-Side `requireAuth()` redirect
3. **Client Guard**: `<ProtectedRoute>` Component
4. **API Auth**: `withApiAuth()` + `verifyRole()` in jeder Route
5. **RLS Policies**: Datenbank-Level Security
6. **Club Isolation**: Via `user_club_memberships` + RLS
7. **CSRF Protection**: `withCSRFProtection()` (nur bei 1 Endpunkt!)
8. **Rate Limiting**: `withRateLimit()` (bei ~85% der Endpunkte)

### 6.5 Auth-Hooks (Client)

**Datei**: `hooks/use-user-data.ts`

```typescript
export function useUserRoles() {
  return useQuery({
    queryKey: ['user', 'roles'],
    queryFn: () => fetchJSON<{ roles: UserRole[] }>('/api/user/roles'),
  });
}

export function useHasRole(requiredRole: UserRole) {
  const { data: roles } = useUserRoles();
  const highestRole = roles.reduce((highest, role) =>
    ROLE_HIERARCHY[role] > ROLE_HIERARCHY[highest] ? role : highest
  );
  return ROLE_HIERARCHY[highestRole] >= ROLE_HIERARCHY[requiredRole];
}

// Convenience Hooks
export function useIsSuperadmin() {
  return useHasRole('superadmin');
}
export function useIsAdminOrAbove() {
  return useHasRole('admin');
}
export function useIsTrainerOrAbove() {
  return useHasRole('trainer');
}
```

---

## 7. Geschäftslogik & Business Rules

### 7.1 Mitglieder-Validierung

**Service**: `member.service.ts`

```typescript
// Validierungsregeln:
- Vorname: min 2 Zeichen
- Nachname: min 2 Zeichen
- Email: gültiges Format
- Telefon: min 5 Zeichen
- Geburtsdatum: gültiges Datum
- PLZ: exakt 5 Ziffern (deutsche PLZ)
- Mitgliedschaftsstart < Mitgliedschaftsende
```

**Problem**: Validierung nur in-memory, keine DB-Constraints.

### 7.2 Session-Buchungs-Regeln

**Service**: `booking.service.ts`, `schedule.service.ts`

```typescript
// Max Participants (Zod):
maxParticipants: z.coerce.number().int().min(1).max(50)

// Booking Rules (BookingRule):
{
  max_booking_duration_minutes: 90,
  min_booking_duration_minutes: 30,
  advance_booking_days: 7,           // 7 Tage im Voraus
  max_bookings_per_day: 2,
  max_bookings_per_week: 10,
  cancellation_hours: 24             // Stornierungsfrist
}
```

**Validierung**:

```typescript
async validateBookingRules(userId, clubId, startTime, endTime) {
  const durationMinutes = (end - start) / 60000

  if (durationMinutes > rule.max_booking_duration_minutes) {
    throw new Error('Maximale Buchungsdauer überschritten')
  }

  if (dayBookings.length >= rule.max_bookings_per_day) {
    throw new Error('Maximale Buchungen pro Tag erreicht')
  }

  if (weekBookings.length >= rule.max_bookings_per_week) {
    throw new Error('Maximale Buchungen pro Woche erreicht')
  }
}
```

### 7.3 Rechnungs-Berechnung

**Service**: `invoice.service.ts`

```typescript
// Automatische Berechnung:
const subtotal = items.reduce((sum, item) =>
  sum + item.quantity * item.unit_price, 0
)

const taxAmount = items.reduce((sum, item) => {
  const itemTotal = item.quantity * item.unit_price
  return sum + itemTotal * (item.tax_rate / 100)
}, 0)

const totalAmount = subtotal + taxAmount

// Limits:
- Max 100 Items pro Rechnung
- Max Quantity: 1000
- Max Unit Price: 1.000.000 EUR
- Max Tax Rate: 100%
- Description: max 500 Zeichen
```

### 7.4 Stornierungsregeln

**Domain Entity**: `src/domain/booking/booking.ts`

```typescript
public getCancellationPolicy(): {
  requiresApproval: boolean
  refundPercentage: number
  cancellationFee: number
} {
  const hours = this.getHoursUntilSession()

  if (hours > 24) {
    return {
      requiresApproval: false,
      refundPercentage: 100,
      cancellationFee: 0
    }
  } else if (hours > 2) {
    return {
      requiresApproval: true,
      refundPercentage: 50,
      cancellationFee: 5
    }
  } else {
    return {
      requiresApproval: false,
      refundPercentage: 0,
      cancellationFee: 10
    }
  }
}
```

**🔴 KRITISCHER BUG**:

```typescript
private getHoursUntilSession(): number {
  const now = new Date()
  // 🔴 BUG: bookedAt ist Buchungszeitpunkt, nicht Session-Start!
  return (this.bookedAt.getTime() - now.getTime()) / (1000 * 60 * 60)
}
// → Immer negativ → immer "weniger als 2h" → immer maximale Gebühr!
```

### 7.5 SEPA-Lastschrift

**Service**: `sepa.service.ts`, `pain008-generator.ts`

```typescript
// SEPA-Mandat:
{
  mandateReference: `SWINGZ-${club_id}-${Date.now()}`,
  creditorId: 'DE98ZZZ09999999999',
  iban: data.iban.replace(/\s/g, ''),
  status: 'active'
}

// SEPA XML (Pain.008):
- Nur Payments mit status='pending' und payment_method='sepa'
- Mandat muss status='active' haben
- Generiert XML nach ISO 20022 Standard
```

### 7.6 Mahnwesen

**Service**: `dunning.service.ts`

```typescript
// Automatische Mahngebühren:
calculateDunningFee(level: number): number {
  switch (level) {
    case 1: return 5.0   // 1. Mahnung: 5€
    case 2: return 10.0  // 2. Mahnung: 10€
    case 3: return 20.0  // 3. Mahnung: 20€
    default: return 0
  }
}

// Mahnfrist:
const dueDate = new Date()
dueDate.setDate(dueDate.getDate() + 14)  // +14 Tage
```

### 7.7 Workflows

#### Mitglieder-Onboarding

```
1. Admin-Einladung (POST /api/members/invite)
   ↓
2. User-Erstellung in Supabase Auth
   ↓
3. user_club_memberships Eintrag
   ↓
4. Email-Versand (Einladung + Login-Link)
   ↓
5. Audit-Log (member_invited)
```

**Problem**: Bei Fehler in Schritt 3 wird User gelöscht, aber Email nicht zurückgerufen.

#### Session-Buchung

```
1. Verfügbarkeitsprüfung (RPC validate_booking_availability)
   ↓
2. Doppelbuchungs-Check (existsByMemberAndSession)
   ↓  ⚠️ Race Condition Lücke hier!
3. Booking erstellen (status='pending')
   ↓
4. Bestätigungs-Email (async, catch errors)
```

**Problem**: Keine Transaktion, keine Max-Participants-Validierung.

#### Abrechnung-Workflow

```
1. Rechnung erstellen (status='draft')
   ↓
2. Rechnung versenden (status='sent', sent_at=now())
   ↓
3. SEPA-Lastschrift (getPendingSepaPayments → generateXML)
   ↓
4. Zahlung verarbeiten (status='completed', processed_at=now())
   ↓
5. Bei Überfälligkeit: Mahnwesen (processAutomaticDunning)
```

**Problem**: Keine Transaktionen, Invoice kann ohne Items existieren.

---

## 8. Kritische Sicherheitslücken

### 🔴 PRIORITÄT 1 - KRITISCH

#### 8.1 Fehlende Rollenänderungs-API

**Datei**: `app/api/members/[id]/route.ts:45`

**Problem**:

```typescript
// Frontend sendet:
{
  role: 'admin';
}

// Backend (PATCH):
const { firstName, lastName, email, phone } = await req.json();
// ❌ 'role' wird NICHT extrahiert!

// MemberService.updateMember() hat kein 'role' Feld
```

**Auswirkung**: Admins können Rollen NICHT ändern trotz UI.

**Fix**:

```typescript
// Neuer Endpoint: /api/admin/memberships/[id]/route.ts
export async function PATCH(req: NextRequest, { params }) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse();

    const { role, is_active } = await req.json();

    // Privilege Escalation Prevention
    if (role === 'superadmin' && auth.role !== 'superadmin') {
      return forbiddenResponse('Only superadmin can assign superadmin role');
    }

    const { data: old } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('id', params.id)
      .single();

    await supabase
      .from('user_club_memberships')
      .update({ role, is_active, updated_at: new Date() })
      .eq('id', params.id);

    await AuditService.logRoleChange(auth.user.id, params.id, old.role, role);

    return NextResponse.json({ success: true });
  });
}
```

---

#### 8.2 Email-basierte Superadmin-Detection

**Datei**: `lib/api-auth.ts:38`

**Problem**:

```typescript
if (memberships.length === 0) {
  const isSuperAdmin = user.email?.includes('superadmin');
  const isAdmin = user.email?.includes('admin');

  if (isSuperAdmin || isAdmin) {
    return {
      role: isSuperAdmin ? 'superadmin' : 'admin',
      memberships: [],
    };
  }
}
```

**Auswirkung**:

- `test-superadmin@example.com` würde durchgehen
- `mysuperadmin@gmail.com` würde durchgehen
- Umgeht gesamtes Membership-System

**Fix**: Komplett entfernen, stattdessen explizite Superadmin-Membership in DB.

---

#### 8.3 Race Condition bei Buchungen

**Datei**: `booking.use-cases.ts` (geschätzte Zeile 45-50)

**Problem**:

```typescript
const alreadyBooked = await existsByMemberAndSession(memberId, sessionId);
if (alreadyBooked) throw new DoubleBookingError();

// ⚠️ 50-100ms Lücke - anderer Request kann hier rein!

await bookingRepository.save(booking);
```

**Auswirkung**: Bei parallelen Requests können Doppelbuchungen entstehen.

**Fix**:

```typescript
// 1. Database Unique Constraint:
ALTER TABLE bookings ADD CONSTRAINT bookings_member_session_unique
  UNIQUE (member_id, session_id);

// 2. Supabase RPC mit Transaction:
CREATE OR REPLACE FUNCTION create_booking_safe(
  p_member_id uuid,
  p_session_id uuid,
  p_club_id uuid,
  p_schedule_id uuid
) RETURNS uuid AS $$
DECLARE
  v_booking_id uuid;
  v_current_count int;
  v_max_participants int;
BEGIN
  -- Lock row for update
  SELECT max_participants INTO v_max_participants
  FROM sessions WHERE id = p_session_id FOR UPDATE;

  -- Check current bookings
  SELECT COUNT(*) INTO v_current_count
  FROM bookings
  WHERE session_id = p_session_id AND status IN ('confirmed', 'pending');

  IF v_current_count >= v_max_participants THEN
    RAISE EXCEPTION 'Session full';
  END IF;

  INSERT INTO bookings (member_id, session_id, club_id, schedule_id, status)
  VALUES (p_member_id, p_session_id, p_club_id, p_schedule_id, 'pending')
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql;

// 3. In TypeScript:
const { data, error } = await supabase.rpc('create_booking_safe', {
  p_member_id: memberId,
  p_session_id: sessionId,
  p_club_id: clubId,
  p_schedule_id: scheduleId
})
```

---

#### 8.4 Fehlende Rate Limits

**Datei**: `app/api/auth/login/route.ts`

**Problem**:

```typescript
export async function POST(request: NextRequest) {
  // ❌ Kein Rate Limit!
  const { email, password } = await request.json();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // → Brute Force Angriffe möglich
}
```

**Fix**:

```typescript
import { withRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Add strict rate limiting (5 attempts per minute)
  const rateLimitResult = await withRateLimit(request, {
    max: 5,
    windowMs: 60000,
  });

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429 }
    );
  }

  // ... rest of login logic
}
```

**Weitere betroffene Endpunkte**:

- `/api/webhooks/stripe` - Kein Rate Limit
- `/api/webhooks/zapier` - Kein Rate Limit
- `/api/debug/auth` - Sollte in Production deaktiviert sein

---

#### 8.5 Keine CSRF-Protection

**Problem**: Nur `/api/members` POST hat CSRF-Check, alle anderen nicht.

**Betroffene Endpunkte** (Beispiele):

- `/api/sessions` POST
- `/api/bookings` POST
- `/api/billing/invoices/create` POST
- `/api/members/invite` POST
- `/api/clubs` POST

**Fix**: Global CSRF-Middleware

```typescript
// middleware.ts
import { verifyCsrfToken } from '@/lib/csrf';

export async function middleware(request: NextRequest) {
  const method = request.method;
  const isMutatingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  if (isMutatingMethod && !request.url.includes('/api/webhooks/')) {
    const csrfToken = request.headers.get('x-csrf-token');
    const isValid = await verifyCsrfToken(csrfToken, request);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }
  }

  return NextResponse.next();
}
```

---

#### 8.6 Stornierungsfrist-Bug

**Datei**: `src/domain/booking/booking.ts:174`

**Problem**:

```typescript
private getHoursUntilSession(): number {
  const now = new Date()
  // 🔴 BUG: bookedAt ist Buchungszeitpunkt, nicht Session-Start!
  return (this.bookedAt.getTime() - now.getTime()) / (1000 * 60 * 60)
}

// Wird aufgerufen von:
public getCancellationPolicy() {
  const hours = this.getHoursUntilSession()
  // hours ist immer negativ → immer "weniger als 2h"
  // → immer 0% Refund + 10€ Gebühr!
}
```

**Auswirkung**:

- Alle Stornierungen haben maximale Gebühr
- Customer Complaints garantiert
- Verletzt Verbraucherschutzgesetze

**Fix**:

```typescript
// booking.ts
export class Booking {
  private sessionStartTime: Date; // Neues Feld!

  constructor(
    // ... existing fields
    sessionStartTime: Date
  ) {
    this.sessionStartTime = sessionStartTime;
  }

  private getHoursUntilSession(): number {
    const now = new Date();
    return (this.sessionStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  }

  public cancel(reason: string, notes?: string): void {
    if (this.status === 'cancelled' || this.status === 'completed') {
      throw new Error(`Cannot cancel booking in status: ${this.status}`);
    }

    const policy = this.getCancellationPolicy();

    // Enforce policy
    if (policy.cancellationFee > 0) {
      // Create cancellation fee charge
      // ... fee logic
    }

    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.cancellationReason = reason;
    this.cancellationNotes = notes;
  }
}

// Beim Erstellen:
const session = await getSessionById(sessionId);
const booking = new Booking(
  // ... existing args
  session.timeslot_start // Pass session start time!
);
```

---

### 🟡 PRIORITÄT 2 - MODERAT

#### 8.7 Club-Isolation Lücken

**Datei**: `app/api/members/route.ts` (GET)

**Problem**:

```typescript
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // ❌ Keine Club-Filterung!
    const { data: members } = await supabase.from('users').select('*');
    // → User sieht ALLE Members aller Clubs!
  });
}
```

**Fix**:

```typescript
// Filter by club for non-superadmin
let query = supabase.from('users').select('*');

if (auth.role !== 'superadmin') {
  // Join with user_club_memberships to filter
  query = query.in(
    'id',
    supabase.from('user_club_memberships').select('user_id').eq('club_id', auth.clubId)
  );
}
```

**Weitere betroffene Endpunkte**:

- `/api/statistics` GET
- `/api/clubs` GET

---

#### 8.8 Fehlende Max-Participants-Validierung

**Datei**: `booking.service.ts` (createBooking)

**Problem**:

```typescript
async createBooking(data) {
  // ❌ Prüft NICHT, ob Session voll ist!
  const booking = await supabase
    .from('bookings')
    .insert({...})
}
```

**Fix** (siehe 8.3 für vollständige RPC-Lösung):

```typescript
async createBooking(data) {
  const session = await getSessionById(data.sessionId)

  const { count } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', data.sessionId)
    .in('status', ['confirmed', 'pending'])

  if (count >= session.max_participants) {
    throw new SessionFullError('Session is fully booked')
  }

  // ... create booking
}
```

---

#### 8.9 Webhook Signature Validation fehlt

**Datei**: `app/api/webhooks/zapier/route.ts:12`

**Problem**:

```typescript
export async function POST(request: NextRequest) {
  // In development, skip signature validation
  if (process.env.NODE_ENV !== 'production') {
    // Validate signature in production
  }
  // ❌ In Production KEINE Validation implementiert!
}
```

**Auswirkung**:

- Jeder kann Fake-Webhooks senden
- Kann Buchungen manipulieren
- Kann System-Events triggern

**Fix**:

```typescript
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-zapier-signature');

  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.ZAPIER_WEBHOOK_SECRET;
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  // ... process webhook
}
```

---

#### 8.10 Fehlende Transaktionen

**Datei**: `invoice.service.ts:123` (geschätzt)

**Problem**:

```typescript
async createInvoice(data) {
  // 1. Create invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .insert({...})
    .single()

  // 2. Create items
  const items = await Promise.all(
    data.items.map(item =>
      supabase.from('invoice_items').insert({
        invoice_id: invoice.id,
        ...item
      })
    )
  )
  // ❌ Bei Fehler: Invoice ohne Items in DB!
}
```

**Fix**:

```typescript
// Supabase RPC mit Transaction
CREATE OR REPLACE FUNCTION create_invoice_with_items(
  p_invoice jsonb,
  p_items jsonb
) RETURNS uuid AS $$
DECLARE
  v_invoice_id uuid;
  v_item jsonb;
BEGIN
  -- Insert invoice
  INSERT INTO invoices (club_id, member_id, due_date, notes, ...)
  SELECT * FROM jsonb_populate_record(null::invoices, p_invoice)
  RETURNING id INTO v_invoice_id;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO invoice_items (invoice_id, description, quantity, ...)
    SELECT v_invoice_id, * FROM jsonb_populate_record(null::invoice_items, v_item);
  END LOOP;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;

// In TypeScript:
const { data, error } = await supabase.rpc('create_invoice_with_items', {
  p_invoice: invoiceData,
  p_items: itemsData
})
```

---

### 🟢 PRIORITÄT 3 - NIEDRIG

#### 8.11 Audit Logging unvollständig

**Problem**: Viele kritische Operationen werden nicht geloggt.

**Nicht geloggt**:

- Member-Bearbeitungen (PATCH)
- Session-Erstellung
- Booking-Stornierungen
- Payment-Status-Änderungen
- Settings-Änderungen

**Nur geloggt**:

- Club-Erstellung/Änderung
- Member-Einladung
- Rollen-Änderungen (wenn implementiert)

**Fix**: Audit-Service erweitern

```typescript
// audit.service.ts
static async logMemberUpdate(actorId, memberId, changes, request?) {
  await this.log(actorId, 'member_updated', 'member', memberId, changes, request)
}

static async logSessionCreated(actorId, sessionId, data, request?) {
  await this.log(actorId, 'session_created', 'session', sessionId, data, request)
}

static async logBookingCancelled(actorId, bookingId, reason, request?) {
  await this.log(actorId, 'booking_cancelled', 'booking', bookingId, { reason }, request)
}
```

---

#### 8.12 Soft-Delete fehlt

**Datei**: `app/api/members/[id]/route.ts:78`

**Problem**:

```typescript
export async function DELETE(req: NextRequest, { params }) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');

    // ❌ Hard Delete!
    await supabase.from('users').delete().eq('id', params.id);
  });
}
```

**Auswirkung**:

- Daten unwiederbringlich verloren
- Historische Daten (Bookings, Payments) zeigen auf gelöschten User
- Audit-Trail unvollständig

**Fix**:

```typescript
export async function DELETE(req: NextRequest, { params }) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');

    // Soft Delete via is_active flag
    await supabase
      .from('user_club_memberships')
      .update({
        is_active: false,
        deactivated_at: new Date(),
        deactivated_by: auth.user.id,
      })
      .eq('user_id', params.id)
      .eq('club_id', auth.clubId);

    await AuditService.logMemberDeactivated(auth.user.id, params.id);

    return NextResponse.json({ success: true });
  });
}
```

---

## 9. UX-Defizite & Inkonsistenzen

### 9.1 Dashboard-Verwirrung

**Problem**: Drei verschiedene Dashboards ohne klare Trennung.

**Aktuell**:

- `/dashboard` → Allgemeines Dashboard (zeigt KPIs)
- `/admin/dashboard` → Admin Dashboard (ähnlich?)
- `/trainer` → Trainer Dashboard (existiert als Component, keine Route!)

**Empfehlung**: Ein Dashboard mit Role-spezifischen Sections.

```typescript
// app/(protected)/dashboard/page.tsx
export default async function DashboardPage() {
  const { user } = await requireAuth()
  const { role } = await getUserRole(user.id)

  return (
    <>
      <DashboardHeader user={user} role={role} />

      {role === 'member' && <MemberDashboard />}
      {role === 'trainer' && <TrainerDashboard />}
      {role === 'admin' && <AdminDashboard />}
      {role === 'superadmin' && <SuperadminDashboard />}
    </>
  )
}
```

---

### 9.2 Deutsch/Englisch-Mix

**Inkonsistenzen** in Navigation:

- "Trainingszeiten" (DE) vs "Schedules" (EN)
- "Platz-Kalender" (DE) vs "Courts" (EN)
- "Buchungen" (DE) vs "Bookings" (EN)
- "Abo & Rechnung" (DE) vs "Billing" (EN)

**Code** ist überwiegend Englisch (gut):

- `member.service.ts`, `booking.ts`, `invoice.ts`

**Empfehlung**:

- UI: Konsistent Deutsch
- Code: Konsistent Englisch
- API-Responses: Englisch
- Error-Messages: Deutsch

---

### 9.3 Fehlende Feedback-Messages

**Problem**: Viele Actions haben keine Success/Error-Toasts.

**Beispiele ohne Feedback**:

- Session erstellen
- Member einladen
- Rechnung bezahlen
- Court buchen
- Profil aktualisieren

**Fix**: Toast-System implementieren

```typescript
// hooks/use-toast.ts
import { toast } from 'sonner';

export function useSuccessToast() {
  return (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
    });
  };
}

// In Components:
const showSuccess = useSuccessToast();

const handleSubmit = async () => {
  await createSession(data);
  showSuccess('Session erfolgreich erstellt!');
};
```

---

### 9.4 Sidebar - Doppelte Icons

**Datei**: `components/layout/sidebar.tsx:49-50`

**Problem**:

```typescript
{ name: 'News', href: '/news', icon: Bell },
{ name: 'Benachrichtigungen', href: '/notifications', icon: Bell },
```

**Fix**:

```typescript
{ name: 'News', href: '/news', icon: Newspaper },
{ name: 'Benachrichtigungen', href: '/notifications', icon: Bell },
```

---

### 9.5 Fehlende Mobile-Optimierung

**Problem**: Sidebar ist nur für Desktop optimiert.

**Aktuell**:

```typescript
// sidebar.tsx:78-79
className={cn(
  'h-[calc(100vh-4rem)] w-64 border-r',
  open ? 'fixed inset-y-0 left-0 z-50 block' : 'hidden md:block'
)}
```

**Empfehlung**:

1. **Hamburger-Menu** für Mobile
2. **Bottom-Navigation** für wichtigste Links
3. **Swipe-Gestures** zum Öffnen/Schließen

---

### 9.6 Unklare Court vs Session Buchung

**Problem**: Zwei getrennte Systeme.

**Aktuell**:

- `/courts` → Court-Kalender anzeigen
- `/bookings` → Session-Buchungen

**User-Verwirrung**:

- "Buche ich einen Platz oder eine Session?"
- "Was ist der Unterschied?"

**Empfehlung**: Vereinheitlichen

```
/bookings
  ├─ Tab: Trainings (Sessions mit Trainer)
  ├─ Tab: Platzreservierung (Courts ohne Trainer)
  └─ Tab: Meine Buchungen
```

---

### 9.7 Fehlende Loading-States

**Problem**: Viele Buttons haben keinen Loading-State während API-Calls.

**Beispiel**:

```typescript
// Aktuell:
<Button onClick={handleSubmit}>Speichern</Button>

// Besser:
<Button
  onClick={handleSubmit}
  disabled={isLoading}
>
  {isLoading ? <Spinner /> : 'Speichern'}
</Button>
```

---

### 9.8 Keine Empty States

**Problem**: Leere Listen zeigen nur "Keine Daten" ohne Call-to-Action.

**Beispiel** (`admin/members/page.tsx`):

```typescript
// Aktuell:
{members.length === 0 && <p>Keine Mitglieder</p>}

// Besser:
{members.length === 0 && (
  <EmptyState
    icon={Users}
    title="Noch keine Mitglieder"
    description="Lade dein erstes Mitglied ein, um loszulegen."
    action={
      <Button onClick={() => router.push('/admin/members/invite')}>
        Mitglied einladen
      </Button>
    }
  />
)}
```

---

## 10. Optimierungsempfehlungen

### 🚀 SOFORT (Woche 1-2) - Kritische Fixes

#### 1. Rollenänderungs-Endpoint implementieren

**Datei**: `app/api/admin/memberships/[id]/route.ts` (neu erstellen)  
**Aufwand**: 2 Stunden  
**Priorität**: 🔴 Kritisch

```typescript
// Siehe Abschnitt 8.1 für vollständigen Code
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // Implementierung mit Privilege Escalation Prevention
}
```

---

#### 2. Email-Superadmin-Detection entfernen

**Datei**: `lib/api-auth.ts:38`  
**Aufwand**: 30 Minuten  
**Priorität**: 🔴 Kritisch

```typescript
// ENTFERNEN:
if (memberships.length === 0) {
  const isSuperAdmin = user.email?.includes('superadmin');
  // ...
}

// ERSETZEN durch:
if (memberships.length === 0) {
  throw new UnauthorizedError('No active club membership found');
}
```

---

#### 3. Stornierungsfrist-Bug fixen

**Datei**: `src/domain/booking/booking.ts:174`  
**Aufwand**: 1 Stunde  
**Priorität**: 🔴 Kritisch

```typescript
// Siehe Abschnitt 8.6 für vollständigen Fix
private getHoursUntilSession(): number {
  const now = new Date()
  return (this.sessionStartTime.getTime() - now.getTime()) / (1000 * 60 * 60)
}
```

---

#### 4. Rate Limiting für Login

**Datei**: `app/api/auth/login/route.ts`  
**Aufwand**: 30 Minuten  
**Priorität**: 🔴 Kritisch

```typescript
import { withRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimitResult = await withRateLimit(request, { max: 5, windowMs: 60000 });
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }
  // ... rest
}
```

---

#### 5. Debug-Endpoint in Production deaktivieren

**Datei**: `app/api/debug/auth/route.ts:3`  
**Aufwand**: 10 Minuten  
**Priorität**: 🔴 Kritisch

```typescript
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  // ... debug logic
}
```

---

### 📊 KURZFRISTIG (Woche 3-6) - Wichtige Verbesserungen

#### 6. Database Unique Constraint für Buchungen

**Datei**: `supabase/migrations/xxx_booking_constraints.sql` (neu)  
**Aufwand**: 1 Stunde  
**Priorität**: 🔴 Kritisch

```sql
-- Prevent double bookings
ALTER TABLE bookings
  ADD CONSTRAINT bookings_member_session_unique
  UNIQUE (member_id, session_id);

-- Prevent overbooking (via trigger)
CREATE OR REPLACE FUNCTION check_session_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_current_count int;
  v_max_participants int;
BEGIN
  SELECT max_participants INTO v_max_participants
  FROM sessions WHERE id = NEW.session_id;

  SELECT COUNT(*) INTO v_current_count
  FROM bookings
  WHERE session_id = NEW.session_id
    AND status IN ('confirmed', 'pending');

  IF v_current_count >= v_max_participants THEN
    RAISE EXCEPTION 'Session is fully booked';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_booking_capacity
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_session_capacity();
```

---

#### 7. Max-Participants-Validierung

**Datei**: `booking.service.ts:45` oder RPC (siehe 8.3)  
**Aufwand**: 2 Stunden  
**Priorität**: 🟡 Moderat

---

#### 8. CSRF-Protection global

**Datei**: `middleware.ts`  
**Aufwand**: 3 Stunden  
**Priorität**: 🟡 Moderat

```typescript
// Siehe Abschnitt 8.5 für vollständigen Code
export async function middleware(request: NextRequest) {
  // Global CSRF check für alle mutating methods
}
```

---

#### 9. Club-Isolation-Filter

**Dateien**: `app/api/members/route.ts`, `app/api/statistics/route.ts`  
**Aufwand**: 2 Stunden  
**Priorität**: 🟡 Moderat

```typescript
// Siehe Abschnitt 8.7
if (auth.role !== 'superadmin') {
  query = query.eq('club_id', auth.clubId);
}
```

---

#### 10. Soft-Delete für Members

**Datei**: `app/api/members/[id]/route.ts:78`  
**Aufwand**: 1 Stunde  
**Priorität**: 🟡 Moderat

```typescript
// Siehe Abschnitt 8.12
// Update is_active statt DELETE
```

---

#### 11. Invoice-Transaktionen

**Datei**: `invoice.service.ts:123` + Supabase RPC  
**Aufwand**: 3 Stunden  
**Priorität**: 🟡 Moderat

```typescript
// Siehe Abschnitt 8.10
// Supabase RPC create_invoice_with_items()
```

---

### 🎯 MITTELFRISTIG (Monat 2-3) - Feature-Verbesserungen

#### 12. State Machine für Status

**Datei**: `lib/state-machines/invoice-state-machine.ts` (neu)  
**Aufwand**: 4 Stunden  
**Priorität**: 🟢 Niedrig

```typescript
const INVOICE_TRANSITIONS = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  overdue: ['paid', 'dunning', 'cancelled'],
  dunning: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[from]?.includes(to) ?? false;
}
```

---

#### 13. Audit Logging erweitern

**Datei**: `audit.service.ts`  
**Aufwand**: 2 Stunden  
**Priorität**: 🟢 Niedrig

```typescript
// Siehe Abschnitt 8.11
// Neue Methoden für alle CRUD-Operationen
```

---

#### 14. Webhook Signature Validation

**Datei**: `app/api/webhooks/zapier/route.ts:12`  
**Aufwand**: 1 Stunde  
**Priorität**: 🟡 Moderat

```typescript
// Siehe Abschnitt 8.9
// HMAC SHA-256 Signature Verification
```

---

#### 15. Frontend-Validierung

**Dateien**: Alle Form-Components  
**Aufwand**: 8 Stunden  
**Priorität**: 🟢 Niedrig

```typescript
// React Hook Form + Zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createMemberSchema } from '@/lib/schemas';

const form = useForm({
  resolver: zodResolver(createMemberSchema),
});
```

---

#### 16. Mobile-Optimierung

**Datei**: `components/layout/sidebar.tsx`  
**Aufwand**: 6 Stunden  
**Priorität**: 🟢 Niedrig

- Hamburger-Menu
- Bottom-Navigation
- Swipe-Gestures

---

#### 17. Bulk-Operationen

**Dateien**: Diverse API-Endpunkte  
**Aufwand**: 8 Stunden  
**Priorität**: 🟢 Niedrig

```typescript
// Beispiel: Bulk Member Delete
POST /api/members/bulk-deactivate
Body: { memberIds: uuid[] }
```

---

### 🌟 LANGFRISTIG (Monat 4-6) - Architektur-Verbesserungen

#### 18. Dynamic Dashboard

**Datei**: `app/(protected)/dashboard/page.tsx`  
**Aufwand**: 12 Stunden  
**Priorität**: 🟢 Niedrig

Ein Dashboard für alle Rollen mit dynamischen Sections.

---

#### 19. Court + Session Booking vereinheitlichen

**Dateien**: Mehrere  
**Aufwand**: 16 Stunden  
**Priorität**: 🟢 Niedrig

```
/bookings mit Tabs:
- Trainings (Sessions)
- Platzreservierung (Courts)
- Meine Buchungen
```

---

#### 20. Feedback-System

**Dateien**: Neue Feature  
**Aufwand**: 20 Stunden  
**Priorität**: 🟢 Niedrig

Member können Trainer nach Training bewerten.

---

#### 21. Email-Kampagnen

**Dateien**: Neue Feature  
**Aufwand**: 16 Stunden  
**Priorität**: 🟢 Niedrig

Automatische Erinnerungen, Newsletter, etc.

---

#### 22. Progressive Web App

**Dateien**: Service Worker, Manifest  
**Aufwand**: 12 Stunden  
**Priorität**: 🟢 Niedrig

Offline-Fähigkeit, Push-Notifications.

---

#### 23. Internationalisierung

**Dateien**: i18n-Setup  
**Aufwand**: 20 Stunden  
**Priorität**: 🟢 Niedrig

Multi-Language-Support (DE, EN, FR).

---

## 11. Roadmap

### Phase 1 - Bugfixes (2 Wochen)

**Ziel**: Production-Ready  
**Aufwand**: ~40 Stunden

**Tasks**:

1. ✅ Rollenänderungs-Endpoint (2h)
2. ✅ Email-Superadmin-Detection entfernen (0.5h)
3. ✅ Stornierungsfrist-Bug fixen (1h)
4. ✅ Rate Limiting Login (0.5h)
5. ✅ Debug-Endpoint deaktivieren (0.5h)
6. ✅ Database Constraints (1h)
7. ✅ Max-Participants-Validierung (2h)
8. ✅ CSRF-Protection global (3h)
9. ✅ Club-Isolation-Filter (2h)
10. ✅ Soft-Delete (1h)
11. ✅ Invoice-Transaktionen (3h)

**Ergebnis**:

- Keine kritischen Bugs mehr
- Grundlegende Security etabliert
- System produktiv nutzbar

---

### Phase 2 - Feature-Vervollständigung (4 Wochen)

**Ziel**: Feature-Complete  
**Aufwand**: ~80 Stunden

**Tasks**: 12. ✅ State Machine für Status (4h) 13. ✅ Audit Logging erweitern (2h) 14. ✅ Webhook Signature Validation (1h) 15. ✅ Frontend-Validierung (8h) 16. ✅ Toast-System (4h) 17. ✅ Empty States (4h) 18. ✅ Loading States (4h) 19. ✅ Error Boundaries (4h) 20. ✅ Testing-Setup (8h)

**Ergebnis**:

- Alle Features vollständig implementiert
- Gute UX mit Feedback-Messages
- Robuste Error-Handling

---

### Phase 3 - UX-Optimierung (4 Wochen)

**Ziel**: User-Friendly  
**Aufwand**: ~100 Stunden

**Tasks**: 21. ✅ Mobile-Optimierung (6h) 22. ✅ Dynamic Dashboard (12h) 23. ✅ Court/Session Booking vereinheitlichen (16h) 24. ✅ Bulk-Operationen (8h) 25. ✅ Search & Filtering verbessern (8h) 26. ✅ Keyboard-Shortcuts (4h) 27. ✅ Accessibility (8h) 28. ✅ Performance-Optimierung (8h)

**Ergebnis**:

- Intuitive Benutzeroberfläche
- Mobile-First Design
- Schnelle Performance

---

### Phase 4 - Skalierung (2 Monate)

**Ziel**: Enterprise-Ready  
**Aufwand**: ~160 Stunden

**Tasks**: 29. ✅ Feedback-System (20h) 30. ✅ Email-Kampagnen (16h) 31. ✅ Progressive Web App (12h) 32. ✅ Internationalisierung (20h) 33. ✅ Advanced Analytics (16h) 34. ✅ Reporting-System (16h) 35. ✅ API-Dokumentation (8h) 36. ✅ Admin-Panel v2 (20h)

**Ergebnis**:

- Enterprise-Grade Features
- Multi-Language-Support
- Umfassende Analytics

---

### Reifegrad-Progression

```
Aktuell:  ⭐⭐☆☆☆ (2/5) - Early Beta
Phase 1:  ⭐⭐⭐☆☆ (3/5) - Production-Ready
Phase 2:  ⭐⭐⭐⭐☆ (4/5) - Feature-Complete
Phase 3:  ⭐⭐⭐⭐☆ (4/5) - User-Friendly
Phase 4:  ⭐⭐⭐⭐⭐ (5/5) - Enterprise-Ready
```

---

## 12. Zusammenfassung

### ✅ Stärken

1. **Solide Architektur** mit Domain-Driven Design
2. **Hierarchisches Rollensystem** funktioniert gut
3. **Multi-Tenancy** mit Row Level Security
4. **TypeScript + Zod** für Type-Safety
5. **API-Struktur** gut organisiert (100+ Endpunkte)
6. **Klare Trennung** Frontend/Backend
7. **Moderne Tech-Stack** (Next.js 14, Supabase)

### ❌ Schwächen

1. **Kritische Bugs** in Kernlogik (Booking-Stornierung)
2. **Sicherheitslücken** (Race Conditions, fehlende Auth-Checks)
3. **Inkonsistente UX** (3 Dashboards, Sprachen-Mix)
4. **Fehlende Features** (Rollenänderung, Soft-Delete)
5. **Performance-Probleme** (N+1 Queries)
6. **Unvollständige Validierung** (Frontend/Backend)
7. **Fehlende Transaktionen** bei kritischen Operationen

### 📊 Bewertung

| Kategorie     | Score | Kommentar                                  |
| ------------- | ----- | ------------------------------------------ |
| Architektur   | 8/10  | Gut strukturiert, DDD-Ansätze              |
| Sicherheit    | 5/10  | Mehrere kritische Lücken                   |
| Performance   | 6/10  | N+1 Probleme, fehlende Indices             |
| UX/UI         | 6/10  | Inkonsistenzen, fehlende Feedback-Messages |
| Code-Qualität | 7/10  | TypeScript, aber inkonsistent              |
| Testing       | 2/10  | Kaum Tests vorhanden                       |
| Dokumentation | 3/10  | Minimal, keine API-Docs                    |

**Gesamtscore**: **7/10** (Early Beta, aber vielversprechend)

### 🎯 Nächste Schritte

**Priorität 1 (Diese Woche)**:

1. Stornierungsfrist-Bug fixen
2. Rollenänderungs-Endpoint implementieren
3. Email-Superadmin-Detection entfernen
4. Rate Limiting für Login
5. Debug-Endpoint deaktivieren

**Priorität 2 (Nächste 2 Wochen)**: 6. Database Constraints 7. CSRF-Protection global 8. Club-Isolation härten 9. Soft-Delete implementieren 10. Invoice-Transaktionen

**Nach Phase 1 (4 Wochen)**: System ist **Production-Ready** ✅

---

## 13. Anhang

### A. Wichtige Dateien

#### Authentifizierung & Autorisierung

- `lib/auth.ts` - Server-Side Auth (Pages)
- `lib/api-auth.ts` - API Auth + Role Verification
- `middleware.ts` - Minimal Middleware (Locale)
- `components/layout/protected-route.tsx` - Client Auth Guard
- `hooks/use-user-data.ts` - Client-Side User Hooks

#### Navigation

- `components/layout/sidebar.tsx` - Sidebar mit Rollen-basiertem Menu
- `components/layout/header.tsx` - Header mit User-Menu
- `app/(protected)/protected-client-layout.tsx` - Layout-Wrapper

#### Datenbank

- `supabase/complete_migration.sql` - Vollständiges Schema
- `supabase/migrations/001_rls_policies.sql` - RLS Policies

#### API Routes (Wichtigste)

- `app/api/user/roles/route.ts` - User Roles fetchen
- `app/api/admin/tenants/route.ts` - Tenant-Übersicht
- `app/api/members/route.ts` - Member CRUD
- `app/api/sessions/route.ts` - Sessions CRUD
- `app/api/billing/invoices/create/route.ts` - Rechnungserstellung

#### Domain Entities

- `src/domain/booking/booking.ts` - Booking Entity
- `src/domain/member/member.ts` - Member Entity
- `src/domain/invoice/invoice.ts` - Invoice Entity

#### Services

- `lib/booking/booking.service.ts` - Buchungs-Logik
- `lib/billing/invoice.service.ts` - Rechnungs-Logik
- `lib/sepa/sepa.service.ts` - SEPA-Lastschrift

---

### B. Testdaten

**Test-Credentials**:

```
admin@swingz.com / AdminPass123!
superadmin@swingz.com / AdminPass123!
```

**Datenbank**:

- 3 Clubs: Badminton Hamburg, Squash Munich, Tennis Berlin
- Club IDs: `3cebf2ad-f41f-4c1d-949d-29cfe8bcb7a7` (Tennis Berlin)

---

### C. Kontakt & Support

**Dokumentation**: Diese Datei  
**Erstellungsdatum**: 2026-05-05  
**Letzte Aktualisierung**: 2026-05-05  
**Version**: 1.0

---

**Ende der Analyse**
