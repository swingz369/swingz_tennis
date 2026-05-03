'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
} from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

export interface TrialTrainingAnalytics {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  noShow: number;
  converted: number;
  conversionRate: number;
  averageRating: number;
  averageDuration: number;
  trends: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  topTrainers: {
    id: string;
    name: string;
    total: number;
    completed: number;
    converted: number;
    conversionRate: number;
  }[];
  timeDistribution: {
    morning: number;
    afternoon: number;
    evening: number;
  };
}

export default function TrialTrainingAnalytics() {
  const [analytics, setAnalytics] = useState<TrialTrainingAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      // In production, this would fetch from an analytics API
      // For now, we'll use mock data
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setAnalytics({
        total: 156,
        scheduled: 23,
        completed: 98,
        cancelled: 12,
        noShow: 8,
        converted: 42,
        conversionRate: 43,
        averageRating: 4.2,
        averageDuration: 58,
        trends: {
          daily: [12, 15, 8, 11, 14, 9, 13],
          weekly: [45, 52, 38, 61],
          monthly: [120, 145, 132],
        },
        topTrainers: [
          {
            id: 't1',
            name: 'Thomas Müller',
            total: 45,
            completed: 38,
            converted: 18,
            conversionRate: 47,
          },
          {
            id: 't2',
            name: 'Julia Weber',
            total: 38,
            completed: 32,
            converted: 14,
            conversionRate: 44,
          },
          {
            id: 't3',
            name: 'Michael Schmidt',
            total: 32,
            completed: 28,
            converted: 10,
            conversionRate: 36,
          },
        ],
        timeDistribution: {
          morning: 45,
          afternoon: 62,
          evening: 49,
        },
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (current < previous) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return null;
  };

  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) return 'text-green-600';
    if (current < previous) return 'text-red-600';
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Laden...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Keine Daten verfügbar</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Probetraining Analytics</h1>
          <p className="text-gray-500">Detaillierte Statistiken und Trends</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
            <TabsList>
              <TabsTrigger value="7d">7 Tage</TabsTrigger>
              <TabsTrigger value="30d">30 Tage</TabsTrigger>
              <TabsTrigger value="90d">90 Tage</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Gesamt
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total}</div>
            <p className="text-xs text-gray-500 mt-1">
              Probetrainings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Konversionsrate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.conversionRate}%</div>
            <p className="text-xs text-gray-500 mt-1">
              Von Abgeschlossen zu Mitglied
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Durchschnittsbewertung
            </CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageRating.toFixed(1)}</div>
            <p className="text-xs text-gray-500 mt-1">
              Von 5 Sternen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Durchschnittsdauer
            </CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageDuration} Min</div>
            <p className="text-xs text-gray-500 mt-1">
              Pro Training
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Status-Verteilung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{analytics.scheduled}</div>
              <div className="text-sm text-gray-600 mt-1">Geplant</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{analytics.completed}</div>
              <div className="text-sm text-gray-600 mt-1">Abgeschlossen</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{analytics.converted}</div>
              <div className="text-sm text-gray-600 mt-1">Konvertiert</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{analytics.cancelled}</div>
              <div className="text-sm text-gray-600 mt-1">Abgesagt</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{analytics.noShow}</div>
              <div className="text-sm text-gray-600 mt-1">Nicht erschienen</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Trainers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Trainer nach Konversionsrate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.topTrainers.map((trainer, index) => (
              <div key={trainer.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-semibold">{trainer.name}</div>
                    <div className="text-sm text-gray-600">
                      {trainer.total} Trainings • {trainer.completed} Abgeschlossen
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">{trainer.conversionRate}%</div>
                  <div className="text-sm text-gray-600">{trainer.converted} Konvertiert</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Time Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Zeitverteilung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{analytics.timeDistribution.morning}</div>
              <div className="text-sm text-gray-600 mt-1">Morgens (6-12)</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{analytics.timeDistribution.afternoon}</div>
              <div className="text-sm text-gray-600 mt-1">Nachmittags (12-18)</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">{analytics.timeDistribution.evening}</div>
              <div className="text-sm text-gray-600 mt-1">Abends (18-22)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="daily">
            <TabsList className="mb-4">
              <TabsTrigger value="daily">Täglich</TabsTrigger>
              <TabsTrigger value="weekly">Wöchentlich</TabsTrigger>
              <TabsTrigger value="monthly">Monatlich</TabsTrigger>
            </TabsList>
            <TabsContent value="daily">
              <div className="h-64 flex items-end justify-between gap-2">
                {analytics.trends.daily.map((value, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-brand-primary rounded-t"
                      style={{ height: `${(value / Math.max(...analytics.trends.daily)) * 100}%` }}
                    />
                    <div className="text-xs text-gray-600 mt-2">
                      {format(subDays(new Date(), 6 - index), 'EEE', { locale: de })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="weekly">
              <div className="h-64 flex items-end justify-between gap-2">
                {analytics.trends.weekly.map((value, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-brand-primary rounded-t"
                      style={{ height: `${(value / Math.max(...analytics.trends.weekly)) * 100}%` }}
                    />
                    <div className="text-xs text-gray-600 mt-2">
                      Woche {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="monthly">
              <div className="h-64 flex items-end justify-between gap-2">
                {analytics.trends.monthly.map((value, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-brand-primary rounded-t"
                      style={{ height: `${(value / Math.max(...analytics.trends.monthly)) * 100}%` }}
                    />
                    <div className="text-xs text-gray-600 mt-2">
                      {format(subMonths(new Date(), 2 - index), 'MMM', { locale: de })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
