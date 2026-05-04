'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Users,
  Euro,
  Calendar,
  Clock,
  Target,
  Download,
} from 'lucide-react';
import type { DashboardMetric, Statistics } from '@/src/domain/entities/statistics.entity';

interface StatisticsDashboardProps {
  className?: string;
}

export function StatisticsDashboard({ className }: StatisticsDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetric[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, statsRes] = await Promise.all([
        fetch('/api/statistics/dashboard'),
        fetch(`/api/statistics?period=${period}`),
      ]);

      if (metricsRes.ok && statsRes.ok) {
        const metricsData = await metricsRes.json();
        const statsData = await statsRes.json();
        setMetrics(metricsData);
        setStatistics(statsData);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    try {
      const response = await fetch(`/api/statistics/export?format=${format}&period=${period}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `statistics-${period}-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting statistics:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Lade Statistiken...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Statistiken & Berichte</h2>
          <p className="text-muted-foreground">Übersicht über alle wichtigen Kennzahlen</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Zeitraum wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Täglich</SelectItem>
              <SelectItem value="weekly">Wöchentlich</SelectItem>
              <SelectItem value="monthly">Monatlich</SelectItem>
              <SelectItem value="yearly">Jährlich</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => handleExport('pdf')}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      {statistics && (
        <Tabs defaultValue="members" className="space-y-4">
          <TabsList>
            <TabsTrigger value="members">Mitglieder</TabsTrigger>
            <TabsTrigger value="revenue">Umsatz</TabsTrigger>
            <TabsTrigger value="courts">Plätze</TabsTrigger>
            <TabsTrigger value="trainers">Trainer</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <MemberStatisticsCard stats={statistics.memberStats} />
          </TabsContent>

          <TabsContent value="revenue">
            <RevenueStatisticsCard stats={statistics.revenueStats} />
          </TabsContent>

          <TabsContent value="courts">
            <CourtStatisticsCard stats={statistics.courtStats} />
          </TabsContent>

          <TabsContent value="trainers">
            <TrainerStatisticsCard stats={statistics.trainerStats} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const isPositive = metric.changeType === 'increase';
  const Icon = getMetricIcon(metric.id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {metric.value.toLocaleString('de-DE')} {metric.unit}
        </div>
        <div className="flex items-center text-xs text-muted-foreground mt-1">
          {isPositive ? (
            <ArrowUp className="h-3 w-3 mr-1 text-green-500" />
          ) : (
            <ArrowDown className="h-3 w-3 mr-1 text-red-500" />
          )}
          <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
            {Math.abs(metric.change)}%
          </span>
          <span className="ml-1">zum Vorzeitraum</span>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberStatisticsCard({ stats }: { stats: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mitgliederstatistiken</CardTitle>
        <CardDescription>Übersicht über alle Mitglieder</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Gesamt</p>
            <p className="text-2xl font-bold">{stats.totalMembers}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Aktiv</p>
            <p className="text-2xl font-bold text-green-600">{stats.activeMembers}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Inaktiv</p>
            <p className="text-2xl font-bold text-red-600">{stats.inactiveMembers}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Neu</p>
            <p className="text-2xl font-bold text-blue-600">{stats.newMembers}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Konversionsrate</p>
              <Badge variant="secondary">{stats.conversionRate.toFixed(1)}%</Badge>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${stats.conversionRate}%` }}
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Mitgliedsstatus</p>
            <div className="space-y-2">
              {Object.entries(stats.membersByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{status}</span>
                  <Badge variant="outline">{Number(count)}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueStatisticsCard({ stats }: { stats: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Umsatzstatistiken</CardTitle>
        <CardDescription>Finanzielle Übersicht</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Gesamtumsatz</p>
            <p className="text-2xl font-bold">{stats.totalRevenue.toLocaleString('de-DE')} €</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Training</p>
            <p className="text-2xl font-bold">{stats.trainingRevenue.toLocaleString('de-DE')} €</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Ausstehend</p>
            <p className="text-2xl font-bold text-yellow-600">
              {stats.pendingPayments.toLocaleString('de-DE')} €
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Überfällig</p>
            <p className="text-2xl font-bold text-red-600">
              {stats.overduePayments.toLocaleString('de-DE')} €
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium mb-4">Umsatz nach Monat</p>
          <div className="space-y-2">
            {stats.revenueByMonth.map((item: any) => (
              <div key={item.month} className="flex items-center justify-between">
                <span className="text-sm">{item.month}</span>
                <span className="font-semibold">{item.revenue.toLocaleString('de-DE')} €</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CourtStatisticsCard({ stats }: { stats: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platzstatistiken</CardTitle>
        <CardDescription>Nutzung und Auslastung</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Gesamtbuchungen</p>
            <p className="text-2xl font-bold">{stats.totalBookings}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Auslastung</p>
            <p className="text-2xl font-bold">{stats.utilizationRate}%</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Ø Tagesbuchungen</p>
            <p className="text-2xl font-bold">{stats.averageDailyBookings}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Storniert</p>
            <p className="text-2xl font-bold text-red-600">{stats.cancelledBookings}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium mb-4">Spitzenzeiten</p>
          <div className="space-y-2">
            {stats.peakHours.slice(0, 5).map((item: any) => (
              <div key={item.hour} className="flex items-center justify-between">
                <span className="text-sm">{item.hour}:00 Uhr</span>
                <Badge variant="outline">{item.bookings} Buchungen</Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrainerStatisticsCard({ stats }: { stats: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trainerstatistiken</CardTitle>
        <CardDescription>Leistung und Einsatz</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Gesamtstunden</p>
            <p className="text-2xl font-bold">{stats.totalHours}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Gesamtsitzungen</p>
            <p className="text-2xl font-bold">{stats.totalSessions}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Ø Stunden/Trainer</p>
            <p className="text-2xl font-bold">{stats.averageHoursPerTrainer.toFixed(1)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Aktive Trainer</p>
            <p className="text-2xl font-bold text-green-600">{stats.activeTrainers}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium mb-4">Top-Performer</p>
          <div className="space-y-2">
            {stats.topPerformers.map((performer: any, index: number) => (
              <div
                key={performer.trainerId}
                className="flex items-center justify-between p-2 bg-secondary rounded"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{index + 1}</Badge>
                  <span className="text-sm font-medium">Trainer {performer.trainerId}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>{performer.hours}h</span>
                  <span>{performer.sessions} Sitzungen</span>
                  <span className="font-semibold">
                    {performer.earnings.toLocaleString('de-DE')} €
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getMetricIcon(metricId: string) {
  switch (metricId) {
    case 'total-members':
    case 'active-members':
      return Users;
    case 'total-revenue':
      return Euro;
    case 'court-utilization':
      return Calendar;
    case 'total-hours':
      return Clock;
    case 'conversion-rate':
      return Target;
    default:
      return TrendingUp;
  }
}
