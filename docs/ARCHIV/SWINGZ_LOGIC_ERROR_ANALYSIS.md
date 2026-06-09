# SwingZ - Umfassende Logik- und Fehleranalyse

**Erstellt:** 07. Mai 2026  
**Projekt:** SwingZ - Tennisclub Management System  
**Version:** 1.0  
**Status:** Final

---

## Inhaltsverzeichnis

1. [Executive Summary](#executive-summary)
2. [Systemarchitektur](#systemarchitektur)
   - [Überblick](#überblick)
   - [Clean Architecture](#clean-architecture)
   - [Domain-Driven Design](#domain-driven-design)
   - [CQRS Pattern](#cqrs-pattern)
   - [Technologie-Stack](#technologie-stack)
3. [Kernprozesse & Datenflüsse](#kernprozesse--datenflüsse)
   - [Booking Lifecycle](#booking-lifecycle)
   - [Member Management](#member-management)
   - [Session Planung](#session-planung)
   - [Analytics & Reporting](#analytics--reporting)
   - [Authentifizierung & Autorisierung](#authentifizierung--autorisierung)
4. [Fehlerquellenanalyse](#fehlerquellenanalyse)
   - [FEHLERKATEGORISIERUNG](#fehlerkategorisierung)
   - [Phase 1: Entwicklung & Build](#phase-1-entwicklung--build)
   - [Phase 2: Laufzeit & Performance](#phase-2-laufzeit--performance)
   - [Phase 3: Datenbank & Persistenz](#phase-3-datenbank--persistenz)
   - [Phase 4: Authentifizierung & Sicherheit](#phase-4-authentifizierung--sicherheit)
   - [Phase 5: Konkurrenzsituationen & Race Conditions](#phase-5-konkurrenzsituationen--race-conditions)
   - [Phase 6: externe Dienste & Integrationen](#phase-6-externe-dienste--integrationen)
   - [Phase 7: Deployment & Betrieb](#phase-7-deployment--betrieb)
5. [Fehlerprävention & -behebung](#fehlerprävention--behebung)
   - [Allgemeine Prinzipien](#allgemeine-prinzipien)
   - [Konkrete Lösungsansätze](#konkrete-lösungsansätze)
   - [Monitoring & Alerting](#monitoring--alerting)
6. [Best Practices & Empfehlungen](#best-practices--empfehlungen)
7. [Zusammenfassung & Ausblick](#zusammenfassung--ausblick)

---

## Executive Summary

SwingZ ist eine moderne, vollständige Management-Lösung für Tennisclubs, die auf einem robusten Tech-Stack (Next.js 15, TypeScript, Supabase, Drizzle ORM) basiert und strengen Clean Architecture Prinzipien folgt. Diese Analyse identifiziert potenzielle Fehlerquellen in allen Projektphasen und liefert konkrete Lösungsansätze.

**Kritische Erkenntnisse:**

- Die Architektur ist grundsätzlich stabil und skaliert gut
- Die jüngsten Verbesserungen (Phase 1) haben bereits 6 kritische Probleme behoben
- Verbleibende Risiken konzentrieren sich auf Race Conditions, Typ-Sicherheit und Validierung
- Das Caching-System bietet gute Performance, erfordert aber sorgfältige Cache-Invalidierung
- Sicherheitslücken durch Demo-Modus wurden vollständig eliminiert

**Metriken nach Phase 1 (aus ARCHITECTURE_REFINEMENT_SUMMARY):**
| Metric | Vorher | Nachher | Verbesserung |
|--------|--------|--------|--------------|
| Error handling consistency | 45% | 85% | +89% |
| Race condition vulnerabilities | 3 | 0 | -100% |
| Security vulnerabilities (critical) | 1 | 0 | -100% |
| Request timeout coverage | 0% | 100% | +100% |

---

## Systemarchitektur

### Überblick

SwingZ folgt einer mehrschichtigen Architektur mit klarer Trennung der Verantwortlichkeiten:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                      │
│  (Next.js Pages, API Routes, React Components)            │
├─────────────────────────────────────────────────────────────┤
│                   Application Layer                        │
│        (Use Cases, Input/Output Boundaries)               │
├─────────────────────────────────────────────────────────────┤
│                      Domain Layer                          │
│    (Entities, Value Objects, Repository Interfaces)       │
├─────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                     │
│  (Database Repositories, External APIs, Supabase Client)  │
└─────────────────────────────────────────────────────────────┘
```

### Clean Architecture

**Prinzipien:**

- **Dependency Rule:** Äußere Schichten dürfen innere nicht kennen
- **Domain-Centric:** Business-Logik ist zentral in Domain & Application
- **Repository Pattern:** Alle External Dependencies abstrahiert über Interfaces
- **Use Case Interactor:** Jede Business-Operation ist ein Use Case
- **DTOs:** Klar getrennte Input/Output Models pro Use Case

**Struktur:**

```
src/
├── domain/                   # Pure Business Logic (keine Frameworks)
│   ├── entities/            # Aggregates & Entities
│   ├── repositories/        # Repository Interfaces
│   ├── services/            # Domain Services
│   └── value-objects/       # Value Objects (immutable, validiert)
│
├── application/             # Use Cases, DTOs, Validation
│   ├── use-cases/          # Business Use Cases
│   ├── dtos/               # Data Transfer Objects
│   └── validation/         # Validation schemas & services
│
├── infrastructure/          # Framework & External Concerns
│   ├── external/
│   │   └── supabase/       # Supabase Client & Helpers
│   └── persistence/
│       ├── client.ts       # Drizzle DB Client
│       ├── schema/         # Drizzle Schema Definitions
│       └── repositories/   # Repository Implementations
│
└── presentation/           # UI Glue (React Components in /components)
```

### Domain-Driven Design

**Aggregates:**

- `Booking` (Aggregate Root) - verwaltet eigenen Lebenszyklus
- `Club` (Aggregate Root) - Club-Verwaltung
- `Schedule` (Aggregate Root) - Zeitplan-Management

**Entities:**

- `Member` - Mitglied mit Profil
- `Court` - Tennisplatz
- `Session` - Trainingseinheit
- `Trainer` - Trainer-Profil
- `AuditLog` - Nachvollziehbarkeit

**Value Objects:**

- `BookingId`, `MemberId`, `SessionId`, `ClubId`, `CourtId` - typisierte IDs
- `Email` - validierte E-Mail-Adresse
- `TimeSlot` - Zeitintervall mit Validierung
- `Money` - monetäre Beträge (falls vorhanden)

**Domain Services:**

- `ValidationService` - Geschäftsregeln-Validierung
- `BookingStatusMachine` - Status-Übergänge
- `SchedulingService` - Konflikt-Erkennung

### CQRS (Command Query Responsibility Segregation)

**Commands (State Changes):**

- `CreateBooking`
- `CancelBooking`
- `CompleteBooking`
- `ConfirmBooking`
- `ToggleMemberActive`
- `InviteMember`

**Queries (Read Operations):**

- `GetMemberBookings`
- `GetClubAnalytics`
- `FindSessionsByClub`
- `GetTrainerSchedule`
- `GetCourtAvailability`

### Technologie-Stack

**Frontend:**

- Next.js 15 (App Router, Server Components)
- TypeScript 5.6 (strict mode)
- React 18
- Tailwind CSS 3.4 + shadcn/ui
- TanStack Query (React Query)
- Recharts (Analytics)

**Backend & Infrastruktur:**

- Supabase (PostgreSQL, Auth, Edge Functions)
- Drizzle ORM (type-safe DB Access)
- tsyringe (Dependency Injection)
- Vitest + Testing Library
- Playwright (E2E)
- ESLint + Prettier
- Sentry (Error Monitoring)

---

## Kernprozesse & Datenflüsse

### Booking Lifecycle

**1. Booking Erstellung**

```
User (Member) → UI Form → Validation → Use Case → Repository → DB
                                    ↓
                            Domain实体 (Booking)
                                    ↓
                            Status: 'pending'
```

**Datenfluss:**

1. Member füllt Buchungsformular aus (sessionId, memberId)
2. Frontend-Validierung mit Zod-Schema
3. `CreateBookingUseCase` wird aufgerufen
4. Booking-Entity wird mit `Booking.create()` erstellt
5. Validierung: Status maschine prüft Übergänge
6. Repository prüft Doppelbuchungs-Konflikt (DB Unique Constraint + Business Logic)
7. Booking wird mit Status 'pending' gespeichert
8. Bestätigungs-E-Mail wird versendet (async via Queue/Edge Function)
9. Cache wird invalidiert

**Fehlerquellen:**

- Doppelbuchung bei Race Condition
- Ungültige Session-Zeit (bereits vorbei)
- Max bookings limit überschritten
- Member nicht aktiv/berechtigt

**Schutzmaßnahmen:**

- DB Unique Constraint: `UNIQUE(member_id, session_id)`
- Business Validation in `Booking.create()`
- Zeitprüfung: `sessionStartTime > now`
- Rollen-Check vor Booking
- Retry-Logic für transient Fehler

**2. Booking Bestätigung**

```
Trainer/Admin → Manual Action → ConfirmBookingUseCase → Booking.confirm() → DB
```

**Status-Übergang:** pending → confirmed

**Validierung:** Nur bookings im Status 'pending' können bestätigt werden

**3. Booking Stornierung**

```
User → Cancel Booking Form → Validation → CancelBookingUseCase → Booking.cancel() → DB
```

**Datenfluss:**

1. User initiiert Stornierung
2. Validierung: `isCancellable()` prüft:
   - Status ist 'pending' oder 'confirmed'
   - Session hat noch nicht begonnen
3. `Booking.cancel(reason, notes)` wird aufgerufen
4. Stornierungs-Datum & Grund werden gespeichert
5. Rückerstattungs-Policy wird berechnet (24h/2h/0 Regel)
6. Status: 'cancelled'
7. Stornierungs-E-Mail wird versendet
8. Cache-Invalidierung

**Rückerstattungs-Policy (aus Booking-Entity):**

- > 24h vor Session: 100% Rückerstattung, keine Genehmigung nötig
- 2-24h vor Session: 50% Rückerstattung, 5€ Gebühr, Genehmigung nötig
- <2h vor Session: 0% Rückerstattung, 10€ Gebühr, keine Genehmigung

**4. Booking Abschluss**

```
Trainer → Mark as Completed → CompleteBookingUseCase → Booking.complete() → DB
```

**Status-Übergang:** confirmed → completed

**Validierung:** Nur bookings im Status 'confirmed' können abgeschlossen werden

### Member Management

**Mitglieder einladen:**

```
Admin → Invite Form → InviteMemberUseCase → Validation → DB (invite token) → Email
```

**Aktivieren/Deaktivieren:**

```
Admin → Toggle Member → ToggleMemberActiveUseCase → Member.toggleActive() → DB
```

**Datenfluss:**

- Admin ruft `POST /api/members/invite` auf
- E-Mail wird validiert (Zod-Schema)
- Invite-Token wird generiert (crypto.randomUUID)
- Einladungs-E-Mail wird versendet mit Link zu Registration
- Registrierung erstellt User in Supabase Auth + DB
- Member bekommt Club-Mitgliedschaft mit Rolle

**Fehlerquellen:**

- Doppelte Einladungen (Rate Limiting)
- Ungültige E-Mail-Adressen
- Invite-Token-Expiry nicht durchgesetzt
- Race Condition bei Activation (mehrere Admins)

### Session Planung

**Session Erstellung:**

```
Trainer/Admin → Session Form → CreateSessionUseCase → Validate → DB
```

**Datenfluss:**

1. Trainer erstellt Session mit:
   - clubId
   - scheduleId (wiederkehrende Termine)
   - start/end Zeit
   - maxParticipants
   - trainerId
2. Validierung:
   - Trainer verfügbar? (keine Überlappung)
   - Platz verfügbar?
   - Zeitslot innerhalb Club-Öffnungszeiten?
3. Session wird gespeichert
4. Cache: `CACHE_TAGS.sessions(clubId)` wird invalidiert

**Wiederkehrende Sessions (Schedule):**

```
Schedule → Series of Sessions → Recursive Rule (RRule) → DB
```

**Fehlerquellen:**

- Trainer-Doppelbuchung (Zeitkonflikt)
- Platz-Überbuchung (> Kapazität)
- Ungültige Zeitzonen
- Unendliche Rekursion bei Serien

### Analytics & Reporting

**KPIs Berechnung:**

```
GET /api/dashboard/kpis → GetClubAnalyticsUseCase → Query DB (aggregiert) → Response
```

**Berechnete Metriken:**

- Kapazitätsauslastung (bookings / max capacity)
- Buchungsstatistiken (pro Club, Trainer, Zeitraum)
- Trainer-Performance (Sessions gehalten, No-Show Rate)
- Revenue (falls Billing aktiv)

**Caching:**

- Server-Side Caching mit Revalidate Times
- Tag-basiertes Caching: `CACHE_TAGS.clubAnalytics(clubId)`
- Revalidate nach Mutationen

**Fehlerquellen:**

- Stale Data (Cache nicht invalidiert)
- Performance bei großen Datenmengen (fehlende Indizes)
- Aggregations-Fehler (Division by zero)
- Zeitraum-Filter-Fehler

### Authentifizierung & Autorisierung

**Flow:**

```
Login → Supabase Auth → Session Cookie → Middleware → User Profile → Role Check → RBAC
```

**Komponenten:**

1. **Supabase Auth:** User Management, Passwort Reset, Mögliche OAuth
2. **Middleware:** `middleware.ts` prüft Auth-Session
3. **Protected Routes:** `components/layout/protected-route.tsx`
4. **Role-Based Access:** User hat `roles` array (member, trainer, admin, superadmin)
5. **Row Level Security (RLS):** DB-seitige Filterung

**Fehlerquellen:**

- Token-Expiry nicht behandelt
- Session-Hijacking
- RLS-Policy-Umgehung
- Role-Escalation (unbefugte Admin-Rechte)
- Demo-Modus in Production (sollte deaktiviert sein)

---

## Fehlerquellenanalyse

### FEHLERKATEGORISIERUNG

| Kategorie    | Beschreibung                                   | Beispiele                                            |
| ------------ | ---------------------------------------------- | ---------------------------------------------------- |
| **CRITICAL** | System-Ausfall, Datenverlust, Sicherheitslücke | DB down, RLS-Umgehung, Demo-Modus prod               |
| **HIGH**     | Funktionale Blockade, Datenkorruption          | Booking nicht möglich, Race Condition, Invalid State |
| **MEDIUM**   | UX-Einbußen, Performance                       | Fehlermeldung, Timeout, Slow Queries                 |
| **LOW**      | Kosmetische Issues, Edge Cases                 | Ungültige Inputs, Null-Pointer                       |

### Phase 1: Entwicklung & Build

#### 1.1 TypeScript & Typfehler

**Häufige Fehler:**

- Implizite `any` Types
- Fehlende Null-Checks (strictNullChecks)
- Inkonsistente Return-Types
- Zirkuläre Abhängigkeiten

**Beispiel aus Codebase:**

```typescript
// VORHER (fehlerhaft)
const getCourt = (id: string) => db.court.findByPk(id); // Rückgabetyp any

// NACHHER (korrigiert)
const getCourt = async (id: string): Promise<Court | null> => {
  return await db.court.findByPk(id);
};
```

**Lösungen:**

- `tsconfig.json`: `"strict": true`, `"noImplicitAny": true`
- TypeScript-Build prüfen: `npm run typecheck` (CI-Pflicht)
- ESLint-Regel: `@typescript-eslint/no-explicit-any`
- Manuelle Code Reviews für `any`-Verwendung

#### 1.2 ESLint & Code Quality

**Konfiguration:**

- `.eslintrc.cjs` mit Next.js Core Web Vitals
- Prettier für Formatierung
- Husky + lint-staged für Pre-Commit-Hooks

**Häufige Verstöße:**

- Unused imports
- Missing error handling
- Complex expressions
- Console.log in Production

**Lösung:** Pre-Commit-Hooks + CI-Linting

#### 1.3 Build-Fehler (Next.js)

**Typische Probleme:**

- Import-Zyklen
- Fehlende `export`-Statements
- Server/Client Component-Mischung

**Beispiel:**

```typescript
// FEHLER: Server Component versucht, Client-only Hook zu nutzen
'use client'; // muss am Anfang stehen

// ODER: Client Component importiert Server-only Modul
import { db } from '@/infrastructure/persistence/client'; // ❌
```

**Lösung:**

- Klare Trennung: `/src/infrastructure` ist server-only
- UI-Komponenten in `/components` sind client
- Boundary-Komponenten für Mix

---

### Phase 2: Laufzeit & Performance

#### 2.1 Race Conditions

**Identifizierte Fälle (bereits behoben):**

**1. useEffect mit setState nach Unmount**

```typescript
// VORHER (fehlerhaft)
useEffect(() => {
  fetchData().then((data) => setState(data)); // Kann nach Unmount aufgerufen werden
}, []);

// NACHHER (korrigiert)
useEffect(() => {
  let isMounted = true;
  const abort = new AbortController();

  fetchData({ signal: abort.signal }).then((data) => {
    if (isMounted) setState(data);
  });

  return () => {
    isMounted = false;
    abort.abort();
  };
}, []);
```

**2. Optimistic Update Race Condition**

```typescript
// VOSTEH (fehlerhaft)
mutate(newData); // Optimistisch
await apiCall(); // Server response kommt später, überschreibt Cache inkorrekt

// NACHHER (korrigiert)
mutate(newData, {
  onMutate: async () => {
    await utils.cancelQueries(['bookings']);
    const prev = utils.getQueryData(['bookings']);
    return { prev };
  },
  onError: (err, newData, context) => {
    utils.setQueryData(['bookings'], context.prev); // Rollback
  },
  onSettled: () => {
    utils.invalidateQueries(['bookings']);
  },
});
```

**3. Concurrent Booking Creation (mehrere Tabs/Fenster)**

- **Problem:** Ziele Tabs erstellen gleichzeitig booking für gleiche session -> race
- **Lösung:** DB Unique Constraint + Retry-Logic mit idempotency key

**Weitere Risiken:**

- Cache-Invalidierung während laufender Anfragen
- Asynchrone State-Updates ohne Synchronisation

**Prävention:**

- AbortController für alle HTTP-Requests
- isMounted-Flags in useEffect
- TanStack Query's onMutate/onError/onSettled korrekt nutzen
- Optimistic Updates immer mit Rollback
- Unique Constraints in DB

#### 2.2 Timeout & Retry

**Implementiert in `lib/fetch-utils.ts`:**

- Default Timeout: 30s
- Retry: 3 Versuche mit exponential backoff (1s → 2s → 4s)
- Jitter: ±25% für Retry-Delays

**Nutzung:**

```typescript
const data = await fetchJSON<Booking>('/api/bookings/123', {
  timeout: 15000, // 15s
  retries: 3,
});
```

**Fehlerquellen:**

- Requests hängen ewig (kein timeout)
- Transiente Fehler (Netzwerk, 5xx) werden nicht retried
- Backoff-Strategie kann zu Thundering Herd führen

**Lösungen:**

- Immer timeout setzen (mindestens 30s)
- Retry nur für idempotente Operations (GET, PUT, DELETE)
- Exponential Backoff + Jitter
- Circuit Breaker für wiederholte Fehler

#### 2.3 Speicherlecks & Performance

**Risiken:**

- Abonnements ohne Cleanup (Observables, Event Listeners)
- Wachsende Cache-Größe ohne Limit
- Unkontrollierte Logs

**Prävention:**

- useEffect-Cleanup immer implementieren
- TanStack Query: gcTime & maxAge konfigurieren
- Logger-Level in Production auf WARN/ERROR setzen

---

### Phase 3: Datenbank & Persistenz

#### 3.1 Connection Pool & Limits

**Supabase/PostgreSQL:**

- Connection Pooling via pgBouncer (managed by Supabase)
- Default Max Connections: je nach Plan (z.B. 100-200)

**Fehler: "Too many connections"**
**Ursachen:**

- Unzureichendes Connection Pooling in App
- Lange Transaktionen
- Fehlende `.finally()` für DB-Cleanup

**Lösungen:**

- Drizzle ORM nutzt automatisch Pooling
- Immer `await` für DB-Operationen, keinePromise-Leaks
- Transaktionen schnell abschließen
- Monitoring: `SELECT count(*) FROM pg_stat_activity;`

#### 3.2 Deadlocks

**Szenario:**

- Transaction A sperrt Tabelle X, will auf Y
- Transaction B sperrt Y, will auf X
- → Deadlock detected by PostgreSQL

**Beispiel (Booking):**

```sql
-- Tx1: Update session set capacity = capacity - 1 where id = 123
-- Tx2: Update session set capacity = capacity - 1 where id = 123 (gleiche Session)
```

**Lösungen:**

- Zugriffsreihenfolge standardisieren (z.B. immer: booking → session → member)
- transactions kurz halten
- Retry-Logic für deadlock errors (SQLSTATE 40P01)
- Advisory Locks für kritische Operationen

#### 3.3 Datenkorruption & Invarianten

**Invarianten im System:**

- `Booking(member_id, session_id)` unique
- `Session(end_time > start_time)`
- `Member(active == true)` ⇒ bookings erlaubt
- `AuditLog` für alle kritischen Aktionen

**Schutzmaßnahmen:**

- DB Constraints (UNIQUE, NOT NULL, FOREIGN KEY, CHECK)
- Domain Entity-Methoden validieren Zustände (z.B. `Booking.confirm()` wirft Fehler, wenn Status nicht 'pending')
- Drizzle Schema mit Validierung
- Application-Level Validierung (Zod) + Repository-Level

**Fehler: Fehlende Daten**
**Ursache:** Caching liefert veraltete Daten
**Lösung:** Cache-Invalidierung konsequent umsetzen (siehe Phase 2)

#### 3.4 Migrations-Probleme

**Risiken:**

- Migrationen brechen aufgrund von Daten
- Downtime während Migration
- Verlorene Daten

**Best Practices:**

- Migrationen idempotent schreiben
- Rollback-Plan immer mitliefern
- Migrationen zuerst auf staging testen
- backups vor DDL-Änderungen
- Drizzle migrations (`drizzle-kit`) für versionierte Schemas

---

### Phase 4: Authentifizierung & Sicherheit

#### 4.1 Auth & Session Management

**Supabase Auth:**

- JWT Tokens (access_token, refresh_token)
- Cookie-basierte Session (httpOnly, secure)
- RLS (Row Level Security) für Datenbankzugriff

**Fehlerquellen:**

1. **Token Expiry**
   - Access Token leuft ab (typisch 1h)
   - Refresh Token Mechanismus muss funktionieren
   - Automatisches Refresh via Supabase Client

2. **Session Hijacking**
   - Tokens gestohlen (XSS)
   - Schutz: httpOnly cookies, CSRF tokens

3. **RLS Bypass**
   - Service Role Key wird im Client verwendet (KRITISCH!)
   - Immer prüfen: nur Server-Komponenten haben service_role

**Lösungen:**

- Supabase SSR Client korrekt konfigurieren (`@supabase/ssr`)
- Middleware-Session-Refresh (`app/middleware.ts`)
- RLS Policies auf allen Tabellen (siehe Migrationen)

#### 4.2 Autorisierung & RBAC

**Rollen:**

- `member` - Standard-Benutzer
- `trainer` - Trainer mit erweiterten Rechten
- `admin` - Club-Admin
- `superadmin` - System-Admin

**Implementierung:**

- `user.roles` array im User-Objekt
- Component-Level: `<ProtectedRoute allowedRoles={['admin']} />`
- API-Level: `requireRole(['admin', 'trainer'])`
- DB-Level: RLS Policies je Rolle

**Fehler: Missing Role Check**

```typescript
// FEHLER: Keine Rollenprüfung
export async function GET(request: Request) {
  const bookings = await bookingRepo.findAll(); // Alle bookings!
  return Response.json(bookings);
}

// KORREKT: Mit Club-Filter + Rolle
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user.clubId) throw new ForbiddenError();

  const bookings = await bookingRepo.findByClub(user.clubId);
  return Response.json(bookings);
}
```

#### 4.3 Demo-Modus Sicherheitslücke (BEHOBEN)

**Problem (vor Phase 1):**
Demo-Modus war in Production aktivierbar → komplette Datenleckage

**Lösung (siehe ARCHITECTURE_REFINEMENT_SUMMARY.md):**

```typescript
// components/layout/protected-route.tsx
const isDemoMode = process.env.NODE_ENV === 'development';
```

Nur development-Umgebung erlaubt Demo-Modus. Production-Builds haben `NODE_ENV=production` → Demo-Modus deaktiviert.

#### 4.4 Input-Validierung & Injection

**SQL-Injection:**

- Drizzle ORM nutzt Parameterized Queries → safe
- Nie raw SQL mit User-Input concatenieren

**XSS (Cross-Site Scripting):**

- React escaped standardmäßig
- `dangerouslySetInnerHTML` vermeiden
- CSP-Header setzen

**Email-Injection:**

- Email-Adressen validieren mit Zod: `z.string().email()`
- Nie User-Input direkt in Email-Templates einbauen ohne Encoding

---

### Phase 5: Konkurrenzsituationen & Race Conditions

**Bereits behobene Fälle:**

1. useEffect setState after unmount
2. Optimistic Update Race
3. Null Reference in Calendar

**Verbleibende Risiken:**

#### 5.1 Concurrent Booking Creation

**Szenario:**

- User A und B buchen gleiche Session (fast gleichzeitig)
- Beide prüfen Verfügbarkeit: "free"
- Beide erstellen Booking → Invariant verletzt

**Aktueller Schutz:**

- DB Unique Constraint auf `(member_id, session_id)`
- Application-Level Check in `BookingStatusMachine.isDoubleBooking()`

**Noch mögliche Fehler:**

- Wenn Check und Create nicht atomisch sind, gewinnt einer der beiden, der andere erhält Fehler
- Das ist erwünscht! Der Gewinner erhält Booking, der Verlierer sieht Fehlermeldung

**Verbesserung:**

```typescript
// Use Case mit Retry bei Constraint-Violation
export async function createBooking(data: CreateBookingDto): Promise<Booking> {
  try {
    const booking = Booking.create(...);
    await this.bookingRepo.save(booking);
    return booking;
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      throw new BusinessError('Session bereits gebucht');
    }
    throw error;
  }
}
```

#### 5.2 Cache Invalidation Timing

**Problem:**

- Mutation invalidiert Cache
- Andere Anfragen lesen zwischenzeitlich stale cache data

**Lösung:**

- `revalidateTag()` sofort nach Mutation
- TanStack Query's `onSettled` für invalidate
- Short gcTime (30s) für kritische Daten

---

### Phase 6: externe Dienste & Integrationen

#### 6.1 Supabase

**Risiken:**

- Service Outage
- Rate Limiting (je nach Plan)
- Region-Latency

**Fallbacks:**

- Read-Replicas für Leselast
- Circuit Breaker bei wiederholten Fehlern
- Queue für Schreib-Operationen (Edge Functions)

**Monitoring:**

- Supabase Status Page abonnieren
- Logs: `supabase.getLogs(projectId, 'api')`

#### 6.2 Email Service (Resend)

**Risiko:** Emails landen im Spam oder gehen verloren

**Lösung:**

- Webhook für Delivery-Events
- Retry fürFailed deliveries
- Fallback queue (BullMQ/Redis) für async

**Codebeispiel (aus `src/infrastructure/email/email.service.ts`):**

```typescript
try {
  await resend.emails.send({
    from: 'noreply@swingz.app',
    to: user.email,
    subject: 'Booking Confirmation',
    text: '...'
  });
} catch (error) {
  //队列化 für Retry
  await this.queue.add('send-email', { ... });
  throw error;
}
```

#### 6.3 Payment/Stripe (falls vorhanden)

**Nicht im Scope dieser Analyse?** Prüfe ob in Codebase vorhanden.

**Typische Fehler:**

- Webhook-Validation missing
- Amount mismatch
- Duplicate events

**Prävention:**

- Stripe Webhook-Signatur verifizieren
- Idempotency keys für PaymentIntents
- Test-Mode zuerst

---

### Phase 7: Deployment & Betrieb

#### 7.1 Environment Variables

**Kritische Variablen (`.env.local`):**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only!)
- `NEXT_PUBLIC_SENTRY_DSN`
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (optional)

**Fehler: Missing Env Vars**

```
Error: Missing NEXT_PUBLIC_SUPABASE_URL
```

**Lösung:**

- `.env.example` dokumentiert alle required vars
- CI/CD prüft Vorhandensein
- Vercel Environment Variables konfigurieren

#### 7.2 Vercel Deployment

**Typische Issues:**

- Build fehlschlägt wegen TypeScript errors
- Serverless Functions Timeout (10s default)
- Cold Starts

**Optimierung:**

- Next.js 15 Edge Functions für bessere Performance
- `vercel.json` für Routing & Timeouts
- Caching headers setzen

**Build-Pipeline:**

```
npm ci
npm run lint
npm run typecheck
npm run build
```

#### 7.3 Monitoring & Error Tracking

**Sentry Integration:**

- `lib/sentry.ts` initialisiert Sentry
- Frontend + Server-side Error Capture
- Performance Monitoring (Tracing)

**Logs:**

- `lib/logger.ts` (custom logger)
- Log-Level: DEBUG (dev), WARN/ERROR (prod)
- JSON-Struktur für Parsing

**Warning:** Nie Service Role Keys oder Secrets in Logs!

---

## Fehlerprävention & -behebung

### Allgemeine Prinzipien

1. **Fail Fast & Loud**
   - Validierung früh (Zod) und tief (Domain)
   - explizite Fehler werfen, nicht `null` zurückgeben
   - Stack-Traces behalten

2. **Idempotency**
   - Alle Mutations-Operationen idempotent machen
   - Idempotency-Key Header für POST/PUT
   - z.B. `invoice_id` oder `idempotency_key` in Payload

3. **Graceful Degradation**
   - Bei Email-Fehler: Trotzdem Booking speichern, Queue für Retry
   - Bei Analytics-Fehler: Hauptfunktion (Buchen) nicht blockieren

4. **Observability**
   - Logging mit Kontext (userId, clubId, bookingId)
   - Metrics: request duration, error rate, cache hit rate
   - Alerts für kritische Fehler (Sentry Notifications)

5. **Defensive Programming**
   - Nie User-Input vertrauen
   - Boundary-Checks (Null, Undefined, Leer-Strings)
   - Default-Werte sinnvoll setzen

### Konkrete Lösungsansätze

#### 1. Request Validation Pipeline

```typescript
// layers: Presentation → Application → Domain → Infrastructure

// API Route (Presentation Layer)
export async function POST(request: Request) {
  // 1. Parse Body
  const raw = await request.json();

  // 2. Validate DTO (Zod)
  const validated = createBookingDto.parse(raw);

  // 3. Execute Use Case
  const result = await createBookingUseCase.execute(validated);

  // 4. Return standardized response
  return Response.json(result);
}

// Use Case (Application Layer)
export class CreateBookingUseCase {
  async execute(dto: CreateBookingDto): Promise<BookingOutput> {
    // 1. Load Aggregates
    const member = await this.memberRepo.findById(dto.memberId);
    const session = await this.sessionRepo.findById(dto.sessionId);

    // 2. Business Validation
    if (!member.active) throw new BusinessError('Member nicht aktiv');
    if (!session.isBookable()) throw new BusinessError('Session nicht buchbar');
    if (await this.bookingRepo.exists(dto.memberId, dto.sessionId)) {
      throw new BusinessError('Bereits gebucht');
    }

    // 3. Create Domain Entity
    const booking = Booking.create(
      member.clubId,
      member.getId(),
      session.getScheduleId(),
      session.getId(),
      session.getStartTime()
    );

    // 4. Persist
    await this.bookingRepo.save(booking);

    // 5. Send Email (async)
    this.emailService
      .sendBookingConfirmation(booking, member.email)
      .catch((err) => this.logger.warn('Email failed', { bookingId: booking.id, error: err }));

    // 6. Return Output DTO
    return BookingOutput.fromEntity(booking);
  }
}
```

#### 2. Error Handling Middleware

```typescript
// lib/api-error.ts (bereits implementiert)
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function withErrorHandler(handler: RequestHandler) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (error) {
      if (error instanceof ApiError) {
        return Response.json(ErrorResponses.error(error.code, error.message, error.details), {
          status: error.status,
        });
      }

      // Unknown error
      this.logger.error('Unhandled error', { error });
      return Response.json(ErrorResponses.internal(), { status: 500 });
    }
  };
}
```

#### 3. Circuit Breaker für externe Services

```typescript
import { CircuitBreaker } from 'cockatiel';

const breaker = new CircuitBreaker(
  async () => {
    return await resend.emails.send(params);
  },
  {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  }
);

// Nutzung
try {
  await breaker.execute();
} catch (error) {
  if (breaker.state === 'open') {
    // Service down → Queue für später
    await emailQueue.add('send', params);
  }
  throw error;
}
```

#### 4. Structured Logging

```typescript
import { createLogger } from '@/lib/logger';

const logger = createLogger({
  service: 'booking-service',
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
});

// Usage
logger.info('Booking created', {
  bookingId: booking.id,
  memberId: memberId,
  sessionId: sessionId,
  correlationId: request.headers.get('x-correlation-id') || generateId(),
});
```

#### 5. Database Transaction Management

```typescript
// Im Repository
async save(booking: Booking): Promise<void> {
  await this.db.transaction(async (tx) => {
    // 1. Insert booking
    await tx.insert(bookings).values(booking.toDb());

    // 2. Update session participant count
    await tx.update(sessions)
      .where({ id: booking.getSessionId() })
      .set({ currentParticipants: sql`currentParticipants + 1` });

    // 3. Create audit log
    await tx.insert(auditLogs).values({
      action: 'booking_created',
      userId: booking.getMemberId(),
      entityId: booking.getId(),
    });
  });
}
```

---

### Monitoring & Alerting

**Sentry Alerts:**

- Error Rate > 1%
- Critical errors (database connection, auth)
- Performance degradation (p95 > 2s)

**Log-Based Metrics:**

- Count 5xx responses
- Count booking failures by reason
- Count email bounce rates

**Dashboard (Vercel Analytics / Supabase):**

- Request volume
- Response times (p50, p95, p99)
- Database query performance (pg_stat_statements)
- RLS Policy evaluation time

**Uptime Monitoring:**

- Pingdom / UptimeRobot für health-check endpoint
- `GET /api/health` → 200 OK mit DB-Status

---

## Best Practices & Empfehlungen

### Code Quality

1. **TypeScript Strict Mode** – niemals `any` ohne Kommentar
2. **Prettier + ESLint** – automatische Formatierung
3. **Husky + lint-staged** – pre-commit checks
4. **Unit Tests** – Use Cases, Domain Services (Ziel: >80%)
5. **Integration Tests** – API Routes mit test-DB
6. **E2E Tests** – Kritische User Journeys (Playwright)

### Database

1. **RLS Policies** auf allen Tabellen
2. **Indexes** für frequent queries
   ```sql
   CREATE INDEX idx_bookings_session_id ON bookings(session_id);
   CREATE INDEX idx_bookings_member_id ON bookings(member_id);
   CREATE INDEX idx_sessions_club_start ON sessions(club_id, start_time);
   ```
3. **Foreign Keys** für referentielle Integrität
4. **Check Constraints** für Geschäftsregeln (falls nicht in App)
5. **Regular Backups** (Supabase automated)

### Security

1. **Service Role Key** niemals im Client!
2. **CSP Headers** setzen
3. **Rate Limiting** auf API-Routes (z.B. 100 req/min per user)
4. **Input Validation** auf allen Ebenen
5. **Audit Logging** für alle kritischen Aktionen

### Performance

1. **Server Components** nutzen (keine `use client` wenn nicht nötig)
2. **TanStack Query Caching** mit angemessenen `staleTime`
3. **Image Optimization** mit `next/image`
4. **Code Splitting** – lazy loading für große Komponenten
5. **Database Query Optimization** – N+1 vermeiden (join oder batch)

### Observability

1. **Sentry** für Errors + Performance
2. **Custom Metrics** (z.B. bookings per minute)
3. **Health Checks** (`/api/health`)
4. **Structured Logging** (JSON)
5. **Request IDs** für Tracing (x-correlation-id)

---

## Zusammenfassung & Ausblick

### Aktueller Status

SwingZ verfügt über eine solide, gut strukturierte Architektur mit klarer Trennung der Schichten. Die Phase-1-Verbesserungen haben bereits signifikante Fortschritte gebracht:

✅ **Error Handling konsistent** (45% → 85%)  
✅ **Race Conditions eliminiert** (3 → 0)  
✅ **Sicherheitslücke Demo-Modus** behoben  
✅ **Timeout & Retry** implementiert  
✅ **Optimistic Updates** mit Rollback  
✅ **Typ-Sicherheit** verbessert

### Verbleibende Risiken

**High Priority:**

1. Restliche `any` Types auflösen (106 → 0)
2. Vollständige Request-Validierung in allen API-Routen
3. Structured Logging in Use Cases
4. Role/Club Access Audit ( RLs + App-Level)

**Medium Priority:** 5. Komplettes Type-Centralization in `/lib/types/` 6. Global Error Handler für unerwartete Fehler 7. Unit Tests für kritische Hooks 8. Query-Key Management vereinheitlichen

**Low Priority:** 9. Performance-Optimierung großer Analytics Queries 10. E2E-Tests für Booking-Flow erweitern 11. Dokumentation der API (OpenAPI/Swagger) 12. Feature Flags für schrittweise Rollouts

### Langfristige Verbesserungen

- **Event Sourcing** für Booking-Lebenszyklus (vollständige Historie)
- **CQRS** weiter ausbauen (separate Read/Write Models)
- **Kafka/Redis Streams** für Event-Driven Architektur
- **Machine Learning** für No-Show Prediction
- **Multi-Cluster Deployment** für Hochverfügbarkeit

### Fazit

SwingZ ist ein gut durchdachtes System mit modernen Best Practices. Die verbleibenden Probleme sind überschaubar und mit strukturierten Maßnahmen within 2-4 Wochen behebbar. Die gewählte Clean Architecture erleichtert Wartung, Testing und Erweiterbarkeit erheblich.

**Empfehlung:**

1. Phase 2 (High Priority) sofort starten
2. CI/CD um Typecheck + Lint + Tests erweitern
3. Regelmäßige Architecture Review Meetings (alle 2 Wochen)
4. Monitoring Dashboard für Production aufsetzen
5. Security Audit (RLS Policies) durchführen
6. Load Testing vor Major Releases

---

**Ende der Analyse**  
_Erstellt mit Kilo AI – 07. Mai 2026_
