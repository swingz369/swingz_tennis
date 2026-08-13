import { Suspense } from 'react';
import { requireAdminClub } from '@/lib/admin-context';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentsClient } from './documents-client';
import { DocumentsTabsWrapper } from './documents-tabs-wrapper';
import type { BoardDecision, DecisionVote, MeetingInvitation } from '@/lib/types/decisions';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
const log = createLogger('admin:documents');

export default async function AdminDocumentsPage() {
  // RLS-enforcing client (not the service client) — board_decisions RLS
  // policies require a real membership row for the querying user, so this
  // is defense-in-depth against a wrong/spoofed clubId, not just app logic.
  const { clubId, supabase } = await requireAdminClub();

  const decisionsRes = await supabase
    .from('board_decisions')
    .select('*')
    .eq('club_id', clubId)
    .order('meeting_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (decisionsRes.error) {
    log.error('Failed to fetch board_decisions', { error: decisionsRes.error.message });
  }

  const decisions = (decisionsRes.data ?? []) as unknown as BoardDecision[];

  // meeting_invitations has no club_id column — club-scoping only exists
  // indirectly via decision_id, same as the decision_votes query below.
  const decisionIds = decisions.map((d) => d.id);
  const [votesRes, invitationsRes] =
    decisionIds.length > 0
      ? await Promise.all([
          supabase
            .from('decision_votes')
            .select('*')
            .in('decision_id', decisionIds)
            .order('voted_at', { ascending: false })
            .limit(500),
          supabase
            .from('meeting_invitations')
            .select('decision_id, status, member_id')
            .in('decision_id', decisionIds)
            .eq('status', 'pending')
            .limit(200),
        ])
      : [
          { data: [] as DecisionVote[], error: null },
          {
            data: [] as Pick<MeetingInvitation, 'decision_id' | 'status' | 'member_id'>[],
            error: null,
          },
        ];

  if (votesRes.error) {
    log.warn('decision_votes fetch failed', { error: votesRes.error.message });
  }
  if (invitationsRes.error) {
    log.error('Failed to fetch meeting_invitations', { error: invitationsRes.error.message });
  }

  const votes = (votesRes.data ?? []) as DecisionVote[];
  const invitations = (invitationsRes.data ?? []) as unknown as Pick<
    MeetingInvitation,
    'decision_id' | 'status' | 'member_id'
  >[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dokumente & Vereinsführung"
        description="Vereinsdokumente, Versammlungen und Board-Beschlüsse an einem Ort."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DocumentsTabsWrapper
          initialDecisions={decisions}
          initialVotes={votes}
          initialInvitations={invitations}
        >
          <DocumentsClient />
        </DocumentsTabsWrapper>
      </Suspense>
    </div>
  );
}
