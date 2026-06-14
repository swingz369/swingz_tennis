'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Users,
  UserCheck,
  Calendar,
  BarChart3,
  ArrowRight,
  LayoutGrid,
  Activity,
} from 'lucide-react';
import { ScrollReveal, AnimatedCounter } from '@/components/animations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomizableDashboard } from '@/components/customizable-dashboard';
import type { DashboardWidget } from '@/lib/dashboard-widgets';

interface ClubStats {
  members: number;
  trainers: number;
  courts: number;
}

const iconMap: Record<string, React.ElementType> = {
  members: Users,
  trainers: UserCheck,
  courts: Building2,
  schedule: Calendar,
  analytics: BarChart3,
};

interface MenuItem {
  label: string;
  href: string;
  icon: string;
  desc: string;
}

export function ClubDashboardClient({
  clubName,
  stats,
  menuItems,
  clubId,
}: {
  clubName: string;
  stats: ClubStats;
  menuItems: MenuItem[];
  clubId: string;
}) {
  const router = useRouter();

  const KPI_CONFIGS = [
    {
      type: 'kpi_members',
      label: 'Mitglieder',
      value: stats.members,
      icon: Users,
      gradient: 'from-blue-500 to-indigo-600',
      href: `/admin/members?clubId=${clubId}`,
    },
    {
      type: 'kpi_trainers',
      label: 'Trainer',
      value: stats.trainers,
      icon: UserCheck,
      gradient: 'from-green-500 to-emerald-700',
      href: `/admin/trainers?clubId=${clubId}`,
    },
    {
      type: 'kpi_courts',
      label: 'Plätze',
      value: stats.courts,
      icon: Building2,
      gradient: 'from-purple-500 to-purple-700',
      href: `/admin/courts?clubId=${clubId}`,
    },
  ] as const;

  const renderWidget = (widget: DashboardWidget) => {
    // KPI Cards
    const kpiConfig = KPI_CONFIGS.find((c) => c.type === widget.type);
    if (kpiConfig) {
      const Icon = kpiConfig.icon;
      const idx = KPI_CONFIGS.indexOf(kpiConfig);
      return (
        <ScrollReveal delay={idx * 100}>
          <Card
            variant="elevated"
            className="group cursor-pointer hover-lift transition-all duration-300"
            role="link"
            tabIndex={0}
            aria-label={`${kpiConfig.label}: ${kpiConfig.value} — Verwalten`}
            onClick={() => router.push(kpiConfig.href)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push(kpiConfig.href);
              }
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{kpiConfig.label}</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white tabular-nums">
                    <AnimatedCounter value={kpiConfig.value} />
                  </p>
                </div>
                <div
                  className={`p-3.5 rounded-2xl bg-gradient-to-br ${kpiConfig.gradient} text-white shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}
                >
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-brand-light opacity-0 group-hover:opacity-100 transition-opacity">
                Verwalten
                <ArrowRight className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      );
    }

    // Management Menu
    if (widget.type === 'management_menu') {
      return (
        <ScrollReveal delay={200}>
          <Card
            variant="bordered"
            className="overflow-hidden border-0 shadow-sm bg-background dark:bg-card/5 backdrop-blur-sm"
          >
            <CardHeader className="border-b border-border dark:border-white/10 bg-muted/50 dark:bg-card/[0.02]">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-brand-primary to-brand-dark text-white shadow-sm">
                  <LayoutGrid className="h-4 w-4" />
                </div>
                <span>Verwaltung</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menuItems.map((item) => {
                  const ItemIcon = iconMap[item.icon] || Users;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="group flex items-start gap-4 p-5 rounded-xl border border-border dark:border-white/10 bg-background dark:bg-card/[0.02] hover:border-brand-light/30 hover:shadow-lg hover:shadow-brand-light/5 transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <div className="shrink-0 h-12 w-12 rounded-xl bg-brand-light/10 text-brand-light flex items-center justify-center group-hover:bg-brand-light group-hover:text-white transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg">
                        <ItemIcon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground dark:text-white group-hover:text-brand-primary dark:group-hover:text-brand-light transition-colors">
                          {item.label}
                        </h3>
                        <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      );
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
                <p className="text-sm font-medium text-white/70 mb-1">Vereins-Administration</p>
                <h1 className="text-3xl font-bold">{clubName}</h1>
                <p className="text-white/70 mt-2">Verwalte Mitglieder, Trainer, Plätze und mehr</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-xl bg-background/10 backdrop-blur-sm px-4 py-2.5">
                <Activity className="h-5 w-5 text-brand-accent" />
                <span className="text-sm font-medium">{stats.members} Mitglieder</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Customizable Widget Grid */}
      <CustomizableDashboard dashboardType="club" clubId={clubId} renderWidget={renderWidget} />
    </div>
  );
}
