/**
 * Member Service Adapter
 *
 * Member operations via in-memory service.
 * TODO: Switch to Drizzle repository when member-specific DB schema is ready.
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
   * Delegates to in-memory service for validation logic
   */
  validateMemberInput(input: CreateMemberInput): { valid: boolean; errors: string[] } {
    return MemberService.validateMemberInput(input);
  }

  /**
   * Create a new member
   */
  async createMember(input: CreateMemberInput): Promise<Member> {
    // Always validate
    const validation = this.validateMemberInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.createMember(input);
  }

  /**
   * Get member by ID
   */
  async getMemberById(id: string): Promise<Member | null> {
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.getMemberById(id);
  }

  /**
   * Get member by user ID
   */
  async getMemberByUserId(userId: string): Promise<Member | null> {
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.getMemberByUserId(userId);
  }

  /**
   * Get member by email
   */
  async getMemberByEmail(email: string): Promise<Member | null> {
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.getMemberByEmail(email);
  }

  /**
   * Get all members
   */
  async getAllMembers(): Promise<Member[]> {
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.getAllMembers();
  }

  /**
   * Query members with filters
   */
  async queryMembers(query: MemberQuery): Promise<Member[]> {
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.queryMembers(query);
  }

  /**
   * Get active members
   */
  async getActiveMembers(): Promise<Member[]> {
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.getActiveMembers();
  }

  /**
   * Get members by training group
   */
  async getMembersByTrainingGroup(trainingGroup: string): Promise<Member[]> {
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.getMembersByTrainingGroup(trainingGroup);
  }

  /**
   * Update member
   */
  async updateMember(id: string, input: UpdateMemberInput): Promise<Member | null> {
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.updateMember(id, input);
  }

  /**
   * Update member status
   */
  async updateMemberStatus(
    id: string,
    status: Member['membershipStatus']
  ): Promise<Member | null> {
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.updateMemberStatus(id, status);
  }

  /**
   * Delete member
   */
  async deleteMember(id: string): Promise<boolean> {
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
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
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.getMemberStatistics();
  }

  /**
   * Search members
   */
  async searchMembers(query: string): Promise<Member[]> {
    // TODO: Switch to Drizzle repository when member-specific DB schema is ready.
    return MemberService.searchMembers(query);
  }
}

// Export singleton instance
export const memberService = new MemberServiceAdapter();
