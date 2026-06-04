'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AdminCourtCalendar from '@/components/admin-court-calendar';
import { CourtsManageClient } from './manage/courts-manage-client';
import { Calendar, Settings } from 'lucide-react';
import type { Court } from '@/lib/types/court-booking';

export function CourtsPageClient({
  clubId,
  initialCourts,
  courtTypes,
}: {
  clubId: string;
  initialCourts: Court[];
  courtTypes: Array<{ id: string; name: string; surface: string }>;
}) {
  return (
    <Tabs defaultValue="calendar" className="space-y-6">
      <TabsList className="w-full max-w-md grid grid-cols-2 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
        <TabsTrigger
          value="calendar"
          className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Platz-Kalender
        </TabsTrigger>
        <TabsTrigger
          value="manage"
          className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
        >
          <Settings className="h-4 w-4 mr-2" />
          Verwaltung
        </TabsTrigger>
      </TabsList>
      <TabsContent value="calendar">
        <AdminCourtCalendar initialClubId={clubId} />
      </TabsContent>
      <TabsContent value="manage">
        <CourtsManageClient initialCourts={initialCourts} courtTypes={courtTypes} clubId={clubId} />
      </TabsContent>
    </Tabs>
  );
}
