# Architektur — Clean Architecture + DDD + CQRS in SwingZ

> Welche Schichten gibt es, wie kommunizieren sie, wo liegt was. Verbindlich: ['BUSINESS_RULES.md'](../../BUSINESS_RULES.md) für Domän-Begriffe, [`lib/auth-common.ts`](../../../lib/auth-common.ts) für die Rollen-Hierarchie.

## 🧱 Schichtenmodell (Clean Architecture)

```
┌───────────────────────────────────────────────────────┐
│ Presentation: Next.js App Router + Components        │
│   app/(protected)/, app/(public)/, app/api/,          │
│   app/landing/, components/, hooks/                   │
├───────────────────────────────────────────────────────┤
│ Application: Use Cases + DTOs                         │
│   src/application/use-cases/                          │
│   src/application/services/                           │
│   src/application/dtos/                               │
├───────────────────────────────────────────────────────┤
│ Domain: Entities + Value Objects + Repository Ifaces  │
│   src/domain/entities/                                │
│   src/domain/value-objects/                           │
│   src/domain/services/                                │
│   src/domain/repositories/                            │
├───────────────────────────────────────────────────────┤
│ Infrastructure: External (Supabase, Stripe, …)        │
│   src/infrastructure/external/supabase/               │
│   src/infrastructure/persistence/                     │
│   src/infrastructure/services/                        │
└───────────────────────────────────────────────────────┘
```

**Dependency-Rule:** Außen darf innen nicht kennen. Ein Domain-Entity darf KEIN React-Component importieren. Eine Use-Case darf KEIN Stripe-Code direkt importieren (nur über ein injiziertes Interface).

**Aktuelle Drift** (siehe `docs/PROJEKTANALYSE-KONSOLIDIERT-2026-07-01.md`): nur ~20 % (62/306) der Routes nutzen den `src/application`-Layer. Bookings/Billing/Matches laufen am Layer vorbei. Das ist **kein Verbot**, aber **Tech-Debt**.

### Wann ist Drift akzeptabel?

- **CRUD-Routes mit nur einer Permission-Prüfung**: OK inline in `route.ts`. Begründung: Use-Case-Wrapper wäre Overhead.
- **Routes mit Side-Effects** (Stripe, Notifications, DB-Writes): SOLLTEN über Use-Case laufen.
- **Routes mit Cross-Domain-Logik** (z. B. Saison-Abrechnung berührt Billing + Season-Billing + Invoices): MÜSSEN Use-Case haben.

## 🎯 DDD-Karte (Aggregates, Entities, Value Objects)

### Aggregates (mit Root-Entity)

| Aggregate         | Root                                         | Members                        | Tables                                   |
| ----------------- | -------------------------------------------- | ------------------------------ | ---------------------------------------- |
| **Booking**       | `Booking` (`src/domain/entities/booking.ts`) | BookingLine[]                  | `bookings`, `booking_line_items`         |
| **Schedule**      | `Schedule`                                   | Session[]                      | `schedules`, `sessions`                  |
| **Club**          | `Club`                                       | CourtType[], Court[], Member[] | `clubs`, `court_types`, `courts`         |
| **InvoiceRun**    | `Invoice`                                    | LineItem[]                     | `invoices`, `invoice_line_items`         |
| **SeasonBilling** | `SeasonBillingConfig`                        | —                              | `season_billing_configs`                 |
| **Tournament**    | `Tournament`                                 | Participant[]                  | `tournaments`, `tournament_participants` |

### Entities (kein Aggregate-Root)

`Member`, `Court`, `Session`, `Trainer`, `Payable`, `PricingRule`, `Decision`, `FaqEntry`, `Newsletter`, `PushSubscription`.

### Value Objects

