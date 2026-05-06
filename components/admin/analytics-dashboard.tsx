'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  UserCheck,
  Calendar,
  BookMarked,
  TrendingUp,
  TrendingDown,
  Star,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AnalyticsMetrics } from '@/lib/services/analytics-service';

interface AnalyticsDashboardProps {
  metrics: AnalyticsMetrics;
  clubName?: string;
}

export function AnalyticsDashboard({ metrics, clubName }: AnalyticsDashboardProps) {
  const kpiCards = [
    {
      title: 'Total Members',
      value: metrics.totalMembers.toLocaleString(),
      subtitle: `${metrics.activeMembersThisMonth} active this month`,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      trend: metrics.memberGrowthRate,
      trendLabel: 'vs last month',
    },
    {
      title: 'Total Trainers',
      value: metrics.totalTrainers,
      subtitle: `${metrics.activeTrainersThisMonth} active this month`,
      icon: UserCheck,
      color: 'from-green-500 to-green-600',
      badge: {
        label: `${metrics.avgTrainerRating.toFixed(1)} ★`,
        variant: 'success' as const,
      },
    },
    {
      title: 'Sessions This Month',
      value: metrics.sessionsThisMonth,
      subtitle: `${metrics.totalSessions} total sessions`,
      icon: Calendar,
      color: 'from-purple-500 to-purple-600',
      badge: {
        label: `${metrics.sessionCompletionRate}% completion`,
        variant: 'default' as const,
      },
    },
    {
      title: 'Bookings This Month',
      value: metrics.bookingsThisMonth.toLocaleString(),
      subtitle: `${metrics.avgBookingsPerMember} avg per member`,
      icon: BookMarked,
      color: 'from-orange-500 to-orange-600',
      badge: {
        label: `${metrics.noShowRate}% no-show`,
        variant: metrics.noShowRate > 10 ? ('warning' as const) : ('default' as const),
      },
    },
  ];

  const additionalMetrics = [
    {
      title: 'Member Growth',
      value: `${metrics.newMembersThisMonth}`,
      label: 'New members this month',
      trend: metrics.memberGrowthRate,
    },
    {
      title: 'Feedback Score',
      value: `${metrics.avgFeedbackRating.toFixed(1)} / 5.0`,
      label: `${metrics.totalFeedback} total feedback`,
      icon: Star,
    },
    {
      title: 'Session Attendance',
      value: `${metrics.avgSessionAttendance.toFixed(1)}`,
      label: 'Average per session',
      icon: Users,
    },
    {
      title: 'No-Show Rate',
      value: `${metrics.noShowRate}%`,
      label: 'This month',
      icon: AlertCircle,
      alert: metrics.noShowRate > 15,
    },
  ];

  return (
    <div className="space-y-6">
      {clubName && (
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">{clubName}</h1>
          <p className="text-gray-500">Analytics Dashboard</p>
        </div>
      )}

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} variant="elevated" className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500">{kpi.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{kpi.subtitle}</p>
                </div>
                <div
                  className={`p-3 rounded-xl bg-gradient-to-br ${kpi.color} text-white flex-shrink-0`}
                >
                  <kpi.icon className="h-6 w-6" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {kpi.trend !== undefined && (
                  <div
                    className={`flex items-center gap-1 text-sm ${kpi.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {kpi.trend >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span className="font-medium">{Math.abs(kpi.trend).toFixed(1)}%</span>
                    <span className="text-gray-500 text-xs">{kpi.trendLabel}</span>
                  </div>
                )}
                {kpi.badge && <Badge variant={kpi.badge.variant}>{kpi.badge.label}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {additionalMetrics.map((metric) => (
          <Card key={metric.title} variant="bordered">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase">{metric.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{metric.label}</p>
                </div>
                {metric.icon && (
                  <metric.icon
                    className={`h-5 w-5 ${metric.alert ? 'text-red-500' : 'text-gray-400'}`}
                  />
                )}
                {metric.trend !== undefined && (
                  <div
                    className={`flex items-center ${metric.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {metric.trend >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Trends Chart */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>6-Month Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.monthlyData.map((month, idx) => (
              <div key={month.month} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-gray-600">{month.month}</div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-20 text-xs text-gray-500">Members</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{
                          width: `${(month.members / Math.max(...metrics.monthlyData.map((m) => m.members))) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="w-12 text-xs font-medium text-right">{month.members}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 text-xs text-gray-500">Sessions</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-purple-500 h-full rounded-full transition-all"
                        style={{
                          width: `${(month.sessions / Math.max(...metrics.monthlyData.map((m) => m.sessions))) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="w-12 text-xs font-medium text-right">{month.sessions}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 text-xs text-gray-500">Bookings</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-orange-500 h-full rounded-full transition-all"
                        style={{
                          width: `${(month.bookings / Math.max(...metrics.monthlyData.map((m) => m.bookings))) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="w-12 text-xs font-medium text-right">{month.bookings}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
