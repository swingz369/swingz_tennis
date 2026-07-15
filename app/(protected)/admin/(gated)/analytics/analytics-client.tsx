'use client';

import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { TrendingUp, Users, DollarSign, Calendar, Brain } from 'lucide-react';
import { ScrollReveal } from '@/components/animations';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy-load recharts (~360 KB) — only needed when charts are visible
const RechartsLazy = dynamic(() => import('./analytics-charts').then((m) => m.AnalyticsCharts), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-80 rounded-2xl border border-border dark:border-white/10 p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ))}
    </div>
  ),
});

// Lazy-load AI churn panel — heavy component with its own data fetching
const ChurnRiskPanel = dynamic(
  () => import('@/components/ai/churn-risk-panel').then((m) => m.ChurnRiskPanel),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-2xl" /> }
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
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Keine Vereine gefunden.</div>
      </div>
    );
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
    <div className="p-6 space-y-6">
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

      {/* AI Insights: Churn Prediction */}
      <ScrollReveal delay={300}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ChurnRiskPanel />
          </div>
          <Card variant="bordered" className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-info-50 dark:bg-info-900/20">
                <Brain className="h-5 w-5 text-info-500 dark:text-info-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">KI Insights</h3>
                <p className="text-xs text-muted-foreground">Automatische Analysen</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-info-50 dark:bg-info-900/20 rounded-lg border border-info-100 dark:border-info-800/30">
                <p className="text-sm font-medium text-info-800 dark:text-info-300">Matchmaking</p>
                <p className="text-xs text-info-600 dark:text-info-400 mt-1">
                  Finde Trainingspartner mit passendem Level und freien Zeiten.
                </p>
              </div>
              <div className="p-3 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-100 dark:border-success-800/30">
                <p className="text-sm font-medium text-success-800 dark:text-success-300">
                  Empfehlungen
                </p>
                <p className="text-xs text-success-600 dark:text-success-400 mt-1">
                  Basierend auf Buchungs- und Anwesenheitsdaten generiert.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </ScrollReveal>
    </div>
  );
}
