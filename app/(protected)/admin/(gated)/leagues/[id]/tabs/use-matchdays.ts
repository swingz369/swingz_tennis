'use client';

import { useState } from 'react';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import type { MatchDay } from './types';

/** Fachlogik des "Spieltage"-Tabs — als Hook ausgelagert, weil der Header
 * (Import-Buttons) außerhalb des Tabs sitzt, aber denselben Zustand steuert. */
export function useMatchdays(leagueId: string, onChanged: () => void) {
  const [showNewMatchDay, setShowNewMatchDay] = useState(false);
  const [newMatchDay, setNewMatchDay] = useState({
    matchday_number: 1,
    scheduled_date: '',
    opponent: '',
    is_home: true,
    venue: '',
    notes: '',
  });

  const [showImport, setShowImport] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [importing, setImporting] = useState(false);

  const [blockingMatchday, setBlockingMatchday] = useState<string | null>(null);

  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState({ result: 'win', score_home: 0, score_away: 0 });

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
