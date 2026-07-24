'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Clock, CalendarOff } from 'lucide-react';

const AbsenceManagement = dynamic(
  () =>
    import('@/components/absences/absence-management').then((m) => ({
      default: m.AbsenceManagement,
    })),
  { ssr: false }
);

type HoursLogsTab = 'hours-logs' | 'absences';

const tabs: {
  id: HoursLogsTab;
  label: string;
  icon: React.ComponentType<{ className?: string | undefined }>;
}[] = [
  { id: 'hours-logs', label: 'Stundennachweise', icon: Clock },
  { id: 'absences', label: 'Abwesenheiten', icon: CalendarOff },
];

export function HoursLogsTabsWrapper({
  children,
  adminUserId,
}: {
  children: React.ReactNode;
  adminUserId: string;
}) {
  const [activeTab, setActiveTab] = useState<HoursLogsTab>('hours-logs');

  return (
    <div className="space-y-6">
      <div className="px-6 pt-2">
        <div className="flex gap-1 bg-muted dark:bg-card/5 p-1 rounded-xl w-fit flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                activeTab === tab.id
                  ? 'bg-background dark:bg-surface-dark text-brand-primary shadow-sm'
                  : 'text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-white'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'hours-logs' && children}
      {activeTab === 'absences' && <AbsenceManagement isAdmin adminUserId={adminUserId} />}
    </div>
  );
}
