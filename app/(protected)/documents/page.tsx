'use client';
import { useState, useEffect } from 'react';
import { FileText, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/api-fetch';
import { PageHeader } from '@/components/ui/page-header';
import { ListState } from '@/components/ui/list-state';

type Doc = {
  id: string;
  name: string;
  category: string;
  file_url: string;
  file_size_bytes: number;
  created_at: string;
};

export default function MemberDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  // Ein 403 darf nicht als "keine Dokumente" durchgehen (PRODUKTIONSREIFE.md 4.5).
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ documents?: Doc[] }>('/api/admin/documents')
      .then((d) => setDocs(d.documents ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (b: number) =>
    b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vereinsdokumente"
        description="Satzung, Beschlüsse und weitere Unterlagen."
      />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Alle Dokumente</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || error || docs.length === 0 ? (
            <ListState
              loading={loading}
              error={error}
              empty={docs.length === 0}
              emptyTitle="Keine Dokumente vorhanden"
              emptyHint="Dein Verein hat hier noch nichts hinterlegt. Frag den Vorstand, wenn du ein Dokument erwartest."
            />
          ) : (
            <div className="divide-y divide-border">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 py-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(doc.file_size_bytes)} ·{' '}
                      {new Date(doc.created_at).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {doc.category}
                  </Badge>
                  <a href={doc.file_url} target="_blank" rel="noreferrer">
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
