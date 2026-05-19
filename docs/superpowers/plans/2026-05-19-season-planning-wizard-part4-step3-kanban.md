# Season Planning Wizard — Part 4: Step 3 (Kanban Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Step 3 — Kanban board mit Drag & Drop, KI-Plan-Button, Konflikte-Badge

**Architecture:** Server page lädt plan-entries + members + groups. Client KanbanBoard nutzt @dnd-kit/core. Drag & Drop → optimistisches State-Update → PATCH plan-entries. Bei Fehler: Rollback + Toast.

**Tech Stack:** @dnd-kit/core + @dnd-kit/sortable (bereits installiert), Next.js 15, shadcn/ui, TypeScript

---

## Task 6: Step 3 — Plan (Kanban)

**Files:**
- Create: `app/(protected)/admin/seasons/[id]/wizard/plan/page.tsx`
- Create: `app/(protected)/admin/seasons/[id]/wizard/plan/kanban-board.tsx`
- Create: `app/(protected)/admin/seasons/[id]/wizard/plan/member-card.tsx`

- [ ] **Step 1: Create server page**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/plan/page.tsx
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { KanbanBoard } from './kanban-board'

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { data: season } = await supabase.from('seasons').select('id, club_id').eq('id', id).single()
  if (!season) notFound()

  const [{ data: groups }, { data: members }, { data: entries }] = await Promise.all([
    supabase.from('training_groups').select('id, name, level, max_participants').eq('club_id', season.club_id),
    supabase.from('profiles').select('id, full_name, level').eq('club_id', season.club_id).eq('role', 'member'),
    supabase.from('seasonPlanEntries').select('id, member_id, group_id, preference_match_score').eq('season_id', id),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Plan</h1>
        <p className="text-muted-foreground">Mitglieder per Drag & Drop auf Gruppen verteilen.</p>
      </div>
      <KanbanBoard
        seasonId={id}
        groups={groups ?? []}
        allMembers={members ?? []}
        initialEntries={entries ?? []}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create KanbanBoard**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/plan/kanban-board.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, DragEndEvent, closestCenter, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { MemberCard } from './member-card'

type Group = { id: string; name: string; level: string; max_participants: number | null }
type Member = { id: string; full_name: string; level: string }
type Entry = { id: string; member_id: string; group_id: string; preference_match_score: number | null }

export function KanbanBoard({ seasonId, groups, allMembers, initialEntries }: {
  seasonId: string; groups: Group[]; allMembers: Member[]; initialEntries: Entry[]
}) {
  const router = useRouter()
  const [entries, setEntries] = useState(initialEntries)
  const [running, setRunning] = useState(false)

  function getEntry(memberId: string) { return entries.find(e => e.member_id === memberId) }

  function membersForGroup(groupId: string | null) {
    const ids = new Set(entries.filter(e => (groupId === null ? !e.group_id : e.group_id === groupId)).map(e => e.member_id))
    return allMembers.filter(m => ids.has(m.id))
  }

  const unassigned = allMembers.filter(m => !entries.find(e => e.member_id === m.id))

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const memberId = active.id as string
    const newGroupId = over.id === 'unassigned' ? null : over.id as string
    const entry = getEntry(memberId)
    const snapshot = [...entries]

    setEntries(es => entry
      ? es.map(e => e.member_id === memberId ? { ...e, group_id: newGroupId ?? '' } : e)
      : [...es, { id: '', member_id: memberId, group_id: newGroupId ?? '', preference_match_score: null }]
    )

    const url = entry ? `/api/seasons/${seasonId}/plan-entries/${entry.id}` : `/api/seasons/${seasonId}/plan-entries`
    const res = await fetch(url, {
      method: entry ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, group_id: newGroupId }),
    })
    if (!res.ok) { setEntries(snapshot); toast.error('Fehler beim Speichern') }
    else if (!entry) {
      const saved = await res.json()
      setEntries(es => es.map(e => e.member_id === memberId && e.id === '' ? saved : e))
    }
  }

  async function triggerAutoPlan() {
    setRunning(true)
    const res = await fetch(`/api/seasons/${seasonId}/auto-plan`, { method: 'POST' })
    setRunning(false)
    if (!res.ok) { toast.error('KI-Plan fehlgeschlagen'); return }
    toast.success('KI-Plan generiert — Seite wird aktualisiert')
    router.refresh()
  }

  async function advance() {
    await fetch(`/api/seasons/${seasonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planning_status: 'invoices_generated' }),
    })
    router.push(`/admin/seasons/${seasonId}/wizard/billing`)
    router.refresh()
  }

  const assigned = allMembers.length - unassigned.length
  const columns = [
    { id: 'unassigned', name: 'Nicht eingeplant', level: '', max_participants: null, members: unassigned },
    ...groups.map(g => ({ ...g, members: membersForGroup(g.id) })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={triggerAutoPlan} disabled={running}>
          <Sparkles className="h-4 w-4 mr-2" />
          {running ? 'Analysiere...' : 'KI-Plan generieren'}
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{assigned}/{allMembers.length} eingeplant</span>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map(col => {
            const over = col.max_participants !== null && col.members.length > col.max_participants
            return (
              <div key={col.id} className="flex-shrink-0 w-60">
                <div className={`rounded-lg border bg-muted/30 p-3 space-y-2 min-h-[8rem] ${over ? 'border-destructive' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{col.name}</span>
                    <Badge variant={over ? 'destructive' : 'secondary'} className="ml-1 flex-shrink-0">
                      {col.members.length}{col.max_participants ? `/${col.max_participants}` : ''}
                    </Badge>
                  </div>
                  <SortableContext id={col.id} items={col.members.map(m => m.id)} strategy={verticalListSortingStrategy}>
                    {col.members.map(m => (
                      <MemberCard key={m.id} member={m} score={getEntry(m.id)?.preference_match_score ?? null} groupId={col.id} />
                    ))}
                  </SortableContext>
                </div>
              </div>
            )
          })}
        </div>
      </DndContext>

      <div className="flex justify-end pt-2">
        <Button onClick={advance}>Weiter zu Billing</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create MemberCard**

```typescript
// app/(protected)/admin/seasons/[id]/wizard/plan/member-card.tsx
'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Member = { id: string; full_name: string; level: string }

export function MemberCard({ member, score, groupId }: { member: Member; score: number | null; groupId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: member.id })
  const scoreColor = score === null ? '' : score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600'
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'rounded border bg-background px-2 py-1.5 text-sm cursor-grab select-none flex items-center justify-between',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary',
      )}
    >
      <span className="truncate mr-2">{member.full_name}</span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Badge variant="outline" className="text-xs px-1 py-0">{member.level}</Badge>
        {score !== null && <span className={cn('text-xs font-medium', scoreColor)}>{score}%</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/(protected)/admin/seasons/\[id\]/wizard/plan/
git commit -m "feat: wizard step 3 — Kanban plan with drag & drop"
```

**Next:** Part 5 — Steps 4+5 + billing API endpoints
