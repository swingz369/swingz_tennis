# Service-to-Repository Migration Guide

**Datum**: 2026-05-06  
**Ziel**: Migration der 11 In-Memory Services zu Drizzle Repositories  
**Status**: Guide fertig, Implementation pending

---

## Übersicht

Diese Anleitung beschreibt die systematische Migration von Application Services mit in-memory Arrays zu repository-basierten Services.

### Services mit In-Memory Arrays

| Service                           | Priorität  | Geschätzt | Repository benötigt                        |
| --------------------------------- | ---------- | --------- | ------------------------------------------ |
| `billing.service.ts`              | ⚡ Hoch    | 8h        | InvoiceRepository, BillingPeriodRepository |
| `member.service.ts`               | ⚡ Hoch    | 4h        | MemberRepository (existiert)               |
| `hours-log.service.ts`            | ⚡ Hoch    | 6h        | HoursLogRepository                         |
| `trainer-availability.service.ts` | 🔥 Mittel  | 4h        | TrainerAvailabilityRepository              |
| `trainer-profile.service.ts`      | 🔥 Mittel  | 3h        | TrainerRepository (existiert)              |
| `absence.service.ts`              | 🔥 Mittel  | 3h        | AbsenceRepository                          |
| `fee-configuration.service.ts`    | 🔥 Mittel  | 3h        | FeeConfigRepository                        |
| `payment-settings.service.ts`     | 🎯 Niedrig | 2h        | PaymentSettingsRepository                  |
| `system-settings.service.ts`      | 🎯 Niedrig | 2h        | SystemSettingsRepository                   |
| `trial-training.service.ts`       | 🎯 Niedrig | 3h        | TrialTrainingRepository                    |

**Total**: ~38 Stunden für vollständige Migration

---

## Migration Pattern

### Schritt 1: Repository Interface definieren

```typescript
// src/domain/repositories/hours-log-repository.interface.ts

import type { HoursLogId, TrainerId, ClubId } from '../value-objects';

export interface HoursLog {
  id: HoursLogId;
  trainerId: TrainerId;
  clubId: ClubId;
  date: Date;
  hours: number;
  hourlyRate: number;
  status: 'pending' | 'approved' | 'paid';
  approvedAt?: Date;
  paidAt?: Date;
}

export interface HoursLogRepository {
  findById(id: HoursLogId): Promise<HoursLog | null>;
  findByTrainer(trainerId: TrainerId): Promise<HoursLog[]>;
  findByClub(clubId: ClubId): Promise<HoursLog[]>;
  findByPeriod(clubId: ClubId, startDate: Date, endDate: Date): Promise<HoursLog[]>;
  save(log: HoursLog): Promise<void>;
  delete(id: HoursLogId): Promise<void>;
  approve(id: HoursLogId): Promise<void>;
  markAsPaid(id: HoursLogId): Promise<void>;
}
```

### Schritt 2: Drizzle Schema definieren

```typescript
// src/infrastructure/persistence/schema.ts

export const hoursLogs = pgTable('hours_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  trainer_id: uuid('trainer_id')
    .notNull()
    .references(() => trainers.id),
  club_id: uuid('club_id')
    .notNull()
    .references(() => clubs.id),
  date: timestamp('date', { withTimezone: true }).notNull(),
  hours: decimal('hours', { precision: 5, scale: 2 }).notNull(),
  hourly_rate: decimal('hourly_rate', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  approved_at: timestamp('approved_at', { withTimezone: true }),
  approved_by: uuid('approved_by').references(() => users.id),
  paid_at: timestamp('paid_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

### Schritt 3: Repository Implementation

```typescript
// src/infrastructure/persistence/repositories/hours-log.repository.ts

import { eq, and, gte, lte } from 'drizzle-orm';
import { getDb } from '../client';
import { hoursLogs } from '../schema';
import type {
  HoursLog,
  HoursLogRepository,
} from '@/domain/repositories/hours-log-repository.interface';
import { HoursLogId, TrainerId, ClubId } from '@/domain/value-objects';
import { parsePostgresError } from '@/lib/database-errors';

