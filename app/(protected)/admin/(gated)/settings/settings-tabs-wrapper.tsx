'use client';

import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { Settings, Building2, Zap, Palette, ShieldAlert, Landmark } from 'lucide-react';
import {
  ClubSettingsContent,
  SystemSettingsContent,
  ModuleSettingsContent,
} from './settings-client';

const BrandingSettingsClient = dynamic(() => import('../branding/branding-client'), {
  ssr: false,
});
const AuditLogsTab = dynamic(() => import('./audit-logs-tab'), { ssr: false });
const LegalTab = dynamic(() => import('./legal-tab').then((m) => ({ default: m.LegalTab })), {
  ssr: false,
});

const TRIGGER_CLASS =
  'gap-2 rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-surface-dark data-[state=active]:text-primary data-[state=active]:shadow-sm';

export function SettingsTabsWrapper({
  clubId,
  isSuperadmin,
}: {
  clubId: string;
  isSuperadmin: boolean;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vereinseinstellungen"
        description="Konfiguration, Branding und Sicherheit deines Vereins"
      />

      <Tabs defaultValue="club" className="space-y-6">
        <TabsList className="h-auto w-full max-w-3xl flex-wrap justify-start gap-1 bg-muted dark:bg-card/5 p-1 rounded-xl">
          <TabsTrigger value="club" className={TRIGGER_CLASS}>
            <Building2 className="h-4 w-4" />
            Verein
          </TabsTrigger>
          {isSuperadmin && (
            <TabsTrigger value="system" className={TRIGGER_CLASS}>
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
          )}
          <TabsTrigger value="modules" className={TRIGGER_CLASS}>
            <Zap className="h-4 w-4" />
            Module
          </TabsTrigger>
          <TabsTrigger value="branding" className={TRIGGER_CLASS}>
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="legal" className={TRIGGER_CLASS}>
            <Landmark className="h-4 w-4" />
            Vereinsregister
          </TabsTrigger>
          <TabsTrigger value="audit-logs" className={TRIGGER_CLASS}>
            <ShieldAlert className="h-4 w-4" />
            Audit-Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="club">
          <ClubSettingsContent />
        </TabsContent>

        {isSuperadmin && (
          <TabsContent value="system">
            <SystemSettingsContent />
          </TabsContent>
        )}

        <TabsContent value="modules">
          <ModuleSettingsContent clubId={clubId} />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingSettingsClient clubId={clubId} />
        </TabsContent>

        <TabsContent value="legal">
          <LegalTab clubId={clubId} />
        </TabsContent>

        <TabsContent value="audit-logs">
          <AuditLogsTab clubId={clubId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
