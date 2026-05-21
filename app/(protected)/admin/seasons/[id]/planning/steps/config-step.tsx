'use client';

import { useState } from 'react';
import { useWizard } from '@/lib/season-planning/wizard-context';
import ScheduleReadinessCheck from '@/lib/season-planning/readiness-check';
import { MemberSelector } from './member-selector';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings,
  Users,
  Gauge,
  AlertTriangle,
  CheckCircle,
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
          <CardDescription>
            Diese Einstellungen steuern den Clustering-Algorithmus
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Max. Gruppengröße</Label>
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
              <Label className="text-xs text-muted-foreground">Min. Gruppengröße</Label>
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
                onChange={(e) => handleConfigChange('trainerUtilizationMaxPct', Number(e.target.value))}
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
                onChange={(e) => handleConfigChange('maxNiveauSpanBeginner', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Max. Niveau-Spanne (Fortgeschritten)</Label>
              <Input
                type="number"
                min={1}
                max={4}
                value={config.maxNiveauSpanAdvanced}
                onChange={(e) => handleConfigChange('maxNiveauSpanAdvanced', Number(e.target.value))}
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
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Historische Gruppen bevorzugen</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.avoidHighFailureSlots}
                onChange={(e) => handleConfigChange('avoidHighFailureSlots', e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Hohe Ausfallraten-Slots vermeiden</span>
            </label>
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
            <p className={`text-xl font-bold mt-1              ${state.isReady ? 'text-green-600' : 'text-amber-600'}`}>
              {state.isReady ? 'Bereit' : 'Prüfen'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Member Selector */}
      <MemberSelector />
    </div>
  );
}
