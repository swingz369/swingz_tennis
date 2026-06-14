'use client';

import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { TrendingUp, Users, DollarSign, Calendar, Brain } from 'lucide-react';
import { AnimatedCounter, ScrollReveal } from '@/components/animations';
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
      gradient: 'from-brand-primary to-brand-dark',
    },
    {
      title: 'Buchungen',
      value: data.totalBookings,
      icon: TrendingUp,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Umsatz',
      value: data.totalRevenue,
      prefix: '€',
      icon: DollarSign,
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      title: 'Sessions',
      value: data.totalSessions,
      icon: Calendar,
      gradient: 'from-orange-500 to-orange-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <ScrollReveal>
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Analytics</h1>
          <p className="text-muted-foreground">Vereinsstatistiken und Leistungskennzahlen</p>
        </div>
      </ScrollReveal>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <ScrollReveal key={kpi.title} delay={i * 80}>
            <Card
              variant="glass"
              className="group hover-lift transition-all duration-300 hover:shadow-lg p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                  <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">
                    {kpi.prefix && <span>{kpi.prefix}</span>}
                    <AnimatedCounter value={kpi.value} duration={1500} />
                  </p>
                </div>
                <div
                  className={`p-3 rounded-xl bg-gradient-to-br ${kpi.gradient} text-white flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                >
                  <kpi.icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
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
          <Card variant="bordered" className="p-6 transition-all duration-300 hover:shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-50">
                <Brain className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">KI Insights</h3>
                <p className="text-xs text-muted-foreground">Automatische Analysen</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm font-medium text-blue-800">Matchmaking</p>
                <p className="text-xs text-blue-600 mt-1">
                  Finde Trainingspartner mit passendem Level und freien Zeiten.
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <p className="text-sm font-medium text-green-800">Empfehlungen</p>
                <p className="text-xs text-green-600 mt-1">
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
