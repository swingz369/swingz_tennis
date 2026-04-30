# SWINGZ App - Projektre-Engineering Prompt

Die SWINGZ App ist eine Multi-Tenant Tennisclub-Management-Plattform.
Das Projekt ist **architektonisch durchdacht**, wir wenden aber das Prinzip
**"Bau für morgen, liefere für heute"** an: Clean Architecture mit
minimalem V1-Scope (MVP in 8 Wochen), erweiterbar für spätere Phasen.

**Ziel**: MVP in 8 Wochen, KI-Scheduling als USP, ohne Overhead.

---

## 🏗️ ARCHITEKTUR-PRINZIPIEN

### Philosophie: Erweiterbar, aber schlank

Wir bauen **keine** Event-Systeme, CQRS-Infrastruktur oder Multi-Region-Architektur,
die wir heute nicht brauchen. Stattdessen: Saubere Schichten, Interfaces,
loose Kopplung – so dass V2 Features (Cross-Club, Events, CQRS) ohne
Rewrite der Domain hinzugefügt werden können.

### 1. Clean Architecture (4 Schichten)

```
src/
├── domain/              # Enterprise Business Rules
│   ├── entities/        # Aggregate Roots (Club, Schedule, Booking)
│   ├── repositories/    # Interfaces (ohne Implementierung)
│   ├── services/        # Domain Services (Scheduling, Validation)
│   ├── value-objects/   # VO: TimeSlot, ScheduleWeek, etc.
│   └── events/          # Typen definiert, Dispatcher später
│
├── application/         # Use Cases (V1: Einfache Klassen)
│   ├── use-cases/       # OptimizeSchedule, CreateBooking
│   └── interfaces/      # Application-Ports (für spätere CQRS)
│
├── infrastructure/      # External Concerns
│   ├── persistence/     # Drizzle Repositories (implements domain/ports)
│   ├── ai/              # Claude Client (V1: Real)
│   └── external/        # Stripe, SEPA (lightweight)
│
└── presentation/        # Next.js 15 App Router
    ├── app/             # Server Components, Route Handlers
    ├── components/      # shadcn/ui
    └── lib/             # Zustand (minimaler Client State)
```

### 2. Domain-Driven Design (3 Aggregate Roots für V1)

**Aggregat 1: Club** (Multi-Tenant Root)

- Enthält: Members, Trainers, Courts
- Invarianten: Max Members, Öffnungszeiten

**Aggregat 2: Schedule** (gehört zu Club, 1:1 für V1)

- Enthält: Season, TrainingGroups, Sessions
- Invarianten: Keine Trainer-Doppelbelegung, Kapazitätslimits
- **KI-Optimierung**: Core Feature

**Aggregat 3: Booking**

- Enthält: Member, Session, Status
- Invarianten: Keine Überbuchung, Storno-Regeln

**Value Objects** (V1 vollständig):

- `TimeSlot` (Start/End, Validation)
- `ScheduleWeek`, `TrainerId`, `MemberId`

### 3. Multi-Tenant & Rollen (V1: Minimal)

**V1: Einzelverein-Modus**

- Superadmin = Vereins-Admin (vereinfacht)
- Keine Cross-Club-Trainer (V2 Feature)
- RLS in Supabase = einzige Sicherheitsschicht

---

## 🔧 TECH-STACK VERFEINERUNG

### Backend & Data Layer

**Supabase (PostgreSQL)**:

- RLS strikt für jeden Zugriff
- Point-in-Time Recovery (PITR) aktiviert

**Drizzle ORM** (Type-safe):

```typescript
export const clubs = pgTable('clubs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
});
```

**Kein Caching Layer in V1**:

- TanStack Query (Server State) reicht
- Kein Redis, kein BullMQ (später)

### Frontend Stack

**Next.js 15 (App Router)**:

- Server Components: Daten fetching im Component Tree
- Route Handlers: Leichtgewichtige API-Endpunkte

**State Management**:

- Client State: Zustand (UI-States only)
- Server State: TanStack Query
- Session: Supabase Auth (HTTP-only cookies)

---

## 📐 CODE QUALITY STANDARDS

### TypeScript Strictness

- `strict: true`, `noImplicitAny`, `strictNullChecks`
- Path mapping: `@/domain/*`, `@/application/*`

### Testing: Fokus auf Domain (90%)

- **Domain Layer**: 90-100% Coverage (Invarianten)
- **Use Cases**: 70% (happy path)
- **UI**: 30-50% (kritische Flows)

### Linting & Formatting

- ESLint + Prettier (automatisch via Husky)
- SonarJS (Cognitive Complexity max 15)

---

## 📝 NAMING CONVENTIONS & BEST PRACTICES

- **kebab-case**: Dateien/Verzeichnisse
- **PascalCase**: Komponenten, Types
- **camelCase**: Variablen, Funktionen
- **UPPER_SNAKE_CASE**: Konstanten

---

## 🔄 CI/CD & DEVELOPMENT WORKFLOW

### Git Branching (GitHub Flow)

```
main          → Production (protected)
feature/*     → Feature branches
hotfix/*      → Critical fixes
```

### Commit Convention

```
feat: add multi-tenant support
fix(reservation): timezone handling
```

### CI Pipeline (GitHub Actions)

