/**
 * Member Service Adapter
 *
 * Member operations backed by real Supabase DB (user_club_memberships + users tables).
 * Validation logic and CRUD interface are production-ready.
 *
 * Usage:
 * ```typescript
 * import { memberService } from '@/application/services/member-service.adapter';
 *
 * const members = await memberService.getAllMembers();
 * ```
 */

import type {
  Member,
  CreateMemberInput,
  UpdateMemberInput,
  MemberQuery,
} from '@/domain/entities/member.entity';
import { MemberService } from './member.service';

class MemberServiceAdapter {
  /**
   * Validate member input
   * Delegates to MemberService for validation logic
   */
  validateMemberInput(input: CreateMemberInput): { valid: boolean; errors: string[] } {
    return MemberService.validateMemberInput(input);
  }

  /**
   * Create a new member — persisted to Supabase DB
   * @param clubId — optional club assignment (should come from auth context)
   */
  async createMember(input: CreateMemberInput, clubId?: string): Promise<Member> {
    return MemberService.createMember(input, clubId);
  }

  /**
   * Get member by ID
   */
  async getMemberById(id: string): Promise<Member | null> {
    return MemberService.getMemberById(id);
  }

  /**
   * Get member by user ID
   */
  async getMemberByUserId(userId: string): Promise<Member | null> {
    return MemberService.getMemberByUserId(userId);
  }

  /**
   * Get member by email
   */
  async getMemberByEmail(email: string): Promise<Member | null> {
    return MemberService.getMemberByEmail(email);
  }

  /**
   * Get all members
   */
  async getAllMembers(): Promise<Member[]> {
    return MemberService.getAllMembers();
  }

  /**
   * Query members with filters
   * @param query — may include clubId for club-scoped queries
   */
  async queryMembers(query: MemberQuery & { clubId?: string }): Promise<Member[]> {
    return MemberService.queryMembers(query);
  }

  /**
   * Get active members
   */
  async getActiveMembers(): Promise<Member[]> {
    return MemberService.getActiveMembers();
  }

  /**
   * Count active members in a club.
   * Sprint 3 / Ticket 3.6.1 — Pay-per-Active-Member-Pricing.
   * Used by `lib/services/stripe-subscription-quantity-sync.service.ts`
   * to drive the Stripe subscription-item quantity. Returns 0 on error.
   */
  async getActiveMemberCount(clubId?: string): Promise<number> {
    return MemberService.getActiveMemberCount(clubId);
  }

  /**
   * Get members by training group
   */
  async getMembersByTrainingGroup(trainingGroup: string): Promise<Member[]> {
    return MemberService.getMembersByTrainingGroup(trainingGroup);
  }

  /**
   * Update member
   */
  async updateMember(id: string, input: UpdateMemberInput): Promise<Member | null> {
    return MemberService.updateMember(id, input);
  }

  /**
   * Update member status
   */
  async updateMemberStatus(id: string, status: Member['membershipStatus']): Promise<Member | null> {
    return MemberService.updateMemberStatus(id, status);
  }

  /**
   * Delete member
   */
  async deleteMember(id: string): Promise<boolean> {
    return MemberService.deleteMember(id);
  }

  /**
   * Get member statistics
   */
  async getMemberStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    terminated: number;
    byType: { member: number; trial: number; inactive: number };
    byTrainingGroup: Record<string, number>;
  }> {
    return MemberService.getMemberStatistics();
  }

  /**
   * Search members
   */
  async searchMembers(query: string): Promise<Member[]> {
    return MemberService.searchMembers(query);
  }
}

// Export singleton instance
export const memberService = new MemberServiceAdapter();