| VO                                                        | Datei                                   | Validierung                     |
| --------------------------------------------------------- | --------------------------------------- | ------------------------------- |
| `BookingId`, `MemberId`, `SessionId`, `ClubId`, `CourtId` | `src/domain/value-objects/*`            | UUID-Format                     |
| `Email`                                                   | `src/domain/value-objects/email.ts`     | RFC-5322 + MX optional          |
| `TimeSlot`                                                | `src/domain/value-objects/time-slot.ts` | Start < End, Dauer 30/45/60 min |
| `Iban`                                                    | `lib/iban.ts`                           | ISO-13616 + Mod-97              |

Value Objects sind **immutable** und **selbst-validierend** (Constructor wirft bei Invalid).

## ⚡ CQRS — Command/Query-Trennung

| Command (Schreiben)     | Use-Case Datei                                     | HTTP-Trigger                 |
| ----------------------- | -------------------------------------------------- | ---------------------------- |
| `CreateBooking`         | `src/application/use-cases/booking.use-cases.ts`   | `POST /api/bookings`         |
| `CancelBooking`         | `src/application/use-cases/booking.use-cases.ts`   | `PATCH /api/bookings/:id`    |
| `ToggleMemberActive`    | `src/application/use-cases/member.use-cases.ts`    | `PATCH /api/members/:id`     |
| `GenerateInvoiceRun`    | `src/application/services/billing.service.ts`      | `POST /api/billing/generate` |
| `SubscribeSubscription` | `lib/stripe-subscription-quantity-sync.service.ts` | `POST /api/stripe/subscribe` |

| Query (Lesen)        | Repository Datei                                                    | HTTP-Trigger                         |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------ |
| `GetMemberBookings`  | `src/infrastructure/persistence/repositories/booking.repository.ts` | `GET /api/bookings/member/:memberId` |
| `GetClubAnalytics`   | `src/application/use-cases/club-analytics.use-cases.ts`             | `GET /api/dashboard/kpis?clubId=…`   |
| `FindSessionsByClub` | Sessions-Repository                                                 | `GET /api/sessions?clubId=…`         |

## 🏛 Module / CLI-Helper

Wichtige zentrale Helper (NICHT Layer-spezifisch, sondern querschnittlich):

| Helper                               | Import                         | Zweck                                        |
| ------------------------------------ | ------------------------------ | -------------------------------------------- |
| `requireAuth()`                      | `@/lib/auth.ts`                | Server Component Auth Guard                  |
| `requireApiAuth()` / `withApiAuth()` | `@/lib/api-auth.ts`            | API-Route Auth Guard (mit Cookie-Resolution) |
| `requireAdminClub()`                 | `@/lib/admin-context.ts`       | Admin-Page Auth (mit Club-Cookie-Resolution) |
| `verifyRole()`                       | `@/lib/api-auth.ts`            | Rollen-Hierarchie-Check                      |
| `verifyOffice()`                     | `@/lib/api-auth.ts`            | Ämter-Flag-Check (Kassenwart etc.)           |
| `createLogger()`                     | `@/lib/logger.ts`              | Strukturiertes Logging                       |
| `createServiceClient()`              | `@/lib/supabase/service.ts`    | Supabase Service-Client (umgeht RLS!)        |
| `claudeApiFetch`                     | `@/lib/api-fetch.ts`           | Client-Side Fetch-Wrapper                    |
| `getPagination(n)`                   | `@/lib/pagination.ts`          | Pagination Helper                            |
| `useClubFeatures()`                  | `@/hooks/use-club-features.ts` | Client-Hook für Feature-Flags                |

## 🔀 Datenfluss am Beispiel "Mitglied bucht Session"

