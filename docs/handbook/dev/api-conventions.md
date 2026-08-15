# API-Conventions — So schreibst du eine neue Route

> Pattern, Pflicht-Imports, Gotchas. Verbindlich für jede neue `/api/*/route.ts`.

## 🎯 Das 7-Säulen-Pattern

Jede API-Route folgt dieser Struktur:

```ts
// app/api/<feature>/route.ts (oder [id]/route.ts)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import { getPagination, buildPaginationMeta } from '@/lib/pagination';

const log = createLogger('api/widget');

// ─── Validierung ──────────────────────────────────────────────────────────
const BodySchema = z.object({
  name: z.string().min(1).max(80),
  amount: z.number().positive().int(),
});

// ─── POST (Create) ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    if (!auth.clubId) return forbiddenResponse('No club context');

    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      // … business logic …
      const result = await auth.supabase
        .from('widgets')
        .insert({ ...parsed.data, club_id: auth.clubId })
        .select()
        .single();

      log.info('widget created', { widgetId: result.data?.id, actorId: auth.user.id });
      return NextResponse.json(result.data, { status: 201 });
    } catch (err) {
      log.error('widget create failed', err instanceof Error ? err : undefined, {
        actorId: auth.user.id,
      });
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}

// ─── GET (List) ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    if (!auth.clubId) return forbiddenResponse('No club context');

    const { page, pageSize, offset } = getPagination(request, { defaultPageSize: 25 });

    const { data, error, count } = await auth.supabase
      .from('widgets')
      .select('*', { count: 'exact' })
      .eq('club_id', auth.clubId)
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('widget list failed', undefined, { error: error.message });
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }

    return NextResponse.json({
      widgets: data,
      meta: buildPaginationMeta(count ?? 0, page, pageSize),
    });
  });
}
```

## 📏 Die 7 Regeln im Detail

### 1. **Auth first, immer**

`withApiAuth(request, handler)` umschließt JEDE Route. Nicht-optional. Selbst für Public-Routes: `withApiAuth` macht 401 statt Crash.

```ts
// ❌ NIEMALS
export async function POST(request: NextRequest) {
  const body = await request.json();
  // ... direkt ohne auth
}

// ✅ IMMER
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const body = await request.json();
    // ...
  });
}
```

### 2. **Role-Check explizit**

`verifyRole(auth, 'admin')` ist nicht-inferentiell. Schreibe die Mindest-Rolle explizit, nicht die höchste, die der Code "zufällig" hat.

```ts
// ❌ Implizit
if (auth.role === 'admin') {
  /* … */
}
// Höhere Rollen sind implizit ausgeschlossen!

// ✅ Explizit
if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
// owner,s superadmin, admin dürfen durch
```

### 3. **Club-Scope prüfen bei Cross-Param-Risiko**

Wenn ein `clubId`-Parameter im Body/Query steht (statt aus Cookie):

```ts
if (!(await verifyClubAccess(auth, requestedClubId)))
  return forbiddenResponse('Club access denied');
```

`verifyClubAccess` lässt Owner/Superadmin immer durch (auch ohne Cookie-Match).

### 4. **Validierung mit Zod**

Jeder Input: Query, Body, Path → Zod-Schema, `safeParse`. Fehler als 400 mit `error.flatten()`.

```ts
const QuerySchema = z.object({
  clubId: z.string().uuid().optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
});
const parsed = QuerySchema.safeParse({
  clubId: request.nextUrl.searchParams.get('clubId') ?? undefined,
  includeArchived: request.nextUrl.searchParams.get('includeArchived') ?? undefined,
});
```

### 5. **Logging strukturiert**

`createLogger('api/<bereich>')` mit Doppelpunkt-Hierarchie. Pflicht-Felder:

```ts
log.info('event', {
  actorId: auth.user.id, // wer
  action: 'widget.create', // was
  entityId: result.id, // auf wen
  clubId: auth.clubId, // scope
});
```

`log.error(...)` mit Error-Objekt als 2. Parameter, Context als 3. Parameter.

### 6. **Pagination mit Helper**

`getPagination(request, { defaultPageSize: 25, maxPageSize: 100 })` liest `?page=`, `?pageSize=`. Liefert `{ page, pageSize, offset }`.

`buildPaginationMeta(count, page, pageSize)` fürs Response-Meta.

### 7. **Error-Format konsistent**

```ts
// 400 — Client-Fehler (Bad Input)
return NextResponse.json(
  { error: 'Invalid body', details: parsed.error.flatten() },
  { status: 400 }
);

// 401 — Auth fehlt (von withApiAuth geliefert)
// 403 — Permission verweigert (forbiddenResponse())
// 404 — Ressource nicht gefunden
return NextResponse.json({ error: 'Widget not found' }, { status: 404 });

// 409 — Konflikt (Duplicate, etc.)
return NextResponse.json({ error: 'Duplicate', details: { field: 'name' } }, { status: 409 });

// 500 — Server-Fehler
return NextResponse.json({ error: 'Internal error' }, { status: 500 });
// ⚠️ Keine internen Details an Client! Nur Log.
```

## ⚠️ Anti-Patterns (verbannt)

