# Season Planning Wizard — Part 5: Billing API Endpoints

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Zwei neue API-Endpoints: billing-preview (kein DB-Write) + billing-generate (Massenrechnungen)

**Architecture:** Beide unter `/api/seasons/[id]/wizard/`. Preview liest `seasonPlanEntries` + `fee_configurations`, berechnet Beträge ohne zu schreiben. Generate iteriert Preview-Array und ruft `billing.service.createSeasonInvoice()` auf.

**Tech Stack:** Next.js 15, Supabase, existing `billing.service.ts`, `withApiAuth`

---

## Task 7: billing-preview endpoint

**Files:**
- Create: `app/api/seasons/[id]/wizard/billing-preview/route.ts`
- Create: `tests/unit/billing-preview.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/billing-preview.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: vi.fn((_r: any, _o: any, handler: any) => handler({ supabase: mockSupabase, clubId: 'club1', user: { id: 'u1' } })),
  checkRateLimitOrFail: vi.fn(),
  RATE_LIMITS: { STANDARD: {} },
}))

const mockSupabase = {
  from: (table: string) => ({
    select: () => ({ eq: () => ({ eq: () => ({ data: [], error: null }) }) }),
  }),
}

describe('POST /api/seasons/[id]/wizard/billing-preview', () => {
  it('returns 200 with array', async () => {
    const { POST } = await import('@/app/api/seasons/[id]/wizard/billing-preview/route')
    const req = new Request('http://localhost/api/seasons/s1/wizard/billing-preview', { method: 'POST' })
    const res = await POST(req as any, { params: Promise.resolve({ id: 's1' }) } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run tests/unit/billing-preview.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create route**

```typescript
// app/api/seasons/[id]/wizard/billing-preview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, checkRateLimitOrFail, RATE_LIMITS } from '@/lib/api-auth'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  checkRateLimitOrFail(request, RATE_LIMITS.STANDARD)
  const { id: seasonId } = await params
  return withApiAuth(request, { requiredRole: 'admin' }, async (auth) => {
    const [{ data: entries, error: eErr }, { data: feeConfigs, error: fErr }] = await Promise.all([
      auth.supabase.from('seasonPlanEntries').select('member_id, group_id, profiles(full_name)').eq('season_id', seasonId),
      auth.supabase.from('fee_configurations').select('*').eq('club_id', auth.clubId).eq('is_active', true),
    ])
    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })
    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

    const preview = (entries ?? []).map((entry: any) => {
      const fee = (feeConfigs ?? []).find((f: any) => {
        if (!f.conditions) return true
        if (f.conditions.trainingGroup && f.conditions.trainingGroup !== entry.group_id) return false
        return true
      }) ?? null
      return {
        memberId: entry.member_id,
        memberName: entry.profiles?.full_name ?? '',
        groupId: entry.group_id,
        amount: fee?.amount ?? 0,
        feeConfigId: fee?.id ?? null,
        billingCycle: fee?.billing_cycle ?? 'season',
        installments: fee?.billing_cycle === 'installment' ? (fee.installment_count ?? 1) : 1,
      }
    })
    return NextResponse.json(preview)
  })
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run tests/unit/billing-preview.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/api/seasons/\[id\]/wizard/billing-preview/ tests/unit/billing-preview.test.ts
git commit -m "feat: billing-preview API endpoint (no DB write)"
```

---

## Task 8: billing-generate endpoint

**Files:**
- Create: `app/api/seasons/[id]/wizard/billing-generate/route.ts`

- [ ] **Step 1: Check createSeasonInvoice signature**

Open `lib/services/billing.service.ts`, find `createSeasonInvoice`. Note the exact parameter names — you'll use them in the call below. Common signature:
```typescript
createSeasonInvoice(supabase, { clubId, memberId, seasonId, totalAmount, installmentCount })
```
If names differ, adjust accordingly in the route.

- [ ] **Step 2: Create route**

```typescript
// app/api/seasons/[id]/wizard/billing-generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, checkRateLimitOrFail, RATE_LIMITS } from '@/lib/api-auth'
import { createSeasonInvoice } from '@/lib/services/billing.service'

type PreviewItem = {
  memberId: string
  memberName: string
  groupId: string
  amount: number
  feeConfigId: string | null
  installments: number
  override?: { amount?: number; installments?: number }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  checkRateLimitOrFail(request, RATE_LIMITS.STANDARD)
  const { id: seasonId } = await params
  return withApiAuth(request, { requiredRole: 'admin' }, async (auth) => {
    const items: PreviewItem[] = await request.json()
    let generated = 0
    const errors: string[] = []

    for (const item of items) {
      const amount = item.override?.amount ?? item.amount
      const installments = item.override?.installments ?? item.installments
      try {
        await createSeasonInvoice(auth.supabase, {
          clubId: auth.clubId,
          memberId: item.memberId,
          seasonId,
          totalAmount: amount,
          installmentCount: installments,
        })
        generated++
      } catch (err: any) {
        errors.push(`${item.memberName}: ${err.message}`)
      }
    }

    await auth.supabase
      .from('seasons')
      .update({ planning_status: 'invoices_generated' })
      .eq('id', seasonId)

    return NextResponse.json({ generated, skipped: 0, errors })
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/seasons/\[id\]/wizard/billing-generate/
git commit -m "feat: billing-generate API — bulk invoice creation"
```

**Next:** Part 6 — Step 4 Billing UI
