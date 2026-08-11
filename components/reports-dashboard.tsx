'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import {
  Loader2,
  TrendingUp,
  Users,
  CreditCard,
  Calendar,
  Download,
  FileText,
  BarChart3,
  PieChart,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-fetch';
import { createLogger } from '@/lib/logger';

const log = createLogger('reports-dashboard');

interface ReportStats {
  totalMembers: number;
  activeMembers: number;
  totalRevenue: number;
  pendingPayments: number;
  totalBookings: number;
  courtUtilization: number;
  topGroups: { name: string; count: number }[];
  revenueByMonth: { month: string; revenue: number }[];
}

export default function ReportsDashboard() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/analytics')
      .then((r) => (r.ok ? r.json() : Promise.reject('Fehler')))
      .then((data) => setStats(data))
      .catch((error) => log.error('Report-Statistiken konnten nicht geladen werden', error))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
      </div>
    );
  }

  const reportCards = [
    {
      label: 'Mitglieder gesamt',
      value: stats?.totalMembers ?? '--',
      icon: Users,
      color: 'text-info-600',
    },
    {
      label: 'Aktive Mitglieder',
      value: stats?.activeMembers ?? '--',
      icon: TrendingUp,
      color: 'text-success-600',
    },
    {
      label: 'Gesamtumsatz',
      value: stats?.totalRevenue ? `€${stats.totalRevenue.toLocaleString('de-DE')}` : '--',
      icon: CreditCard,
      color: 'text-brand-light',
    },
    {
      label: 'Offene Zahlungen',
      value: stats?.pendingPayments ? `€${stats.pendingPayments.toLocaleString('de-DE')}` : '--',
      icon: FileText,
      color: 'text-warning-600',
    },
    {
      label: 'Buchungen gesamt',
      value: stats?.totalBookings ?? '--',
      icon: Calendar,
      color: 'text-info-600',
    },
    {
      label: 'Platzauslastung',
      value: stats?.courtUtilization ? `${stats.courtUtilization}%` : '--',
      icon: PieChart,
      color: 'text-info-600',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Reports & Exporte</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vereins-Kennzahlen und Datenexport</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {reportCards.map((c) => (
          <Card key={c.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <p className="text-xl font-bold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Export Actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Exporte
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Mitglieder CSV', href: '/api/analytics/members/export', icon: Users },
            { label: 'Buchungen CSV', href: '/api/analytics/bookings/export', icon: Calendar },
            { label: 'Umsatz CSV', href: '/api/analytics/revenue/export', icon: CreditCard },
            { label: 'Audit Log PDF', href: '/api/audit-logs/export', icon: FileText },
          ].map((ex) => (
            <Link key={ex.href} href={ex.href}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                  <IconBox icon={ex.icon} size="md" variant="light" />
                  <span className="text-xs font-medium">{ex.label}</span>
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-light" />
            Umsatzentwicklung
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.revenueByMonth && stats.revenueByMonth.length > 0 ? (
            <div className="space-y-2">
              {stats.revenueByMonth.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20">{m.month}</span>
                  <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-brand-light h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (m.revenue / (stats.totalRevenue || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums w-20 text-right">
                    €{m.revenue.toLocaleString('de-DE')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Keine Umsatzdaten verfügbar
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Groups */}
      {stats?.topGroups && stats.topGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-light" />
              Top Trainingsgruppen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topGroups.map((g) => (
                <div key={g.name} className="flex items-center justify-between">
                  <span className="text-sm">{g.name}</span>
                  <span className="text-sm font-medium tabular-nums">{g.count} Mitglieder</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
