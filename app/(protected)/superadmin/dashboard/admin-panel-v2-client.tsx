'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsDashboard } from '@/components/admin/analytics-dashboard';
import { FeedbackModerationPanel } from '@/components/admin/feedback-moderation-panel';
import { AuditLogViewer } from '@/components/admin/audit-log-viewer';
import MemberListManagement from '@/components/member-list-management';
import { SessionBookings } from '@/components/bookings/session-bookings';
import SystemSettingsManagement from '@/components/system-settings';
import { BarChart3, MessageSquare, FileText, Settings, Users, Calendar } from 'lucide-react';
import type { AnalyticsMetrics } from '@/lib/services/analytics-service';

interface AdminPanelV2ClientProps {
  clubId: string;
  clubName: string;
  analyticsMetrics: AnalyticsMetrics | null;
  userRole: string;
}

export function AdminPanelV2Client({
  clubId,
  clubName,
  analyticsMetrics,
  userRole,
}: AdminPanelV2ClientProps) {
  const [activeTab, setActiveTab] = useState('analytics');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-primary">Admin Panel v2</h1>
          <p className="text-gray-500">{clubName}</p>
        </div>
        <div className="text-sm text-gray-500">
          Role: <span className="font-medium capitalize">{userRole}</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Feedback</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Audit Logs</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Sessions</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-6">
          {analyticsMetrics ? (
            <AnalyticsDashboard metrics={analyticsMetrics} clubName={clubName} />
          ) : (
            <div className="text-center py-12 text-gray-500">Failed to load analytics data</div>
          )}
        </TabsContent>

        <TabsContent value="feedback" className="mt-6">
          <FeedbackModerationPanel clubId={clubId} />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogViewer clubId={clubId} />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MemberListManagement clubId={clubId} embedded />
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <SessionBookings clubId={clubId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <SystemSettingsManagement clubId={clubId} embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