```yaml
jobs:
  lint:
    - npm run lint
    - npm run format:check
  typecheck:
    - npm run typecheck
  test:
    - npm run test:unit
    - npm run test:e2e
  build:
    needs: [lint, typecheck, test]
    - npm run build
```

---

## 🚀 KI-GESTÜTZTE SAISON-TRAININGSPLANUNG (Core USP)

### Architektur (Domain-zentriert)

```typescript
class SchedulingService {
  async optimize(schedule: Schedule): Promise<Result<Schedule>> {
    // 1. KI generiert Plan (JSON)
    const aiPlan = await this.aiClient.generate(promptData);

    // 2. Domain validiert (Invarianten prüfen)
    const validated = Schedule.fromAIPlan(aiPlan);

    // 3. Heuristik repariert kleine Konflikte
    return this.heuristicRepair(validated);
  }
}
```

### KI-Output (Strukturiertes JSON)

```json
{
  "groups": [
    {
      "id": "g-123",
      "day_of_week": 1,
      "start_time": "17:00",
      "trainer_id": "t-456",
      "member_ids": ["m-1", "m-2"]
    }
  ]
}
```

### Rate Limiting & Kosten

- Redis-Limit: 10/Minute
- Kosten: $0.003/GPT-4o-mini-Aufruf
- Fallback: Algorithmus-Heuristik (ohne KI-Text)

### V1 MVP Scope

- [x] Algorithmus: Rule-Based Matching
- [x] KI-Integration (Claude/GPT) für Optimierung
- [x] Drag & Drop UI für manuelle Korrektur
- [x] < 30s Antwortzeit

---

## 🎯 MVP SCOPE (8 Wochen Plan)

### Woche 1-2: Domain + Foundation ⚠️ Basis muss sitzen

- [x] Domain Entities (Club, Schedule, Booking)
- [x] Value Objects (TimeSlot, etc.)
- [x] Repository Interfaces
- [x] Drizzle Schema
- **Kein CQRS** – einfache Services

### Woche 3-4: Infrastructure + Core CRUD

- [x] Drizzle Repositories
- [x] Supabase RLS Policies
- [x] Admin UI: Club-Management
- [x] Booking System für Members

### Woche 5-6: KI-Scheduling (USP – Hier Zeit investieren)

- [x] Claude API Integration (JSON)
- [x] Heuristik-Fallback bei Fehlern
- [x] Konflikt-Erkennung + Auto-Korrektur
- [x] UI: Drag & Drop

### Woche 7-8: Polish + Deploy

- [x] Monitoring (Sentry)
- [x] Tests (70% Overall, 90% Domain)
- [x] Deploy (Vercel)

---

## 🔒 SECURITY: RLS als einzige Schicht (V1)

### Kein "Application Layer Check" zusätzlich

Supabase RLS macht **alles**. Weniger Code = weniger Bugs.

```sql
CREATE POLICY "schedule_access" ON schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_id = schedules.club_id
      AND user_id = auth.uid()
    )
  );
```

---

## ⚡ WAS WIR NICHT MACHEN (V1)

❌ Event Bus / Domain Events  
❌ CQRS mit Read/Write Split  
❌ Redis / Memcached Caching  
❌ Multi-Tenant Superadmin (nur 1 Verein/User)  
❌ Cross-Club Features  
❌ Docker / Kubernetes  
❌ Microservices

**Alles kommt in V2/V3 einfach hinzu** (Architektur erlaubt es).

---

## 📊 SUCCESS METRICS (V1)

- **Time-to-Market**: MVP in 8 Wochen
- **KI Accuracy**: 90%+ korrekte Gruppenzuweisungen
- **Performance**: < 30s Plan-Generierung
- **Code Quality**: 90% Domain-Test-Coverage
- **Bundle Size**: < 200KB (gzipped)

---

## ✅ ZUSAMMENFASSUNG

- **Architektur**: Clean, erweiterbar, aber V1-schlank
- **Stack**: Next.js 15 + Drizzle + Supabase + TanStack Query
- **USP**: KI-Scheduling (strukturiert, schnell)
- **Scope**: 3 Aggregate, 1 Verein, 8 Wochen
- **Quality**: Domain 90% Tests, strict TypeScript
- **Security**: RLS only (simple = safe)

Wir bauen das Fundament richtig, aber das Haus nur so groß, wie es für morgen nötig ist.  
V2 baut einfach oben weiter – ohne das Fundament zu sprengen.

---

## 🛡️ PRODUKTIONS-BACKUP-STRATEGIE (V1)

**Supabase PITR**: Aktiviert (7 Tage)  
**Tägliche Dumps**: pg_dump → S3 (14 Tage Retention)  
**Monitoring**: Sentry + Logtail

### Rollback (einfach)

- Level 1: Vercel Previous Deployment (Code)
- Level 2: PITR oder pg_dump (DB)

### DSGVO (V1 minimal)

- Daten in EU (Supabase)
- Soft-Delete (`deleted_at`)

---

## ✅ V1 GO-LIVE CHECKLISTE

- [x] Supabase PITR aktiviert
- [x] Tägliches DB-Backup
- [x] Sentry Monitoring aktiv
- [x] Vercel Deployment getestet
- [x] Rollback getestet
- [ ] Erster Restore-Test erfolgreich

**Das war\'s. Mehr braucht V1 nicht.**