| Anti-Pattern                                          | Warum schlecht                                                              | Wie richtig                               |
| ----------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| `console.log()`                                       | Lint-Verbot (`@typescript-eslint/no-console`); Logs gehen nicht nach Sentry | `log.info()` aus `lib/logger`             |
| `as any` Cast                                         | TypeScript-strict verletzt; referred-Data kann nicht typgeprüft werden      | Branded Types / explizite Casts           |
| `supabase.from('x').select(...)` ohne `auth.supabase` | RLS umgangen oder User-Kontext fehlt                                        | IMMER `auth.supabase`                     |
| Direct Drizzle-Call in API Route                      | Bypass der Clean-Arch-Use-Case-Schicht                                      | Use-Case aus `src/application/use-cases/` |
| Inline-Stripe-Code                                    | Konflikt mit Webhook-Idempotenz                                             | `lib/stripe/*` Wrapper                    |
| Hard-coded Role-Strings                               | Drift zu `lib/auth-common.ts`                                               | `hasRole(auth.role, 'admin')`             |
| 200 mit `error`-Feld im Body                          | Client muss Status-Code parsen, nicht Body                                  | 4xx/5xx Status bei Fehlern                |

## 🔄 Methoden-Pattern

### POST (Create)

```ts
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // 1. Body validieren
    // 2. Insert
    // 3. Audit-Log schreiben (wenn Pflicht)
    // 4. Return 201 mit Entity
  });
}
```

### GET (Read/List)

```ts
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // 1. Query validieren (Pagination, Filter)
    // 2. Supabase-Query mit .eq('club_id', auth.clubId)
    // 3. Return mit Meta
  });
}
```

### PATCH (Update)

```ts
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const { id } = await params;
    // 1. fetch existing → 404 wenn nicht da
    // 2. Body validieren (partial)
    // 3. Update
    // 4. Audit-Log
  });
}
```

### DELETE

```ts
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async (auth) => {
    // ⚠️ Soft-delete bevorzugen wenn DSGVO-relevant
    // ⚠️ Hard-delete verboten für Member/Trainer/Buchungen
  });
}
```

## 🎵 Path-Param Convention

```
/api/[resource]/                  → POST (create)
/api/[resource]/[id]              → GET (read), PATCH (update), DELETE
/api/[resource]/[id]/[sub-action] → POST (action that affects [id])
```

Beispiele:

- `POST /api/bookings`
- `GET /api/bookings/[bookingId]`
- `PATCH /api/bookings/[bookingId]/cancel`
- `GET /api/members/[memberId]/bookings`

## 📦 Response-Shape

Erfolgreiche Antworten sind IMMER das Entity (oder Liste + Meta):

```ts
// Single
return NextResponse.json(entity, { status: 200 });

// List
return NextResponse.json({
  items: [...],
  meta: { page, pageSize, totalCount, totalPages }
}, { status: 200 });
```

## 🔍 Cross-Cutting Concerns

### CSRF

Für State-Changing Routes (`POST`, `PATCH`, `DELETE`): CSRF-Token in Header oder Cookie. `lib/csrf.ts` stellt Helper bereit. **Aktivieren wenn Route außerhalb von origin-handler-SSR läuft.**

### Rate-Limit

In `proxy.ts` ist eine globale Rate-Limit-Konfiguration. Spezielle Routes (z. B. Trial-Training, Magic-Link) zusätzlich in `lib/rate-limit.ts` schützen.

### Audit-Logging

Pflicht für: Buchung, Storno, Rechnung, Membership-Change.

**Einziger Schreibpfad: `logAudit()` aus `lib/audit.ts`.** Niemals direkt in
`audit_logs` inserten — auf der Tabelle existiert nur eine SELECT-Policy, jeder
Insert über den User-Client wird von RLS verworfen (genau daran sind bis
15.08.2026 alle Schreiber gescheitert, die Tabelle war leer).

```ts
await logAudit({
  actorId: auth.user.id, // muss in users existieren (FK), 'system' o. ä. wird verworfen
  action: 'member_deactivated', // UI-Label ergänzen: admin/(gated)/settings/audit-logs-tab.tsx
  resourceType: 'membership',
  resourceId: id, // uuid NOT NULL
  clubId: membership.club_id, // ohne club_id für Admins unsichtbar, nur Owner sieht die Zeile
  details: { role: membership.role },
  request,
});
```

`logAudit()` wirft nie und braucht kein try/catch. Ausnahme mit Absicht:
`lib/services/anonymize.service.ts` schreibt seine DSGVO-Zeilen weiter per
Drizzle, weil dort ein verschluckter Fehler die Idempotenz-Sentinel-Logik
(Intent-vor-Mutation) aushebeln würde.

### Notifications

Seiteneffekt z. B. nach `POST /api/bookings`: `notification.service.ts` einfügen.

## 🧪 Test-Pattern

Jede neue Route hat mindestens:

- **Unit-Test** für Use-Case-Business-Logik
- **Integration-Test** für Route-Handler mit gemocktem Supabase
- **E2E-Test** für den User-Flow (Playwright, in `tests/e2e/`)

```ts
// src/__tests__/api/widget.test.ts
import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/widget/route';

describe('POST /api/widget', () => {
  it('returns 401 without auth', async () => {
    const req = new Request('http://localhost/api/widget', { method: 'POST', body: '{}' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    // ... mocked auth context
  });
});
```

## 📚 Verwandte Kapitel

- [`auth-rbac.md`](./auth-rbac.md) — Rollen + Guards
- [`supabase-setup.md`](./supabase-setup.md) — Service-vs-Server-Client
- [`data-model.md`](./data-model.md) — Tabellen, die deine Route berührt
- [`api-reference.md`](./api-reference.md) — bestehende Routes, die du als Vorbild nimmst
