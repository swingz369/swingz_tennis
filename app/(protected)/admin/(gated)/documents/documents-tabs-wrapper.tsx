'use client';

import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, CalendarClock, Gavel } from 'lucide-react';
import type { BoardDecision, DecisionVote, MeetingInvitation } from '@/lib/types/decisions';

const MeetingsClient = dynamic(
  () => import('../meetings/meetings-client').then((m) => ({ default: m.MeetingsClient })),
  { ssr: false }
);
const DecisionsClient = dynamic(
  () => import('../decisions/decisions-client').then((m) => ({ default: m.DecisionsClient })),
  { ssr: false }
);

// Dieselbe Trigger-Optik wie die anderen shadcn-Tab-Leisten (settings, analytics),
// damit alle Admin-Tabs identisch aussehen statt der früheren Inline-Pills.
const TRIGGER_CLASS =
  'gap-2 rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-surface-dark data-[state=active]:text-primary data-[state=active]:shadow-sm';

export function DocumentsTabsWrapper({
  children,
  initialDecisions,
  initialVotes,
  initialInvitations,
}: {
  children: React.ReactNode;
  initialDecisions: BoardDecision[];
  initialVotes: DecisionVote[];
  initialInvitations: Pick<MeetingInvitation, 'decision_id' | 'status' | 'member_id'>[];
}) {
  return (
    <Tabs defaultValue="documents" className="space-y-6">
      <TabsList className="h-auto w-full max-w-3xl flex-wrap justify-start gap-1 bg-muted dark:bg-card/5 p-1 rounded-xl">
        <TabsTrigger value="documents" className={TRIGGER_CLASS}>
          <FileText className="h-4 w-4" />
          Dokumente
        </TabsTrigger>
        <TabsTrigger value="meetings" className={TRIGGER_CLASS}>
          <CalendarClock className="h-4 w-4" />
          Versammlungen
        </TabsTrigger>
        <TabsTrigger value="decisions" className={TRIGGER_CLASS}>
          <Gavel className="h-4 w-4" />
          Board-Beschlüsse
        </TabsTrigger>
      </TabsList>

      <TabsContent value="documents">{children}</TabsContent>
      <TabsContent value="meetings">
        <MeetingsClient />
      </TabsContent>
      <TabsContent value="decisions">
        <DecisionsClient
          initialDecisions={initialDecisions}
          initialVotes={initialVotes}
          initialInvitations={initialInvitations}
        />
      </TabsContent>
    </Tabs>
  );
}
