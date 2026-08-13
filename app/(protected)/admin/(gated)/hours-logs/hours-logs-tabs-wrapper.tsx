'use client';

import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { Clock, CalendarOff } from 'lucide-react';

const AbsenceManagement = dynamic(
  () =>
    import('@/components/absences/absence-management').then((m) => ({
      default: m.AbsenceManagement,
    })),
  { ssr: false }
);

const TRIGGER_CLASS =
  'gap-2 rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm';

export function HoursLogsTabsWrapper({
  children,
  adminUserId,
}: {
  children: React.ReactNode;
  adminUserId: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stundennachweise & Abwesenheiten"
        description="Arbeitsstunden der Trainer verwalten und Abwesenheiten genehmigen"
      />

      <Tabs defaultValue="hours-logs" className="space-y-6">
        <TabsList className="h-auto w-full max-w-2xl flex-wrap justify-start gap-1 bg-muted dark:bg-card/5 p-1 rounded-xl">
          <TabsTrigger value="hours-logs" className={TRIGGER_CLASS}>
            <Clock className="h-4 w-4" />
            Stundennachweise
          </TabsTrigger>
          <TabsTrigger value="absences" className={TRIGGER_CLASS}>
            <CalendarOff className="h-4 w-4" />
            Abwesenheiten
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hours-logs">{children}</TabsContent>

        <TabsContent value="absences">
          <AbsenceManagement isAdmin adminUserId={adminUserId} hideHeader />
        </TabsContent>
      </Tabs>
    </div>
  );
}
