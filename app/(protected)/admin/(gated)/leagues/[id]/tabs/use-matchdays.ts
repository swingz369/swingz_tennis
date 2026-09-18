'use client';

import { useCallback, useEffect, useState } from 'react';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import type { League, MatchDay } from './types';

/** Fachlogik des "Spieltage"-Tabs — als Hook ausgelagert, weil der Header
 * (nuLiga-Sync-/Historie-/Import-Buttons) außerhalb des Tabs sitzt, aber
 * denselben Zustand steuert. */
export function useMatchdays(leagueId: string, league: League | null, onChanged: () => void) {
  const [showNewMatchDay, setShowNewMatchDay] = useState(false);
  const [newMatchDay, setNewMatchDay] = useState({
    matchday_number: 1,
    scheduled_date: '',
    opponent: '',
    is_home: true,
    venue: '',
    notes: '',
  });

  const [nuligaUrl, setNuligaUrl] = useState('');
  const [showNuligaConfig, setShowNuligaConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(null);
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [syncHistory, setSyncHistory] = useState<Record<string, unknown>[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [importing, setImporting] = useState(false);

  const [blockingMatchday, setBlockingMatchday] = useState<string | null>(null);

  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState({ result: 'win', score_home: 0, score_away: 0 });

  useEffect(() => {
    if (league?.nuliga_url) setNuligaUrl(league.nuliga_url);
  }, [league?.nuliga_url]);

  const handleCreateMatchDay = async () => {
    if (!newMatchDay.opponent) {
      toast.error('Gegner erforderlich');
      return;
    }
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/matchdays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMatchDay),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Spieltag erstellt');
      setShowNewMatchDay(false);
      setNewMatchDay({
        matchday_number: (newMatchDay.matchday_number ?? 0) + 1,
        scheduled_date: '',
        opponent: '',
        is_home: true,
        venue: '',
        notes: '',
      });
      onChanged();
    } catch {
      toast.error('Fehler beim Erstellen');
    }
  };

  const handleRecordResult = async (matchdayId: string) => {
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/matchdays/${matchdayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: resultForm.result,
          score_home: resultForm.score_home,
          score_away: resultForm.score_away,
          status: 'completed',
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Ergebnis eingetragen');
      setEditingResultId(null);
      onChanged();
    } catch {
      toast.error('Fehler beim Eintragen');
    }
  };

  const handleDeleteMatchDay = async (matchdayId: string) => {
    if (!confirm('Spieltag wirklich löschen?')) return;
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/matchdays/${matchdayId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Löschen fehlgeschlagen');
      toast.success('Spieltag gelöscht');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  const handleNuligaSync = async () => {
    if (!nuligaUrl.trim()) {
      toast.error('Bitte nuLiga-URL eingeben');
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuliga_url: nuligaUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Sync fehlgeschlagen');

      setSyncResult(data);
      const parts: string[] = [];
      if (data.teamsCreated > 0) parts.push(`${data.teamsCreated} Teams erstellt`);
      if (data.teamsUpdated > 0) parts.push(`${data.teamsUpdated} Teams aktualisiert`);
      if (data.matchesCreated > 0) parts.push(`${data.matchesCreated} Spieltage erstellt`);
      if (data.matchesUpdated > 0) parts.push(`${data.matchesUpdated} Spieltage aktualisiert`);
      if (data.playersImported > 0) {
        parts.push(`${data.playersImported} Spieler im Kader (${data.playersLinked} verknüpft)`);
      }
      if (data.skippedForeign > 0) {
        parts.push(`${data.skippedForeign} fremde Begegnungen übersprungen`);
      }
      toast.success(`Sync erfolgreich: ${parts.join(', ') || 'Alles aktuell'}`);
      if (data.warning) toast.warning(data.warning, { duration: 10000 });
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleCourtBlock = async (matchDay: MatchDay) => {
    setBlockingMatchday(matchDay.id);
    const blocked = matchDay.blocked_courts > 0;
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/matchdays/${matchDay.id}/courts`, {
        method: blocked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: blocked ? undefined : JSON.stringify({ notify_members: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Fehlgeschlagen');
      toast.success(blocked ? 'Platzsperre aufgehoben' : `${data.created} Plätze gesperrt`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler bei der Platzsperre');
    } finally {
      setBlockingMatchday(null);
    }
  };

  const loadSyncHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/sync-history?limit=15`);
      const data = await res.json();
      setSyncHistory(data.logs ?? []);
    } catch {
      toast.error('Fehler beim Laden der Sync-Historie');
    } finally {
      setLoadingHistory(false);
    }
  }, [leagueId]);

  const handleImportCsv = async () => {
    if (!importCsv.trim()) {
      toast.error('CSV-Daten fehlen');
      return;
    }
    setImporting(true);
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: importCsv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Import fehlgeschlagen');

      const parts = [] as string[];
      if (data.created > 0) parts.push(`${data.created} neue Spieltage`);
      if (data.updated > 0) parts.push(`${data.updated} aktualisiert`);
      toast.success(`Import erfolgreich: ${parts.join(', ') || 'Keine Änderungen'}`);
      if (data.errors?.length) {
        toast.warning(`${data.errors.length} Zeile(n) mit Fehlern`);
      }
      setShowImport(false);
      setImportCsv('');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Import');
    } finally {
      setImporting(false);
    }
  };

  return {
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
    loadSyncHistory,
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
  };
}

export type MatchdaysActions = ReturnType<typeof useMatchdays>;
