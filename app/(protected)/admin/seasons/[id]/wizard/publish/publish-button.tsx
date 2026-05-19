'use client';
import { useState } from 'react';
import { csrfHeaders } from '@/lib/csrf-client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function PublishButton({ seasonId }: { seasonId: string }) {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

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
    <Button onClick={publish} disabled={publishing} size="lg">
      {publishing ? 'Veröffentlichen...' : 'Saison veröffentlichen'}
    </Button>
  );
}
