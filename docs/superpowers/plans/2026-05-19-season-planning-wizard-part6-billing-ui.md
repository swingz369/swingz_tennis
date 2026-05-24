# Season Planning Wizard — Part 6: Step 4 (Billing UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Step 4 — Rechnungsvorschau mit Tabelle, "Alle generieren"-Button, Überspringen-Option

**Architecture:** Server page berechnet Preview inline (kein extra API-Call). Client-Komponente zeigt Tabelle mit editierbaren Beträgen/Raten. "Alle generieren" → POST billing-generate. "Überspringen" → direkt zu Step 5.

**Tech Stack:** Next.js 15, shadcn/ui (Table, Card, Button, Input, Badge), TypeScript

---

## Task 9: Step 4 — Billing Page

**Files:**

- Create: `app/(protected)/admin/seasons/[id]/wizard/billing/page.tsx`
- Create: `app/(protected)/admin/seasons/[id]/wizard/billing/billing-preview-table.tsx`

- [ ] **Step 1: Create server page**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/billing/page.tsx
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { BillingPreviewTable } from './billing-preview-table'

export default async function BillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { data: season } = await supabase.from('seasons').select('id, club_id').eq('id', id).single()
  if (!season) notFound()

  const [{ data: entries }, { data: feeConfigs }] = await Promise.all([
    supabase.from('seasonPlanEntries').select('member_id, group_id, profiles(full_name)').eq('season_id', id),
    supabase.from('fee_configurations').select('*').eq('club_id', season.club_id).eq('is_active', true),
  ])

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rechnungen</h1>
        <p className="text-muted-foreground">Vorschau der Rechnungen vor der Veröffentlichung.</p>
      </div>
      {(!feeConfigs || feeConfigs.length === 0) && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
          Keine aktiven Gebühren-Konfigurationen. Du kannst diesen Schritt überspringen und Rechnungen später unter Admin › Billing erstellen.
        </div>
      )}
      <BillingPreviewTable seasonId={id} initialPreview={preview} />
    </div>
  )
}
```

- [ ] **Step 2: Create BillingPreviewTable**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/billing/billing-preview-table.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

type PreviewItem = {
  memberId: string; memberName: string; groupId: string
  amount: number; feeConfigId: string | null; billingCycle: string; installments: number
}
type Override = { amount: string; installments: string }

export function BillingPreviewTable({ seasonId, initialPreview }: { seasonId: string; initialPreview: PreviewItem[] }) {
  const router = useRouter()
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [generating, setGenerating] = useState(false)

  function setOverride(id: string, field: keyof Override, val: string) {
    setOverrides(p => ({ ...p, [id]: { ...p[id], [field]: val } }))
  }

  const total = initialPreview.reduce((sum, item) => {
    return sum + (overrides[item.memberId]?.amount ? +overrides[item.memberId].amount : item.amount)
  }, 0)

  async function generate() {
    setGenerating(true)
    const payload = initialPreview.map(item => ({
      ...item,
      override: overrides[item.memberId]
        ? { amount: overrides[item.memberId].amount ? +overrides[item.memberId].amount : undefined, installments: overrides[item.memberId].installments ? +overrides[item.memberId].installments : undefined }
        : undefined,
    }))
    const res = await fetch(`/api/seasons/${seasonId}/wizard/billing-generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setGenerating(false)
    if (!res.ok) { toast.error('Fehler beim Generieren'); return }
    const { generated, errors } = await res.json()
    if (errors.length > 0) toast.error(`${errors.length} Fehler: ${errors[0]}`)
    else toast.success(`${generated} Rechnungen erstellt`)
    router.push(`/admin/seasons/${seasonId}/wizard/publish`)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Rechnungsvorschau</span>
          <span className="text-base font-normal text-muted-foreground">
            Gesamt: <strong>€{total.toFixed(2)}</strong> · {initialPreview.length} Mitglieder
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {initialPreview.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Keine eingeplanten Mitglieder.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mitglied</TableHead>
                <TableHead>Betrag (€)</TableHead>
                <TableHead>Raten</TableHead>
                <TableHead>Zyklus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialPreview.map(item => (
                <TableRow key={item.memberId}>
                  <TableCell>{item.memberName}</TableCell>
                  <TableCell>
                    <Input type="number" min={0} step={0.01} className="w-24 h-7 text-sm"
                      placeholder={String(item.amount)}
                      value={overrides[item.memberId]?.amount ?? ''}
                      onChange={e => setOverride(item.memberId, 'amount', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={1} className="w-16 h-7 text-sm"
                      placeholder={String(item.installments)}
                      value={overrides[item.memberId]?.installments ?? ''}
                      onChange={e => setOverride(item.memberId, 'installments', e.target.value)} />
                  </TableCell>
                  <TableCell><Badge variant="outline">{item.billingCycle}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={() => router.push(`/admin/seasons/${seasonId}/wizard/publish`)}>Überspringen</Button>
        <Button onClick={generate} disabled={generating || initialPreview.length === 0}>
          {generating ? 'Generiere...' : 'Alle Rechnungen generieren'}
        </Button>
      </CardFooter>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(protected)/admin/seasons/\[id\]/wizard/billing/
git commit -m "feat: wizard step 4 — Billing preview and generation"
```

**Next:** Part 7 — Step 5 Publish + Unit Tests
