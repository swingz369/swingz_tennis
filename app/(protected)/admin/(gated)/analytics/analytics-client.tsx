'use client';

import dynamic from 'next/dynamic';
import { StatCard } from '@/components/ui/stat-card';
import { TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';
import { ScrollReveal } from '@/components/animations';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy-load recharts (~360 KB) — only needed when charts are visible
const RechartsLazy = dynamic(() => import('./analytics-charts').then((m) => m.AnalyticsCharts), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-80 rounded-xl border border-border dark:border-white/10 p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ))}
    </div>
  ),
});

// Lazy-load AI churn panel — heavy component with its own data fetching
const ChurnRiskPanel = dynamic(
  () => import('@/components/churn-risk-panel').then((m) => m.ChurnRiskPanel),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> }
);

export interface AnalyticsData {
  totalMembers: number;
  totalBookings: number;
  totalRevenue: number;
  totalSessions: number;
  revenueByClub: { club: string; revenue: number }[];
  bookingsOverTime: { date: string; bookings: number }[];
  sessionsPerTrainer: { trainer: string; sessions: number }[];
  capacityUtilization: { court: string; util: number }[];
}

interface AnalyticsClientProps {
  data: AnalyticsData | null;
}

export function AnalyticsClient({ data }: AnalyticsClientProps) {
  if (!data) {
    return <div className="text-center py-12 text-muted-foreground">Keine Vereine gefunden.</div>;
  }

  const kpiCards = [
    {
      title: 'Mitglieder',
      value: data.totalMembers,
      icon: Users,
      color: 'brand' as const,
      animate: true,
    },
    {
      title: 'Buchungen',
      value: data.totalBookings,
      icon: TrendingUp,
      color: 'blue' as const,
      animate: true,
    },
    {
      title: 'Umsatz',
      value: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
        data.totalRevenue
      ),
      icon: DollarSign,
      color: 'green' as const,
      animate: false,
    },
    {
      title: 'Sessions',
      value: data.totalSessions,
      icon: Calendar,
      color: 'orange' as const,
      animate: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <ScrollReveal key={kpi.title} delay={i * 80}>
            <StatCard
              icon={kpi.icon}
              label={kpi.title}
              value={kpi.value}
              color={kpi.color}
              animate={kpi.animate}
            />
          </ScrollReveal>
        ))}
      </div>

      {/* Charts Grid — lazy-loaded (recharts ~360 KB) */}
      <RechartsLazy data={data} />

      {/* Abwanderungsrisiko — wertet Buchungs- und Anwesenheitsdaten aus (kein Modell).
          Die zweite Karte daneben war reine Werbefläche ohne eigene Daten und ist entfallen,
          zusammen mit dem `ai_analysis`-Gate. */}
      <ScrollReveal delay={300}>
        <ChurnRiskPanel />
      </ScrollReveal>
    </div>
  );
}
