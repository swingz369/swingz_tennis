'use client';

import { useMemo, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Calendar,
  FileText,
  Vote,
  Clock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { formatDate, formatRelativeTime } from '@/lib/format';
import type {
  BoardDecision,
  DecisionVote,
  DecisionStatus,
  DecisionType,
  VoteChoice,
} from '@/lib/types/decisions';

interface Props {
  initialDecisions: BoardDecision[];
  initialVotes: DecisionVote[];
  initialInvitations: { decision_id: string; status: string; member_id: string }[];
}

const STATUS_LABELS: Record<
  DecisionStatus,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'error' | 'warning' }
> = {
  draft: { label: 'Entwurf', variant: 'secondary' },
  scheduled: { label: 'Geplant', variant: 'secondary' },
  in_progress: { label: 'Laufend', variant: 'warning' },
  completed: { label: 'Abgeschlossen', variant: 'success' },
  cancelled: { label: 'Abgebrochen', variant: 'error' },
};

const TYPE_LABELS: Record<DecisionType, string> = {
  vorstandsbeschluss: 'Vorstandsbeschluss',
  mitgliederversammlung: 'Mitgliederversammlung',
  ausschuss: 'Ausschuss',
  sonderbeschluss: 'Sonderbeschluss',
};

export function DecisionsClient({ initialDecisions, initialVotes, initialInvitations }: Props) {
  const [decisions, setDecisions] = useState<BoardDecision[]>(initialDecisions);

  // Im Read-Only-Modus für diese Seite: votes/Invitations kommen initial vom Server.
  // Bei Cast-Vote über DecisionVoteButton würde die Tally live über decision.votes_for
  // etc. gepflegt — wir behalten hier die Snapshot-Aggregation.
  const votesByDecision = useMemo(
    () => groupBy(initialVotes, (v) => v.decision_id),
    [initialVotes]
  );
  const pendingByDecision = useMemo(
    () => groupByCount(initialInvitations, (i) => i.decision_id),
    [initialInvitations]
  );

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    title: '',
    description: '',
    decision_type: 'mitgliederversammlung' as DecisionType,
    meeting_date: '',
  });
  const [creating, startCreating] = useTransition();
  const [statusFilter, setStatusFilter] = useState<DecisionStatus | 'all'>('all');
  const [cancelTarget, setCancelTarget] = useState<BoardDecision | null>(null);
  const [cancelling, startCancelling] = useTransition();

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return decisions;
    return decisions.filter((d) => d.status === statusFilter);
  }, [decisions, statusFilter]);

  const counts = useMemo(() => {
    const c = {
      all: decisions.length,
      draft: 0,
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const d of decisions) c[d.status] += 1;
    return c;
  }, [decisions]);

  const submitNew = () => {
    if (!newForm.title.trim()) {
      toast.error('Titel ist erforderlich');
      return;
    }
    startCreating(async () => {
      const res = await apiFetch('/api/decisions', {
        method: 'POST',
        body: JSON.stringify({
          title: newForm.title.trim(),
          description: newForm.description.trim() || null,
          decision_type: newForm.decision_type,
          meeting_date: newForm.meeting_date || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Fehler beim Anlegen');
        return;
      }
      const created = (await res.json()) as BoardDecision;
      setDecisions((prev) => [created, ...prev]);
      setNewForm({
        title: '',
        description: '',
        decision_type: 'mitgliederversammlung',
        meeting_date: '',
      });
      setShowNew(false);
      toast.success('Beschluss angelegt');
    });
  };

  const updateStatus = (id: string, next: DecisionStatus, outcome?: 'approved' | 'rejected') => {
    void (async () => {
      try {
        const res = await apiFetch(`/api/decisions/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: next, outcome }),
        });
        if (!res.ok) {
          toast.error('Statuswechsel fehlgeschlagen');
          return;
        }
        const updated = (await res.json()) as BoardDecision;
        setDecisions((prev) => prev.map((d) => (d.id === id ? updated : d)));
        toast.success(`Status: ${STATUS_LABELS[next].label}`);
      } catch {
        toast.error('Statuswechsel fehlgeschlagen');
      }
    })();
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    startCancelling(async () => {
      try {
        const res = await apiFetch(`/api/decisions/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'cancelled' }),
        });
        if (!res.ok) {
          toast.error('Abbruch fehlgeschlagen');
          return;
        }
        const updated = (await res.json()) as BoardDecision;
        setDecisions((prev) => prev.map((d) => (d.id === id ? updated : d)));
        toast.success('Beschluss abgebrochen');
        setCancelTarget(null);
      } catch {
        toast.error('Abbruch fehlgeschlagen');
      }
    });
  };

  return (
    <div className="space-y-5">
      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as DecisionStatus | 'all')}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <TabsList>
            <TabsTrigger value="all">Alle ({counts.all})</TabsTrigger>
            <TabsTrigger value="draft">Entwürfe ({counts.draft})</TabsTrigger>
            <TabsTrigger value="scheduled">Geplant ({counts.scheduled})</TabsTrigger>
            <TabsTrigger value="in_progress">Laufend ({counts.in_progress})</TabsTrigger>
            <TabsTrigger value="completed">Abgeschlossen ({counts.completed})</TabsTrigger>
            <TabsTrigger value="cancelled">Abgebrochen ({counts.cancelled})</TabsTrigger>
          </TabsList>
          {!showNew && (
            <Button onClick={() => setShowNew(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Neuer Beschluss
            </Button>
          )}
        </div>

        {(['all', 'draft', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const).map(
          (tab) => (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
              {filtered.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Keine Beschlüsse"
                  description={
                    tab === 'all'
                      ? 'Lege den ersten Beschluss für deinen Verein an.'
                      : `Keine Beschlüsse mit Status "${STATUS_LABELS[tab as DecisionStatus].label}".`
                  }
                  action={
                    tab === 'all'
                      ? { label: 'Beschluss anlegen', onClick: () => setShowNew(true) }
                      : undefined
                  }
                />
              ) : (
                filtered.map((d) => (
                  <DecisionRow
                    key={d.id}
                    decision={d}
                    votes={votesByDecision[d.id] ?? []}
                    pendingInvitations={pendingByDecision[d.id] ?? 0}
                    onUpdateStatus={updateStatus}
                    onCancel={(decision) => setCancelTarget(decision)}
                  />
                ))
              )}
            </TabsContent>
          )
        )}
      </Tabs>

      {showNew && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Neuer Beschluss</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="d-title" className="text-xs font-medium">
                Titel *
              </label>
              <Input
                id="d-title"
                value={newForm.title}
                onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                placeholder="z.B. Anschaffung Vereinsbus 2026"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="d-desc" className="text-xs font-medium">
                Beschreibung / Antragstext
              </label>
              <Textarea
                id="d-desc"
                value={newForm.description}
                onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                placeholder="Antragstext, Begründung, Beschlussvorschlag…"
                rows={4}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="d-type" className="text-xs font-medium">
                  Beschlussart
                </label>
                <select
                  id="d-type"
                  value={newForm.decision_type}
                  onChange={(e) =>
                    setNewForm({ ...newForm, decision_type: e.target.value as DecisionType })
                  }
                  className="w-full mt-1 p-2 rounded border bg-background text-sm"
                >
                  {(Object.keys(TYPE_LABELS) as DecisionType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="d-date" className="text-xs font-medium">
                  Sitzungsdatum
                </label>
                <Input
                  id="d-date"
                  type="date"
                  value={newForm.meeting_date}
                  onChange={(e) => setNewForm({ ...newForm, meeting_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNew(false)}
                disabled={creating}
              >
                Abbrechen
              </Button>
              <Button size="sm" onClick={submitNew} disabled={creating} className="gap-1.5">
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Beschluss anlegen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !cancelling) setCancelTarget(null);
        }}
        title="Beschluss abbrechen?"
        description={
          cancelTarget
            ? `„${cancelTarget.title}“ wird auf Status „Abgebrochen“ gesetzt. Diese Aktion kann später wieder geändert werden.`
            : ''
        }
        confirmLabel="Abbrechen"
        cancelLabel="Zurück"
        variant="warning"
        loading={cancelling}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

function DecisionRow({
  decision,
  votes,
  pendingInvitations,
  onUpdateStatus,
  onCancel,
}: {
  decision: BoardDecision;
  votes: DecisionVote[];
  pendingInvitations: number;
  onUpdateStatus: (id: string, next: DecisionStatus, outcome?: 'approved' | 'rejected') => void;
  onCancel: (decision: BoardDecision) => void;
}) {
  const st = STATUS_LABELS[decision.status];
  const tally = countByChoice(votes);

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">{decision.title}</h3>
              <Badge variant={st.variant}>{st.label}</Badge>
              <Badge variant="outline" className="text-2xs">
                {TYPE_LABELS[decision.decision_type]}
              </Badge>
            </div>
            {decision.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {decision.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
              {decision.meeting_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Sitzung: {formatDate(decision.meeting_date)}
                </span>
              )}
              {decision.created_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Erstellt {formatRelativeTime(decision.created_at)}
                </span>
              )}
              {pendingInvitations > 0 && (
                <span className="flex items-center gap-1">
                  <Vote className="h-3 w-3" />
                  {pendingInvitations} offene Einladung{pendingInvitations !== 1 ? 'en' : ''}
                </span>
              )}
            </div>

            {/* Vote tally */}
            {(decision.votes_for > 0 ||
              decision.votes_against > 0 ||
              decision.votes_abstain > 0 ||
              votes.length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1 font-medium text-success-700 dark:text-success-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Dafür: {decision.votes_for || tally.for}
                </span>
                <span className="flex items-center gap-1 font-medium text-error-700 dark:text-error-400">
                  <XCircle className="h-3.5 w-3.5" /> Dagegen:{' '}
                  {decision.votes_against || tally.against}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  Enthaltung: {decision.votes_abstain || tally.abstain}
                </span>
                {decision.quorum_met !== null && (
                  <Badge
                    variant={decision.quorum_met ? 'success' : 'secondary'}
                    className="text-2xs"
                  >
                    {decision.quorum_met ? 'Quorum erreicht' : 'Quorum offen'}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {decision.status === 'draft' && (
                <DropdownMenuItem onClick={() => onUpdateStatus(decision.id, 'scheduled')}>
                  Zur Sitzung einplanen
                </DropdownMenuItem>
              )}
              {decision.status === 'scheduled' && (
                <DropdownMenuItem onClick={() => onUpdateStatus(decision.id, 'in_progress')}>
                  Abstimmung starten
                </DropdownMenuItem>
              )}
              {decision.status === 'in_progress' && (
                <>
                  <DropdownMenuItem
                    onClick={() => onUpdateStatus(decision.id, 'completed', 'approved')}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2 text-success-600 dark:text-success-400" />
                    Annehmen (completed)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onUpdateStatus(decision.id, 'completed', 'rejected')}
                  >
                    <XCircle className="h-4 w-4 mr-2 text-error-600 dark:text-error-400" />
                    Ablehnen (completed)
                  </DropdownMenuItem>
                </>
              )}
              {decision.status !== 'cancelled' && decision.status !== 'completed' && (
                <DropdownMenuItem onClick={() => onCancel(decision)}>Abbrechen</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

function groupByCount<T, K extends string>(items: T[], key: (item: T) => K): Record<K, number> {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<K, number>
  );
}

function countByChoice(votes: DecisionVote[]): Record<VoteChoice, number> {
  return votes.reduce(
    (acc, v) => {
      acc[v.choice] = (acc[v.choice] ?? 0) + 1;
      return acc;
    },
    { for: 0, against: 0, abstain: 0 } as Record<VoteChoice, number>
  );
}
