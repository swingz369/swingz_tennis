'use client';

import { AnimatedCounter, ScrollReveal } from '@/components/animations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CustomizableDashboard } from '@/components/customizable-dashboard';
import {
  Building2,
  Users,
  UserCheck,
  Euro,
  ArrowRight,
  TrendingUp,
  Activity,
  Award,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { DashboardWidget } from '@/lib/dashboard-widgets';

interface ClubData {
  id: string;
  name: string;
  members: number;
  trainers: number;
  revenue: number;
}

interface DashboardData {
  clubs: ClubData[];
  totalClubs: number;
  totalMembers: number;
  totalTrainers: number;
  totalRevenue: number;
}

// ─── Widget Renderers ───

const KPI_CONFIGS = [
  {
    type: 'kpi_clubs',
    title: 'Vereine',
    icon: Building2,
    gradient: 'from-emerald-500 to-brand-primary',
    href: '/admin/clubs',
  },
  {
    type: 'kpi_members',
    title: 'Mitglieder',
    icon: Users,
    gradient: 'from-blue-500 to-indigo-600',
    href: '/admin/members',
  },
  {
    type: 'kpi_trainers',
    title: 'Trainer',
    icon: UserCheck,
    gradient: 'from-green-500 to-emerald-700',
    href: '/admin/trainers',
  },
  {
    type: 'kpi_revenue',
    title: 'Umsatz',
    icon: Euro,
    gradient: 'from-brand-accent to-orange-700',
    href: '/admin/billing',
  },
] as const;

function KpiCard({
  config,
  value,
  index,
}: {
  config: (typeof KPI_CONFIGS)[number];
  value: number | string;
  index: number;
}) {
  const router = useRouter();
  const Icon = config.icon;
  return (
    <ScrollReveal delay={index * 80}>
      <Card
        variant="glass"
        className="group cursor-pointer hover-lift transition-all duration-300"
        role="link"
        tabIndex={0}
        aria-label={`${config.title}: ${value} — Details anzeigen`}
        onClick={() => router.push(config.href)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            router.push(config.href);
          }
        }}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{config.title}</p>
              <p className="text-3xl font-bold text-foreground dark:text-white">
                {typeof value === 'number' ? (
                  <AnimatedCounter value={value} />
                ) : (
                  <span className="tabular-nums">{value}</span>
                )}
              </p>
            </div>
            <div
              className={`p-3.5 rounded-2xl bg-gradient-to-br ${config.gradient} text-white shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}
            >
              <Icon className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-medium text-brand-light opacity-0 group-hover:opacity-100 transition-opacity">
            Details anzeigen
            <ArrowRight className="h-3 w-3" />
          </div>
        </CardContent>
      </Card>
    </ScrollReveal>
  );
}

function ClubListWidget({
  clubs,
  router: r,
}: {
  clubs: ClubData[];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <ScrollReveal delay={200}>
      <Card variant="glass" className="overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-brand-primary to-brand-dark text-white shadow-sm">
                <Building2 className="h-4 w-4" />
              </div>
              <span>Alle Vereine</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => r.push('/admin/clubs')}
              className="text-xs"
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Verwalten
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border dark:divide-white/10">
            {clubs.map((club) => (
              <div
                key={club.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-muted/80 dark:hover:bg-background/[0.03] transition-all duration-200 group cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    r.push(`/admin/clubs/${club.id}/dashboard`);
                  }
                }}
                onClick={() => r.push(`/admin/clubs/${club.id}/dashboard`)}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-primary/10 to-brand-dark/10 dark:from-white/5 dark:to-white/[0.02] flex items-center justify-center text-brand-primary dark:text-brand-light group-hover:scale-110 transition-transform">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground dark:text-white group-hover:text-brand-primary dark:group-hover:text-brand-light transition-colors">
                      {club.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <span className="tabular-nums">{club.members}</span> Mitglieder ·{' '}
                      <span className="tabular-nums">{club.trainers}</span> Trainer
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                    <span>€{club.revenue.toLocaleString()}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-all duration-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      r.push(`/admin/clubs/${club.id}/dashboard`);
                    }}
                  >
                    Details
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {clubs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted dark:bg-card/5 flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground mb-1">Keine Vereine vorhanden</p>
              <p className="text-sm text-muted-foreground mb-4">
                Erstelle den ersten Verein, um zu starten
              </p>
              <Button
                variant="default"
                onClick={() => r.push('/admin/clubs/new')}
                className="bg-brand-primary hover:bg-brand-dark text-white"
              >
                Verein anlegen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </ScrollReveal>
  );
}

// ─── Main Dashboard ───

export function SuperadminDashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();

  if (!data || typeof data !== 'object') {
    return (
      <div className="p-6 min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-600 font-medium">Fehler: Ungültige Dashboard-Daten</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const safeData = {
    clubs: Array.isArray(data.clubs) ? data.clubs : [],
    totalClubs: data.totalClubs ?? 0,
    totalMembers: data.totalMembers ?? 0,
    totalTrainers: data.totalTrainers ?? 0,
    totalRevenue: data.totalRevenue ?? 0,
  };

  const valueMap: Record<string, number | string> = {
    kpi_clubs: safeData.totalClubs,
    kpi_members: safeData.totalMembers,
    kpi_trainers: safeData.totalTrainers,
    kpi_revenue: `€${safeData.totalRevenue.toLocaleString()}`,
  };

  const renderWidget = (widget: DashboardWidget) => {
    const kpiConfig = KPI_CONFIGS.find((c) => c.type === widget.type);
    if (kpiConfig) {
      const idx = KPI_CONFIGS.indexOf(kpiConfig);
      return <KpiCard config={kpiConfig} value={valueMap[widget.type] ?? 0} index={idx} />;
    }
    if (widget.type === 'club_list') {
      return <ClubListWidget clubs={safeData.clubs} router={router} />;
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary via-brand-primary/95 to-brand-dark p-8 text-white">
          <div className="absolute inset-0 bg-noise opacity-5" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-background/5 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-brand-accent/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white/70 mb-1">Superadmin</p>
                <h1 className="text-3xl font-bold">Plattform Dashboard</h1>
                <p className="text-white/70 mt-2">Übersicht aller Vereine und Kennzahlen</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-xl bg-background/10 backdrop-blur-sm px-4 py-2.5">
                <Award className="h-5 w-5 text-brand-accent" />
                <span className="text-sm font-medium">{safeData.totalClubs} Vereine</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Customizable Widget Grid */}
      <CustomizableDashboard dashboardType="superadmin" renderWidget={renderWidget} />
    </div>
  );
}
