'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus,
  Calendar,
  Edit2,
  Trash2,
  ExternalLink,
  RefreshCw,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  LockOpen,
  X,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import type { MatchDay } from './types';
import type { MatchdaysActions } from './use-matchdays';

export function MatchdaysTab({
  matchDays,
  lastSyncedAt,
  actions,
}: {
  matchDays: MatchDay[];
  lastSyncedAt: string | null;
  actions: MatchdaysActions;
}) {
  const {
    showNewMatchDay,
    setShowNewMatchDay,
    newMatchDay,
    setNewMatchDay,
    handleCreateMatchDay,
    nuligaUrl,
    setNuligaUrl,
    showNuligaConfig,
    setShowNuligaConfig,
    syncing,
    syncResult,
    handleNuligaSync,
    showSyncHistory,
    setShowSyncHistory,
    syncHistory,
    loadingHistory,
    showImport,
    setShowImport,
    importCsv,
    setImportCsv,
    importing,
    handleImportCsv,
    blockingMatchday,
    handleToggleCourtBlock,
    editingResultId,
    setEditingResultId,
    resultForm,
    setResultForm,
    handleRecordResult,
    handleDeleteMatchDay,
  } = actions;

  return (
    <>
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Spieltage</h2>
        <Button size="sm" onClick={() => setShowNewMatchDay(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Neuer Spieltag
        </Button>
      </div>

      {matchDays.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <Calendar className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Noch keine Spieltage eingetragen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {matchDays.map((md) => (
            <Card
              key={md.id}
              className={`hover:shadow-md transition-all duration-200 ${
                md.status === 'completed'
                  ? md.result === 'win'
                    ? 'border-l-4 border-l-success-500'
                    : md.result === 'loss'
                      ? 'border-l-4 border-l-error-500'
                      : 'border-l-4 border-l-warning-500'
                  : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[3rem]">
                      <div className="text-2xs text-muted-foreground">Spieltag</div>
                      <div className="text-xl font-bold text-primary">{md.matchday_number}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{md.opponent}</span>
                        <Badge variant={md.is_home ? 'default' : 'outline'} className="text-xs">
                          {md.is_home ? '🏠 Heim' : '✈️ Auswärts'}
                        </Badge>
                        {md.status === 'completed' && md.result && (
                          <Badge
                            className={`text-xs font-semibold ${
                              md.result === 'win'
                                ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-300'
                                : md.result === 'loss'
                                  ? 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-300'
                                  : 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-300'
                            }`}
                          >
                            {md.result === 'win'
                              ? '✓ Sieg'
                              : md.result === 'loss'
                                ? '✗ Niederlage'
                                : '= Unentschieden'}
                          </Badge>
                        )}
                        {md.status !== 'completed' && (
                          <Badge
                            variant="outline"
                            className="text-xs text-info-600 border-info-200"
                          >
                            Ausstehend
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {md.scheduled_date
                          ? new Date(md.scheduled_date).toLocaleDateString('de-DE', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : 'Kein Datum'}
                        {md.venue && ` · ${md.venue}`}
                      </div>
                      {md.status === 'completed' && md.score_home !== null && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-2xl font-bold tabular-nums text-foreground">
                            {md.score_home}
                          </span>
                          <span className="text-lg text-muted-foreground font-medium">:</span>
                          <span className="text-2xl font-bold tabular-nums text-foreground">
                            {md.score_away}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {md.nuliga_report_url && (
                      <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <a href={md.nuliga_report_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Spielbericht
                        </a>
                      </Button>
                    )}
                    {md.is_home && (
                      <Button
                        variant={md.blocked_courts > 0 ? 'secondary' : 'outline'}
                        size="sm"
                        disabled={blockingMatchday === md.id}
                        onClick={() => handleToggleCourtBlock(md)}
                        className="gap-1.5"
                        title={
                          md.blocked_courts > 0
                            ? `${md.blocked_courts} Plätze gesperrt — klicken zum Aufheben`
                            : 'Alle aktiven Plätze für dieses Heimspiel sperren'
                        }
                      >
                        {md.blocked_courts > 0 ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <LockOpen className="h-3.5 w-3.5" />
                        )}
                        {md.blocked_courts > 0 ? `${md.blocked_courts} Plätze` : 'Plätze'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingResultId(md.id);
                        setResultForm({
                          result: md.result ?? 'win',
                          score_home: md.score_home ?? 0,
                          score_away: md.score_away ?? 0,
                        });
                      }}
                      className="gap-1.5"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      {md.status === 'completed' ? 'Bearbeiten' : 'Ergebnis'}
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMatchDay(md.id)}
                          aria-label="Spieltag löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-error-400" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Spieltag löschen</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Result Recording */}
                {editingResultId === md.id && (
                  <div className="mt-3 p-3 border rounded-xl bg-muted/50 space-y-3">
                    <div className="flex items-center gap-4">
                      <div>
                        <label htmlFor="ld-result-type" className="text-xs font-medium">
                          Ergebnis
                        </label>
                        <select
                          id="ld-result-type"
                          value={resultForm.result}
                          onChange={(e) => setResultForm({ ...resultForm, result: e.target.value })}
                          className="w-full mt-1 p-2 rounded border bg-background text-sm"
                        >
                          <option value="win">Sieg</option>
                          <option value="draw">Unentschieden</option>
                          <option value="loss">Niederlage</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="ld-result-home" className="text-xs font-medium">
                          Eigene
                        </label>
                        <Input
                          id="ld-result-home"
                          type="number"
                          min={0}
                          value={resultForm.score_home}
                          onChange={(e) =>
                            setResultForm({
                              ...resultForm,
                              score_home: parseInt(e.target.value) || 0,
                            })
                          }
                          className="mt-1 w-20"
                        />
                      </div>
                      <span className="text-lg font-bold mt-5">:</span>
                      <div>
                        <label htmlFor="ld-result-away" className="text-xs font-medium">
                          Gegner
                        </label>
                        <Input
                          id="ld-result-away"
                          type="number"
                          min={0}
                          value={resultForm.score_away}
                          onChange={(e) =>
                            setResultForm({
                              ...resultForm,
                              score_away: parseInt(e.target.value) || 0,
                            })
                          }
                          className="mt-1 w-20"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditingResultId(null)}>
                        Abbrechen
                      </Button>
                      <Button size="sm" onClick={() => handleRecordResult(md.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Eintragen
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* nuLiga Sync Panel */}
      {showNuligaConfig && (
        <Card className="border-2 border-info-200 bg-info-50/50 dark:bg-info-900/20 dark:border-info-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              nuLiga Synchronisation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verbinde diese Liga mit einer nuLiga Seite, um Tabellen und Ergebnisse automatisch zu
              synchronisieren.
            </p>
            <div>
              <label htmlFor="nuliga-url" className="text-xs font-medium">
                nuLiga URL
              </label>
              <Input
                id="nuliga-url"
                value={nuligaUrl}
                onChange={(e) => setNuligaUrl(e.target.value)}
                placeholder="https://htv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/groupPage?championship=...&group=..."
                className="mt-1 tabular-nums text-xs"
              />
              <p className="text-2xs text-muted-foreground mt-1">
                URL muss von *.liga.nu stammen (z.B. htv.liga.nu, btv.liga.nu)
              </p>
            </div>
            {lastSyncedAt && (
              <p className="text-xs text-muted-foreground">
                Letzter Sync: {new Date(lastSyncedAt).toLocaleString('de-DE')}
              </p>
            )}
            {syncResult && (
              <div className="text-xs bg-success-50 dark:bg-success-900/30 border border-success-200 dark:border-success-800 rounded p-2 space-y-1">
                <p className="font-medium text-success-700 dark:text-success-400">Sync-Ergebnis:</p>
                <p>
                  {String(syncResult.standings)} Teams, {String(syncResult.matches)} Spieltage
                  geladen
                </p>
                <p>
                  {String(
                    (syncResult.teamsCreated as number) + (syncResult.teamsUpdated as number)
                  )}{' '}
                  Teams aktualisiert,{' '}
                  {String(
                    (syncResult.matchesCreated as number) + (syncResult.matchesUpdated as number)
                  )}{' '}
                  Spieltage aktualisiert
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowNuligaConfig(false)}>
                Schließen
              </Button>
              <Button size="sm" onClick={handleNuligaSync} disabled={syncing || !nuligaUrl.trim()}>
                {syncing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Synchronisiere...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Synchronisieren
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync History Panel */}
      {showSyncHistory && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Sync-Historie
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSyncHistory(false)}
                    aria-label="Schließen"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Schließen</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Laden</p>
            ) : syncHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Noch keine Sync-Einträge vorhanden
              </p>
            ) : (
              <div className="space-y-2">
                {syncHistory.map((entry) => (
                  <div
                    key={entry.id as string}
                    className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 text-sm"
                  >
                    <div className="mt-0.5">
                      {(entry.status as string) === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-success-500" />
                      ) : (entry.status as string) === 'partial' ? (
                        <AlertTriangle className="h-4 w-4 text-warning-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-error-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {(entry.trigger as string) === 'cron' ? 'Automatisch' : 'Manuell'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.created_at as string).toLocaleString('de-DE')}
                        </span>
                      </div>
                      {(entry.status as string) === 'success' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {String(
                            (entry.teams_created as number) + (entry.teams_updated as number)
                          )}{' '}
                          Teams,{' '}
                          {String(
                            (entry.matches_created as number) + (entry.matches_updated as number)
                          )}{' '}
                          Spieltage aktualisiert
                          {entry.duration_ms != null && ` · ${String(entry.duration_ms)}ms`}
                        </p>
                      )}
                      {(entry.status as string) === 'failed' && !!entry.error_message && (
                        <p className="text-xs text-error-500 mt-1">{String(entry.error_message)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CSV Import Panel */}
      {showImport && (
        <Card className="border-2 border-info-200 bg-info-50/50 dark:bg-info-900/20 dark:border-info-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              CSV-Import (tennis.de Format)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Importiere Spielergebnisse aus einer CSV-Datei. Bestehende Spieltage werden
              aktualisiert, neue werden erstellt.
            </p>
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
              Format: Spieltag;Datum;Gegner;Heim/Auswärts;Spielort;Ergebnis;Punkte Heim;Punkte
              Gast;Status;Notizen
            </div>
            <div>
              <label htmlFor="csv-upload" className="text-xs font-medium">
                CSV-Datei hochladen
              </label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv,.txt,.tsv"
                className="mt-1"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setImportCsv((ev.target?.result as string) || '');
                    };
                    reader.readAsText(file);
                  }
                  // Reset so re-uploading the same file triggers onChange again
                  e.target.value = '';
                }}
              />
            </div>
            <div>
              <label htmlFor="csv-text" className="text-xs font-medium">
                Oder CSV-Text einfügen
              </label>
              <textarea
                id="csv-text"
                value={importCsv}
                onChange={(e) => setImportCsv(e.target.value)}
                placeholder="Spieltag;Datum;Gegner;Heim/Auswärts;...&#10;1;15.03.2026;TC Musterstadt;Heim;..."
                rows={5}
                className="w-full mt-1 p-2 rounded border bg-background text-sm tabular-nums resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowImport(false);
                  setImportCsv('');
                }}
              >
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleImportCsv} disabled={importing || !importCsv.trim()}>
                {importing ? 'Importiere...' : 'Importieren'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Match Day Form */}
      {showNewMatchDay && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Neuen Spieltag anlegen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ld-md-number" className="text-xs font-medium">
                  Spieltag-Nr. *
                </label>
                <Input
                  id="ld-md-number"
                  type="number"
                  min={1}
                  value={newMatchDay.matchday_number}
                  onChange={(e) =>
                    setNewMatchDay({
                      ...newMatchDay,
                      matchday_number: parseInt(e.target.value) || 1,
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="ld-md-opponent" className="text-xs font-medium">
                  Gegner *
                </label>
                <Input
                  id="ld-md-opponent"
                  value={newMatchDay.opponent}
                  onChange={(e) => setNewMatchDay({ ...newMatchDay, opponent: e.target.value })}
                  placeholder="z.B. TC Musterstadt"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="ld-md-date" className="text-xs font-medium">
                  Datum
                </label>
                <Input
                  id="ld-md-date"
                  type="date"
                  value={newMatchDay.scheduled_date}
                  onChange={(e) =>
                    setNewMatchDay({ ...newMatchDay, scheduled_date: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="ld-md-venue-type" className="text-xs font-medium">
                  Heim/Auswärts
                </label>
                <select
                  id="ld-md-venue-type"
                  value={newMatchDay.is_home ? 'home' : 'away'}
                  onChange={(e) =>
                    setNewMatchDay({ ...newMatchDay, is_home: e.target.value === 'home' })
                  }
                  className="w-full mt-1 p-2 rounded border bg-background text-sm"
                >
                  <option value="home">Heim</option>
                  <option value="away">Auswärts</option>
                </select>
              </div>
              <div>
                <label htmlFor="ld-md-venue" className="text-xs font-medium">
                  Spielort
                </label>
                <Input
                  id="ld-md-venue"
                  value={newMatchDay.venue}
                  onChange={(e) => setNewMatchDay({ ...newMatchDay, venue: e.target.value })}
                  placeholder="Optional"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowNewMatchDay(false)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleCreateMatchDay}>
                Spieltag erstellen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
