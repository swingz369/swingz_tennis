'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Settings, Palette, MapPin, ShieldAlert } from 'lucide-react';

const BrandingSettingsClient = dynamic(() => import('../branding/branding-client'), { ssr: false });
const CourtTypesClient = dynamic(
  () => import('../court-types/court-types-client').then((m) => ({ default: m.CourtTypesClient })),
  { ssr: false }
);
const AuditLogsList = dynamic(() => import('./audit-logs-tab'), { ssr: false });

type SettingsTab = 'general' | 'branding' | 'court-types' | 'audit-logs';

const tabs: {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'general', label: 'Allgemein', icon: Settings },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'court-types', label: 'Platztypen', icon: MapPin },
  { id: 'audit-logs', label: 'Audit-Logs', icon: ShieldAlert },
];

export function SettingsTabsWrapper({
  children,
  clubId,
}: {
  children: React.ReactNode;
  clubId: string;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="px-6 pt-2">
        <div className="flex gap-1 bg-muted dark:bg-card/5 p-1 rounded-xl w-fit flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
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

      {/* Tab content */}
      {activeTab === 'general' && children}
      {activeTab === 'branding' && <BrandingSettingsClient clubId={clubId} />}
      {activeTab === 'court-types' && <CourtTypesClient />}
      {activeTab === 'audit-logs' && <AuditLogsList clubId={clubId} />}
    </div>
  );
}