```
1. Member klickt "Buchen" auf /sessions/[id]
   → Client-Component liest Club-Features via useClubFeatures()
   → ruft POST /api/bookings mit { memberId, sessionId }

2. app/api/bookings/route.ts
   → withApiAuth() resolved Rollen + Club-Kontext
   → verifyRole(auth, 'member')
   → Aufruf: BookingUseCase.create(memberId, sessionId)

3. src/application/use-cases/booking.use-cases.ts
   → Buchungsregeln prüfen (max. 3 pro Mitglied, Vorlauf-Zeit, etc.)
   → Aufruf: BookingRepository.createBookingSafe(memberId, sessionId)
   → RPC: create_booking_safe (DB-side FOR UPDATE + GIST-Exclusion-Constraint)
   → Aufruf: NotificationService.notifyBookingCreated(booking)

4. src/infrastructure/persistence/repositories/booking.repository.ts
   → supabase.rpc('create_booking_safe', {...})

5. RPC create_booking_safe
   → BEGIN; SELECT … FOR UPDATE; Capacity-Check; INSERT; COMMIT;
   → RETURNING *

6. lib/services/notification.service.ts
   → service-supabase.from('notifications').insert({...})

7. POST /api/cron/notify-dispatch (später, alle 5 min)
   → service-supabase.from('notifications').select('dispatched_at IS NULL')
   → für jede: Resend senden → dispatched_at setzen
```

Siehe [`themen-interplay.md`](./themen-interplay.md) für Sequenzdiagramme.

## ⚠️ Wo diese Schicht zu brechen ist

**Erlaubt (weil pragmatisch):**

- Direktes `supabase.from('x').select(...)` in Server-Components, wenn es **nur Lesen** ist und **kein Cross-Domain-Effekt** hat. Begründung: Use-Case-Wrapper wäre sinnlos.
- Inline-Logik in `route.ts`, wenn es ein einmaliger Admin-Action ist (z. B. Approve-Toggle).

**Verboten (Hard Rule):**

- Domain-Logic darf NIE in Client-Components liegen. Beispiel: Preis-Berechnung in `<PricingForm calc={...}>` ist verboten → muss Server-Action sein.
- Stripe-Calls direkt in Page-Components (auch Server Components) — dürfen NUR in `lib/stripe/*` oder via Webhook-Trigger erfolgen.
- `createServiceClient()` in Client-Components oder API-Routes, die Membership-respektierende Queries machen müssen — stattdessen `createServerClient` (siehe [`supabase-setup.md`](./supabase-setup.md)).

## 🔍 Wo finde ich was?

| Frage                                 | Datei                                                  |
| ------------------------------------- | ------------------------------------------------------ |
| Wie sieht Rollen-Hierarchie aus?      | `lib/auth-common.ts`                                   |
| Was darf welche Rolle sehen?          | [`dev/auth-rbac.md`](./auth-rbac.md)                   |
| Welche DB-Spalte heißt wie?           | [`dev/data-model.md`](./data-model.md)                 |
| Welche API-Route gibt's?              | [`dev/api-reference.md`](./api-reference.md)           |
| Wie schreibe ich eine neue API-Route? | [`dev/api-conventions.md`](./api-conventions.md)       |
| Wie funktioniert Stripe?              | [`dev/stripe-integration.md`](./stripe-integration.md) |
| Wie teste ich?                        | [`dev/testing-strategy.md`](./testing-strategy.md)     |

## 🏕️ Warum diese Architektur (nicht eine andere)?

History: Das Projekt startete 2025 als Monolith mit allem in `app/`. Die DDD/Clean-Architektur wurde 2026 in einer Refactoring-Welle (PR-Patterns `chore(refactor): extract domain entity`) eingeführt. Warum?

1. **Testbarkeit**: Use-Cases lassen sich ohne DB mocken (DI von Repository-Interface).
2. **DSGVO-Compliance**: Anonymisierung (`anonymize.service.ts`) braucht klare Aggregates, um zu wissen was personenbezogen ist.
3. **Multi-Tenant-Fehler-Vermeidung**: Use-Case-Schicht kann einheitlich prüfen "ist diese Entität im Club des Users?".
4. **Stripe-Webhook-Korrektheit**: Webhook-Handler brauchen Domain-Logik, keine Inline-Validierung.

Das alles funktioniert nur, wenn der Layer konsequent durchgehalten wird. Drift ist Tech-Debt, nicht Architektur-Verstoß per se.
