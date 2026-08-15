'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  FileText,
  Clock,
  CheckCircle,
  Trash2,
  Zap,
  Bell,
  LayoutGrid,
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CenteredModal } from '@/components/ui/centered-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import type { SeasonWithStats } from '@/lib/types/season-planning';
import {
  seasonStatusLabel,
  seasonTypeLabel,
  seasonWorkflowPhase,
  SEASON_WORKFLOW_PHASES,
} from '@/lib/season-planning/status-labels';
import { SeasonPlanningTabs } from '@/components/admin/season-planning-tabs';
import { apiFetch } from '@/lib/api-fetch';
import { SeasonCalendarTab } from '@/components/admin/season-calendar-tab';

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
      const res = await apiFetch('/api/billing/generate-season-invoices', {
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
            <p className="text-sm font-medium text-success-600">
              {result.created} Rechnung{result.created !== 1 ? 'en' : ''} erstellt
            </p>
            {result.errors && result.errors.length > 0 && (
              <ul className="text-sm text-error-600 space-y-0.5">
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
      const res = await apiFetch('/api/billing/group-change', {
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

      <CenteredModal open={open} onClose={() => setOpen(false)}>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold">Gruppenwechsel</h2>
          <p className="text-sm text-muted-foreground">
            Mitglied in eine andere Gruppe wechseln lassen
          </p>
        </div>
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
          {err && <p className="text-sm text-error-600">{err}</p>}
          {result && (
            <p className="text-sm font-medium text-success-600">
              Wechsel durchgeführt. Netto: {result.net_delta >= 0 ? '+' : ''}
              {result.net_delta.toFixed(2)} €
            </p>
          )}
        </div>
        <div className="flex gap-2 pt-2">
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
        </div>
      </CenteredModal>
    </>
  );
}

function GroupMemberList({
  seasonId,
  clubId,
  group,
  groups,
  refreshKey,
  onChanged,
}: {
  seasonId: string;
  clubId: string;
  group: TrainingGroup;
  groups: TrainingGroup[];
  refreshKey: number;
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(
          `/api/seasons/${seasonId}/groups/${group.id}/members?clubId=${clubId}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setMembers(data.members ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [seasonId, clubId, group.id, refreshKey]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Lade Mitglieder…</p>;
  }

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Keine aktiven Mitglieder in dieser Gruppe.</p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {members.map((m) => (
        <li key={m.id} className="flex items-center justify-between py-2">
          <span className="text-sm">{m.name}</span>
          <GroupChangeDialog
            memberId={m.id}
            currentGroupId={group.id}
            currentGroupName={group.name}
            clubId={clubId}
            groups={groups}
            onSuccess={onChanged}
          />
        </li>
      ))}
    </ul>
  );
}

function GroupMembersPanel({ seasonId, clubId }: { seasonId: string; clubId: string }) {
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  // Nach einem Wechsel alle Gruppenlisten neu laden (Quell- UND Zielgruppe ändern sich)
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/api/seasons/${seasonId}/groups?clubId=${clubId}`);
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
            <GroupMemberList
              seasonId={seasonId}
              clubId={clubId}
              group={group}
              groups={groups}
              refreshKey={refreshKey}
              onChanged={() => setRefreshKey((k) => k + 1)}
            />
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
  const [publishing, setPublishing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [quickStarting, setQuickStarting] = useState(false);
  const [reminding, setReminding] = useState(false);

  const fetchSeason = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/api/seasons/${id}`);

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
      const response = await apiFetch(`/api/seasons/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          planning_status: 'collecting_preferences',
          preferences_open: true,
        }),
      });

      if (!response.ok) throw new Error('Fehler beim Öffnen der Präferenzen');

      // Mitglieder direkt per E-Mail informieren — sonst erfährt niemand davon
      let sent = 0;
      try {
        const remindRes = await apiFetch(`/api/seasons/${id}/planning/remind`, { method: 'POST' });
        if (remindRes.ok) sent = (await remindRes.json()).sent ?? 0;
      } catch {
        // E-Mail-Versand optional — das Öffnen war erfolgreich
      }
      toast.success(
        sent > 0
          ? `Präferenzen geöffnet — ${sent} Mitglieder per E-Mail benachrichtigt`
          : 'Präferenzen geöffnet'
      );

      await fetchSeason();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleRemind = async () => {
    setReminding(true);
    try {
      const res = await apiFetch(`/api/seasons/${id}/planning/remind`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Erinnerung fehlgeschlagen');
      toast.success(data.message ?? `${data.sent ?? 0} Erinnerungen versendet`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setReminding(false);
    }
  };

  const handlePublish = () => {
    setPublishConfirmOpen(true);
  };

  const confirmPublish = async () => {
    // Don't close the dialog here — ConfirmDialog awaits this handler and
    // closes itself once it resolves. Closing early hid the LoadingButton
    // spinner, so for seasons with many members (sequential per-recipient
    // email sending server-side) the popup just vanished with zero feedback
    // while the request kept running for tens of seconds in the background.
    setPublishing(true);
    try {
      const response = await apiFetch(`/api/seasons/${id}/planning/confirm`, {
        method: 'POST',
        body: JSON.stringify({ acceptedWarnings: [] }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Fehler beim Veröffentlichen');
      }

      const data = await response.json();
      toast.success(
        data.republish
          ? `Saison aktualisiert: ${data.removedSessions} künftige Trainingseinheiten ersetzt durch ${data.publishedSessions}`
          : `Saison veröffentlicht: ${data.publishedSessions} Trainingseinheiten erstellt`
      );
      await fetchSeason();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setPublishing(false);
    }
  };

  const handleQuickStart = async () => {
    setQuickStarting(true);
    try {
      // Auto-Plan with intelligent defaults, then redirect to wizard
      const response = await apiFetch(`/api/seasons/${id}/auto-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });

      if (!response.ok) {
        const err = await response.json();
        toast.error(err.error ?? 'Auto-Plan fehlgeschlagen');
        setQuickStarting(false);
        return;
      }

      toast.success('Planung erstellt — Weiterleitung...');
      setQuickStarting(false);
      router.push(`/admin/seasons/${id}/planning?step=3`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Auto-Plan');
      setQuickStarting(false);
    }
  };

  const handleDelete = async () => {
    setDeleteConfirmOpen(false);
    setDeleting(true);
    try {
      const response = await apiFetch(`/api/seasons/${id}`, {
        method: 'DELETE',
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
  // Ein veröffentlichter Plan bleibt änderbar: erneutes Veröffentlichen ersetzt
  // alle künftigen Trainingseinheiten durch den aktuellen Planstand.
  const isRepublish = season.planning_status === 'published';
  const canPublish = season.planning_status === 'manual_review' || isRepublish;
  const workflowPhase = seasonWorkflowPhase(season.planning_status);
  const nextStepHint = [
    'Nächster Schritt: Präferenzen öffnen — Mitglieder werden per E-Mail gebeten, ihre Wunschzeiten abzugeben.',
    `${season.submitted_preferences} von ${season.total_preferences} Mitgliedern haben Präferenzen abgegeben. Nächster Schritt: Ausstehende erinnern oder die Planung starten.`,
    'Nächster Schritt: Plan im Wizard prüfen und veröffentlichen.',
    'Die Saison ist veröffentlicht — Trainingsplan, Konflikte und Gruppenwechsel findest du in den Tabs unten.',
  ][workflowPhase];
  const canQuickStart =
    ['draft', 'collecting_preferences', 'manual_review'].includes(season.planning_status ?? '') &&
    season.submitted_preferences > 0;

  return (
    <div className="space-y-6">
      <SeasonPlanningTabs seasonId={id} />
      <ConfirmDialog
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        title={isRepublish ? 'Saison erneut veröffentlichen' : 'Saison veröffentlichen'}
        description={
          season.open_conflicts > 0
            ? `Es gibt noch ${season.open_conflicts} offene Konflikte. Empfehlung: zuerst im Wizard unter „Abschließen" prüfen. Trotzdem veröffentlichen?`
            : isRepublish
              ? 'Alle künftigen Trainingseinheiten dieser Saison werden gelöscht und aus dem aktuellen Planstand neu erstellt — inklusive der Teilnehmer-Buchungen. Bereits stattgefundene Termine bleiben unverändert.'
              : 'Möchten Sie diese Saison wirklich veröffentlichen? Für alle geplanten Gruppen werden Trainingseinheiten erstellt.'
        }
        confirmLabel={isRepublish ? 'Erneut veröffentlichen' : 'Veröffentlichen'}
        variant="primary"
        loading={publishing}
        onConfirm={confirmPublish}
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Das Veröffentlichen kann bei großen Vereinen mehrere Minuten dauern (Trainingseinheiten,
            E-Mails und Rechnungen werden erstellt). Bitte diese Seite währenddessen nicht
            schließen.
          </p>
          {publishing && (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-full animate-pulse rounded-full bg-primary" />
              </div>
              <p className="text-xs">Wird veröffentlicht, bitte warten…</p>
            </div>
          )}
        </div>
      </ConfirmDialog>

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
              <h1 className="text-2xl font-bold tracking-tight">{season.name}</h1>
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
          {canQuickStart && (
            <Button
              variant="default"
              onClick={handleQuickStart}
              disabled={quickStarting}
              title="Erstellt sofort einen automatischen Plan mit den Standard-Einstellungen und öffnet ihn zur Prüfung im Wizard — ohne die Konfiguration vorher zu zeigen."
            >
              {quickStarting ? (
                <Clock className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Schnellstart
            </Button>
          )}
          <Link href={`/admin/seasons/${id}/planning`}>
            <Button variant={canQuickStart ? 'outline' : 'default'}>
              <Play className="mr-2 h-4 w-4" />
              {['published', 'active', 'completed', 'archived'].includes(
                season.planning_status ?? ''
              )
                ? 'Saisonplanung ansehen'
                : season.planning_status === 'draft'
                  ? 'Wizard öffnen'
                  : 'Planung fortsetzen'}
            </Button>
          </Link>
          {canOpenPreferences && (
            <Button onClick={handleOpenPreferences}>
              <Users className="mr-2 h-4 w-4" />
              Präferenzen öffnen
            </Button>
          )}

          {canPublish && (
            <Button onClick={handlePublish} variant={isRepublish ? 'outline' : 'default'}>
              <FileText className="mr-2 h-4 w-4" />
              {isRepublish ? 'Erneut veröffentlichen' : 'Veröffentlichen'}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Weitere Aktionen">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Workflow-Fortschritt */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {SEASON_WORKFLOW_PHASES.map((phase, i) => (
              <div key={phase} className="flex items-center gap-2">
                {i > 0 && <div className="h-px w-5 bg-border" aria-hidden />}
                <span
                  className={`flex items-center gap-1.5 text-sm ${
                    i === workflowPhase
                      ? 'font-semibold'
                      : i < workflowPhase
                        ? 'text-success-600'
                        : 'text-muted-foreground'
                  }`}
                >
                  {i < workflowPhase ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                        i === workflowPhase ? 'border-primary text-primary' : ''
                      }`}
                    >
                      {i + 1}
                    </span>
                  )}
                  {phase}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">{nextStepHint}</p>
            {workflowPhase === 1 && (
              <Button variant="outline" size="sm" onClick={handleRemind} disabled={reminding}>
                <Bell className="mr-2 h-4 w-4" />
                {reminding ? 'Sende…' : 'Ausstehende erinnern'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
              von {season.total_preferences} Mitgliedern eingereicht
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

      {/* Tabs — only show planning-related tabs after the plan is published */}
      <SeasonTabs season={season} seasonId={id} />
    </div>
  );
}

/* Extracted tabs component so the IIFE is not needed */

const SEASON_TAB_VALUES = [
  'overview',
  'preferences',
  'plan',
  'conflicts',
  'group-change',
  'calendar',
] as const;

function SeasonTabs({ season, seasonId }: { season: SeasonWithStats; seasonId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPublished = ['published', 'active', 'completed', 'archived'].includes(
    season.planning_status ?? ''
  );
  const requestedTab = searchParams.get('tab');
  const publishedOnlyTabs = ['preferences', 'plan', 'conflicts', 'group-change'];
  const initialTab =
    requestedTab &&
    (SEASON_TAB_VALUES as readonly string[]).includes(requestedTab) &&
    (isPublished || !publishedOnlyTabs.includes(requestedTab))
      ? requestedTab
      : 'overview';

  return (
    <Tabs defaultValue={initialTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Übersicht</TabsTrigger>
        {isPublished && (
          <>
            <TabsTrigger value="preferences">
              Präferenzen ({season.submitted_preferences})
            </TabsTrigger>
            <TabsTrigger value="plan">Plan ({season.planned_entries})</TabsTrigger>
            <TabsTrigger value="conflicts">Konflikte ({season.open_conflicts})</TabsTrigger>
            <TabsTrigger value="group-change">Gruppenwechsel</TabsTrigger>
          </>
        )}
        <TabsTrigger value="calendar">Saisonkalender</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Saison-Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p className="text-lg">{seasonStatusLabel(season.planning_status)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Saison-Typ</p>
                <p className="text-lg">{seasonTypeLabel(season.season_type)}</p>
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

        <SeasonInvoiceGenerator seasonId={seasonId} clubId={season.club_id ?? ''} />
      </TabsContent>

      {isPublished && (
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>User Präferenzen</CardTitle>
              <CardDescription>
                Übersicht aller eingereichten Verfügbarkeiten und Präferenzen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push(`/admin/seasons/${seasonId}/preferences`)}>
                Alle Präferenzen anzeigen
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      <TabsContent value="plan">
        {isPublished ? (
          <Card>
            <CardHeader>
              <CardTitle>Trainingsplan</CardTitle>
              <CardDescription>Geplante Training-Sessions für diese Season</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => router.push('/scheduler')}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                Wochenplan öffnen
              </Button>
              <p className="text-xs text-muted-foreground">
                Gemeinsame Wochenplan-Ansicht — dort auch direkt bearbeitbar
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Play className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">Noch keine Planung veröffentlicht</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Starte den Wizard, um eine Planung zu erstellen und zu veröffentlichen.
              </p>
              <Button onClick={() => router.push(`/admin/seasons/${seasonId}/planning?step=3`)}>
                <Play className="mr-2 h-4 w-4" />
                Zum Planungs-Wizard
              </Button>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {isPublished && (
        <TabsContent value="conflicts">
          <Card>
            <CardHeader>
              <CardTitle>Planungskonflikte</CardTitle>
              <CardDescription>Erkannte Konflikte in der Planung</CardDescription>
            </CardHeader>
            <CardContent>
              {season.open_conflicts === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-success-500" />
                  <p className="mt-4 text-lg font-medium">Keine Konflikte</p>
                  <p className="text-sm text-muted-foreground">Die Planung ist konfliktfrei</p>
                </div>
              ) : (
                <Button onClick={() => router.push(`/admin/seasons/${seasonId}/conflicts`)}>
                  Konflikte anzeigen ({season.open_conflicts})
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {isPublished && (
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
              <GroupMembersPanel seasonId={seasonId} clubId={season.club_id ?? ''} />
            </CardContent>
          </Card>
        </TabsContent>
      )}

      <TabsContent value="calendar">
        <SeasonCalendarTab seasonId={seasonId} clubId={season.club_id ?? ''} />
      </TabsContent>
    </Tabs>
  );
}
