'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

/**
 * 1.3.3 — Krisenfall-Button: nuLiga CSV-Import
 * Einfaches Modal für Tabellen- + Spielplan-Upload wenn nuLiga-Scraper ausfällt.
 */

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface Props {
  leagueId: string;
  teamName?: string;
}

export function NuligaImport({ leagueId, teamName = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const standingsRef = useRef<HTMLInputElement>(null);
  const matchesRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    const standings = standingsRef.current?.files?.[0];
    const matches = matchesRef.current?.files?.[0];
    if (!standings && !matches) {
      toast.error('Bitte mindestens eine CSV-Datei auswählen');
      return;
    }

    const form = new FormData();
    form.set('leagueId', leagueId);
    form.set('teamName', teamName);
    if (standings) form.set('standings', standings);
    if (matches) form.set('matches', matches);

    setLoading(true);
    try {
      const r = await apiFetch('/api/admin/nuliga/import', { method: 'POST', body: form });
      const data = (await r.json()) as {
        standingsImported?: number;
        matchesImported?: number;
        error?: string;
      };
      if (!r.ok) {
        toast.error(extractErrorMessage(data) ?? 'Import fehlgeschlagen');
        return;
      }
      toast.success(
        `Import erfolgreich: ${data.standingsImported ?? 0} Teams, ${data.matchesImported ?? 0} Spieltage`
      );
      setOpen(false);
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-warning-600 border-warning-300 hover:bg-warning-50 dark:hover:bg-warning-900"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          CSV-Fallback
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning-500" />
            nuLiga CSV-Import (Krisenfall)
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Wenn der nuLiga-Scraper nicht erreichbar ist, können Tabelle und Spielplan manuell per
          CSV-Export aus nuLiga hochgeladen werden (Semikolon-getrennt, UTF-8).
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nuliga-standings">Tabelle (standings.csv)</Label>
            <Input id="nuliga-standings" ref={standingsRef} type="file" accept=".csv" />
            <p className="text-xs text-muted-foreground">
              Spalten: Rang;Mannschaft;Spiele;S;U;N;Punkte
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nuliga-matches">Spielplan (matches.csv)</Label>
            <Input id="nuliga-matches" ref={matchesRef} type="file" accept=".csv" />
            <p className="text-xs text-muted-foreground">
              Spalten: Spieltag;Datum;Heimmannschaft;Gastmannschaft
            </p>
          </div>
          <Button className="w-full" onClick={() => void handleImport()} disabled={loading}>
            <Upload className="h-4 w-4 mr-2" />
            {loading ? 'Importiere…' : 'Importieren'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
