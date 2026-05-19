# Season Planning Wizard — Part 7: Step 5 (Publish) + Unit Tests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Step 5 Veröffentlichen-Seite + Vitest unit tests

**Architecture:** Publish-Page zeigt Zusammenfassung aus DB, Checkliste mit Warnungen, PublishButton ruft POST /api/seasons/[id]/planning/confirm auf. Nach Erfolg: grüner Erfolgsstatus + Link.

**Tech Stack:** Next.js 15, shadcn/ui (Card, Button, Badge), Vitest, TypeScript

---

## Task 10: Step 5 — Veröffentlichen

**Files:**
- Create: `app/(protected)/admin/seasons/[id]/wizard/publish/page.tsx`
- Create: `app/(protected)/admin/seasons/[id]/wizard/publish/publish-button.tsx`

- [ ] **Step 1: Create server page**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/publish/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { PublishButton } from './publish-button'

export default async function PublishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { data: season } = await supabase.from('seasons').select('id, name, club_id, planning_status').eq('id', id).single()
  if (!season) notFound()

  const [
    { count: groupCount },
    { count: memberCount },
    { count: invoiceCount },
    { data: waitlisted },
    { data: noTrainer },
  ] = await Promise.all([
    supabase.from('training_groups').select('*', { count: 'exact', head: true }).eq('club_id', season.club_id),
    supabase.from('seasonPlanEntries').select('*', { count: 'exact', head: true }).eq('season_id', id),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('season_id', id),
    supabase.from('seasonWaitlists').select('member_id').eq('season_id', id).eq('status', 'waiting'),
    supabase.from('training_groups').select('id').eq('club_id', season.club_id).is('trainer_id', null),
  ])

  const warnings: string[] = []
  if (waitlisted && waitlisted.length > 0) warnings.push(`${waitlisted.length} Mitglieder auf der Warteliste`)
  if (noTrainer && noTrainer.length > 0) warnings.push(`${noTrainer.length} Gruppen ohne Trainer`)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Veröffentlichen</h1>
        <p className="text-muted-foreground">Finaler Review bevor die Saison aktiviert wird.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Zusammenfassung</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Gruppen', value: groupCount ?? 0 },
            { label: 'Eingeplante Mitglieder', value: memberCount ?? 0 },
            { label: 'Rechnungen', value: invoiceCount ?? 0 },
            { label: 'Warteliste', value: waitlisted?.length ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-700 text-base">
              <AlertTriangle className="h-5 w-5" /> Warnungen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {warnings.map(w => <p key={w} className="text-sm text-yellow-700">• {w}</p>)}
          </CardContent>
        </Card>
      )}

      {season.planning_status === 'published' ? (
        <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <div>
            <p className="font-medium">Saison wurde veröffentlicht</p>
            <Link href={`/admin/seasons/${id}`} className="text-sm text-primary underline">Zur Saison-Übersicht</Link>
          </div>
        </div>
      ) : (
        <PublishButton seasonId={id} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create PublishButton**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/publish/publish-button.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export function PublishButton({ seasonId }: { seasonId: string }) {
  const router = useRouter()
  const [publishing, setPublishing] = useState(false)
  const [done, setDone] = useState(false)

  async function publish() {
    setPublishing(true)
    const res = await fetch(`/api/seasons/${seasonId}/planning/confirm`, { method: 'POST' })
    setPublishing(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Fehler beim Veröffentlichen')
      return
    }
    setDone(true)
    toast.success('Saison veröffentlicht!')
    router.refresh()
  }

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4">
        <CheckCircle className="h-6 w-6 text-green-600" />
        <div>
          <p className="font-medium">Saison wurde veröffentlicht</p>
          <Link href={`/admin/seasons/${seasonId}`} className="text-sm text-primary underline">Zur Saison-Übersicht</Link>
        </div>
      </div>
    )
  }

  return (
    <Button size="lg" onClick={publish} disabled={publishing} className="w-full sm:w-auto">
      {publishing ? 'Veröffentliche...' : 'Saison veröffentlichen'}
    </Button>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(protected)/admin/seasons/\[id\]/wizard/publish/
git commit -m "feat: wizard step 5 — Veröffentlichen"
```

---

## Task 11: Unit Tests

**Files:**
- Create: `tests/unit/billing-calculation.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/unit/billing-calculation.test.ts
import { describe, it, expect } from 'vitest'

function calcPreview(entries: any[], feeConfigs: any[]) {
  return entries.map(entry => {
    const fee = feeConfigs.find(f => {
      if (!f.conditions) return true
      if (f.conditions.trainingGroup && f.conditions.trainingGroup !== entry.group_id) return false
      return true
    }) ?? null
    return {
      memberId: entry.member_id,
      amount: fee?.amount ?? 0,
      installments: fee?.billing_cycle === 'installment' ? (fee.installment_count ?? 1) : 1,
    }
  })
}

describe('billing preview calculation', () => {
  it('assigns amount from matching fee config', () => {
    const result = calcPreview(
      [{ member_id: 'm1', group_id: 'g1' }],
      [{ amount: 120, billing_cycle: 'season', conditions: { trainingGroup: 'g1' } }]
    )
    expect(result[0].amount).toBe(120)
    expect(result[0].installments).toBe(1)
  })

  it('returns 0 when no config matches', () => {
    const result = calcPreview(
      [{ member_id: 'm1', group_id: 'g2' }],
      [{ amount: 120, billing_cycle: 'season', conditions: { trainingGroup: 'g1' } }]
    )
    expect(result[0].amount).toBe(0)
  })

  it('sets installments from installment_count', () => {
    const result = calcPreview(
      [{ member_id: 'm1', group_id: 'g1' }],
      [{ amount: 300, billing_cycle: 'installment', installment_count: 3, conditions: null }]
    )
    expect(result[0].installments).toBe(3)
  })

  it('uses global fee config when conditions null', () => {
    const result = calcPreview(
      [{ member_id: 'm1', group_id: 'any' }],
      [{ amount: 80, billing_cycle: 'season', conditions: null }]
    )
    expect(result[0].amount).toBe(80)
  })
})
```

- [ ] **Step 2: Run all unit tests**

```bash
npx vitest run tests/unit/wizard-stepper.test.ts tests/unit/billing-calculation.test.ts
```
Expected: all PASS

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors. Fix any type errors before proceeding.

- [ ] **Step 4: Commit + PR**

```bash
git add tests/unit/billing-calculation.test.ts
git commit -m "test: billing preview calculation unit tests"
```

Open PR from `worktree-season-planning-wizard-spec` → `main`:
```bash
gh pr create --title "feat: season planning wizard (5-step)" --body "$(cat <<'EOF'
## Summary
- 5-step wizard at /admin/seasons/[id]/wizard/[step]
- Wizard layout with persistent stepper (planning_status driven)
- Step 1: Einstellungen, Step 2: Gruppen CRUD, Step 3: Kanban Drag & Drop
- Step 4: Billing preview + generate, Step 5: Publish
- training-groups CRUD API, billing-preview + billing-generate endpoints
- DB migration: invoices_generated planning_status

## Test plan
- [ ] npx vitest run
- [ ] npx tsc --noEmit
- [ ] Manual: navigate /admin/seasons/[id]/wizard, complete all 5 steps
- [ ] Drag member between Kanban columns, verify DB update
- [ ] Browser refresh in step 3: state preserved

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
