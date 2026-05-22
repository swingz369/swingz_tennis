'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Users,
  AlertCircle,
  TrendingUp,
  Play,
  Settings,
  FileText,
  Clock,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SeasonWithStats } from '@/lib/types/season-planning';

function SeasonInvoiceGenerator({ seasonId, clubId }: { seasonId: string; clubId: string }) {
  const [installmentCount, setInstallmentCount] = useState(1);
  const [dueDates, setDueDates] = useState<string[]>(['']);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);

  useEffect(() => {
    setDueDates((prev) => {
      const arr = [...prev];
      while (arr.length < installmentCount) arr.push('');
      return arr.slice(0, installmentCount);
    });
  }, [installmentCount]);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/billing/generate-season-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: clubId,
          season_id: seasonId,
          installment_count: installmentCount,
          installment_due_dates: installmentCount > 1 ? dueDates : [],
          due_date: dueDates[0] ?? '',
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ created: 0, errors: ['Netzwerkfehler'] });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saison-Rechnungen</CardTitle>
        <CardDescription>Rechnungen für alle Mitglieder dieser Saison generieren</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div>
            <Label htmlFor="installment_count">Raten</Label>
            <Select
              value={String(installmentCount)}
              onValueChange={(v) => setInstallmentCount(Number(v))}
            >
              <SelectTrigger id="installment_count" className="mt-1 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Rate</SelectItem>
                <SelectItem value="2">2 Raten</SelectItem>
                <SelectItem value="3">3 Raten</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          {dueDates.map((date, i) => (
            <div key={i} className="flex items-center gap-3">
              <Label htmlFor={`due_date_${i}`} className="w-32 shrink-0">
                {installmentCount === 1 ? 'Fälligkeitsdatum' : `Rate ${i + 1} fällig`}
              </Label>
              <Input
                id={`due_date_${i}`}
                type="date"
                value={date}
                onChange={(e) => {
                  const updated = [...dueDates];
                  updated[i] = e.target.value;
                  setDueDates(updated);
                }}
                className="max-w-xs"
              />
            </div>
          ))}
        </div>

        <Button onClick={handleGenerate} disabled={generating || !dueDates[0]}>
          {generating ? 'Generiere…' : 'Rechnungen generieren'}
        </Button>

        {result && (
          <div className="mt-2 space-y-1">
            <p className="text-sm font-medium text-green-600">
              {result.created} Rechnung{result.created !== 1 ? 'en' : ''} erstellt
            </p>
            {result.errors && result.errors.length > 0 && (
              <ul className="text-sm text-red-600 space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TrainingGroup {
  id: string;
  name: string;
  age_group: string;
  level: string;
}

function GroupChangeDialog({
  memberId,
  currentGroupId,
  currentGroupName,
  clubId,
  groups,
  onSuccess,
}: {
  memberId: string;
  currentGroupId: string;
  currentGroupName: string;
  clubId: string;
  groups: TrainingGroup[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newGroupId, setNewGroupId] = useState('');
  const [changeDate, setChangeDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ net_delta: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const otherGroups = groups.filter((g) => g.id !== currentGroupId);

  const handleSubmit = async () => {
    if (!newGroupId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/billing/group-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: clubId,
          member_id: memberId,
          old_group_id: currentGroupId,
          new_group_id: newGroupId,
          change_date: changeDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? 'Fehler beim Gruppenwechsel');
      } else {
        setResult(data.data);
        onSuccess();
      }
    } catch {
      setErr('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Wechseln
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gruppenwechsel</DialogTitle>
            <DialogDescription>
              Mitglied in eine andere Gruppe wechseln lassen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Aktuelle Gruppe</Label>
              <p className="mt-1 text-sm font-medium">{currentGroupName}</p>
            </div>
            <div>
              <Label>Neue Gruppe</Label>
              <Select value={newGroupId} onValueChange={setNewGroupId}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Gruppe wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {otherGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.age_group} / {g.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="change_date">Wechseldatum</Label>
              <Input
                id="change_date"
                type="date"
                value={changeDate}
                onChange={(e) => setChangeDate(e.target.value)}
                className="mt-1 max-w-xs"
              />
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            {result && (
              <p className="text-sm font-medium text-green-600">
                Wechsel durchgeführt. Netto: {result.net_delta >= 0 ? '+' : ''}
                {result.net_delta.toFixed(2)} €
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setResult(null);
                setErr(null);
                setNewGroupId('');
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !newGroupId}>
              {loading ? 'Wird ausgeführt…' : 'Wechsel durchführen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GroupMembersPanel({ seasonId, clubId }: { seasonId: string; clubId: string }) {
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/seasons/${seasonId}/groups?clubId=${clubId}`);
        if (res.ok) {
          const data = await res.json();
          setGroups(data.groups ?? []);
        }
      } finally {
        setLoadingGroups(false);
      }
    };
    load();
  }, [seasonId, clubId]);

  if (loadingGroups) {
    return <p className="text-sm text-muted-foreground">Lade Gruppen…</p>;
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Gruppen für diese Saison gefunden. Bitte zuerst eine Planung veröffentlichen.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {group.name}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {group.age_group} / {group.level}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GroupChangeDialog
              memberId=""
              currentGroupId={group.id}
              currentGroupName={group.name}
              clubId={clubId}
              groups={groups}
              onSuccess={() => {}}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Wähle oben ein Mitglied aus, um einen Gruppenwechsel durchzuführen.
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface SeasonDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function SeasonDetailPage({ params }: SeasonDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [season, setSeason] = useState<SeasonWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSeason = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/seasons/${id}`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Season');
      }

      const data = await response.json();
      setSeason(data.season);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSeason();
  }, [id, fetchSeason]);

  const handleOpenPreferences = async () => {
    try {
      const response = await fetch(`/api/seasons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planning_status: 'collecting_preferences',
          preferences_open: true,
        }),
      });

      if (!response.ok) throw new Error('Fehler beim Öffnen der Präferenzen');

      await fetchSeason();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handlePublish = () => {
    setPublishConfirmOpen(true);
  };

  const confirmPublish = async () => {
    setPublishConfirmOpen(false);
    try {
      const response = await fetch(`/api/seasons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planning_status: 'published' }),
      });

      if (!response.ok) throw new Error('Fehler beim Veröffentlichen');

      await fetchSeason();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleDelete = async () => {
    setDeleteConfirmOpen(false);
    setDeleting(true);
    try {
      const response = await fetch(`/api/seasons/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const err = await response.json();
        toast.error(err.error ?? 'Fehler beim Löschen der Saison');
        setDeleting(false);
        return;
      }

      toast.success('Saison gelöscht');
      router.push('/admin/seasons');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !season) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>Fehler</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error || 'Season nicht gefunden'}</p>
          <Button onClick={() => router.push('/admin/seasons')} className="mt-4" variant="outline">
            Zurück zur Übersicht
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canOpenPreferences = season.planning_status === 'draft';
  const canPublish = season.planning_status === 'manual_review';
  const canDelete = !['published', 'active', 'completed', 'archived'].includes(season.planning_status ?? '');

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        title="Saison veröffentlichen"
        description="Möchten Sie diese Saison wirklich veröffentlichen?"
        confirmLabel="Veröffentlichen"
        variant="brand"
        onConfirm={confirmPublish}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Saison löschen"
        description="Möchten Sie diese Saison wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden. Alle Präferenzen, Planungseinträge und Konflikte werden ebenfalls gelöscht."
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/seasons')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{season.season_type === 'summer' ? '☀️' : '❄️'}</span>
              <h1 className="text-3xl font-bold tracking-tight">{season.name}</h1>
              {season.is_active && (
                <Badge variant="default">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Aktiv
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {new Date(season.start_date).toLocaleDateString('de-DE')} -{' '}
              {new Date(season.end_date).toLocaleDateString('de-DE')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/admin/seasons/${id}/planning`}>
            <Button>
              <Play className="mr-2 h-4 w-4" />
              {['published', 'active', 'completed', 'archived'].includes(season.planning_status ?? '')
                ? 'Saisonplanung ansehen'
                : season.planning_status === 'draft'
                ? 'Saisonplanung starten'
                : 'Saisonplanung fortsetzen'}
            </Button>
          </Link>
          <Button variant="outline" onClick={() => router.push(`/admin/seasons/${id}/edit`)}>
            <Settings className="mr-2 h-4 w-4" />
            Bearbeiten
          </Button>

          {canOpenPreferences && (
            <Button onClick={handleOpenPreferences}>
              <Users className="mr-2 h-4 w-4" />
              Präferenzen öffnen
            </Button>
          )}


          {canPublish && (
            <Button onClick={handlePublish}>
              <FileText className="mr-2 h-4 w-4" />
              Veröffentlichen
            </Button>
          )}

          {canDelete && (
            <Button
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleting}
            >
              {deleting ? (
                <Clock className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Löschen
            </Button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Präferenzen</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{season.submitted_preferences}</div>
            <p className="text-xs text-muted-foreground">
              von {season.total_preferences} eingereicht
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${season.total_preferences > 0 ? (season.submitted_preferences / season.total_preferences) * 100 : 0}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trainer</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{season.trainers_count}</div>
            <p className="text-xs text-muted-foreground">Trainer verfügbar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Geplante Einheiten</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{season.planned_entries}</div>
            <p className="text-xs text-muted-foreground">Training-Sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Konflikte</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{season.open_conflicts}</div>
            <p className="text-xs text-muted-foreground">
              {season.open_conflicts > 0 ? 'Zu lösen' : 'Keine Konflikte'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="preferences">
            Präferenzen ({season.submitted_preferences})
          </TabsTrigger>
          <TabsTrigger value="plan">Plan ({season.planned_entries})</TabsTrigger>
          <TabsTrigger value="conflicts">Konflikte ({season.open_conflicts})</TabsTrigger>
          <TabsTrigger value="group-change">Gruppenwechsel</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Season Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className="text-lg">{season.planning_status}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Saison-Typ</p>
                  <p className="text-lg capitalize">{season.season_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Jahr</p>
                  <p className="text-lg">{season.year}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Gruppen abgedeckt</p>
                  <p className="text-lg">{season.groups_covered}</p>
                </div>
              </div>

              {season.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Beschreibung</p>
                  <p className="mt-1 text-sm">{season.description}</p>
                </div>
              )}

              {season.preferences_deadline && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Präferenz-Deadline</p>
                  <p className="mt-1 text-sm">
                    {new Date(season.preferences_deadline).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <SeasonInvoiceGenerator seasonId={id} clubId={season.club_id ?? ''} />
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>User Präferenzen</CardTitle>
              <CardDescription>
                Übersicht aller eingereichten Verfügbarkeiten und Präferenzen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push(`/admin/seasons/${id}/preferences`)}>
                Alle Präferenzen anzeigen
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan">
          <Card>
            <CardHeader>
              <CardTitle>Trainingsplan</CardTitle>
              <CardDescription>Geplante Training-Sessions für diese Season</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push(`/admin/seasons/${id}/plan`)}>
                Plan anzeigen
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts">
          <Card>
            <CardHeader>
              <CardTitle>Planungskonflikte</CardTitle>
              <CardDescription>Erkannte Konflikte in der Planung</CardDescription>
            </CardHeader>
            <CardContent>
              {season.open_conflicts === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                  <p className="mt-4 text-lg font-medium">Keine Konflikte</p>
                  <p className="text-sm text-muted-foreground">Die Planung ist konfliktfrei</p>
                </div>
              ) : (
                <Button onClick={() => router.push(`/admin/seasons/${id}/conflicts`)}>
                  Konflikte anzeigen ({season.open_conflicts})
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="group-change">
          <Card>
            <CardHeader>
              <CardTitle>Gruppenwechsel</CardTitle>
              <CardDescription>
                Mitglieder zwischen Trainingsgruppen dieser Saison verschieben und Abrechnung
                automatisch anpassen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GroupMembersPanel seasonId={id} clubId={season.club_id ?? ''} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
