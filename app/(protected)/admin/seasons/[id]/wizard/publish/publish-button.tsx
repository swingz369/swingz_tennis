'use client';
import { useState } from 'react';
import { csrfHeaders } from '@/lib/csrf-client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export function PublishButton({ seasonId }: { seasonId: string }) {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportCSV() {
    setExporting(true);
    try {
      const res = await fetch(`/api/seasons/${seasonId}/plan-entries?format=csv`, {
        headers: csrfHeaders(),
      });
      if (!res.ok) {
        // Fallback: generate CSV from JSON response
        const jsonRes = await fetch(`/api/seasons/${seasonId}/plan-entries`, {
          headers: csrfHeaders(),
        });
        if (!jsonRes.ok) {
          toast.error('Export fehlgeschlagen');
          setExporting(false);
          return;
        }
        const data = await jsonRes.json();
        const entries = data.entries || data || [];
        const csv = generatePlanCSV(entries);
        downloadCSV(csv, `saisonplan-${seasonId.slice(0, 8)}.csv`);
      } else {
        const csvText = await res.text();
        downloadCSV(csvText, `saisonplan-${seasonId.slice(0, 8)}.csv`);
      }
      toast.success('CSV exportiert');
    } catch {
      toast.error('Export fehlgeschlagen');
    } finally {
      setExporting(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/seasons/${seasonId}/planning/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ acceptedWarnings: [] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Fehler beim Veröffentlichen');
        setPublishing(false);
        return;
      }
      toast.success('Saison erfolgreich veröffentlicht');
      setPublished(true);
    } catch {
      toast.error('Netzwerkfehler');
      setPublishing(false);
    }
  }

  if (published) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-4 space-y-2">
        <p className="font-semibold text-green-800">Saison erfolgreich veröffentlicht!</p>
        <Link
          href={`/admin/seasons/${seasonId}`}
          className="text-sm text-green-700 underline hover:text-green-900"
        >
          Zur Saison-Übersicht →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={publish} disabled={publishing} size="lg">
        {publishing ? 'Veröffentlichen...' : 'Saison veröffentlichen'}
      </Button>
      <Button variant="outline" onClick={exportCSV} disabled={exporting}>
        <Download className="h-4 w-4 mr-2" />
        {exporting ? 'Exportiere...' : 'CSV exportieren'}
      </Button>
    </div>
  );
}

function generatePlanCSV(entries: any[]): string {
  const headers = ['Gruppe', 'Trainer', 'Tag', 'Start', 'Ende', 'Platz', 'Teilnehmer', 'Status'];
  const rows = entries.map((e: any) => [
    e.group_name || e.group_id || '',
    e.trainer_name || e.trainer_id || '',
    ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][e.day_of_week ?? 0],
    (e.start_time || '').substring(0, 5),
    (e.end_time || '').substring(0, 5),
    e.court_name || e.court_id || '',
    Array.isArray(e.expected_participants) ? e.expected_participants.length : 0,
    e.status || '',
  ]);
  return [headers, ...rows].map((row) => row.join(',')).join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
