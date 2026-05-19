# Season Planning Wizard — Part 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DB migration for `invoices_generated` status + training-groups CRUD API

**Architecture:** New enum value in `planning_status`, three new API routes for training_groups CRUD. Follow existing pattern: rate-limit → auth → supabase query → JSON response.

**Tech Stack:** Next.js 15, Supabase, TypeScript, existing `withApiAuth` helper

---

## Task 1: DB Migration — add `invoices_generated` planning_status

**Files:**
- Create: `supabase/migrations/20260519_add_invoices_generated_status.sql`
- Modify: `lib/types/season-planning.ts`

- [ ] **Step 1: Write migration SQL**

```sql
-- supabase/migrations/20260519_add_invoices_generated_status.sql
ALTER TYPE planning_status ADD VALUE IF NOT EXISTS 'invoices_generated' AFTER 'manual_review';
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```
Expected: migration applied without errors.

- [ ] **Step 3: Update TypeScript enum**

In `lib/types/season-planning.ts`, find the `PlanningStatus` enum and add after `MANUAL_REVIEW`:

```typescript
INVOICES_GENERATED = 'invoices_generated',
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260519_add_invoices_generated_status.sql lib/types/season-planning.ts
git commit -m "feat: add invoices_generated planning_status enum value"
```

---

## Task 2: training-groups CRUD API

**Files:**
- Create: `app/api/training-groups/route.ts`
- Create: `app/api/training-groups/[id]/route.ts`
- Create: `tests/unit/training-groups-api.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/training-groups-api.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: vi.fn((_req: any, _opts: any, handler: any) =>
    handler({ supabase: { from: () => ({ insert: () => ({ select: () => ({ single: () => ({ data: null, error: { message: 'fail' } }) }) }) }) }, user: { id: 'u1' }, clubId: 'c1' })
  ),
  checkRateLimitOrFail: vi.fn(),
  RATE_LIMITS: { STANDARD: {} },
}))

describe('POST /api/training-groups', () => {
  it('returns 400 when name missing', async () => {
    const { POST } = await import('@/app/api/training-groups/route')
    const req = new Request('http://localhost/api/training-groups', {
      method: 'POST',
      body: JSON.stringify({ level: 'A' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/unit/training-groups-api.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/training-groups/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, checkRateLimitOrFail, RATE_LIMITS } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  checkRateLimitOrFail(request, RATE_LIMITS.STANDARD)
  return withApiAuth(request, { requiredRole: 'admin' }, async (auth) => {
    const seasonId = new URL(request.url).searchParams.get('seasonId')
    let query = auth.supabase.from('training_groups').select('*').eq('club_id', auth.clubId)
    if (seasonId) query = (query as any).eq('season_id', seasonId)
    const { data, error } = await (query as any).order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  })
}

export async function POST(request: NextRequest) {
  checkRateLimitOrFail(request, RATE_LIMITS.STANDARD)
  return withApiAuth(request, { requiredRole: 'admin' }, async (auth) => {
    const body = await request.json()
    const { name, level, age_group, schedule_id, max_participants } = body
    if (!name || !level) return NextResponse.json({ error: 'name and level required' }, { status: 400 })
    const { data, error } = await auth.supabase
      .from('training_groups')
      .insert({ name, level, age_group, schedule_id, max_participants, club_id: auth.clubId, is_active: true })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  })
}
```

- [ ] **Step 4: Create `app/api/training-groups/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, checkRateLimitOrFail, RATE_LIMITS } from '@/lib/api-auth'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  checkRateLimitOrFail(request, RATE_LIMITS.STANDARD)
  const { id } = await params
  return withApiAuth(request, { requiredRole: 'admin' }, async (auth) => {
    const body = await request.json()
    const { data, error } = await auth.supabase
      .from('training_groups')
      .update(body)
      .eq('id', id)
      .eq('club_id', auth.clubId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  checkRateLimitOrFail(request, RATE_LIMITS.STANDARD)
  const { id } = await params
  return withApiAuth(request, { requiredRole: 'admin' }, async (auth) => {
    const { error } = await auth.supabase
      .from('training_groups')
      .delete()
      .eq('id', id)
      .eq('club_id', auth.clubId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  })
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx vitest run tests/unit/training-groups-api.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/training-groups/ tests/unit/training-groups-api.test.ts
git commit -m "feat: add training-groups CRUD API endpoints"
```

---

**Next:** Continue with Part 2 — Wizard layout + Step 1 (Einstellungen)
