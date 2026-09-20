'use client';
import { PageHeader } from '@/components/ui/page-header';
import { extractErrorMessage } from '@/lib/typed-helpers';

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
import { StatCard } from '@/components/ui/stat-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TrainingGroup {
  id: string;
  name: string;
  age_group: string;
  level: string;
}

function GroupChangeDialog({
  seasonId,
  memberId,
  currentGroupId,
  currentGroupName,
  clubId,
  groups,
  onSuccess,
}: {
  seasonId: string;
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
          season_id: seasonId,
          member_id: memberId,
          old_group_id: currentGroupId,
          new_group_id: newGroupId,
          change_date: changeDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(extractErrorMessage(data) ?? 'Fehler beim Gruppenwechsel');
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
          <h2 className="text-lg font-semibold">Gruppenwechsel</h2>
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
            seasonId={seasonId}
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
  const [groupsError, setGroupsError] = useState<string | null>(null);
  // Nach einem Wechsel alle Gruppenlisten neu laden (Quell- UND Zielgruppe ändern sich)
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/api/seasons/${seasonId}/groups?clubId=${clubId}`);
        const data = await res.json();
        // Ein Fehler der Abfrage wurde hier bis zum 16.08.2026 verschluckt und
        // als "keine Gruppen vorhanden" angezeigt — die Meldung schickte die
        // Suche zur Planung statt zur eigentlichen Ursache.
        if (!res.ok) {
          setGroupsError(extractErrorMessage(data) ?? 'Gruppen konnten nicht geladen werden');
          return;
        }
        setGroups(data.groups ?? []);
      } catch {
        setGroupsError('Netzwerkfehler beim Laden der Gruppen');
      } finally {
        setLoadingGroups(false);
      }
    };
    load();
  }, [seasonId, clubId]);

  if (loadingGroups) {
    return <p className="text-sm text-muted-foreground">Lade Gruppen…</p>;
  }

  if (groupsError) {
    return <p className="text-sm text-error-600">{groupsError}</p>;
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
        throw new Error('Fehler beim Laden der Saison');
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
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? 'Erinnerung fehlgeschlagen');
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
        throw new Error(extractErrorMessage(err) || 'Fehler beim Veröffentlichen');
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
        toast.error(extractErrorMessage(err) ?? 'Auto-Plan fehlgeschlagen');
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
        toast.error(extractErrorMessage(err) ?? 'Fehler beim Löschen der Saison');
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
          <p className="text-sm text-muted-foreground">{error || 'Saison nicht gefunden'}</p>
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
    // Der Stand (x von y) steht in der Kennzahlen-Karte darunter, der Hinweis
    // sagt nur noch, was zu tun ist.
    'Nächster Schritt: Ausstehende erinnern oder die Planung starten.',
    'Nächster Schritt: Plan im Wizard prüfen und veröffentlichen.',
    'Die Saison ist veröffentlicht — Trainingsplan und Konflikte erreichst du über die Kennzahlen, Gruppenwechsel über den Tab unten.',
  ][workflowPhase];
  const canQuickStart =
    ['draft', 'collecting_preferences', 'manual_review'].includes(season.planning_status ?? '') &&
    season.submitted_preferences > 0;

  // Primäraktion aus derselben Workflow-Phase wie `nextStepHint`: solange noch
  // keine Präferenzen eingesammelt werden, ist das Öffnen der Präferenzen der
  // nächste Schritt — danach immer der Wizard, denn dort wird geprüft UND
  // veröffentlicht (Schritt „Abschließen"). Veröffentlichen bleibt bewusst im
  // Menü: aus der Übersicht heraus wäre es ein Klick an der Konfliktprüfung
  // vorbei.
  const isPublishedStatus = workflowPhase === 3;
  const wizardHref = `/admin/seasons/${id}/planning`;
  const wizardLabel = [
    'Wizard öffnen',
    'Planung starten',
    'Planung prüfen',
    'Saisonplanung ansehen',
  ][workflowPhase];
  const primaryIsPreferences = workflowPhase === 0 && canOpenPreferences;

  return (
    <div className="space-y-6">
      {/* Kein Breadcrumb: Tab-Leiste plus Zurück-Link im PageHeader reichen. */}
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

      <PageHeader
        title={`${season.season_type === 'summer' ? '☀️' : '❄️'} ${season.name}`}
        back={{ href: '/admin/seasons', label: 'Zurück zur Saisonübersicht' }}
        description={`${new Date(season.start_date).toLocaleDateString('de-DE')} - ${new Date(season.end_date).toLocaleDateString('de-DE')}`}
        badge={
          season.is_active && (
            <Badge variant="default">
              <CheckCircle className="mr-1 h-3 w-3" />
              Aktiv
            </Badge>
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Genau eine gefüllte Aktion — die, die laut Workflow-Phase als
                Nächstes dran ist (derselbe Zustand, der `nextStepHint`
                steuert). Vorher konkurrierten bis zu vier gleich aussehende
                Buttons um dieselbe Aufmerksamkeit, ohne dass einer sagte,
                welcher der richtige ist. Alles andere bleibt über „Weitere
                Aktionen" einen Klick entfernt. */}
            {primaryIsPreferences ? (
              <Button onClick={handleOpenPreferences}>
                <Users className="mr-2 h-4 w-4" />
                Präferenzen öffnen
              </Button>
            ) : (
              <Link href={wizardHref}>
                <Button>
                  <Play className="mr-2 h-4 w-4" />
                  {wizardLabel}
                </Button>
              </Link>
            )}

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Weitere Aktionen">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Weitere Aktionen</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {primaryIsPreferences && (
                  <DropdownMenuItem asChild>
                    <Link href={wizardHref}>
                      <Play className="mr-2 h-4 w-4" />
                      {wizardLabel}
                    </Link>
                  </DropdownMenuItem>
                )}
                {canOpenPreferences && !primaryIsPreferences && (
                  <DropdownMenuItem onClick={handleOpenPreferences}>
                    <Users className="mr-2 h-4 w-4" />
                    Präferenzen öffnen
                  </DropdownMenuItem>
                )}
                {canQuickStart && (
                  <DropdownMenuItem
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
                  </DropdownMenuItem>
                )}
                {canPublish && (
                  <DropdownMenuItem onClick={handlePublish}>
                    <FileText className="mr-2 h-4 w-4" />
                    {isRepublish ? 'Erneut veröffentlichen' : 'Veröffentlichen'}
                  </DropdownMenuItem>
                )}
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
        }
      />

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

      {/* Kennzahlen — zugleich der Weg dorthin. Vorher standen dieselben Zahlen
          dreimal auf der Seite (hier, im Hinweistext, in den Tab-Beschriftungen),
          und wer sie ansehen wollte, klickte erst auf einen Tab, der nur einen
          Button enthielt, der dann woanders hinführte. Jetzt ist die Zahl der
          Link. Gleiche Komponente wie in der Saisonliste. */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={Users}
          label="Präferenzen"
          value={`${season.submitted_preferences} / ${season.total_preferences}`}
          sub="Mitglieder eingereicht"
          color="blue"
          href={`/admin/seasons/${id}/preferences`}
        />
        <StatCard
          icon={Users}
          label="Trainer"
          value={season.trainers_count}
          sub="verfügbar"
          color="brand"
        />
        <StatCard
          icon={TrendingUp}
          label="Geplante Einheiten"
          value={season.planned_entries}
          sub={isPublishedStatus ? 'Wochenplan öffnen' : 'Im Wizard planen'}
          color="green"
          href={isPublishedStatus ? '/scheduler' : `/admin/seasons/${id}/planning?step=3`}
        />
        <StatCard
          icon={AlertCircle}
          label="Konflikte"
          value={season.open_conflicts}
          sub={season.open_conflicts > 0 ? 'Zu lösen' : 'Keine Konflikte'}
          color={season.open_conflicts > 0 ? 'orange' : 'green'}
          // Ohne Konflikte führt die Karte nirgendwohin — eine Liste mit null
          // Einträgen ist kein Ziel.
          href={season.open_conflicts > 0 ? `/admin/seasons/${id}/conflicts` : undefined}
        />
      </div>

      {/* Tabs — only show planning-related tabs after the plan is published */}
      <SeasonTabs season={season} seasonId={id} />
    </div>
  );
}

/* Extracted tabs component so the IIFE is not needed */

/**
 * Nur noch Tabs, die auch Inhalt haben. „Präferenzen", „Plan" und „Konflikte"
 * enthielten je genau einen Button, der die Seite wieder verliess — der Tab war
 * eine Zwischenstation ohne eigenen Inhalt. Diese drei Ziele hängen jetzt an den
 * Kennzahlen-Karten oben, die dieselben Zahlen ohnehin schon anzeigten.
 * Altlinks auf die entfernten Tabs landen auf „Übersicht".
 */
const SEASON_TAB_VALUES = ['overview', 'group-change', 'calendar'] as const;

function SeasonTabs({ season, seasonId }: { season: SeasonWithStats; seasonId: string }) {
  const searchParams = useSearchParams();
  const isPublished = ['published', 'active', 'completed', 'archived'].includes(
    season.planning_status ?? ''
  );
  const requestedTab = searchParams.get('tab');
  const initialTab =
    requestedTab &&
    (SEASON_TAB_VALUES as readonly string[]).includes(requestedTab) &&
    (isPublished || requestedTab !== 'group-change')
      ? requestedTab
      : 'overview';

  return (
    <Tabs defaultValue={initialTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Übersicht</TabsTrigger>
        {isPublished && <TabsTrigger value="group-change">Gruppenwechsel</TabsTrigger>}
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
      </TabsContent>

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
