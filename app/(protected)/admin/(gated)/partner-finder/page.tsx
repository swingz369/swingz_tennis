'use client';

import { KpiBand } from '@/components/ui/kpi-band';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollReveal } from '@/components/animations';
import { TennisBallEmptyState } from '@/components/ui/empty-state';
import { BarChart3, RefreshCw, ArrowUpRight } from 'lucide-react';
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
  beginner: 'bg-chart-5',
  advanced_beginner: 'bg-chart-3',
  intermediate: 'bg-chart-2',
  advanced: 'bg-chart-4',
  tournament: 'bg-chart-1',
  unbekannt: 'bg-muted-foreground',
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
            <KpiBand
              items={[
                {
                  label: 'Spielende Mitglieder',
                  value: stats?.totalMembers ?? 0,
                  sub: 'Mitglieder & Trainer',
                },
                {
                  label: 'Aktive Suchende',
                  value: stats?.activeSearchers ?? 0,
                  sub: 'haben Zeiten hinterlegt',
                },
                { label: 'Niveaustufen', value: levelEntries.length, sub: 'im Verein vertreten' },
              ]}
            />

            {/* ── Level Distribution ── */}
            {stats && levelEntries.length > 0 && (
              <ScrollReveal delay={240}>
                <Card className="border border-border">
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
                            className={`h-3 w-3 rounded-full ${levelColors[level] ?? 'bg-muted-foreground'}`}
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
          <Card className="border border-dashed border-border">
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
