'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiFetch, fetchJson } from '@/lib/api-fetch';
import { ListState } from '@/components/ui/list-state';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const CATEGORIES = ['satzung', 'protokoll', 'beschluss', 'lizenz', 'vertrag', 'sonstige'];

type Doc = {
  id: string;
  name: string;
  category: string;
  file_url: string;
  file_size_bytes: number;
  mime_type: string;
  created_at: string;
};

export function DocumentsClient() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  // Ein 403 darf nicht als "keine Dokumente" durchgehen (PRODUKTIONSREIFE.md 4.5).
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('sonstige');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    fetchJson<{ documents?: Doc[] }>('/api/admin/documents')
      .then((d) => {
        setDocs(d.documents ?? []);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Keine Datei ausgewählt');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name || file.name);
      fd.append('category', category);
      const res = await apiFetch('/api/admin/documents', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(extractErrorMessage(data) ?? 'Fehler');
        return;
      }
      toast.success('Dokument hochgeladen');
      setDocs((prev) => [data.document, ...prev]);
      setName('');
      setCategory('sonstige');
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await apiFetch(`/api/admin/documents/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Löschen fehlgeschlagen');
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== id));
    toast.success('Dokument gelöscht');
  };

  const fmt = (bytes: number) =>
    bytes > 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.round(bytes / 1024)} KB`;

  return (
    <div className="space-y-6">
      <Card className="max-w-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Dokument hochladen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Datei *</Label>
            <Input
              ref={fileRef}
              type="file"
              className="mt-1.5"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
            />
          </div>
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Satzung 2024"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Kategorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="w-full gap-2">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Hochladen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Alle Dokumente ({docs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || error || docs.length === 0 ? (
            <ListState
              loading={loading}
              error={error}
              empty={docs.length === 0}
              emptyTitle="Noch keine Dokumente hochgeladen"
              emptyHint="Satzung, Beitragsordnung, Platzordnung — alles was Mitglieder nachlesen sollen, kommt hier hoch."
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Herunterladen"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Herunterladen</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(doc.id)}
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Löschen</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
