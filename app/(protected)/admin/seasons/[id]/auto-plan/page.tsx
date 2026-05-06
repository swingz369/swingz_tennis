'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Play,
  Eye,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Users,
  Calendar,
  Zap,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AutoPlanResponse, AlgorithmMetrics } from '@/lib/types/season-planning';

interface AutoPlanPageProps {
  params: {
    id: string; // season_id
  };
}

export default function AutoPlanPage({ params }: AutoPlanPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<AutoPlanResponse | null>(null);

  const [config, setConfig] = useState({
    max_iterations: 1000,
    optimization_goals: ['minimize_conflicts', 'balance_trainer_load', 'maximize_preferences'],
    allow_overbooking: false,
    prefer_consistent_timeslots: true,
  });

  const handleRunPlanning = async (preview: boolean) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/seasons/${params.id}/auto-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          dry_run: preview,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler bei der Planung');
      }

      const data: AutoPlanResponse = await response.json();
      setResult(data);

      if (!preview) {
        toast.success(`Planung abgeschlossen! ${data.entries_created} Einheiten erstellt`);
        setTimeout(() => {
          router.push(`/admin/seasons/${params.id}`);
        }, 2000);
      } else {
        toast.success('Vorschau generiert');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler bei der Planung');
    } finally {
      setLoading(false);
    }
  };

  const toggleGoal = (goal: string) => {
    setConfig((prev) => ({
      ...prev,
      optimization_goals: prev.optimization_goals.includes(goal)
        ? prev.optimization_goals.filter((g) => g !== goal)
        : [...prev.optimization_goals, goal],
    }));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge variant="default">Sehr gut</Badge>;
    if (score >= 60) return <Badge variant="secondary">Gut</Badge>;
    return <Badge variant="error">Verbesserungswürdig</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/admin/seasons/${params.id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automatische Planung</h1>
          <p className="text-muted-foreground">
            KI-optimierte Trainingsplanung basierend auf Präferenzen
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Planungs-Konfiguration</CardTitle>
              <CardDescription>Passen Sie den Algorithmus an</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Max Iterations */}
              <div className="space-y-2">
                <Label htmlFor="max_iterations">Max. Iterationen</Label>
                <input
                  id="max_iterations"
                  type="number"
                  min="100"
                  max="5000"
                  step="100"
                  value={config.max_iterations}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      max_iterations: parseInt(e.target.value),
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                />
                <p className="text-xs text-muted-foreground">
                  Höhere Werte = bessere Ergebnisse, längere Laufzeit
                </p>
              </div>

              {/* Optimization Goals */}
              <div className="space-y-3">
                <Label>Optimierungsziele</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="minimize_conflicts"
                      checked={config.optimization_goals.includes('minimize_conflicts')}
                      onCheckedChange={() => toggleGoal('minimize_conflicts')}
                    />
                    <label htmlFor="minimize_conflicts" className="text-sm cursor-pointer">
                      Konflikte minimieren
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="balance_trainer_load"
                      checked={config.optimization_goals.includes('balance_trainer_load')}
                      onCheckedChange={() => toggleGoal('balance_trainer_load')}
                    />
                    <label htmlFor="balance_trainer_load" className="text-sm cursor-pointer">
                      Trainer-Last ausgleichen
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="maximize_preferences"
                      checked={config.optimization_goals.includes('maximize_preferences')}
                      onCheckedChange={() => toggleGoal('maximize_preferences')}
                    />
                    <label htmlFor="maximize_preferences" className="text-sm cursor-pointer">
                      Präferenzen maximieren
                    </label>
                  </div>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="space-y-3">
                <Label>Erweiterte Optionen</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allow_overbooking"
                      checked={config.allow_overbooking}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, allow_overbooking: !!checked }))
                      }
                    />
                    <label htmlFor="allow_overbooking" className="text-sm cursor-pointer">
                      Überbuchung erlauben
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="prefer_consistent"
                      checked={config.prefer_consistent_timeslots}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({
                          ...prev,
                          prefer_consistent_timeslots: !!checked,
                        }))
                      }
                    />
                    <label htmlFor="prefer_consistent" className="text-sm cursor-pointer">
                      Konsistente Zeitslots bevorzugen
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleRunPlanning(true)}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Läuft...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Vorschau generieren
                    </>
                  )}
                </Button>
                <Button
                  className="w-full"
                  onClick={() => handleRunPlanning(false)}
                  disabled={loading || !result}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Planung ausführen
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {loading && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 animate-pulse text-yellow-500" />
                  Planung läuft...
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={65} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  Der Algorithmus analysiert Präferenzen und erstellt optimale Pläne...
                </p>
              </CardContent>
            </Card>
          )}

          {result && !loading && (
            <div className="space-y-4">
              {/* Metrics Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Planungs-Ergebnisse</CardTitle>
                    {getScoreBadge(result.metrics.score)}
                  </div>
                  <CardDescription>
                    {result.entries_created} Einheiten geplant in {result.metrics.runtime_ms}ms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Gesamt-Score</span>
                        <span
                          className={`text-2xl font-bold ${getScoreColor(result.metrics.score)}`}
                        >
                          {result.metrics.score.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={result.metrics.score} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Trainer-Auslastung</span>
                        <span className="text-lg font-medium">
                          {result.metrics.trainer_utilization.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={result.metrics.trainer_utilization} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Platz-Auslastung</span>
                        <span className="text-lg font-medium">
                          {result.metrics.court_utilization.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={result.metrics.court_utilization} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Präferenzen erfüllt</span>
                        <span className="text-lg font-medium">
                          {result.metrics.preferences_matched}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Einheiten erstellt</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{result.entries_created}</div>
                    <p className="text-xs text-muted-foreground">Training-Sessions</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Konflikte</CardTitle>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{result.conflicts_detected}</div>
                    <p className="text-xs text-muted-foreground">
                      {result.conflicts_detected === 0 ? 'Keine Konflikte! ✓' : 'Zu lösen'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Iterationen</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{result.metrics.iterations}</div>
                    <p className="text-xs text-muted-foreground">Algorithmus-Durchläufe</p>
                  </CardContent>
                </Card>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <Card className="border-yellow-500/50">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <CardTitle>Warnungen</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.warnings.map((warning, index) => (
                        <li key={index} className="text-sm text-yellow-700 dark:text-yellow-500">
                          • {warning}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Success State */}
              {result.conflicts_detected === 0 && result.metrics.score >= 80 && (
                <Card className="border-green-500/50 bg-green-50 dark:bg-green-950">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-green-900 dark:text-green-100">
                        Exzellente Planung!
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Der Algorithmus hat eine optimale Planung ohne Konflikte erstellt. Sie können
                      diese Planung jetzt ausführen oder weitere Anpassungen vornehmen.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {!result && !loading && (
            <Card className="flex h-96 flex-col items-center justify-center">
              <CardHeader className="text-center">
                <Zap className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle>Bereit für automatische Planung</CardTitle>
                <CardDescription>
                  Konfigurieren Sie die Einstellungen und starten Sie die KI-optimierte Planung
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
