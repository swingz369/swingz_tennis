# Drizzle ORM — Schema, Repositories, Migrations

> ORM-Layer für typisierten DB-Zugriff. **Verbindlich** ist das Schema in `src/infrastructure/persistence/schema/`.

## 🎯 Zweck

Drizzle bietet:

- **Type-safe Queries**: `db.query.bookings.findFirst({ where: eq(…) })`
- **Schema als Code-Quelle**: TypeScript-Definitionen → Migrationen generieren
- **Repository-Pattern**: Jede Domain-Entität hat ein Repository-Interface und eine Drizzle-Impl

## 📂 Verzeichnis-Layout

```
src/
├── domain/
│   ├── entities/        ← Pure TS-Klassen (Booking, Member, …)
│   ├── value-objects/   ← Branded-Types
│   └── repositories/    ← Interfaces (z. B. IBookingRepository)
├── application/
│   └── use-cases/       ← Business-Logic, nutzt Repos via Interface
└── infrastructure/
    └── persistence/
        ├── db.ts             ← Drizzle-Client (postgres-js-Rolle)
        ├── schema/           ← Drizzle-Schema (alle Tabellen)
        │   ├── schema.ts     ← Master-Index, exportiert alle Tabellen
        │   ├── auth.ts       ← user_club_memberships, trainers, …
        │   ├── club.ts       ← clubs, courts, court_types, …
        │   ├── scheduling.ts ← sessions, schedules, bookings, …
        │   ├── billing.ts    ← invoices, fee_configs, dunning, …
        │   ├── season.ts     ← seasons, training_groups, …
        │   └── …              (mehrere Sub-Module)
        └── repositories/     ← Drizzle-Impls der Domain-Repos
            ├── booking.repository.ts
            ├── member.repository.ts
            └── …
```

## 🚨 Direkter postgres-Zugriff vs. Supabase REST

Drizzle nutzt die `postgres-js`-Verbindung **direkt zur Postgres-DB** (Port 5432).

⚠️ **Wichtiger Hinweis aus CLAUDE.md:**

> Direkte Drizzle/postgres-js Verbindungen (Port 5432) **schlagen aus der Dev-Umgebung fehl** — Supabase sperrt Port 5432 extern. Stattdessen Supabase REST via Service-Client verwenden.

→ **Drizzle ist nur für lokale Entwicklung und Staging-Builds** geeignet. Im Production-Build läuft Drizzle NICHT, sondern der Supabase-REST-Pfad wird genommen.

Siehe `lib/supabase/service.ts` für den Service-Client-Wrapper, der in Production alle Drizzle-Calls ersetzt.

## 🏗 Schema-Definition

Eine typische Tabellendefinition:

```ts
// src/infrastructure/persistence/schema/booking.ts
import { pgTable, uuid, timestamp, varchar, integer } from 'drizzle-orm/pg-core';

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  courtId: uuid('court_id').references(() => courts.id),
  status: varchar('status', { length: 20 }).notNull().default('confirmed'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: varchar('cancellation_reason', { length: 200 }),
  notes: varchar('notes', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
```

**Konventionen:**

- Tabellenname: snake_case, plural (`bookings`)
- Spaltenname: snake_case
- Primary-Key: `uuid` mit `defaultRandom()`
- Timestamp: `timestamp` mit `withTimezone: true`
- Foreign-Key: `references(() => members.id)` mit `notNull()` wenn Pflicht

## 🔨 Migrationen anlegen

**Wichtig:** Bei jeder Schema-Änderung MUSS eine Migration unter `supabase/migrations/` mit geliefert werden.

### Workflow für neue Tabelle

1. **Schema bearbeiten** in `src/infrastructure/persistence/schema/<domain>.ts`
2. **Manuell SQL-Migration schreiben** in `supabase/migrations/<YYYYMMDD>_<feature>.sql`
3. **Beide synchron halten** — Schema-Drift ist Verbot (CI prüft mit `npm run db:audit`)
4. **Repository anlegen/erweitern** in `src/infrastructure/persistence/repositories/<domain>.repository.ts`
5. **Domain-Entity** (falls neu) in `src/domain/entities/<domain>.ts`

