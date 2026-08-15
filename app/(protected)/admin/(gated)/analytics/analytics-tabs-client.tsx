'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ReportsDashboard from '@/components/reports-dashboard';
import { BarChart3, FileText } from 'lucide-react';

export function AnalyticsTabsClient({ children }: { children: React.ReactNode }) {
  return (
    <Tabs defaultValue="analytics" className="space-y-6">
      <div>
        <TabsList className="w-fit grid grid-cols-2 bg-muted dark:bg-card/5 p-1 rounded-xl">
          <TabsTrigger
            value="analytics"
            className="rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-surface-dark data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-surface-dark data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <FileText className="h-4 w-4 mr-2" />
            Berichte & Exporte
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="analytics">{children}</TabsContent>
      <TabsContent value="reports">
        <ReportsDashboard />
      </TabsContent>
    </Tabs>
  );
}
