import { Suspense } from 'react';
import { requireAdminClub } from '@/lib/admin-context';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { DecisionsClient } from './decisions-client';
import type { BoardDecision, DecisionVote, MeetingInvitation } from '@/lib/types/decisions';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
const log = createLogger('admin:decisions');

export default async function AdminDecisionsPage() {
  const { clubId } = await requireAdminClub();
  const supabase = createServiceClient();

  // Parallel fetch: decisions, recent votes, pending invitations, voters
  const [decisionsRes, invitationsRes] = await Promise.all([
    supabase
      .from('board_decisions')
      .select('*')
      .eq('club_id', clubId)
      .order('meeting_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('meeting_invitations')
      .select('decision_id, status, member_id')
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .limit(200),
  ]);

  if (decisionsRes.error) {
    log.error('Failed to fetch board_decisions', { error: decisionsRes.error.message });
  }
  if (invitationsRes.error) {
    log.error('Failed to fetch meeting_invitations', { error: invitationsRes.error.message });
  }

  const decisions = (decisionsRes.data ?? []) as unknown as BoardDecision[];

  // Get recent votes for these decisions (lightweight, no join — UI aggregates locally)
  const decisionIds = decisions.map((d) => d.id);
  const votesRes =
    decisionIds.length > 0
      ? await supabase
          .from('decision_votes')
          .select('*')
          .in('decision_id', decisionIds)
          .order('voted_at', { ascending: false })
          .limit(500)
      : { data: [] as DecisionVote[], error: null };

  if (votesRes.error) {
    log.warn('decision_votes fetch failed', { error: votesRes.error.message });
  }

  const votes = (votesRes.data ?? []) as DecisionVote[];
  const invitations = (invitationsRes.data ?? []) as unknown as Pick<
    MeetingInvitation,
    'decision_id' | 'status' | 'member_id'
  >[];

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <PageHeader
        title="Beschlussdatenbank"
        description="Vorstands- und Mitgliederversammlungs-Beschlüsse verwalten (§§ 28, 32, 33 BGB)"
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DecisionsClient
          initialDecisions={decisions}
          initialVotes={votes}
          initialInvitations={invitations}
        />
      </Suspense>
    </div>
  );
}
