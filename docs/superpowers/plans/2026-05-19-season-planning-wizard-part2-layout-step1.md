# Season Planning Wizard — Part 2: Layout + Step 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Wizard layout with stepper + Step 1 Einstellungen page

**Architecture:** `layout.tsx` fetches season from DB and renders stepper from `planning_status`. A pure helper `wizard-steps.ts` maps status → active step index. Each page is a server component + client form.

**Tech Stack:** Next.js 15 App Router, shadcn/ui (Card, Button, Input, Switch, Label), TypeScript

---

## Task 3: wizard-steps helper + layout

**Files:**
- Create: `app/(protected)/admin/seasons/[id]/wizard/wizard-steps.ts`
- Create: `app/(protected)/admin/seasons/[id]/wizard/layout.tsx`
- Create: `app/(protected)/admin/seasons/[id]/wizard/page.tsx`
- Create: `tests/unit/wizard-stepper.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/wizard-stepper.test.ts
import { describe, it, expect } from 'vitest'
import { getActiveStep } from '@/app/(protected)/admin/seasons/[id]/wizard/wizard-steps'

describe('getActiveStep', () => {
  it('returns 0 for draft', () => expect(getActiveStep('draft')).toBe(0))
  it('returns 1 for collecting_preferences', () => expect(getActiveStep('collecting_preferences')).toBe(1))
  it('returns 2 for manual_review', () => expect(getActiveStep('manual_review')).toBe(2))
  it('returns 3 for invoices_generated', () => expect(getActiveStep('invoices_generated')).toBe(3))
  it('returns 4 for published', () => expect(getActiveStep('published')).toBe(4))
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run tests/unit/wizard-stepper.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create wizard-steps.ts**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/wizard-steps.ts
export const WIZARD_STEPS = [
  { label: 'Einstellungen', href: 'preferences' },
  { label: 'Gruppen',       href: 'groups' },
  { label: 'Plan',          href: 'plan' },
  { label: 'Billing',       href: 'billing' },
  { label: 'Veröffentlichen', href: 'publish' },
] as const

const STATUS_TO_STEP: Record<string, number> = {
  draft: 0,
  collecting_preferences: 1,
  auto_planning: 2,
  manual_review: 2,
  invoices_generated: 3,
  published: 4,
  active: 4,
  completed: 4,
  archived: 4,
}

export function getActiveStep(status: string): number {
  return STATUS_TO_STEP[status] ?? 0
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run tests/unit/wizard-stepper.test.ts
```
Expected: PASS

- [ ] **Step 5: Create layout.tsx**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/layout.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveStep, WIZARD_STEPS } from './wizard-steps'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export default async function WizardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServerClient()
  const { data: season } = await supabase
    .from('seasons')
    .select('id, name, planning_status')
    .eq('id', id)
    .single()
  if (!season) notFound()

  const active = getActiveStep(season.planning_status ?? 'draft')

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card px-6 py-4">
        <p className="text-sm text-muted-foreground mb-3">{season.name} — Saisonplanung</p>
        <nav className="flex items-center gap-1">
          {WIZARD_STEPS.map((step, i) => {
            const done = i < active
            const current = i === active
            return (
              <div key={step.href} className="flex items-center gap-1">
                {i > 0 && <div className="h-px w-6 bg-border mx-1" />}
                {done ? (
                  <Link
                    href={`/admin/seasons/${id}/wizard/${step.href}`}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <Check className="h-4 w-4" />
                    {step.label}
                  </Link>
                ) : (
                  <span className={cn(
                    'flex items-center gap-1.5 text-sm font-medium',
                    current ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-xs border',
                      current ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground',
                    )}>
                      {i + 1}
                    </span>
                    {step.label}
                  </span>
                )}
              </div>
            )
          })}
        </nav>
      </div>
      <main className="container mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Create page.tsx redirect**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/page.tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveStep, WIZARD_STEPS } from './wizard-steps'