### Beispiel Migration

```sql
-- supabase/migrations/20260801_add_reservation_window.sql
ALTER TABLE bookings
  ADD COLUMN reservation_window_start TIMESTAMPTZ,
  ADD COLUMN reservation_window_end TIMESTAMPTZ;

CREATE INDEX idx_bookings_window ON bookings(reservation_window_start, reservation_window_end);
```

### Drizzle Kit für Schema-Sync

```bash
npm run db:generate      # generiert SQL aus Schema (NICHT für Prod verwenden!)
npm run db:migrate       # applies migrations
npm run db:push          # direkt Schema auf Dev-DB (kein Migrations-File)
npm run db:audit         # CI-Gate, prüft Schema/Migrations-Konsistenz
```

⚠️ **`db:generate` ist unsicher** für Production-Tabellen mit Daten. Lieber manuelle Migrations in `supabase/migrations/`.

## 🗂 Repository-Pattern

Beispiel (`BookingRepository`):

```ts
// src/domain/repositories/booking.repository.interface.ts
import type { Booking } from '@/domain/entities/booking';

export interface IBookingRepository {
  findById(id: string): Promise<Booking | null>;
  findByMember(memberId: string): Promise<Booking[]>;
  createNew(memberId: string, sessionId: string): Promise<Booking>;
  cancel(id: string, reason: string, notes?: string): Promise<Booking>;
}

// src/infrastructure/persistence/repositories/booking.repository.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { bookings } from '../schema/booking';
import type { IBookingRepository } from '@/domain/repositories/booking.repository.interface';

export class DrizzleBookingRepository implements IBookingRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async findById(id: string) {
    const [row] = await this.db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    return row ?? null;
  }
  // …
}
```

Im `src/domain/repositories/booking.repository.interface.ts` → für Tests mit Mocks, in Production mit der Drizzle-Impl. Injection in `lib/di-container.ts` (geplant, noch nicht überall aktiv).

## ⚠️ Drift-Gefahren

### 1. **RLS-Bypass**

Drizzle-Routes (`postgres-js`-Rolle) → **kein RLS**. Wenn du Drizzle für Multi-Tenant-Queries nutzt, MUSS deine Query `WHERE club_id = …` enthalten.

**Anti-Pattern:**

```ts
// ❌ Unsicher — sieht ALLE Buchungen aller Vereine
const allBookings = await db.select().from(bookings);
```

**Richtig:**

```ts
// ✅ Club-scoped
const myClubBookings = await db.select().from(bookings).where(eq(bookings.clubId, auth.clubId));
```

🔴 **Aktuelle Probleme** (P0-2): Schedule, Groups, Pricing-Rules, Analytics haben IDOR-Risiko über query-Param.

### 2. **N+1-Queries**

Vermeide:

```ts
// ❌ N+1
for (const club of clubs) {
  const sessions = await db.select().from(sessions).where(eq(sessions.clubId, club.id));
  for (const session of sessions) {
    const trainer = await db.select().from(trainers).where(eq(trainers.id, session.trainerId));
  }
}
```

Lieber:

```ts
// ✅ JOIN in einer Query
const result = await db
  .select({ session: sessions, trainer: trainers })
  .from(sessions)
  .leftJoin(trainers, eq(sessions.trainerId, trainers.id))
  .where(inArray(sessions.clubId, clubIds));
```

## 🧪 Tests

- **Unit**: Repository-Impl mit Test-DB (SQLite oder Postgres-Container)
- **Integration**: Route-Handler mit gemocktem Drizzle (z. B. `vi.fn()`)
- **E2E**: gegen Dev-DB mit Seed-Daten

## 📚 Verwandte Kapitel

- [`supabase-setup.md`](./supabase-setup.md) — Supabase-Clients
- [`data-model.md`](./data-model.md) — alle Tabellen
- [`architecture.md`](./architecture.md) — Clean-Architecture-Layer
- [`api-conventions.md`](./api-conventions.md) — wie du einen Use-Case schreibst
