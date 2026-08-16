'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HardHat, Users } from 'lucide-react';
import WorkDutiesClient from './work-duties-client';
import AssignmentsClient from './assignments/assignments-client';

/**
 * Arbeitsdienst — eine Sidebar-Sektion, eine Seite, zwei Sichten.
 * „Dienste" (anlegen/bearbeiten) und „Zuweisungen" (wer macht wann was)
 * sind zwei Tabs derselben Daten statt zweier Navigations-Einträge.
 * `?tab=assignments` öffnet die Seite direkt auf der Zuweisungs-Sicht
 * (Deep-Link von /admin/work-duties/assignments).
 */

export type Member = { id: string; name: string; email: string };

export type AssignmentWithName = {
  id: string;
  member_id: string;
  status: string;
  completed_at: string | null;
  name: string;
};

export type DutyWithAssignments = {
  id: string;
  title: string;
  duty_type: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  priority: string;
  work_duty_assignments: AssignmentWithName[];
};

export type MemberStat = { name: string; assigned: number; completed: number };

type Props = {
  members: Member[];
  duties: DutyWithAssignments[];
  memberStats: Record<string, MemberStat>;
};

function WorkDutiesHubTabsInner({ members, duties, memberStats }: Props) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams?.get('tab') || 'duties');

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="duties" className="gap-2">
          <HardHat className="h-4 w-4" />
          Dienste
        </TabsTrigger>
        <TabsTrigger value="assignments" className="gap-2">
          <Users className="h-4 w-4" />
          Zuweisungen
        </TabsTrigger>
      </TabsList>

      <TabsContent value="duties" className="mt-6">
        <WorkDutiesClient members={members} />
      </TabsContent>

      <TabsContent value="assignments" className="mt-6">
        <AssignmentsClient duties={duties} memberStats={memberStats} />
      </TabsContent>
    </Tabs>
  );
}

export function WorkDutiesHubTabs(props: Props) {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Laden…</div>}>
      <WorkDutiesHubTabsInner {...props} />
    </Suspense>
  );
}
