'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeedbackModerationPanel } from '@/components/admin/feedback-moderation-panel';
import { AuditLogViewer } from '@/components/admin/audit-log-viewer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  MessageSquare,
  FileText,
  Users,
  Calendar,
  Building2,
  ChevronRight,
  Shield,
  TrendingUp,
  Activity,
  GraduationCap,
  ArrowRightLeft,
} from 'lucide-react';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ClubWithStats, PlatformStats } from './page';
import { PageHeader } from '@/components/ui/page-header';

interface AdminPanelV2ClientProps {
  clubs: ClubWithStats[];
  platformStats: PlatformStats;
  userRole: string;
  firstName: string;
}

export function AdminPanelV2Client({
  clubs,
  platformStats,
  userRole,
  firstName,
}: AdminPanelV2ClientProps) {
  const [activeTab, setActiveTab] = useState('overview');

  function handleClubSwitch(clubId: string) {
    window.location.href = `/api/admin/switch-club-redirect?clubId=${encodeURIComponent(clubId)}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader
          title="Superadmin Dashboard"
          description={<>Hallo {firstName} — Plattform-Übersicht über alle Vereine</>}
        />
        <div className="flex items-center gap-3">
          {/* Club Switcher Dropdown */}
          <Select onValueChange={handleClubSwitch}>
            <SelectTrigger className="w-full sm:w-[260px] border-info-200 dark:border-info-800 hover:border-info-400 transition-colors">
              <ArrowRightLeft className="h-4 w-4 text-info-500 dark:text-info-400 mr-2 shrink-0" />
              <SelectValue placeholder="Verein auswählen…" />
            </SelectTrigger>
            <SelectContent>
              {clubs.map((club) => (
                <SelectItem key={club.id} value={club.id}>
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-3.5 w-3.5 text-info-500 dark:text-info-400 shrink-0" />
                    <span className="truncate">{club.name}</span>
                    {club.status === 'inactive' && (
                      <Badge variant="secondary" className="text-2xs px-1 py-0 leading-none">
                        Inaktiv
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {club.memberCount} Mitgl.
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge
            variant="outline"
            className="flex items-center gap-1 border-info-300 text-info-700 dark:border-info-700 dark:text-info-300 shrink-0"
          >
            <Shield className="h-3 w-3" /> {userRole}
          </Badge>
        </div>
      </div>

      {/* Platform KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Vereine',
            value: platformStats.totalClubs,
            icon: Building2,
            color: 'text-info-600 dark:text-info-400',
            bg: 'bg-info-50 dark:bg-info-900/20',
          },
          {
            label: 'Mitglieder gesamt',
            value: platformStats.totalMembers,
            icon: Users,
            color: 'text-info-600',
            bg: 'bg-info-50 dark:bg-info-900/20',
          },
          {
            label: 'Trainer gesamt',
            value: platformStats.totalTrainers,
            icon: GraduationCap,
            color: 'text-warning-600',
            bg: 'bg-warning-50 dark:bg-warning-900/20',
          },
          {
            label: 'Aktiv',
            value: clubs.filter((c) => c.status === 'active').length,
            icon: Activity,
            color: 'text-success-600',
            bg: 'bg-success-50 dark:bg-success-900/20',
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value.toLocaleString('de-DE')}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Club Overview Grid */}
      <div id="club-overview">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground dark:text-gray-200">Alle Vereine</h2>
          <Link
            href="/superadmin/clubs"
            className="text-xs text-info-600 dark:text-info-400 hover:underline font-medium flex items-center gap-1"
          >
            Verwalten <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map((club) => (
            <Card
              key={club.id}
              className="hover:shadow-md transition-all duration-200 border-2 hover:border-info-400/50 group"
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info-50 dark:bg-info-900/20 shrink-0">
                    <Building2 className="h-5 w-5 text-info-600 dark:text-info-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{club.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {club.status === 'inactive' && (
                        <Badge variant="secondary" className="text-xs">
                          Inaktiv
                        </Badge>
                      )}
                      {club.status === 'active' && (
                        <Badge variant="success" className="text-xs">
                          Aktiv
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {club.memberCount} Mitglieder
                  </span>
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    {club.trainerCount} Trainer
                  </span>
                </div>

                <Link
                  href={`/api/admin/switch-club-redirect?clubId=${club.id}`}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-info-600 text-white text-sm font-medium hover:bg-info-700 transition-colors group-hover:shadow-sm"
                >
                  Als Admin verwalten
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {clubs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium">Keine Vereine gefunden</p>
              <p className="text-sm mt-1">
                Erstelle einen neuen Verein unter{' '}
                <Link
                  href="/superadmin/clubs"
                  className="text-info-600 dark:text-info-400 hover:underline"
                >
                  Club-Verwaltung
                </Link>
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs for deeper management */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Übersicht</span>
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
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-info-600 dark:text-info-400" />
                Plattform-Statistiken
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Als Superadmin siehst du hier eine Gesamtübersicht aller Vereine. Wähle einen Verein
                oben aus, um ihn als Administrator zu verwalten.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Vereine aktiv',
                    value: clubs.filter((c) => c.status === 'active').length,
                  },
                  {
                    label: 'Vereine inaktiv',
                    value: clubs.filter((c) => c.status === 'inactive').length,
                  },
                  {
                    label: 'Ø Mitglieder / Verein',
                    value:
                      clubs.length > 0 ? Math.round(platformStats.totalMembers / clubs.length) : 0,
                  },
                  {
                    label: 'Ø Trainer / Verein',
                    value:
                      clubs.length > 0 ? Math.round(platformStats.totalTrainers / clubs.length) : 0,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="text-center p-4 bg-muted dark:bg-card/5 rounded-xl"
                  >
                    <p className="text-2xl font-bold text-info-600 dark:text-info-400">
                      {item.value.toLocaleString('de-DE')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="mt-6">
          <FeedbackModerationPanel />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogViewer />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Wähle einen Verein aus</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Um Mitglieder zu verwalten, wähle zuerst einen Verein aus der Übersicht aus. Du
                wirst dann in die Admin-Ansicht des Vereins weitergeleitet.
              </p>
              <Link
                href="#club-overview"
                className="text-sm text-info-600 dark:text-info-400 hover:underline font-medium"
              >
                Zur Vereinsübersicht ↑
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Wähle einen Verein aus</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Um Training-Sessions zu verwalten, wähle zuerst einen Verein aus der Übersicht aus.
                Du wirst dann in die Admin-Ansicht des Vereins weitergeleitet.
              </p>
              <Link
                href="#club-overview"
                className="text-sm text-info-600 dark:text-info-400 hover:underline font-medium"
              >
                Zur Vereinsübersicht ↑
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
