'use client';

import { useState, useEffect, useCallback } from 'react';
import { MatchmakingPanel } from '@/components/ai/matchmaking-panel';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedCounter, ScrollReveal } from '@/components/animations';
import { Shuffle, Users, Target, BarChart3, RefreshCw, Sparkles, Activity } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

interface MatchStats {
  totalMatches: number;
  avgScore: number;
  totalMembers: number;
  myLevel: string;
  levelDistribution: Record<string, number>;
}

const levelLabels: Record<string, string> = {
  beginner: 'Anfänger',
  advanced_beginner: 'Fortgesch. Anfänger',
  intermediate: 'Mittelstufe',
  advanced: 'Fortgeschritten',
  tournament: 'Turnierniveau',
};

const levelColors: Record<string, string> = {
  beginner: 'from-success-500 to-success-600',
  advanced_beginner: 'from-info-500 to-info-600',
  intermediate: 'from-warning-500 to-brand-accent-600',
  advanced: 'from-brand-accent-500 to-error-600',
  tournament: 'from-info-500 to-info-600',
};

export default function MatchmakingPage() {
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiFetch('/api/ai/matchmaking');
      if (!res.ok) return;
      const data = await res.json();

      // Compute level distribution from matches
      const levelDist: Record<string, number> = {};
      for (const m of data.matches ?? []) {
        const lvl = m.playingLevel || 'beginner';
        levelDist[lvl] = (levelDist[lvl] || 0) + 1;
      }

      const matches = data.matches ?? [];
      const avgScore =
        matches.length > 0
          ? Math.round(
              matches.reduce(
                (sum: number, m: { compatibilityScore: number }) => sum + m.compatibilityScore,
                0
              ) / matches.length
            )
          : 0;

      setStats({
        totalMatches: matches.length,
        avgScore,
        totalMembers: data.totalMembers ?? 0,
        myLevel: data.myLevel ?? 'beginner',
        levelDistribution: levelDist,
      });
    } catch {
      /* non-critical */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      {/* ── Hero Header ── */}
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-info-600 via-info-600 to-info-700 p-6 md:p-8 text-white">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-info-400/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white/70 mb-1">KI-Verwaltung</p>
                <h1 className="text-2xl md:text-3xl font-bold">Matchmaking Dashboard</h1>
                <p className="text-white/70 mt-2">
                  Übersicht über Spielpartner-Matching und Niveau-Verteilung
                </p>
              </div>
              <div className="flex items-center gap-2">
                {stats && (
                  <Badge className="bg-white/15 backdrop-blur-sm border-white/20 text-white gap-1.5 px-3 py-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    KI-gestützt
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchStats}
                  disabled={statsLoading}
                  className="text-white hover:bg-white/10"
                >
                  <RefreshCw className={`h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ScrollReveal delay={0}>
          <Card className="group hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Matches gefunden</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={stats?.totalMatches ?? 0} />
                  </p>
                  <p className="text-xs text-muted-foreground">potenzielle Partner</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-info-500 to-info-600 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <Shuffle className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <Card className="group hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Ø Kompatibilität</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={stats?.avgScore ?? 0} suffix="%" />
                  </p>
                  <p className="text-xs text-muted-foreground">Durchschnitts-Score</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-success-500 to-success-700 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <Target className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <Card className="group hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Mitglieder analysiert</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={stats?.totalMembers ?? 0} />
                  </p>
                  <p className="text-xs text-muted-foreground">aktive Mitglieder</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-info-500 to-info-600 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={240}>
          <Card className="group hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Dein Level</p>
                  <p className="text-xl font-bold text-foreground dark:text-white mt-1">
                    {levelLabels[stats?.myLevel ?? 'beginner'] ?? 'Unbekannt'}
                  </p>
                  <p className="text-xs text-muted-foreground">aktuelle Einstufung</p>
                </div>
                <div
                  className={`p-3 rounded-2xl bg-gradient-to-br ${levelColors[stats?.myLevel ?? 'beginner'] ?? 'from-gray-500 to-gray-600'} text-white shadow-lg transition-all duration-300 group-hover:scale-110`}
                >
                  <Activity className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>

      {/* ── Level Distribution ── */}
      {stats && Object.keys(stats.levelDistribution).length > 0 && (
        <ScrollReveal delay={300}>
          <Card className="border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Niveau-Verteilung der Matches</h3>
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(stats.levelDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([level, count]) => (
                    <div
                      key={level}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50"
                    >
                      <div
                        className={`h-3 w-3 rounded-full bg-gradient-to-br ${levelColors[level] ?? 'from-gray-400 to-gray-500'}`}
                      />
                      <span className="text-sm font-medium">{levelLabels[level] ?? level}</span>
                      <span className="text-sm text-muted-foreground">({count})</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      )}

      {/* ── Matchmaking Panel ── */}
      <ScrollReveal delay={400}>
        <MatchmakingPanel showAdminBadge />
      </ScrollReveal>
    </div>
  );
}