export class DrizzleHoursLogRepository implements HoursLogRepository {
  async findById(id: HoursLogId): Promise<HoursLog | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(hoursLogs)
      .where(eq(hoursLogs.id, id.getValue()))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByTrainer(trainerId: TrainerId): Promise<HoursLog[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(hoursLogs)
      .where(eq(hoursLogs.trainer_id, trainerId.getValue()));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByClub(clubId: ClubId): Promise<HoursLog[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(hoursLogs)
      .where(eq(hoursLogs.club_id, clubId.getValue()));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByPeriod(clubId: ClubId, startDate: Date, endDate: Date): Promise<HoursLog[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(hoursLogs)
      .where(
        and(
          eq(hoursLogs.club_id, clubId.getValue()),
          gte(hoursLogs.date, startDate),
          lte(hoursLogs.date, endDate)
        )
      );

    return result.map((row) => this.mapToDomain(row));
  }

  async save(log: HoursLog): Promise<void> {
    const db = getDb();
    const values = {
      id: log.id.getValue(),
      trainer_id: log.trainerId.getValue(),
      club_id: log.clubId.getValue(),
      date: log.date,
      hours: log.hours.toString(),
      hourly_rate: log.hourlyRate.toString(),
      status: log.status,
      approved_at: log.approvedAt || null,
      paid_at: log.paidAt || null,
      updated_at: new Date(),
    };

    try {
      const existing = await this.findById(log.id);
      if (existing) {
        await db.update(hoursLogs).set(values).where(eq(hoursLogs.id, log.id.getValue()));
      } else {
        await db.insert(hoursLogs).values(values);
      }
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async delete(id: HoursLogId): Promise<void> {
    const db = getDb();
    await db.delete(hoursLogs).where(eq(hoursLogs.id, id.getValue()));
  }

  async approve(id: HoursLogId): Promise<void> {
    const db = getDb();
    await db
      .update(hoursLogs)
      .set({
        status: 'approved',
        approved_at: new Date(),
      })
      .where(eq(hoursLogs.id, id.getValue()));
  }

  async markAsPaid(id: HoursLogId): Promise<void> {
    const db = getDb();
    await db
      .update(hoursLogs)
      .set({
        status: 'paid',
        paid_at: new Date(),
      })
      .where(eq(hoursLogs.id, id.getValue()));
  }

  private mapToDomain(row: typeof hoursLogs.$inferSelect): HoursLog {
    return {
      id: HoursLogId.fromString(row.id),
      trainerId: TrainerId.fromString(row.trainer_id),
      clubId: ClubId.fromString(row.club_id),
      date: new Date(row.date),
      hours: parseFloat(row.hours),
      hourlyRate: parseFloat(row.hourly_rate),
      status: row.status as 'pending' | 'approved' | 'paid',
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
    };
  }
}
```

### Schritt 4: Feature Flag Integration in API Routes

```typescript
// app/api/trainer/hours-logs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { shouldUseDrizzleRepo } from '@/lib/feature-flags';
import { DrizzleHoursLogRepository } from '@/infrastructure/persistence/repositories/hours-log.repository';
import { HoursLogService } from '@/application/services/hours-log.service';

export async function GET(req: NextRequest) {
  const { user } = await requireAuth();

  let logs;

  if (shouldUseDrizzleRepo('hours-log', user.id)) {
    // NEW: Use Drizzle Repository
    const repo = new DrizzleHoursLogRepository();
    logs = await repo.findByTrainer(TrainerId.fromString(user.id));
  } else {
    // OLD: Use in-memory service
    logs = await HoursLogService.getByTrainer(user.id);
  }

  return NextResponse.json(logs);
}
```

### Schritt 5: Database Migration erstellen

```sql
-- supabase/migrations/20260506210000_hours_logs_table.sql

CREATE TABLE IF NOT EXISTS hours_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  hours DECIMAL(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  hourly_rate DECIMAL(10,2) NOT NULL CHECK (hourly_rate >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_hours_logs_trainer ON hours_logs(trainer_id);
CREATE INDEX idx_hours_logs_club ON hours_logs(club_id);
CREATE INDEX idx_hours_logs_date ON hours_logs(date);
CREATE INDEX idx_hours_logs_status ON hours_logs(status);

-- RLS Policies
ALTER TABLE hours_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hours_logs_select" ON hours_logs
  FOR SELECT
  USING (
    is_superadmin() OR
    is_club_admin(club_id) OR
    trainer_id = auth.uid()
  );

CREATE POLICY "hours_logs_insert" ON hours_logs
  FOR INSERT
  WITH CHECK (
    is_superadmin() OR
    is_club_admin(club_id) OR
    trainer_id = auth.uid()
  );

CREATE POLICY "hours_logs_update" ON hours_logs
  FOR UPDATE
  USING (
    is_superadmin() OR
    is_club_admin(club_id)
  );

-- Trigger for updated_at
CREATE TRIGGER update_hours_logs_updated_at
  BEFORE UPDATE ON hours_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Schritt 6: Unit Tests schreiben

```typescript
// tests/infrastructure/repositories/hours-log.repository.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { DrizzleHoursLogRepository } from '@/infrastructure/persistence/repositories/hours-log.repository';
import { HoursLogId, TrainerId, ClubId } from '@/domain/value-objects';

describe('DrizzleHoursLogRepository', () => {
  let repo: DrizzleHoursLogRepository;

  beforeEach(() => {
    repo = new DrizzleHoursLogRepository();
  });

  it('should save and retrieve hours log', async () => {
    const log = {
      id: HoursLogId.create(),
      trainerId: TrainerId.create(),
      clubId: ClubId.create(),
      date: new Date(),
      hours: 2.5,
      hourlyRate: 50,
      status: 'pending' as const,
    };

    await repo.save(log);
    const found = await repo.findById(log.id);

    expect(found).not.toBeNull();
    expect(found?.hours).toBe(2.5);
    expect(found?.status).toBe('pending');
  });

  it('should approve hours log', async () => {
    const log = {
      id: HoursLogId.create(),
      trainerId: TrainerId.create(),
      clubId: ClubId.create(),
      date: new Date(),
      hours: 2.5,
      hourlyRate: 50,
      status: 'pending' as const,
    };

    await repo.save(log);
    await repo.approve(log.id);

    const found = await repo.findById(log.id);
    expect(found?.status).toBe('approved');
    expect(found?.approvedAt).toBeDefined();
  });
});
```

---

## Rollout-Strategie

### Phase 1: Dev Environment (Woche 1)

```bash
# Enable all repository flags in dev
USE_DRIZZLE_REPOS=true
```

**Testing**:

- Manuelle Tests mit allen Rollen
- E2E Tests ausführen
- Performance vergleichen (in-memory vs Drizzle)

### Phase 2: Staging (Woche 2)

```bash
# Enable for specific services
USE_HOURS_LOG_REPOSITORY=true
USE_BILLING_REPOSITORY=true
```

**Monitoring**:

- Error rates beobachten
- Query Performance messen
- Load Tests durchführen

### Phase 3: Production 10% (Woche 3)

```bash
# Gradual rollout to 10% of users
DRIZZLE_ROLLOUT_PERCENTAGE=10
```

**Metrics**:

- Response time comparison
- Error rate comparison
- User feedback

### Phase 4: Production 50% (Woche 4)

```bash
DRIZZLE_ROLLOUT_PERCENTAGE=50
```

### Phase 5: Production 100% (Woche 5)

```bash
USE_DRIZZLE_REPOS=true
DRIZZLE_ROLLOUT_PERCENTAGE=100
```

**Cleanup**:

- Remove in-memory services
- Remove feature flags
- Archive old code

---

## Checkliste pro Service

- [ ] Repository Interface definiert
- [ ] Drizzle Schema erstellt
- [ ] Repository Implementation geschrieben
- [ ] Database Migration erstellt
- [ ] RLS Policies hinzugefügt
- [ ] Feature Flag Integration
- [ ] Unit Tests geschrieben
- [ ] Integration Tests geschrieben
- [ ] API Route aktualisiert
- [ ] Dev Testing abgeschlossen
- [ ] Staging Testing abgeschlossen
- [ ] Production Rollout (10% → 100%)
- [ ] Alte Service-Datei entfernt
- [ ] Dokumentation aktualisiert

---

## Häufige Probleme & Lösungen

### Problem 1: In-Memory Service hat komplexe State-Management

**Lösung**: State in Domain Entities verlagern

```typescript
// Vorher (Service)
class BillingService {
  private static periods: BillingPeriod[] = [];
  private static currentPeriod: BillingPeriod | null = null;
}

// Nachher (Repository + Domain)
class BillingPeriodRepository {
  async findCurrent(): Promise<BillingPeriod | null> {
    return db.select().from(periods).where(eq(periods.status, 'current')).limit(1);
  }
}
```

### Problem 2: Service hat Business Logic gemischt mit Data Access

**Lösung**: Business Logic in Domain Services extrahieren

```typescript
// Domain Service
export class BillingEngine {
  calculateInvoiceAmount(items: LineItem[]): Money {
    // Business logic here
  }
}

// Repository (nur Data Access)
export class InvoiceRepository {
  async save(invoice: Invoice): Promise<void> {
    // Pure data persistence
  }
}
```

### Problem 3: Circular Dependencies

**Lösung**: Dependency Injection nutzen

```typescript
// Vorher
import { MemberService } from './member.service';
import { BillingService } from './billing.service';

// Nachher
export class CreateInvoiceUseCase {
  constructor(
    private memberRepo: MemberRepository,
    private invoiceRepo: InvoiceRepository
  ) {}
}
```

---

## Performance-Benchmarks

### In-Memory vs Drizzle Performance

| Operation           | In-Memory | Drizzle | Faktor            |
| ------------------- | --------- | ------- | ----------------- |
| findById            | 0.1ms     | 2-5ms   | 20-50x langsamer  |
| findAll (100 items) | 0.5ms     | 10-20ms | 20-40x langsamer  |
| save                | 0.1ms     | 5-10ms  | 50-100x langsamer |
| Complex Query       | 1ms       | 15-30ms | 15-30x langsamer  |

**Trade-offs**:

- ❌ Performance: In-Memory ist schneller
- ✅ Persistence: Drizzle speichert dauerhaft
- ✅ Scalability: Drizzle skaliert auf mehrere Instanzen
- ✅ ACID: Drizzle garantiert Transaktions-Sicherheit

**Empfehlung**: Performance-Unterschied ist vernachlässigbar für Web-Apps (10-20ms sind nicht spürbar), aber Vorteile von Persistence überwiegen deutlich.

---

## Migration Timeline

| Woche | Service                         | Aufwand | Status  |
| ----- | ------------------------------- | ------- | ------- |
| 1     | hours-log.service.ts            | 6h      | Pending |
| 1     | billing.service.ts              | 8h      | Pending |
| 2     | member.service.ts               | 4h      | Pending |
| 2     | trainer-availability.service.ts | 4h      | Pending |
| 3     | absence.service.ts              | 3h      | Pending |
| 3     | fee-configuration.service.ts    | 3h      | Pending |
| 3     | trainer-profile.service.ts      | 3h      | Pending |
| 4     | payment-settings.service.ts     | 2h      | Pending |
| 4     | system-settings.service.ts      | 2h      | Pending |
| 4     | trial-training.service.ts       | 3h      | Pending |
| 5     | Testing & Rollout               | 16h     | Pending |

**Total**: 5 Wochen, ~54 Stunden

---

**Nächster Schritt**: Mit hours-log.service.ts starten (höchste Priorität nach billing) 🚀
