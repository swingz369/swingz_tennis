'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Gavel } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { DecisionVoteButton } from '@/components/decision-vote-button';
import type {
  BoardDecision,
  DecisionStatus,
  DecisionType,
  DecisionVote,
} from '@/lib/types/decisions';

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

export default function MemberDecisionsPage() {
  const [decisions, setDecisions] = useState<BoardDecision[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, DecisionVote | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/decisions');
        if (!res.ok) return;
        const data = await res.json();
        const list: BoardDecision[] = data.decisions ?? [];
        if (cancelled) return;
        setDecisions(list);

        const votes = await Promise.all(
          list.map(async (d) => {
            const r = await apiFetch(`/api/decisions/${d.id}/votes`);
            if (!r.ok) return [d.id, null] as const;
            const v = await r.json();
            return [d.id, v.vote as DecisionVote | null] as const;
          })
        );
        if (!cancelled) setMyVotes(Object.fromEntries(votes));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Board-Beschlüsse</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Beschlüsse deines Vereins einsehen und abstimmen
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : decisions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Gavel className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Keine Beschlüsse vorhanden</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {decisions.map((d) => {
            const votable = d.status === 'in_progress' || d.status === 'scheduled';
            return (
              <Card key={d.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base font-semibold">{d.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {TYPE_LABELS[d.decision_type]}
                        {d.meeting_date &&
                          ` · ${new Date(d.meeting_date).toLocaleDateString('de-DE')}`}
                      </p>
                    </div>
                    <Badge variant={STATUS_LABELS[d.status].variant}>
                      {STATUS_LABELS[d.status].label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {d.description && (
                    <p className="text-sm text-muted-foreground">{d.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Für: {d.votes_for}</span>
                    <span>Dagegen: {d.votes_against}</span>
                    <span>Enthaltung: {d.votes_abstain}</span>
                  </div>
                  {votable ? (
                    <DecisionVoteButton decisionId={d.id} currentVote={myVotes[d.id] ?? null} />
                  ) : (
                    d.outcome && (
                      <Badge variant={d.outcome === 'approved' ? 'success' : 'secondary'}>
                        {d.outcome === 'approved'
                          ? 'Angenommen'
                          : d.outcome === 'rejected'
                            ? 'Abgelehnt'
                            : d.outcome === 'withdrawn'
                              ? 'Zurückgezogen'
                              : 'Vertagt'}
                      </Badge>
                    )
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
