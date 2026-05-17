'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';
import { AnimatedCounter, ScrollReveal } from '@/components/animations';

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
        <div className="text-center py-12 text-gray-500">Keine Vereine gefunden.</div>
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

  const COLORS = ['#1B4332', '#40916C', '#52B788', '#74C69D', '#95D5B2'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <ScrollReveal>
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Analytics</h1>
          <p className="text-gray-500">Vereinsstatistiken und Leistungskennzahlen</p>
        </div>
      </ScrollReveal>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <ScrollReveal key={kpi.title} delay={i * 80}>
            <Card
              variant="elevated"
              className="group hover-lift transition-all duration-300 hover:shadow-lg p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{kpi.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bookings Over Time (Line) */}
        <ScrollReveal delay={100}>
          <Card variant="bordered" className="p-6 transition-all duration-300 hover:shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Buchungen im Zeitverlauf</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.bookingsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                    formatter={(value) => [value, 'Buchungen']}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="bookings"
                    stroke="#1B4332"
                    strokeWidth={2}
                    dot={{ fill: '#1B4332', r: 4 }}
                    activeDot={{ r: 6 }}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </ScrollReveal>

        {/* Revenue by Club (Pie) */}
        <ScrollReveal delay={150}>
          <Card variant="bordered" className="p-6 transition-all duration-300 hover:shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Umsatz nach Verein</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.revenueByClub}
                    dataKey="revenue"
                    nameKey="club"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent! * 100).toFixed(0)}%`}
                    animationDuration={1200}
                  >
                    {data.revenueByClub.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `€${Number(value).toLocaleString()}`}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </ScrollReveal>

        {/* Sessions per Trainer (Bar) */}
        <ScrollReveal delay={200}>
          <Card variant="bordered" className="p-6 transition-all duration-300 hover:shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sessions pro Trainer</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sessionsPerTrainer} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="trainer"
                    type="category"
                    width={100}
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                    formatter={(value) => [value, 'Sessions']}
                  />
                  <Bar
                    dataKey="sessions"
                    fill="#1B4332"
                    radius={[0, 4, 4, 0]}
                    animationDuration={1200}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </ScrollReveal>

        {/* Court Utilization (Bar) */}
        <ScrollReveal delay={250}>
          <Card variant="bordered" className="p-6 transition-all duration-300 hover:shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Platzauslastung</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.capacityUtilization} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="court"
                    type="category"
                    width={80}
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                    formatter={(value) => [`${value}%`, 'Auslastung']}
                  />
                  <Bar
                    dataKey="util"
                    fill="#40916C"
                    radius={[0, 4, 4, 0]}
                    animationDuration={1200}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </div>
  );
}
