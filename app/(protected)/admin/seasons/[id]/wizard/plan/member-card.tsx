'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Member = { id: string; full_name: string; skill_level: string }

export function MemberCard({ member }: { member: Member; groupId?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: member.id })
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
      <Badge variant="outline" className="text-xs px-1 py-0 flex-shrink-0">{member.skill_level}</Badge>
    </div>
  )
}
