# Billing & Training System — Part 6: Club Settings, Fee Categories & Verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add billing config fields to club settings UI, add fee category management, run full verification.

**Architecture:** Extend existing settings page. New price categories page. Final build + test run.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind, shadcn/ui

**Prerequisites:** All Parts 1–5 completed.

---

## Task 1: Club settings — billing config fields

Find the settings page first:

- [ ] Run: `grep -r "opening_hours\|Vereinseinstellungen\|club.*setting" /home/aeugeln/SwingZ/app --include="*.tsx" -l 2>/dev/null | head -5`
- [ ] Read the found settings file to understand current form fields
- [ ] Add these fields to the existing settings form:

```typescript
// Add these fields to whatever form/component manages club settings:

// 1. Bundesland select
const BUNDESLAENDER = [
  'Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen',
  'Hamburg','Hessen','Mecklenburg-Vorpommern','Niedersachsen',
  'Nordrhein-Westfalen','Rheinland-Pfalz','Saarland','Sachsen',
  'Sachsen-Anhalt','Schleswig-Holstein','Thüringen',
] as const;

// In JSX (adapt to existing form pattern):
<div className="space-y-2">
  <Label>Bundesland (für Schulferien)</Label>
  <select name="bundesland" defaultValue={club.bundesland ?? ''}
    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
    <option value="">-- Bitte wählen --</option>
    {BUNDESLAENDER.map(b => <option key={b} value={b}>{b}</option>)}
  </select>
</div>

// 2. Billing unit select
<div className="space-y-2">
  <Label>Abrechnungseinheit</Label>
  <select name="billing_unit_minutes" defaultValue={club.billing_unit_minutes ?? 60}
    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
    <option value={45}>45 Minuten</option>
    <option value={60}>60 Minuten</option>
  </select>
</div>

// 3. Tax rate input
<div className="space-y-2">
  <Label>Umsatzsteuersatz (%)</Label>
  <Input name="tax_rate" type="number" min={0} max={19} step={1}
    defaultValue={club.tax_rate ?? 0}
    placeholder="0 für gemeinnützige e.V." />
</div>

// 4. Default payment method
<div className="space-y-2">
  <Label>Standard-Zahlungsweg</Label>
  <select name="default_payment_method" defaultValue={club.default_payment_method ?? 'sepa'}
    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
    <option value="sepa">SEPA Lastschrift</option>
    <option value="transfer">Überweisung</option>
    <option value="cash">Bar</option>
    <option value="stripe">Online (Stripe)</option>
  </select>
</div>

// 5. Invoice number prefix
<div className="space-y-2">
  <Label>Rechnungsnummer-Präfix</Label>
  <Input name="invoice_number_prefix" defaultValue={club.invoice_number_prefix ?? 'INV'}
    maxLength={10} placeholder="INV" />
</div>
```

- [ ] Wire new fields to existing club update API (find the API endpoint used by the settings form and ensure it passes the new fields through to the `clubs` table update)
- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add billing config fields to club settings`

## Task 2: Fee categories page `app/(protected)/admin/billing/categories/page.tsx`

- [ ] Create `app/(protected)/admin/billing/categories/page.tsx`:

```typescript
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FeeCategoriiesClient } from './fee-categories-client';

export default async function FeeCategoriesPage({ searchParams }: { searchParams: { clubId?: string } }) {
  const { supabase, user } = await requireAuth();
  const clubId = searchParams.clubId;
  if (!clubId) redirect('/admin/billing');

  const { data: categories } = await supabase
    .from('fee_configurations')
    .select('*')
    .eq('club_id', clubId)
    .in('type', ['training', 'membership'])
    .order('type').order('name');

  return <FeeCategoriiesClient clubId={clubId} initialCategories={categories ?? []} />;
}
```

- [ ] Create `app/(protected)/admin/billing/categories/fee-categories-client.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FeeConfig {
  id: string; name: string; type: string; amount: number;
  billing_cycle: string; billing_unit_count: number; is_active: boolean;
}

export function FeeCategoriiesClient({ clubId, initialCategories }: { clubId: string; initialCategories: FeeConfig[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'training', amount: 0, billing_unit_count: 1, billing_cycle: 'yearly' });

  const handleCreate = async () => {
    const res = await fetch('/api/admin/fee-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, club_id: clubId }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setCategories(prev => [...prev, data]);
      setCreating(false);
      setForm({ name: '', type: 'training', amount: 0, billing_unit_count: 1, billing_cycle: 'yearly' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Preiskategorien</h1>
        <Button onClick={() => setCreating(true)}>Neue Kategorie</Button>
      </div>
      {creating && (
        <Card><CardContent className="pt-4 space-y-3">
          <Input placeholder="Name (z.B. Erwachsene)" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm">
            <option value="training">Training</option>
            <option value="membership">Mitgliedschaft</option>
          </select>
          <Input type="number" placeholder="Preis (€)" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) }))} />
          <div className="flex gap-2">
            <Button onClick={handleCreate}>Speichern</Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Abbrechen</Button>
          </div>
        </CardContent></Card>
      )}
      <div className="divide-y">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">{cat.name}</p>
              <p className="text-sm text-muted-foreground">{cat.type === 'training' ? 'Training' : 'Mitgliedschaft'} · {cat.amount.toFixed(2)} €</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {cat.is_active ? 'Aktiv' : 'Inaktiv'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] Create `app/api/admin/fee-categories/route.ts` with GET + POST (reads/writes `fee_configurations` table, admin-only)
- [ ] `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `feat(billing): add fee categories management page`

## Task 3: Full build verification

- [ ] Run: `cd /home/aeugeln/SwingZ && npm run build 2>&1 | tail -20`
  - Expected: `✓ Compiled successfully` or only pre-existing warnings
  - If new errors appear: fix them before proceeding

- [ ] Run: `cd /home/aeugeln/SwingZ && npx vitest run 2>&1 | tail -15`
  - Expected: all tests pass (new billing tests included)

- [ ] Run manual security check:
  - `curl -s http://localhost:3000/api/billing/invoices` should return 401 or redirect (not data)

- [ ] Commit any fixes: `fix(billing): address build and test issues`

## Task 4: Update plan index

- [ ] Create `docs/superpowers/plans/2026-05-19-billing-INDEX.md` listing all 8 plan files in order:

```markdown
# Billing & Training System — Implementation Plan Index

Execute parts in this order:

1. [Part 1: Schema Migration](./2026-05-19-billing-part1-schema.md)
2. [Part 2a: Types & Balance Service](./2026-05-19-billing-part2a-types-balance.md)
3. [Part 2b: Invoice & Group Change Services](./2026-05-19-billing-part2b-invoice-service.md)
4. [Part 3: School Holidays & Season Integration](./2026-05-19-billing-part3-holidays.md)
5. [Part 4a: Invoice API Routes](./2026-05-19-billing-part4a-api-invoices.md)
6. [Part 4b: Bulk Generation, Group Change & Balance Routes](./2026-05-19-billing-part4b-api-bulk.md)
7. [Part 5: Admin UI](./2026-05-19-billing-part5-ui.md)
8. [Part 6: Club Settings, Fee Categories & Verification](./2026-05-19-billing-part6-verification.md)

**Design spec:** [docs/superpowers/specs/2026-05-19-billing-training-system-design.md](../specs/2026-05-19-billing-training-system-design.md)
```

- [ ] Commit: `docs(billing): add implementation plan index`
