import { z } from 'zod';

// =============================================================================
// Vereinsrecht-Beschlussdatenbank (BGB §§ 28, 32, 33)
// =============================================================================

/**
 * Art des Beschlusses:
 *   - 'vorstandsbeschluss'      → Vorstandsentscheidung (§28 BGB)
 *   - 'mitgliederversammlung'   → MV-Beschluss (§32 BGB)
 *   - 'ausschuss'               → Sonst. Ausschuss
 *   - 'sonderbeschluss'         → Ad-hoc
 */
export const DecisionType = z.enum([
  'vorstandsbeschluss',
  'mitgliederversammlung',
  'ausschuss',
  'sonderbeschluss',
]);
export type DecisionType = z.infer<typeof DecisionType>;

/**
 * Status im Workflow (siehe DB-Enum `decision_status`).
 */
export const DecisionStatus = z.enum([
  'draft',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);
export type DecisionStatus = z.infer<typeof DecisionStatus>;

/**
 * Ergebnis nach Abschluss.
 */
export const DecisionOutcome = z.enum(['approved', 'rejected', 'deferred', 'withdrawn']);
export type DecisionOutcome = z.infer<typeof DecisionOutcome>;

/**
 * Einladungs-Status.
 */
export const InvitationStatus = z.enum(['pending', 'accepted', 'declined', 'tentative']);
export type InvitationStatus = z.infer<typeof InvitationStatus>;

/**
 * Stimme eines Wahlberechtigten.
 */
export const VoteChoice = z.enum(['for', 'against', 'abstain']);
export type VoteChoice = z.infer<typeof VoteChoice>;

/**
 * Audit-Aktion (muss 1:1 mit SQL-Enum `decision_change_action` übereinstimmen).
 * Single Source of Truth — beim Hinzufügen eines neuen Werts MUSS die
 * Migration `20260624_audit_decision_changes.sql` ebenfalls ergänzt werden.
 */
export const DecisionChangeAction = z.enum([
  'created',
  'updated',
  'status_changed',
  'finalized',
  'cancelled',
  'invitation_sent',
  'invitation_response',
  'vote_cast',
]);
export type DecisionChangeAction = z.infer<typeof DecisionChangeAction>;

// === DB-aligned schemas ===

export const BoardDecisionSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  meeting_date: z.string().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  decision_type: DecisionType,
  status: DecisionStatus,
  outcome: DecisionOutcome.nullable(),
  quorum_met: z.boolean().nullable(),
  votes_for: z.number().int().nonnegative(),
  votes_against: z.number().int().nonnegative(),
  votes_abstain: z.number().int().nonnegative(),
  attachments: z.array(z.unknown()).nullable(),
  next_review: z.string().nullable(),
  created_by: z.string().uuid(),
  approved_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type BoardDecision = z.infer<typeof BoardDecisionSchema>;

export const MeetingInvitationSchema = z.object({
  id: z.string().uuid(),
  decision_id: z.string().uuid(),
  member_id: z.string().uuid(),
  status: InvitationStatus,
  responded_at: z.string().nullable(),
  response_note: z.string().nullable(),
  sent_at: z.string(),
  reminded_at: z.string().nullable(),
});
export type MeetingInvitation = z.infer<typeof MeetingInvitationSchema>;

export const DecisionVoteSchema = z.object({
  id: z.string().uuid(),
  decision_id: z.string().uuid(),
  voter_id: z.string().uuid(),
  choice: VoteChoice,
  voted_at: z.string(),
});
export type DecisionVote = z.infer<typeof DecisionVoteSchema>;

// === Input schemas ===

export const CreateDecisionSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  decision_type: DecisionType.default('mitgliederversammlung'),
  meeting_date: z.string().nullable().optional(),
  invited_member_ids: z.array(z.string().uuid()).optional(),
});
export type CreateDecisionInput = z.infer<typeof CreateDecisionSchema>;

export const UpdateDecisionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  meeting_date: z.string().nullable().optional(),
  status: DecisionStatus.optional(),
  outcome: DecisionOutcome.optional(),
  quorum_met: z.boolean().optional(),
  next_review: z.string().nullable().optional(),
  attachments: z.array(z.unknown()).optional(),
});
export type UpdateDecisionInput = z.infer<typeof UpdateDecisionSchema>;

export const CastVoteSchema = z.object({
  choice: VoteChoice,
});
export type CastVoteInput = z.infer<typeof CastVoteSchema>;

export const InvitationResponseSchema = z.object({
  status: InvitationStatus,
  response_note: z.string().nullable().optional(),
});
export type InvitationResponseInput = z.infer<typeof InvitationResponseSchema>;
