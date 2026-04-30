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
import { ProfessionalCard } from '@/components/ui/professional/professional-card';
import { TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';

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
      value: data.totalMembers.toLocaleString(),
      icon: Users,
      color: 'text-brand-primary-600',
    },
    {
      title: 'Buchungen',
      value: data.totalBookings.toLocaleString(),
      icon: TrendingUp,
      color: 'text-blue-600',
    },
    {
      title: 'Umsatz',
      value: `€${data.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      title: 'Sessions',
      value: data.totalSessions.toLocaleString(),
      icon: Calendar,
      color: 'text-orange-600',
    },
  ];

  const COLORS = ['#1B4332', '#40916C', '#52B788', '#74C69D', '#95D5B2'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1B4332]">Analytics</h1>
        <p className="text-gray-500">Vereinsstatistiken und Leistungskennzahlen</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <ProfessionalCard key={kpi.title} variant="elevated" className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{kpi.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{kpi.value}</p>
              </div>
              <div className={`p-3 rounded-full bg-gray-50 ${kpi.color}`}>
                <kpi.icon className="h-6 w-6" />
              </div>
            </div>
          </ProfessionalCard>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bookings Over Time (Line) */}
        <ProfessionalCard variant="bordered" className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Buchungen im Zeitverlauf</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.bookingsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
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
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ProfessionalCard>

        {/* Revenue by Club (Pie) */}
        <ProfessionalCard variant="bordered" className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Umsatz nach Verein</h3>
          <div className="h-64">
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
                >
                  {data.revenueByClub.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `€${Number(value).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ProfessionalCard>

        {/* Sessions per Trainer (Bar) */}
        <ProfessionalCard variant="bordered" className="p-6">
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
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value) => [value, 'Sessions']}
                />
                <Bar dataKey="sessions" fill="#1B4332" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ProfessionalCard>

        {/* Court Utilization (Bar) */}
        <ProfessionalCard variant="bordered" className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Platzauslastung</h3>
          <div className="h-64">
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
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value) => [`${value}%`, 'Auslastung']}
                />
                <Bar dataKey="util" fill="#40916C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ProfessionalCard>
      </div>
    </div>
  );
}
