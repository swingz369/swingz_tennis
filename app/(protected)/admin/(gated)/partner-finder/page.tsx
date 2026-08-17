'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { AnimatedCounter, ScrollReveal } from '@/components/animations';
import { TennisBallEmptyState } from '@/components/ui/empty-state';
import { Shuffle, Users, Target, BarChart3, RefreshCw, ArrowUpRight } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

interface PartnerFinderStats {
  totalMembers: number;
  activeSearchers: number;
  levelDistribution: Record<string, number>;
}

const levelLabels: Record<string, string> = {
  beginner: 'Anfänger',
  advanced_beginner: 'Fortgesch. Anfänger',
  intermediate: 'Mittelstufe',
  advanced: 'Fortgeschritten',
  tournament: 'Turnierniveau',
  unbekannt: 'Keine Angabe',
};

const levelColors: Record<string, string> = {
  beginner: 'from-success-500 to-success-600',
  advanced_beginner: 'from-info-500 to-info-600',
  intermediate: 'from-warning-500 to-brand-accent-600',
  advanced: 'from-brand-accent-500 to-error-600',
  tournament: 'from-info-500 to-info-600',
  unbekannt: 'from-gray-400 to-gray-500',
};

/**
 * Verwaltungssicht der Spielpartner-Suche. Bewusst nur Vereinskennzahlen —
 * die persönliche Suche (eigenes Level, Matches, Herausfordern) gehört zur
 * Mitglieder-Oberfläche (/partner-finder) und ist hier nicht eingebettet.
 */
export default function PartnerFinderOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PartnerFinderStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/partner-finder/stats');
      if (!res.ok) return;
      setStats(await res.json());
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const levelEntries = Object.entries(stats?.levelDistribution ?? {}).sort(([, a], [, b]) => b - a);

  const isEmpty = stats !== null && stats.totalMembers === 0;

  return (
    <div className="relative">
      {/* Subtile Marken-Textur — Ambient-Licht + Noise, bewusst kein Banner. */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-8 h-72 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-brand-light/10 blur-3xl" />
        <div className="absolute -top-16 right-1/4 h-52 w-52 rounded-full bg-brand-accent/10 blur-3xl" />
        <div className="absolute inset-0 noise opacity-[0.03]" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Standard-Header wie auf den übrigen Admin-Seiten — kein Hero-Banner. */}
        <PageHeader
          title="Spielpartner-Übersicht"
          description="Vereinsweite Kennzahlen und Niveau-Verteilung der Spielpartner-Suche"
          actions={[
            {
              label: 'Aktualisieren',
              icon: RefreshCw,
              variant: 'outline',
              onClick: fetchStats,
              disabled: loading,
            },
          ]}
        />

        {isEmpty ? (
          <TennisBallEmptyState
            title="Noch keine Spielpartner"
            description="Sobald Mitglieder ihre Spielstärke und Verfügbarkeit hinterlegen, erscheinen hier die Kennzahlen der Spielpartner-Suche."
            action={{ label: 'Mitglieder verwalten', onClick: () => router.push('/admin/members') }}
          />
        ) : (
          <>
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <ScrollReveal delay={0}>
                <Card className="group hover-lift transition-all duration-300 border border-border dark:border-white/10">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Spielende Mitglieder
                        </p>
                        <p className="text-3xl font-bold text-foreground dark:text-white">
                          <AnimatedCounter value={stats?.totalMembers ?? 0} />
                        </p>
                        <p className="text-xs text-muted-foreground">Mitglieder & Trainer</p>
                      </div>
                      <div className="p-3 rounded-xl bg-info-500 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                        <Users className="h-5 w-5" />
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
                        <p className="text-sm font-medium text-muted-foreground">Aktive Suchende</p>
                        <p className="text-3xl font-bold text-foreground dark:text-white">
                          <AnimatedCounter value={stats?.activeSearchers ?? 0} />
                        </p>
                        <p className="text-xs text-muted-foreground">haben Zeiten hinterlegt</p>
                      </div>
                      <div className="p-3 rounded-xl bg-success-500 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                        <Target className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>

              <ScrollReveal delay={160}>
                <Card className="group hover-lift transition-all duration-300 border border-border dark:border-white/10 col-span-2 lg:col-span-1">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Niveaustufen</p>
                        <p className="text-3xl font-bold text-foreground dark:text-white">
                          <AnimatedCounter value={levelEntries.length} />
                        </p>
                        <p className="text-xs text-muted-foreground">im Verein vertreten</p>
                      </div>
                      <div className="p-3 rounded-xl bg-info-500 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                        <Shuffle className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            </div>

            {/* ── Level Distribution ── */}
            {stats && levelEntries.length > 0 && (
              <ScrollReveal delay={240}>
                <Card className="border border-border dark:border-white/10">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Niveau-Verteilung</h3>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {levelEntries.map(([level, count]) => (
                        <div
                          key={level}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50"
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
          </>
        )}

        {/* ── Hinweis auf die persönliche (Mitglieder-)Suche ── */}
        <ScrollReveal delay={320}>
          <Card className="border border-dashed border-border dark:border-white/10">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Deine persönliche Spielpartnersuche (eigenes Level, Matches, Herausfordern) findest
                du auf der Mitglieder-Oberfläche.
              </p>
              <Button variant="outline" size="sm" asChild className="shrink-0 gap-1.5">
                <Link href="/partner-finder">
                  Zur Suche
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>
    </div>
  );
}
