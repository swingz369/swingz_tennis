'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Trash2, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { PageHeader } from '@/components/ui/page-header';
import { SeasonPlanningTabs } from '@/components/admin/season-planning-tabs';
import { Breadcrumb } from '@/components/ui/breadcrumb';

interface Season {
  id: string;
  name: string;
  season_type: 'summer' | 'winter';
  year: number;
  start_date: string;
  end_date: string;
  preferences_deadline: string | null;
  description: string | null;
  notes: string | null;
  planning_status: string;
  club_id: string;
}

interface EditSeasonPageProps {
  params: Promise<{ id: string }>;
}

export default function EditSeasonPage({ params }: EditSeasonPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [season, setSeason] = useState<Season | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    season_type: 'summer' as 'summer' | 'winter',
    year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    preferences_deadline: '',
    description: '',
    notes: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/api/seasons/${id}`);
        if (!res.ok) throw new Error('Season nicht gefunden');
        const data = await res.json();
        const s: Season = data.season;
        setSeason(s);
        setFormData({
          name: s.name,
          season_type: s.season_type,
          year: s.year,
          start_date: s.start_date?.slice(0, 10) ?? '',
          end_date: s.end_date?.slice(0, 10) ?? '',
          preferences_deadline: s.preferences_deadline?.slice(0, 10) ?? '',
          description: s.description ?? '',
          notes: s.notes ?? '',
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Fehler beim Laden');
        router.push('/admin/seasons');
      } finally {
        setFetching(false);
      }
    };
    load();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/seasons/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'Fehler beim Speichern');
      }
      toast.success('Saison gespeichert');
      router.push(`/admin/seasons/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/seasons/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err) || 'Fehler beim Löschen');
      }
      toast.success('Saison gelöscht');
      router.push('/admin/seasons');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!season) return null;

  const isDraft = season.planning_status === 'draft';
  const statusLabels: Record<string, string> = {
    draft: 'Entwurf',
    preferences_open: 'Präferenzen offen',
    manual_review: 'Wird geprüft',
    published: 'Veröffentlicht',
  };
  const statusLabel = statusLabels[season.planning_status] ?? season.planning_status;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Saisonplanung', href: '/admin/seasons' },
          { label: season.name, href: `/admin/seasons/${id}` },
          { label: 'Bearbeiten' },
        ]}
      />
      <SeasonPlanningTabs seasonId={id} />
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/seasons/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Saison bearbeiten" description={<>{season.name}</>} />
      </div>

      {!isDraft && (
        <Card className="border-warning-200 bg-warning-50 dark:bg-warning-900/20">
          <CardContent className="pt-4 pb-4 flex items-center gap-3 text-sm text-warning-800 dark:text-warning-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Diese Saison ist bereits veröffentlicht (Status:{' '}
            <strong className="mx-1">{statusLabel}</strong>). Saison-Typ, Jahr und Zeitraum sind
            gesperrt, da bereits Trainingspläne und Buchungen darauf basieren — nur Beschreibung,
            Notizen und die Präferenz-Deadline lassen sich noch ändern.
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Saison-Details</CardTitle>
            <CardDescription>Grundlegende Informationen zur Saison</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="season_type">
                  Saison-Typ <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.season_type}
                  onValueChange={(v: 'summer' | 'winter') =>
                    setFormData((p) => ({ ...p, season_type: v }))
                  }
                  disabled={!isDraft}
                >
                  <SelectTrigger id="season_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summer">☀️ Sommer (April – September)</SelectItem>
                    <SelectItem value="winter">❄️ Winter (Oktober – März)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">
                  Jahr <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="year"
                  type="number"
                  min="2024"
                  max="2030"
                  value={formData.year}
                  onChange={(e) => setFormData((p) => ({ ...p, year: parseInt(e.target.value) }))}
                  disabled={!isDraft}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">
                  Startdatum <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData((p) => ({ ...p, start_date: e.target.value }))}
                  disabled={!isDraft}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">
                  Enddatum <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData((p) => ({ ...p, end_date: e.target.value }))}
                  disabled={!isDraft}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferences_deadline">Präferenz-Deadline (optional)</Label>
              <Input
                id="preferences_deadline"
                type="date"
                value={formData.preferences_deadline}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, preferences_deadline: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Interne Notizen (optional)</Label>
              <Textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              {isDraft && (
                <div className="flex items-center gap-2">
                  {confirmDelete && (
                    <span className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Wirklich löschen?
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {confirmDelete ? 'Ja, löschen' : 'Saison löschen'}
                  </Button>
                  {confirmDelete && (
                    <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
                      Abbrechen
                    </Button>
                  )}
                </div>
              )}

              <div className="flex gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/admin/seasons/${id}`)}
                  disabled={loading}
                >
                  Abbrechen
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Save className="mr-2 h-4 w-4 animate-spin" />
                      Wird gespeichert…
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Speichern
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      {!isDraft && (
        <Card className="border-warning-200 bg-warning-50 dark:bg-warning-900/20">
          <CardContent className="pt-4 pb-4 flex items-center gap-3 text-sm text-warning-800 dark:text-warning-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Löschen ist nur bei Saisons im Status <strong className="mx-1">Entwurf</strong> möglich.
            Aktive oder abgeschlossene Saisons können nicht gelöscht werden.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
