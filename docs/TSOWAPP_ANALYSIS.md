# TSOWAPP - Vollständige Projektanalyse

**Analysiert am:** 2026-05-06  
**Projekt:** TSOW App - Multi-Tenant Tennisclub-Management-Plattform  
**Ziel:** Verbesserungsmöglichkeiten für SwingZ identifizieren

---

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Projekt-Struktur](#2-projekt-struktur)
3. [Technologie-Stack](#3-technologie-stack)
4. [Hauptfunktionen & Features](#4-hauptfunktionen--features)
5. [Workflow-Implementierungen](#5-workflow-implementierungen)
6. [State Management](#6-state-management)
7. [API & Backend Integration](#7-api--backend-integration)
8. [Datenmodelle & Schema](#8-datenmodelle--schema)
9. [Business Logic & Services](#9-business-logic--services)
10. [Navigation & Routing](#10-navigation--routing)
11. [Sicherheit & Performance](#11-sicherheit--performance)
12. [Testing](#12-testing)
13. [Deployment & Infrastruktur](#13-deployment--infrastruktur)
14. [Stärken & Schwächen](#14-stärken--schwächen)
15. [Verbesserungsvorschläge für SwingZ](#15-verbesserungsvorschläge-für-swingz)

---

## 1. PROJEKTÜBERSICHT

**TSOW App** ist eine vollständige **Multi-Tenant Tennisclub-Management-Plattform** mit KI-gestützter Trainingsplanung, Platzbuchung und Mitgliederverwaltung.

### Monorepo-Struktur (Turborepo)

```
tsowapp/
├── apps/web/              # Haupt-Next.js-Anwendung
├── supabase/              # DB Migrations, Edge Functions
├── docs/                  # Dokumentation
└── packages/              # Shared Packages (potentiell)
```

### Projekt-Statistiken

| Metrik              | Wert                  |
| ------------------- | --------------------- |
| **Gesamtgröße**     | 2.3 GB                |
| **Apps**            | 1 (web)               |
| **Total Pages**     | ~128                  |
| **Admin Pages**     | 60                    |
| **Member Pages**    | 21                    |
| **Trainer Pages**   | 19                    |
| **API Routes**      | 15+                   |
| **Dependencies**    | 73 (production + dev) |
| **SQL Migrationen** | 27                    |
| **Edge Functions**  | 4                     |
| **Supabase Tables** | 20+                   |
| **Skills Docs**     | 45+                   |

---

## 2. PROJEKT-STRUKTUR

### Root-Level

```
tsowapp/
├── package.json                 # Root workspace config
├── turbo.json                   # Turborepo tasks
├── PROJECT_ANALYSIS.md          # Umfassende Projektdokumentation
├── BLACKBOX.md                  # Blackbox AI Dokumentation
├── README.md                    # Minimal README
├── .env.example                 # Environment Template
├── fix-rls.js                   # Hilfsskripte für RLS-Policies
└── check-*.sql                  # SQL Debugging-Skripte
```

### apps/web/ (Hauptanwendung)

```
apps/web/
├── app/                         # Next.js App Router
│   ├── admin/                   # Admin Dashboard (60 pages)
│   ├── member/                  # Member App (21 pages)
│   ├── trainer/                 # Trainer Dashboard (19 pages)
│   ├── superadmin/              # Superadmin Interface
│   ├── api/                     # API Routes
│   │   ├── webhooks/stripe/     # Stripe Webhooks
│   │   ├── admin/               # Admin APIs
│   │   ├── member/              # Member APIs
│   │   ├── schedule/            # KI-Scheduling
│   │   └── auth/                # Auth Endpoints
│   ├── actions/                 # Server Actions
│   ├── auth/                    # Auth Pages
│   ├── login/
│   ├── register/
│   ├── onboarding/
│   └── globals.css              # Tailwind + Custom Styles
├── components/                  # React Components
│   ├── ui/                      # shadcn/ui components
│   └── ...                      # Business components
├── lib/                         # Utility Libraries
│   ├── auth.ts                  # Auth Helpers
│   ├── admin-club.ts            # Multi-tenant Logic
│   ├── supabase/                # Supabase Clients
│   ├── rate-limit.ts            # Rate Limiting
│   ├── ai.ts                    # Anthropic Integration
│   ├── caching.ts               # Cache Strategies
│   └── format.ts                # Formatierung
├── hooks/                       # Custom React Hooks
├── i18n/                        # Internationalisierung
├── messages/                    # i18n Messages (de, en)
├── emails/                      # React Email Templates
├── tests/                       # Playwright E2E Tests
├── supabase/                    # Local Supabase Config
└── public/                      # Static Assets
```

### Supabase Integration

```
supabase/
├── config.toml                  # Supabase Projekt-Konfiguration
│   ├── project_id: tsow-app
│   ├── API Port: 54321
│   ├── DB Port: 54322
│   ├── Studio Port: 54323
│   └── PostgreSQL 17
├── migrations/                  # 27 SQL Migrationen
├── functions/                   # 4 Edge Functions (Deno)
│   ├── create-membership-invoices/
│   ├── generate-sepa-xml/
│   ├── send-reminders/
│   └── invite-member/
├── snippets/                    # SQL Snippets
└── seed_test_users.sql          # Test-Daten
```

### Dokumentation

```
docs/
├── skills/                      # 20+ Skills
│   ├── playwright-pro/          # E2E Testing Patterns
│   ├── a11y-audit/              # Accessibility
│   ├── database-designer/       # DB Design Patterns
│   ├── senior-fullstack/        # Architecture Patterns
│   └── monorepo-navigator/      # Monorepo Best Practices
└── superpowers/
    ├── plans/                   # Projekt-Pläne
    └── specs/                   # Design-Spezifikationen

.qwen/
├── skills/                      # 25+ AI-Agent Skills
└── agents/                      # 17 Specialized Agents
```

---

## 3. TECHNOLOGIE-STACK

### Frontend

```
Framework:       Next.js 16.2.4 (App Router, React Server Components)
UI-Framework:    shadcn/ui (base-nova style)
Styling:         Tailwind CSS 3.4.1 + CSS Variables
UI-Components:   @base-ui/react, lucide-react
Charting:        recharts 3.8.0
i18n:            next-intl 4.9.1 (de, en)
Email:           react-email + @react-email/components
State:           React 18.3.1 (Server/Client Components)
```

### Backend & Services

```
Database:        PostgreSQL (via Supabase)
Auth:            Supabase Auth (@supabase/ssr, @supabase/supabase-js)
Edge Functions:  Supabase Functions (Deno)
Storage:         Supabase Storage
Realtime:        Supabase Realtime
API:             Next.js API Routes + Server Actions
```

### Integrations

```
KI:              Anthropic Claude API (@anthropic-ai/sdk) - claude-sonnet-4-5
Payment:         Stripe 22.0.2 (Checkout, SEPA, Webhooks)
Rate Limiting:   @upstash/ratelimit + @upstash/redis
Monitoring:      Sentry (@sentry/nextjs 10.49.0)
Validation:      Zod 4.3.6
Environment:     @t3-oss/env-nextjs
```

### Developer Tools

```
TypeScript:      5.x (strict mode)
Linting:         ESLint 9.39.4 + typescript-eslint
Testing:         Vitest 4.1.3 (Unit), Playwright 1.59.1 (E2E)
Git Hooks:       Husky 9.1.7 + lint-staged
Build Tool:      Turborepo (latest)
```

---

## 4. HAUPTFUNKTIONEN & FEATURES

### A) Admin Dashboard (`/admin/*` - 58 Pages)

**Kern-Features:**

- **Dashboard:** Übersicht mit Statistiken (Mitglieder, Plätze, Buchungen, Rechnungen)
- **Mitgliederverwaltung:** CRUD für Mitglieder, Trainer, Familien-Links
- **Platzverwaltung:** Courts, Booking Rules, Buchungskalender
- **Trainingsmanagement:**
  - Trainingsgruppen erstellen/verwalten
  - **KI-Trainingsplan Generator** (Kernfeature)
  - Saisonplanung mit Feiertagen (Bundesländer-spezifisch)
- **Finanzen:**
  - Rechnungserstellung
  - SEPA-Export
  - Mahnwesen
  - Beitragsarten
- **Kommunikation:** News, Nachrichten, Events, Galerie
- **Statistiken & KI-Analyse:** Dashboard Insights, Performance-Reports
- **Einstellungen:** Club-Setup, Buchungsregeln, Trainer-Verfügbarkeit

**Workflow-Beispiel: KI-Trainingsplanung**

1. Admin öffnet `/admin/schedule`
2. Konfiguriert Saison (Start/Ende, Bundesland für Feiertage)
3. System ruft `/api/schedule/generate` auf:
   - Fetcht Mitglieder, Trainer, Plätze, Verfügbarkeiten
   - Algorithmus (`lib/scheduling/group-formation.ts`) bildet Gruppen
   - KI-Analyse via Claude API gibt Feedback zum Plan
4. Review-Screen mit Drag & Drop zum Anpassen
5. Speichern erstellt `season_plans` + `training_groups` + `training_sessions`

### B) Member App (`/member/*` - 39 Pages)

**Kern-Features:**

- **Dashboard:** Persönliche Übersicht (nächstes Training, Buchungen, Rechnungen)
- **Platzbuchung:**
  - Einzelbuchung
  - Serienbuchung
  - Buchungsregeln (max. pro Woche/Tag, Vorlaufzeit)
- **Training:** Trainingsplan, Anwesenheit, Trainer-Slots buchen
- **Profil:** Persönliche Daten, Präferenzen (Wunschzeiten, Partner)
- **Finanzen:** Rechnungen einsehen, Status
- **Kommunikation:** News, Nachrichten, Events, Galerie
- **Sonstiges:** Partner finden, Rangliste, Taktik-Tipps, Notfallkontakte

**Workflow-Beispiel: Platzbuchung**

1. Mitglied öffnet `/member/book`
2. Wählt Datum und Court
3. System prüft Verfügbarkeit und Buchungsregeln
4. Buchung wird als `confirmed` gespeichert
5. Optional: Stornierung innerhalb Frist

### C) Trainer Dashboard (`/trainer/*` - 29 Pages)

**Kern-Features:**

- **Dashboard:** Nächste Sessions, Gruppenzuordnung, Stunden
- **Gruppen:** Eigene Trainingsgruppen verwalten
- **Sessions:** Sessions planen, Anwesenheit erfassen
- **Verfügbarkeit:** Wöchentliche Zeitslots definieren
- **Abwesenheiten:** Vertretungen organisieren
- **Stundennachweise:** Abrechnung, Rechnungen
- **Nachrichten:** Kommunikation mit Admins/Mitgliedern

### D) Superadmin Portal (`/superadmin/*`)

**Kern-Features:**

- Club-Verwaltung (Multi-Tenant Management)
- Benutzer-Übersicht (alle Clubs)
- Plattform-Statistiken
- Finanzen (plattformweit)

---

## 5. WORKFLOW-IMPLEMENTIERUNGEN

### Authentication & Authorization Flow

```
┌─────────────────────────────────────────────────────┐
│  1. User Login (Magic Link / Password)             │
│     → Supabase Auth (auth.users)                   │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  2. Cookie-basiertes Session Management             │
│     → HTTP-only Cookies:                            │
│       • sb-access-token                             │
│       • sb-refresh-token                            │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  3. Server-Side Auth Check                          │
│     → lib/auth.ts: requireAuth()                    │
│     → Liest JWT aus Cookie                          │
│     → Validiert via Supabase                        │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  4. Role-Based Access (RLS + App Logic)             │
│     → Query: club_memberships.role                  │
│     → Roles: superadmin, admin, trainer,            │
│               member, parent, guest                 │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  5. Club Selection (Multi-Tenant)                   │
│     → lib/admin-club.ts: getAdminClubId()           │
│     → Cookie: admin_club_id                         │
│     → Superadmin kann Club wechseln                 │
└─────────────────────────────────────────────────────┘
```

### Multi-Tenant Architecture

- **Isolation:** Jede Tabelle hat `club_id` Spalte
- **RLS Policies:** Row Level Security filtert automatisch nach `club_id`
- **Zugriff:** User kann in mehreren Clubs mit verschiedenen Rollen sein
- **Superadmin:** Sieht alle Clubs, wählt aktiven Club via Cookie

### KI-Integration Workflow

```typescript
// API Route: /api/schedule/generate
1. Fetch Planning Data
   → fetchPlanningData() sammelt:
     • Mitglieder (mit Präferenzen)
     • Trainer (mit Verfügbarkeiten)
     • Courts
     • Feiertage (bundeslandspezifisch)

2. Group Formation Algorithm
   → formGroups() bildet Gruppen:
     • Constraint-basiert (Präferenzen, Konflikte)
     • Iterativ über mehrere Runden
     • Max-Größen: Kids 6, Adults 3

3. AI Analysis (optional)
   → generateAIAnalysis() ruft Claude API:
     • Prompt mit Plan-Summary
     • System Prompt: "Tennisschul-Planer"
     • Feedback zu Gruppengrößen, Verteilung
     • Cache-optimiert (Prompt Caching)

4. Return Result
   → Plan + Stats + AI-Explanation
```

---

## 6. STATE MANAGEMENT

### Ansätze

**Server State:**

- **Next.js Server Components** als primäre Strategie
- **Caching:** `lib/caching.ts` mit `unstable_cache`
  - Static: 1h (Clubs, Courts)
  - Semi-Static: 5min (Stats, Counts)
  - Dynamic: 1min (Bookings, Sessions)
  - Realtime: 0s (Messages, Invoices)
- **Supabase Admin Client** für gecachte Queries

**Client State:**

- **useState/useReducer** für lokale UI-State
- **Custom Hooks:**
  - `useAdminClubId()` - Client-seitiger Club-Context
  - `useSchedulePlan()` - Drag & Drop State
- **URL Search Params** für Filter/Pagination
- **Keine globale State Library** (Redux/Zustand)

### Datenfluss-Muster

```
┌─────────────────────────────────────────┐
│  Server Component (Page)                │
│  → Fetcht Daten via Supabase            │
│  → Nutzt Caching                        │
│  → Übergibt als Props                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Client Component (Interactive)          │
│  → Erhält Initial Data als Props        │
│  → Mutations via Server Actions          │
│  → Optimistic Updates (teilweise)        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Server Action                           │
│  → Validiert Input (Zod)                │
│  → Mutiert DB                            │
│  → Invalidiert Cache (revalidatePath)   │
│  → Redirect/Response                     │
└─────────────────────────────────────────┘
```

---

## 7. API & BACKEND INTEGRATION

### Supabase Integration

**Client-Typen:**

1. **Server Client** (`lib/supabase/server.ts`)
   - Für Server Components/Actions
   - Cookie-basiert, RLS aktiv

2. **Browser Client** (`lib/supabase/client.ts`)
   - Für Client Components
   - Cookie-basiert, RLS aktiv

3. **Admin Client** (`lib/caching.ts`)
   - Für gecachte Queries
   - Service Role Key, umgeht RLS

### API Routes (`/api/*`)

**Wichtige Endpoints:**

- `/api/auth/login` - Login Handler
- `/api/auth/logout` - Logout Handler
- `/api/schedule/generate` - KI-Trainingsplan generieren
- `/api/schedule/save` - Trainingsplan speichern
- `/api/stripe/checkout` - Stripe Payment Session
- `/api/stripe/payment` - Payment Intent
- `/api/webhooks/stripe` - Stripe Webhooks
- `/api/admin/ai-insights` - KI-Analyse für Club-Daten
- `/api/invite` - Mitglied einladen

**Rate Limiting:**

```typescript
// lib/rate-limit.ts
- Auth: 10 req/min
- API: 100 req/min
- Stripe: 50 req/min
- Schedule Generation: 5 req/min (Claude API Kosten-Schutz)
```

### Supabase Edge Functions

```
functions/
├── invite-member/              # Magic Link versenden
├── create-membership-invoices/ # Beitragsrechnungen
├── generate-sepa-xml/          # SEPA-Lastschriften
└── send-reminders/             # Mahnungen
```

---

## 8. DATENMODELLE & SCHEMA

### Kerntabellen

```sql
-- Multi-Tenant Root
clubs (id, name, slug, city, active, ...)

-- Auth & Users
users (id → auth.users.id, email, first_name, ...)

-- Business Entities
persons (id, club_id, first_name, last_name, email,
         member_number, is_minor, has_app_access, ...)

-- Rollen & Zugriff
club_memberships (
  user_id → users.id,
  club_id → clubs.id,
  person_id → persons.id,
  role ENUM('superadmin','admin','trainer','member','parent','guest'),
  status ENUM('pending','active','suspended','left')
)

-- Plätze & Buchungen
courts (id, club_id, name, surface, indoor, active, ...)
booking_rules (id, club_id, role, max_per_week, max_days_ahead, ...)
bookings (id, club_id, court_id, person_id, start_time, end_time, status)

-- Training
training_groups (id, club_id, name, trainer_id, max_participants, ...)
training_sessions (id, club_id, training_group_id, start_time, status)
training_attendance (session_id, person_id, status)
season_plans (id, club_id, name, start_date, end_date, weekly_plan JSON, ai_explanation)

-- Trainer-Verwaltung
trainer_assignments (user_id, club_id, hourly_rate, ...)
trainer_availability (user_id, weekday, from_time, until_time)
trainer_slots (id, trainer_id, day_of_week, start_time, max_bookings)

-- Präferenzen
member_schedule_preferences (
  person_id, preferred_days INT[], avoid_days INT[],
  preferred_time_from, preferred_time_to,
  preferred_partner_ids, avoid_partner_ids,
  training_frequency
)

-- Finanzen
invoices (id, club_id, person_id, amount, status, due_date, ...)
fee_types (id, club_id, name, amount, billing_interval)

-- Kommunikation
messages (id, club_id, sender_id, recipient_id, subject, body, read)
news_posts (id, club_id, title, body, published, pinned)
club_events (id, club_id, title, start_date, end_date, location, ...)
gallery_albums (id, club_id, title, cover_url, event_date)
gallery_photos (id, album_id, url, caption)

-- Familie
family_links (parent_user_id, child_user_id, club_id, relation)
```

### RLS (Row Level Security)

**Muster:**

```sql
-- Beispiel: Clubs sichtbar für Mitglieder
CREATE POLICY "clubs_select_member" ON clubs
  FOR SELECT USING (
    id IN (
      SELECT club_id FROM club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Beispiel: Buchungen nur eigene sichtbar
CREATE POLICY "bookings_select_own" ON bookings
  FOR SELECT USING (
    person_id IN (
      SELECT person_id FROM club_memberships
      WHERE user_id = auth.uid()
    )
  );
```

---

## 9. BUSINESS LOGIC & SERVICES

### Scheduling Algorithm (`lib/scheduling/group-formation.ts`)

**Kernlogik:**

```typescript
function formGroups(members: Member[], availSlots: AvailSlot[]) {
  // 1. Separiere Kinder/Erwachsene
  const kidsMembers = members.filter((m) => m.is_minor);
  const adultMembers = members.filter((m) => !m.is_minor);

  // 2. Iteriere über Runden (bis alle Trainingsfrequenzen erfüllt)
  for (let round = 0; round < MAX_ROUNDS; round++) {
    // 3. Für jeden Slot versuche Gruppe zu bilden
    for (const slot of availSlots) {
      // Filter Mitglieder die:
      // - noch Training brauchen (training_frequency nicht erreicht)
      // - Slot passt (preferred_days, avoid_days, time_window)
      // Prüfe Kompatibilität:
      // - avoid_partner_ids nicht in Gruppe
      // Erstelle Gruppe wenn:
      // - Kids: min 2, max 6
      // - Adults: min 1, max 3
      // Markiere Slot als belegt
      // Inkrementiere member_assign_count
    }
  }

  return { plan, stats };
}
```

**Besonderheiten:**

- **Constraint-basiert:** Präferenzen werden hart respektiert
- **Mehrfach-Training:** Mitglieder können mehrere Gruppen haben
- **Trainer-Verfügbarkeit:** Nur Slots wo Trainer verfügbar ist
- **Platzverfügbarkeit:** Kein Slot-Konflikt

### AI Services (`lib/ai.ts`)

**Claude Integration:**

```typescript
export function getAIClient() {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

// Prompt Caching für wiederkehrende System-Prompts
export const CLUB_ANALYSIS_SYSTEM_PROMPT = `
  Du bist ein erfahrener Tennis-Club-Manager...
`;

// API Call mit Cache Control
const message = await client.messages.create({
  model: 'claude-sonnet-4-5',
  system: [
    {
      type: 'text',
      text: SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
  ],
  messages: [{ role: 'user', content: userPrompt }],
});
```

**Anwendungsfälle:**

1. **Trainingsplan-Analyse:** Feedback zu Gruppengrößen, Verteilung
2. **Club-Insights:** Analysen zu Mitgliedern, Auslastung, Trends
3. **Taktik-Tipps:** Personalisierte Trainingstipps

### Payment Integration (Stripe)

**Workflow:**

```
1. Admin erstellt Rechnung → invoices.status = 'open'
2. Mitglied klickt "Bezahlen" → /api/stripe/checkout
3. Stripe Session erstellt mit Metadata: { invoice_id, club_id }
4. User zahlt bei Stripe
5. Webhook: /api/webhooks/stripe
   → Event: checkout.session.completed
   → Update: invoices.status = 'paid'
6. Optional: SEPA-Lastschrift via Edge Function
```

---

## 10. NAVIGATION & ROUTING

### Multi-Rollen-basierte Navigation

Das Projekt implementiert ein **rollenbasiertes Multi-Tenant-System** mit vier Hauptrollen:

#### A) Superadmin Navigation (`/app/superadmin/layout.tsx`)

- Flat navigation structure
- Navigations-Items:
  - Dashboard (`/superadmin`)
  - Vereine (`/superadmin/clubs`)
  - Nutzer & Trainer (`/superadmin/users`)
  - Finanzen (`/superadmin/finances`)
  - Statistiken (`/superadmin/stats`)
- **Club-Switcher**: Kann zwischen Vereinen wechseln
- Desktop-Sidebar-Layout

#### B) Admin Navigation (`/app/admin/layout.tsx`)

**Gruppierte Navigation** mit 6 Kategorien:

1. **MITGLIEDER:** Dashboard, Mitglieder, Anträge, Trainer
2. **TRAINING:** Trainingsgruppen, KI-Trainingsplan, Saisonen
3. **PLÄTZE:** Plätze & Buchungen
4. **KOMMUNIKATION:** News
5. **KI & ANALYSE:** KI-Analyse, Statistiken
6. **VERWALTUNG:** Finanzen, Trainer-Stunden, Einstellungen

- **26+ Haupt-Routen** unter `/admin/*`
- Desktop-Sidebar mit Club-Logo

#### C) Member Navigation (`/app/member/layout.tsx`)

- **Mobile-First Bottom Tab Navigation**
- 5 Haupttabs: Home, Training, Buchen, Nachrichten, Profil
- **Sticky Header** mit Club-Name
- **Floating Action Button** für Wunsch-Eintragung
- **Banner-Benachrichtigungen** für aktive Saisonplanungen
- Max-width: 2xl (mobile-optimiert)

#### D) Trainer Navigation (`/app/trainer/layout.tsx`)

- **Mobile-First Bottom Tab Navigation**
- 5 Haupttabs: Übersicht, Einheiten, Anwesenheit, Abrechnung, Profil
- Sticky Header
- Max-width: 3xl

### Route-Hierarchie

```
/                           # Landing Page
├── /login                  # Auth
├── /register
├── /dashboard              # Role-Router (weiterleitet)
│
├── /superadmin/            # Superadmin-Bereich
│   ├── /clubs/
│   ├── /users/
│   ├── /finances/
│   └── /stats/
│
├── /admin/                 # Admin-Bereich (26+ Routes)
│   ├── /members/
│   ├── /trainers/
│   ├── /training/
│   ├── /schedule/
│   ├── /courts/
│   ├── /news/
│   └── /finances/
│
├── /member/                # Member-Bereich (18+ Routes)
│   ├── /book/
│   ├── /training/
│   ├── /messages/
│   └── /profile/
│
├── /trainer/               # Trainer-Bereich (15+ Routes)
│   ├── /sessions/
│   ├── /groups/
│   └── /attendance/
│
└── /api/                   # API Routes
```

### Layout-basierte Route Guards

Jedes Rollen-Layout implementiert Guards:

```typescript
// Beispiel: /admin/layout.tsx
const user = await getUserFromCookies();
if (!user) redirect('/login');

const adminMemberships = memberships?.filter((m) => m.role === 'admin' || m.role === 'superadmin');

if (adminMemberships.length === 0) {
  // Redirect zu anderen Rollen
  if (roles.includes('trainer')) redirect('/trainer');
  if (roles.includes('member')) redirect('/member');
  redirect('/login');
}
```

### User-Flow zwischen Screens

#### Onboarding Flow

```
/register → /login → /dashboard → [role-check] →
  ├─ /admin → /onboarding (wenn setup nicht abgeschlossen)
  ├─ /admin (wenn Setup abgeschlossen)
  ├─ /member
  ├─ /trainer
  └─ /superadmin
```

#### Booking Flow

```
Member: /member → /member/book
       ↓
       Select Court & Time
       ↓
       /member/book/confirm?court=X&date=Y&time=Z
       ↓
       Bestätigung
       ↓
       /member/bookings (Übersicht)
```

#### Training Schedule Flow

```
Admin: /admin/schedule → KI-Plan erstellen
       ↓
       /admin/schedule/seasons → Saison aktivieren
       ↓
Member: Banner "Wünsche eintragen"
       ↓
       /member/preferences → Wunschzeiten eingeben
       ↓
Admin: KI generiert Gruppen
       ↓
Member: /member/training → Gruppe sichtbar
```

### Navigation-Komponenten

**Sidebar Component** (`/components/ui/Sidebar.tsx`)

- Client-Side Component
- Unterstützt Flat und Grouped Items
- Active-State-Detection via `usePathname()`
- Club-Logo/Avatar
- Badge-Support
- Logout-Button

**Layout-Patterns:**

Desktop (Admin/Superadmin):

```tsx
<div className="flex min-h-screen">
  <Sidebar groups={NAV} clubName={club} />
  <main className="flex-1 overflow-auto">{children}</main>
</div>
```

Mobile (Member/Trainer):

```tsx
<div className="min-h-screen">
  <header className="sticky top-0">...</header>
  {activePlanBanner && <Banner />}
  <main className="max-w-2xl mx-auto pb-24">{children}</main>
  <nav className="fixed bottom-0">{/* Tab Navigation */}</nav>
</div>
```

---

## 11. SICHERHEIT & PERFORMANCE

### Sicherheit

**Maßnahmen:**

- ✅ HTTP-only Cookies (kein localStorage)
- ✅ Row Level Security (RLS) auf allen Tabellen
- ✅ Rate Limiting (Upstash Redis + Memory Fallback)
- ✅ CSRF-Schutz via Next.js
- ✅ Input-Validierung (Zod in API Routes)
- ✅ Service Role Key nur in Edge Functions/Admin Client
- ✅ CSP Headers (Content Security Policy)

### Performance-Optimierungen

**Implementiert:**

- ✅ Server Components als Standard
- ✅ Parallel Data Fetching (`Promise.all`)
- ✅ Caching mit `unstable_cache` (Next.js 15)
- ✅ Database Indexes auf foreign keys
- ✅ Pagination (Limit/Offset)
- ✅ Image Optimization (next/image)

**TODO:**

- ⚠️ Viele Client Components könnten Server Components sein
- ⚠️ DataTable: Client-side only, keine Server-Pagination
- ⚠️ Streaming SSR mit Suspense Boundaries
- ⚠️ Optimistic Updates fehlen größtenteils
- ⚠️ React Query/SWR für besseres Client-Caching

---

## 12. TESTING

### Unit Tests (Vitest)

- `tests/format.test.ts` - Formatierungs-Utilities
- `tests/rate-limit.test.ts` - Rate Limiting Logik
- `tests/scheduling.test.ts` - Gruppen-Bildungs-Algorithmus
- `tests/ui-components.test.tsx` - UI-Komponenten
- `tests/utils.test.ts` - Helper Functions

### E2E Tests (Playwright)

- `tests/e2e/auth.spec.ts` - Login/Logout Flow
- `tests/e2e/admin.spec.ts` - Admin Dashboard
- `tests/e2e/member.spec.ts` - Member App
- `tests/e2e/trainer.spec.ts` - Trainer Dashboard

**Test-Konfiguration:**

- Sequential Execution (1 Worker)
- Test-Logins in `TEST-LOGINS.md`

---

## 13. DEPLOYMENT & INFRASTRUKTUR

### Hosting

**Hosting:** Vercel (vermutlich)

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=

# Upstash Redis (optional)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Sentry
SENTRY_DSN=
```

### Build

```bash
npm run build      # Turborepo build
npm run dev        # Development
npm run test       # Vitest
npm run test:e2e   # Playwright
```

---

## 14. STÄRKEN & SCHWÄCHEN

### ✅ Stärken

1. **Vollständiges Feature-Set:** Admin, Member, Trainer, Superadmin alle implementiert
2. **Multi-Tenant:** Saubere Isolation via `club_id` + RLS
3. **KI-Integration:** Echter Mehrwert durch Claude-gestützte Planung
4. **Moderne Stack:** Next.js 16 App Router, TypeScript, Supabase
5. **Sicherheit:** Row Level Security, Rate Limiting, httpOnly Cookies
6. **Testing:** Unit + E2E Tests vorhanden
7. **i18n:** Mehrsprachigkeit (de, en) vorbereitet
8. **Mobile-First:** Responsive Design mit Bottom Nav
9. **Umfangreiche Dokumentation:** 45+ Skill Docs
10. **Server Components:** Bewusster Einsatz für Performance

### ⚠️ Schwächen / Verbesserungspotential

1. **Performance:**
   - Zu viele Client Components (125 von 181)
   - Keine Server-Pagination in DataTables
   - Cache-Invalidierung noch nicht optimal

2. **Code-Qualität:**
   - ~200 ESLint Warnings
   - Mehrere 300+ Zeilen Files
   - Inkonsistente Patterns (User vs. Person)

3. **UX:**
   - Setup-Wizard triggert zu oft
   - Einige Broken Links in Navigation
   - Fehlende Error Boundaries

4. **Dokumentation:**
   - Komponenten nicht dokumentiert
   - API-Dokumentation fehlt

5. **Testing:**
   - Coverage nicht vollständig
   - E2E Tests laufen sequential (langsam)

---

## 15. VERBESSERUNGSVORSCHLÄGE FÜR SWINGZ

### 🎯 Priorität 1: Navigation & UX

#### 1. Mobile-First Bottom Navigation implementieren

**Was TSOWAPP gut macht:**

- Member/Trainer App nutzt Bottom Tab Navigation (5 Tabs)
- Sticky Header mit Club-Kontext
- Floating Action Button für Hauptaktionen
- Banner für wichtige Benachrichtigungen

**Für SwingZ:**

```tsx
// Implementierung einer Member Bottom Navigation
<BottomNav>
  <Tab href="/member" icon="Home" label="Home" />
  <Tab href="/member/training" icon="Calendar" label="Training" />
  <Tab href="/member/book" icon="Court" label="Buchen" />
  <Tab href="/member/messages" icon="Mail" badge={unreadCount} />
  <Tab href="/member/profile" icon="User" label="Profil" />
</BottomNav>
```

**Vorteile:**

- Bessere Mobile UX
- Thumb-friendly Navigation
- Konsistent mit modernen Apps

#### 2. Gruppierte Sidebar-Navigation für Admin

**Was TSOWAPP gut macht:**

- Navigation in logische Gruppen (Mitglieder, Training, Plätze, etc.)
- Reduziert cognitive load
- Bessere Übersichtlichkeit bei vielen Routen

**Für SwingZ:**

```tsx
const NAV_GROUPS = [
  {
    label: 'MITGLIEDER',
    items: [
      { href: '/admin', label: 'Dashboard' },
      { href: '/admin/members', label: 'Mitglieder' },
      { href: '/admin/trainers', label: 'Trainer' },
    ],
  },
  {
    label: 'TRAINING & PLÄTZE',
    items: [
      { href: '/admin/training', label: 'Trainingsgruppen' },
      { href: '/admin/courts', label: 'Plätze' },
    ],
  },
  // ...
];
```

#### 3. Club-Switcher für Multi-Tenant

**Was TSOWAPP gut macht:**

- Cookie-basierter Club-Context (`admin_club_id`)
- Superadmin kann Clubs wechseln ohne Re-Login
- Klare visuelle Indication des aktiven Clubs

**Für SwingZ:**

```tsx
// lib/admin-club.ts
export async function getAdminClubId() {
  const cookieStore = cookies();
  return cookieStore.get('admin_club_id')?.value;
}

export async function setAdminClubId(clubId: string) {
  cookies().set('admin_club_id', clubId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
}
```

### 🎯 Priorität 2: State Management & Caching

#### 4. Strukturiertes Caching-System

**Was TSOWAPP gut macht:**

- Zentrale Caching-Funktion in `lib/caching.ts`
- Differenzierte Cache-Strategien nach Datentyp:
  - Static: 1h (Clubs, Courts)
  - Semi-Static: 5min (Stats)
  - Dynamic: 1min (Bookings)
  - Realtime: 0s (Messages)

**Für SwingZ:**

```typescript
// lib/caching.ts
import { unstable_cache } from 'next/cache';

export const getCachedClubStats = unstable_cache(
  async (clubId: string) => {
    const supabase = createAdminClient();
    // ... query
    return stats;
  },
  ['club-stats'],
  { revalidate: 300, tags: ['stats'] }
);

export const getCachedCourts = unstable_cache(
  async (clubId: string) => {
    // ... query
    return courts;
  },
  ['courts'],
  { revalidate: 3600, tags: ['courts'] }
);
```

**Vorteile:**

- Reduzierte DB-Last
- Schnellere Seitenladezeiten
- Einfache Cache-Invalidierung via Tags

#### 5. Server Components wo möglich

**Was TSOWAPP gut macht:**

- Bewusster Einsatz von Server Components
- Client Components nur wo nötig (Interaktivität)

**Für SwingZ:**

- Dashboard-Seiten als Server Components
- Listen/Tabellen als Server Components mit Server-Pagination
- Client Components nur für Formulare, Modals, Interaktive UI

### 🎯 Priorität 3: Multi-Tenant Architektur

#### 6. Row Level Security (RLS) konsequent nutzen

**Was TSOWAPP gut macht:**

- Alle Tabellen haben RLS Policies
- Automatische Filterung nach `club_id`
- Keine manuelle WHERE-Clause in Queries nötig

**Für SwingZ:**

```sql
-- Beispiel: Buchungen nur für eigenen Club
CREATE POLICY "bookings_select_own_club" ON bookings
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Beispiel: Admin kann alle Mitglieder sehen
CREATE POLICY "members_select_admin" ON persons
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_memberships
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
  );
```

#### 7. Klare Trennung: Person vs. User

**Was TSOWAPP gut macht:**

- `users` Tabelle nur für Auth (verknüpft mit auth.users)
- `persons` Tabelle für Business-Logik (Mitglieder, Trainer)
- `club_memberships` als Junction-Table mit Rolle

**Schema:**

```
users (id, email, created_at)
  ↓
club_memberships (user_id, club_id, person_id, role, status)
  ↓
persons (id, club_id, first_name, last_name, member_number, ...)
```

**Vorteile:**

- User kann mehrere Clubs haben
- Person kann mehrere Rollen haben
- Saubere Multi-Tenant-Trennung

### 🎯 Priorität 4: Features & Business Logic

#### 8. KI-Trainingsplanung

**Was TSOWAPP gut macht:**

- Constraint-basierter Algorithmus
- Berücksichtigt Präferenzen, Verfügbarkeiten, Konflikte
- KI-Analyse via Claude API für Feedback

**Für SwingZ:**

- Algorithmus-Logik übernehmen
- Member können Präferenzen eingeben:
  - Wunschtage (Mo-So)
  - Vermeiden-Tage
  - Zeitfenster (von-bis)
  - Wunschpartner / Vermeiden-Partner
  - Trainingsfrequenz (1x, 2x, 3x pro Woche)
- Admin kann Plan generieren und anpassen (Drag & Drop)

#### 9. Serienbuchungen

**Was TSOWAPP gut macht:**

- Mitglieder können wiederkehrende Buchungen erstellen
- Wöchentlich, mehrere Wochen
- Automatische Konflikt-Prüfung

**Für SwingZ:**

```typescript
interface SeriesBooking {
  courtId: string;
  startDate: Date;
  endDate: Date;
  weekday: number;
  startTime: string;
  duration: number;
  recurrence: 'weekly' | 'biweekly';
}

// API: /api/bookings/series
// Erstellt automatisch einzelne Buchungen
```

#### 10. Buchungsregeln

**Was TSOWAPP gut macht:**

- Flexibles Regelwerk pro Rolle:
  - Max. Buchungen pro Woche/Tag
  - Max. Vorlaufzeit (z.B. 7 Tage)
  - Min. Vorlaufzeit (z.B. 2 Stunden)
  - Stornierungsfrist

**Für SwingZ:**

```typescript
interface BookingRule {
  role: 'admin' | 'trainer' | 'member' | 'guest';
  maxPerWeek: number;
  maxPerDay: number;
  maxDaysAhead: number;
  minHoursAhead: number;
  cancellationHoursBefore: number;
}
```

#### 11. Trainer-Verfügbarkeit

**Was TSOWAPP gut macht:**

- Trainer definieren wöchentliche Zeitslots
- System prüft automatisch bei Planung
- Separate Abwesenheiten/Vertretungen

**Für SwingZ:**

```typescript
interface TrainerAvailability {
  trainerId: string;
  weekday: number; // 0-6 (Mo-So)
  fromTime: string; // "08:00"
  untilTime: string; // "12:00"
  active: boolean;
}

interface TrainerAbsence {
  trainerId: string;
  fromDate: Date;
  toDate: Date;
  reason?: string;
  substituteId?: string;
}
```

### 🎯 Priorität 5: Finanzen & Payment

#### 12. Stripe Integration

**Was TSOWAPP gut macht:**

- Checkout-Flow für Rechnungen
- SEPA-Lastschrift Support
- Webhook-Integration für Zahlungsstatus
- Mahnwesen

**Für SwingZ:**

```typescript
// API: /api/stripe/checkout
export async function createCheckoutSession(invoiceId: string) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'sepa_debit'],
    line_items: [{ price_data: {...}, quantity: 1 }],
    metadata: { invoice_id: invoiceId, club_id: clubId },
    success_url: `${baseUrl}/member/invoices?success=true`,
    cancel_url: `${baseUrl}/member/invoices?canceled=true`
  })
  return session.url
}

// Webhook: /api/webhooks/stripe
if (event.type === 'checkout.session.completed') {
  const { invoice_id } = session.metadata
  await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: new Date() })
    .eq('id', invoice_id)
}
```

#### 13. Beitragsarten & automatische Rechnungen

**Was TSOWAPP gut macht:**

- Fee-Types definieren (Monatsbeitrag, Jahresmitgliedschaft, etc.)
- Automatische Rechnungserstellung via Edge Function
- Cron-Job für wiederkehrende Beiträge

**Für SwingZ:**

```typescript
interface FeeType {
  id: string;
  clubId: string;
  name: string;
  amount: number;
  billingInterval: 'monthly' | 'quarterly' | 'yearly' | 'once';
  autoInvoice: boolean;
}

// Edge Function: create-membership-invoices
// Läuft monatlich, erstellt Rechnungen für alle Mitglieder
```

### 🎯 Priorität 6: Kommunikation

#### 14. Internes Nachrichtensystem

**Was TSOWAPP gut macht:**

- Nachrichten zwischen Admin-Mitglied, Trainer-Mitglied
- Unread-Count mit Badge in Navigation
- Realtime-Updates via Supabase

**Für SwingZ:**

```typescript
interface Message {
  id: string;
  clubId: string;
  senderId: string;
  recipientId: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

// Component: LiveMessageCount.tsx
const { data, error } = useRealtime(
  'messages',
  `club_id=eq.${clubId} AND recipient_id=eq.${userId} AND read=eq.false`
);
```

#### 15. News & Events

**Was TSOWAPP gut macht:**

- News-Posts mit Pinning-Option
- Events mit Datum, Ort, Beschreibung
- Galerie mit Alben & Fotos

**Für SwingZ:**

- News-Feed auf Member Dashboard
- Event-Kalender
- Foto-Galerie für Veranstaltungen

### 🎯 Priorität 7: Developer Experience

#### 16. Umfangreiche Skills-Dokumentation

**Was TSOWAPP gut macht:**

- 45+ Skill-Docs für verschiedene Bereiche
- Pattern-Library (Playwright, TDD, Architecture)
- AI-Agent-Skills für konsistente Entwicklung

**Für SwingZ:**

- Dokumentation von Komponenten
- API-Dokumentation
- Architecture Decision Records (ADRs)

#### 17. Testing-Setup

**Was TSOWAPP gut macht:**

- Vitest für Unit-Tests
- Playwright für E2E-Tests
- Test-Logins dokumentiert

**Für SwingZ:**

- Erweiterte Test-Coverage
- CI/CD mit automatischen Tests
- Visual Regression Tests (Playwright)

### 🎯 Priorität 8: Performance

#### 18. Image Optimization

**Was TSOWAPP gut macht:**

- next/image für alle Bilder
- Supabase Storage für Uploads
- Optimierte Formate (WebP)

#### 19. Bundle Optimization

**Was TSOWAPP gut macht:**

- Optimized Imports (lucide-react, recharts)
- Code-Splitting
- Tree-Shaking

### 🎯 Quick Wins (sofort umsetzbar)

1. **Bottom Navigation für Member App** (1-2 Tage)
2. **Gruppierte Sidebar für Admin** (1 Tag)
3. **Caching-System einführen** (2-3 Tage)
4. **Rate Limiting für kritische Endpoints** (1 Tag)
5. **Buchungsregeln erweitern** (2 Tage)
6. **Trainer-Verfügbarkeit** (3 Tage)
7. **Internes Nachrichtensystem** (3-4 Tage)
8. **Server Components Migration** (1-2 Wochen)

### 🎯 Mittelfristig (1-4 Wochen)

1. **KI-Trainingsplanung** (2-3 Wochen)
2. **Stripe Integration** (1-2 Wochen)
3. **Multi-Tenant RLS perfektionieren** (1 Woche)
4. **Serienbuchungen** (1 Woche)
5. **Beitragsarten & auto-Rechnungen** (1 Woche)

### 🎯 Langfristig (1-3 Monate)

1. **News & Events System** (2 Wochen)
2. **Galerie mit Albums** (1 Woche)
3. **SEPA-Lastschrift** (2 Wochen)
4. **Umfassende Test-Suite** (ongoing)
5. **Performance-Optimierungen** (ongoing)

---

## ZUSAMMENFASSUNG

**TSOWAPP** ist ein **exzellentes Referenzprojekt** für SwingZ mit vielen übertragbaren Konzepten:

### Top 5 Learnings:

1. **Mobile-First Navigation:** Bottom Tabs für Member/Trainer, Sidebar für Admin
2. **Multi-Tenant Excellence:** RLS, Club-Switching, Person/User-Trennung
3. **KI-Integration:** Echter Mehrwert durch intelligente Algorithmen + Claude
4. **Strukturiertes Caching:** Performance durch differenzierte Cache-Strategien
5. **Server Components First:** Client Components nur wo nötig

### Wichtigste Verbesserungen für SwingZ:

✅ **Navigation UX** verbessern (Bottom Nav, gruppierte Sidebar)  
✅ **Caching-System** implementieren für bessere Performance  
✅ **Multi-Tenant** sauberer umsetzen mit RLS  
✅ **KI-Features** übernehmen (Trainingsplanung)  
✅ **Payment-Integration** mit Stripe  
✅ **Kommunikation** ausbauen (Messages, News, Events)

Die Implementierung dieser Verbesserungen würde SwingZ auf ein **Production-Ready Level** bringen, vergleichbar mit TSOWAPP.
