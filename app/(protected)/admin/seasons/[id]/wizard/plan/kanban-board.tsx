'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { csrfHeaders } from '@/lib/csrf-client';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { MemberCard } from './member-card';

type Group = { id: string; name: string; level: string; member_ids: string[] | null };
type Member = { id: string; full_name: string; skill_level: string };

export function KanbanBoard({
  seasonId,
  groups,
  allMembers,
}: {
  seasonId: string;
  clubId?: string;
  groups: Group[];
  allMembers: Member[];
}) {
  const router = useRouter();
  const [groupMemberIds, setGroupMemberIds] = useState<Record<string, string[]>>(
    Object.fromEntries(groups.map((g) => [g.id, g.member_ids ?? []]))
  );
  const [running, setRunning] = useState(false);

  function getMemberGroupId(memberId: string): string | null {
    for (const [gid, ids] of Object.entries(groupMemberIds)) {
      if (ids.includes(memberId)) return gid;
    }
    return null;
  }

  function membersForGroup(groupId: string) {
    const ids = new Set(groupMemberIds[groupId] ?? []);
    return allMembers.filter((m) => ids.has(m.id));
  }

  const unassigned = allMembers.filter((m) => getMemberGroupId(m.id) === null);
  const assignedCount = allMembers.length - unassigned.length;

  async function patchGroup(groupId: string, newIds: string[]) {
    const res = await fetch(`/api/seasons/${seasonId}/groups/${groupId}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ member_ids: newIds }),
    });
    if (!res.ok) toast.error('Fehler beim Speichern');
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const memberId = active.id as string;
    const targetGroupId = over.id === 'unassigned' ? null : (over.id as string);
    const sourceGroupId = getMemberGroupId(memberId);
    if (sourceGroupId === targetGroupId) return;

    const snapshot = { ...groupMemberIds };

    setGroupMemberIds((prev) => {
      const next = { ...prev };
      // Remove from source group
      if (sourceGroupId) {
        next[sourceGroupId] = (next[sourceGroupId] ?? []).filter((id) => id !== memberId);
      }
      // Add to target group
      if (targetGroupId) {
        next[targetGroupId] = [...(next[targetGroupId] ?? []), memberId];
      }
      return next;
    });

    try {
      if (sourceGroupId)
        await patchGroup(
          sourceGroupId,
          (groupMemberIds[sourceGroupId] ?? []).filter((id) => id !== memberId)
        );
      if (targetGroupId)
        await patchGroup(targetGroupId, [...(groupMemberIds[targetGroupId] ?? []), memberId]);
    } catch {
      setGroupMemberIds(snapshot);
      toast.error('Fehler beim Speichern');
    }
  }

  async function triggerAutoPlan() {
    setRunning(true);
    const res = await fetch(`/api/seasons/${seasonId}/auto-plan`, { method: 'POST', headers: csrfHeaders() });
    setRunning(false);
    if (!res.ok) {
      toast.error('KI-Plan fehlgeschlagen');
      return;
    }
    toast.success('KI-Plan generiert');
    router.refresh();
  }

  async function advance() {
    await fetch(`/api/seasons/${seasonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ planning_status: 'invoices_generated' }),
    });
    router.push(`/admin/seasons/${seasonId}/wizard/billing`);
    router.refresh();
  }

  const columns = [
    { id: 'unassigned', name: 'Nicht eingeplant', level: '', members: unassigned },
    ...groups.map((g) => ({ ...g, members: membersForGroup(g.id) })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={triggerAutoPlan} disabled={running}>
          <Sparkles className="h-4 w-4 mr-2" />
          {running ? 'Analysiere...' : 'KI-Plan generieren'}
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          {assignedCount}/{allMembers.length} eingeplant
        </span>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <div key={col.id} className="flex-shrink-0 w-60">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 min-h-[8rem]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{col.name}</span>
                  <Badge variant="secondary" className="ml-1 flex-shrink-0">
                    {col.members.length}
                  </Badge>
                </div>
                <SortableContext
                  id={col.id}
                  items={col.members.map((m) => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {col.members.map((m) => (
                    <MemberCard key={m.id} member={m} groupId={col.id} />
                  ))}
                </SortableContext>
              </div>
            </div>
          ))}
        </div>
      </DndContext>
      <div className="flex justify-end pt-2">
        <Button onClick={advance}>Weiter zu Billing</Button>
      </div>
    </div>
  );
}