export default async function WizardIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { data: season } = await supabase
    .from('seasons').select('planning_status').eq('id', id).single()
  const step = WIZARD_STEPS[getActiveStep(season?.planning_status ?? 'draft')]
  redirect(`/admin/seasons/${id}/wizard/${step.href}`)
}
```

- [ ] **Step 7: Commit**

```bash
git add app/(protected)/admin/seasons/\[id\]/wizard/wizard-steps.ts \
        app/(protected)/admin/seasons/\[id\]/wizard/layout.tsx \
        app/(protected)/admin/seasons/\[id\]/wizard/page.tsx \
        tests/unit/wizard-stepper.test.ts
git commit -m "feat: wizard layout with stepper + redirect"
```

---

## Task 4: Step 1 — Einstellungen

**Files:**
- Create: `app/(protected)/admin/seasons/[id]/wizard/preferences/page.tsx`
- Create: `app/(protected)/admin/seasons/[id]/wizard/preferences/preferences-form.tsx`

- [ ] **Step 1: Create server page**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/preferences/page.tsx
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PreferencesForm } from './preferences-form'

export default async function PreferencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { data: season } = await supabase
    .from('seasons')
    .select('id, preferences_deadline, preferences_open, auto_plan_config')
    .eq('id', id)
    .single()
  if (!season) notFound()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground">Lege den Rahmen fest bevor Mitglieder Präferenzen abgeben.</p>
      </div>
      <PreferencesForm seasonId={id} season={season} />
    </div>
  )
}
```

- [ ] **Step 2: Create client form**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/preferences/preferences-form.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

type Season = {
  id: string
  preferences_deadline: string | null
  preferences_open: boolean | null
  auto_plan_config: Record<string, unknown> | null
}

export function PreferencesForm({ seasonId, season }: { seasonId: string; season: Season }) {
  const router = useRouter()
  const cfg = (season.auto_plan_config ?? {}) as Record<string, unknown>
  const [deadline, setDeadline] = useState(season.preferences_deadline?.slice(0, 10) ?? '')
  const [open, setOpen] = useState(season.preferences_open ?? false)
  const [minSize, setMinSize] = useState(String(cfg.group_min_size ?? 4))
  const [maxSize, setMaxSize] = useState(String(cfg.group_max_size ?? 8))
  const [maxSessions, setMaxSessions] = useState(String(cfg.max_sessions_per_week ?? 3))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/seasons/${seasonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences_deadline: deadline || null,
        preferences_open: open,
        planning_status: 'collecting_preferences',
        auto_plan_config: { ...cfg, group_min_size: +minSize, group_max_size: +maxSize, max_sessions_per_week: +maxSessions },
      }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Fehler beim Speichern'); return }
    toast.success('Einstellungen gespeichert')
    router.push(`/admin/seasons/${seasonId}/wizard/groups`)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader><CardTitle>Planungs-Einstellungen</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Präferenz-Deadline</Label>
          <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <Switch id="prefs-open" checked={open} onCheckedChange={setOpen} />
          <Label htmlFor="prefs-open">Präferenzen für Mitglieder öffnen</Label>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Min. Gruppengrösse</Label>
            <Input type="number" min={1} value={minSize} onChange={e => setMinSize(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Max. Gruppengrösse</Label>
            <Input type="number" min={1} value={maxSize} onChange={e => setMaxSize(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Max. Sessions/Woche</Label>
            <Input type="number" min={1} value={maxSessions} onChange={e => setMaxSessions(e.target.value)} />
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'Speichern...' : 'Speichern & Weiter'}</Button>
      </CardFooter>
    </Card>
  )
}
```

- [ ] **Step 3: Add wizard entry button to season detail page**

In `app/(protected)/admin/seasons/[id]/page.tsx`, find the header/actions area and add (import `Link` from `next/link` if not present):

```typescript
<Link href={`/admin/seasons/${season.id}/wizard`}>
  <Button>
    {['draft','collecting_preferences'].includes(season.planning_status ?? '')
      ? 'Saisonplanung starten'
      : 'Saisonplanung fortsetzen'}
  </Button>
</Link>
```

- [ ] **Step 4: Commit**

```bash
git add app/(protected)/admin/seasons/\[id\]/wizard/preferences/
git commit -m "feat: wizard step 1 — Einstellungen"
```

**Next:** Part 3 — Step 2 Gruppen
