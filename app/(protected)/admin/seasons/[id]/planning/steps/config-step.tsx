'use client';

import { useState } from 'react';
import { useWizard } from '@/lib/season-planning/wizard-context';
import ScheduleReadinessCheck from '@/lib/season-planning/readiness-check';
import { MemberSelector } from './member-selector';
import { TrainerAvailabilityPanel } from './trainer-availability';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings,
  Users,
  Gauge,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Zap,
  Baby,
  Clock,
} from 'lucide-react';

export function ConfigStep() {
  const { state, dispatch } = useWizard();
  const [config, setConfig] = useState(state.planningConfig);

  const handleConfigChange = (key: string, value: number | boolean) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      dispatch({ type: 'SET_PLANNING_CONFIG', config: next });
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Readiness Check — placed prominently at top */}
      <ScheduleReadinessCheck
        clubId={state.clubId}
        seasonId={state.seasonId}
        onReady={(isReady) => dispatch({ type: 'SET_READY', isReady })}
      />

      {/* Season Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-brand-primary" />
            Planungseinstellungen
          </CardTitle>
          <CardDescription>Diese Einstellungen steuern den Clustering-Algorithmus</CardDescription>
        </CardHeader>
        <CardContent>
          {' '}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Max. Gruppengröße (Erwachsene)
              </Label>
              <Input
                type="number"
                min={2}
                max={10}
                value={config.groupMaxSize}
                onChange={(e) => handleConfigChange('groupMaxSize', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Min. Gruppengröße (Erwachsene)
              </Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={config.groupMinSize}
                onChange={(e) => handleConfigChange('groupMinSize', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Trainer-Auslastung max. %</Label>
              <Input
                type="number"
                min={50}
                max={100}
                value={config.trainerUtilizationMaxPct}
                onChange={(e) =>
                  handleConfigChange('trainerUtilizationMaxPct', Number(e.target.value))
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Baby className="h-3 w-3" /> Max. Gruppengröße (Kinder)
              </Label>
              <Input
                type="number"
                min={2}
                max={10}
                value={config.kidsGroupMaxSize}
                onChange={(e) => handleConfigChange('kidsGroupMaxSize', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Baby className="h-3 w-3" /> Min. Gruppengröße (Kinder)
              </Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={config.kidsGroupMinSize}
                onChange={(e) => handleConfigChange('kidsGroupMinSize', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Slot-Dauer (Minuten)
              </Label>
              <Input
                type="number"
                min={30}
                max={180}
                step={15}
                value={config.slotDurationMinutes}
                onChange={(e) => handleConfigChange('slotDurationMinutes', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Max. Niveau-Spanne (Anfänger)</Label>
              <Input
                type="number"
                min={1}
                max={4}
                value={config.maxNiveauSpanBeginner}
                onChange={(e) =>
                  handleConfigChange('maxNiveauSpanBeginner', Number(e.target.value))
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Max. Niveau-Spanne (Fortgeschritten)
              </Label>
              <Input
                type="number"
                min={1}
                max={4}
                value={config.maxNiveauSpanAdvanced}
                onChange={(e) =>
                  handleConfigChange('maxNiveauSpanAdvanced', Number(e.target.value))
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Slot-Ausfallrate max. %</Label>
              <Input
                type="number"
                min={10}
                max={80}
                value={config.slotFailureThreshold}
                onChange={(e) => handleConfigChange('slotFailureThreshold', Number(e.target.value))}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.preferHistoricGroups}
                onChange={(e) => handleConfigChange('preferHistoricGroups', e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Historische Gruppen bevorzugen</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.avoidHighFailureSlots}
                onChange={(e) => handleConfigChange('avoidHighFailureSlots', e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Hohe Ausfallraten-Slots vermeiden</span>
            </label>
          </div>
          {/* Auto-Plan Options (integrated from /auto-plan page) */}
          <div className="mt-6 border-t pt-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-foreground">Auto-Plan Optimierung</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Max. Iterationen</Label>
                <Input
                  type="number"
                  min={100}
                  max={5000}
                  step={100}
                  value={config.maxIterations}
                  onChange={(e) => handleConfigChange('maxIterations', Number(e.target.value))}
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  Höhere Werte = bessere Ergebnisse, längere Laufzeit
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="goal-minimize-conflicts"
                  checked={config.optimizationGoals.includes('minimize_conflicts')}
                  onChange={() => {
                    const goals = config.optimizationGoals.includes('minimize_conflicts')
                      ? config.optimizationGoals.filter((g) => g !== 'minimize_conflicts')
                      : [...config.optimizationGoals, 'minimize_conflicts'];
                    handleConfigChange('optimizationGoals' as any, goals as any);
                  }}
                  className="rounded border-border"
                />
                <label htmlFor="goal-minimize-conflicts" className="text-sm cursor-pointer">
                  Konflikte minimieren
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="goal-balance-trainers"
                  checked={config.optimizationGoals.includes('balance_trainer_load')}
                  onChange={() => {
                    const goals = config.optimizationGoals.includes('balance_trainer_load')
                      ? config.optimizationGoals.filter((g) => g !== 'balance_trainer_load')
                      : [...config.optimizationGoals, 'balance_trainer_load'];
                    handleConfigChange('optimizationGoals' as any, goals as any);
                  }}
                  className="rounded border-border"
                />
                <label htmlFor="goal-balance-trainers" className="text-sm cursor-pointer">
                  Trainer-Last ausgleichen
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="goal-maximize-prefs"
                  checked={config.optimizationGoals.includes('maximize_preferences')}
                  onChange={() => {
                    const goals = config.optimizationGoals.includes('maximize_preferences')
                      ? config.optimizationGoals.filter((g) => g !== 'maximize_preferences')
                      : [...config.optimizationGoals, 'maximize_preferences'];
                    handleConfigChange('optimizationGoals' as any, goals as any);
                  }}
                  className="rounded border-border"
                />
                <label htmlFor="goal-maximize-prefs" className="text-sm cursor-pointer">
                  Präferenzen maximieren
                </label>
              </div>
            </div>

            <div className="space-y-2.5 mt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="use-ai"
                  checked={config.useAI}
                  onChange={(e) => handleConfigChange('useAI', e.target.checked)}
                  className="rounded border-border"
                />
                <label
                  htmlFor="use-ai"
                  className="text-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  KI-Optimierung (OpenAI)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="allow-overbooking"
                  checked={config.allowOverbooking}
                  onChange={(e) => handleConfigChange('allowOverbooking', e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="allow-overbooking" className="text-sm cursor-pointer">
                  Überbuchung erlauben
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="prefer-consistent"
                  checked={config.preferConsistentTimeslots}
                  onChange={(e) =>
                    handleConfigChange('preferConsistentTimeslots', e.target.checked)
                  }
                  className="rounded border-border"
                />
                <label htmlFor="prefer-consistent" className="text-sm cursor-pointer">
                  Konsistente Zeitslots bevorzugen
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-primary" />
              <p className="text-xs text-muted-foreground">Ausgewählte Mitglieder</p>
            </div>
            <p className="text-xl font-bold mt-1">{state.selectedMemberIds.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Trainer-Auslastung</p>
            </div>
            <p className="text-xl font-bold mt-1">
              {Object.keys(state.trainerUtilization).length > 0
                ? `${Math.round(
                    Object.values(state.trainerUtilization).reduce((s, t) => s + t.pct, 0) /
                      Math.max(1, Object.keys(state.trainerUtilization).length)
                  )}%`
                : '–'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              {state.isReady ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <p className="text-xs text-muted-foreground">Bereitschaft</p>
            </div>
            <p
              className={`text-xl font-bold mt-1              ${state.isReady ? 'text-green-600' : 'text-amber-600'}`}
            >
              {state.isReady ? 'Bereit' : 'Prüfen'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Member Selector */}
      <MemberSelector />

      {/* Trainer Availability */}
      <TrainerAvailabilityPanel />
    </div>
  );
}
