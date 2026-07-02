import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import type {
  Member,
  CreateMemberInput,
  UpdateMemberInput,
  MemberQuery,
} from '../../domain/entities/member.entity';

/** Service role client — used for all DB operations (server-side only, not exposed to browser) */
const db = createServiceClient();
const log = createLogger('member-service');

export class MemberService {
  /**
   * Validate member input (pure logic, no DB dependency)
   */
  static validateMemberInput(input: CreateMemberInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.userId || input.userId.trim().length === 0) {
      errors.push('Benutzer-ID ist erforderlich');
    }

    if (!input.firstName || input.firstName.trim().length < 2) {
      errors.push('Vorname muss mindestens 2 Zeichen lang sein');
    }

    if (!input.lastName || input.lastName.trim().length < 2) {
      errors.push('Nachname muss mindestens 2 Zeichen lang sein');
    }

    if (!input.email || !this.isValidEmail(input.email)) {
      errors.push('Ungültige E-Mail-Adresse');
    }

    if (!input.phone || input.phone.trim().length < 5) {
      errors.push('Telefonnummer muss mindestens 5 Zeichen lang sein');
    }

    if (!input.dateOfBirth || !this.isValidDate(input.dateOfBirth)) {
      errors.push('Ungültiges Geburtsdatum');
    }

    if (input.address) {
      if (!input.address.street || input.address.street.trim().length < 2) {
        errors.push('Straße muss mindestens 2 Zeichen lang sein');
      }
      if (!input.address.houseNumber || input.address.houseNumber.trim().length === 0) {
        errors.push('Hausnummer ist erforderlich');
      }
      if (!input.address.postalCode || !this.isValidPostalCode(input.address.postalCode)) {
        errors.push('Ungültige Postleitzahl');
      }
      if (!input.address.city || input.address.city.trim().length < 2) {
        errors.push('Stadt muss mindestens 2 Zeichen lang sein');
      }
    }

    if (input.membershipStart && !this.isValidDate(input.membershipStart)) {
      errors.push('Ungültiges Mitgliedschaftsstartdatum');
    }

    if (input.membershipEnd && !this.isValidDate(input.membershipEnd)) {
      errors.push('Ungültiges Mitgliedschaftsenddatum');
    }

    if (
      input.membershipStart &&
      input.membershipEnd &&
      new Date(input.membershipStart) > new Date(input.membershipEnd)
    ) {
      errors.push('Mitgliedschaftsstart muss vor Mitgliedschaftsend liegen');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Map a user_club_memberships row + users row → Member entity
   */
  private static mapToMember(
    m: Record<string, unknown>,
    user?: Record<string, unknown> | null
  ): Member {
    const membershipStatus = m.is_active ? (m.status as string) || 'active' : 'inactive';

    return {
      id: m.id as string,
      userId: m.user_id as string,
      firstName: ((user?.full_name as string) || '').split(' ')[0] || '',
      lastName: ((user?.full_name as string) || '').split(' ').slice(1).join(' '),
      email: (user?.email as string) || '',
      phone: (user?.phone as string) || '',
      dateOfBirth: (user?.date_of_birth as string) || '',
      address: user?.address
        ? {
            street: (user?.address as Record<string, string>)?.street || '',
            houseNumber: (user?.address as Record<string, string>)?.house_number || '',
            postalCode:
              (user?.postal_code as string) ||
              (user?.address as Record<string, string>)?.postal_code ||
              '',
            city: (user?.city as string) || (user?.address as Record<string, string>)?.city || '',
          }
        : user?.city || user?.postal_code
          ? {
              street: (user?.address as string) || '',
              houseNumber: '',
              postalCode: (user?.postal_code as string) || '',
              city: (user?.city as string) || '',
            }
          : undefined,
      memberType: (m.role as string) === 'trial' ? 'trial' : !m.is_active ? 'inactive' : 'member',
      membershipStatus: membershipStatus as Member['membershipStatus'],
      membershipStart: (m.joined_at as string) || undefined,
      membershipEnd: (m.deactivated_at as string) || undefined,
      trainingGroup: undefined, // stored in training_group_memberships, fetched separately
      emergencyContact: user?.emergency_contact
        ? {
            name: (user?.emergency_contact as Record<string, string>)?.name || '',
            phone:
              (user?.emergency_phone as string) ||
              (user?.emergency_contact as Record<string, string>)?.phone ||
              '',
            relationship: (user?.emergency_contact as Record<string, string>)?.relationship || '',
          }
        : undefined,
      notes: (user?.bio as string) || undefined,
      createdAt: (m.created_at as string) || new Date().toISOString(),
      updatedAt: (m.created_at as string) || new Date().toISOString(),
    };
  }

  /**
   * Get user profile data for a user ID
   */
  private static async getUserProfile(userId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await db.from('users').select('*').eq('id', userId).single();
    return error ? null : data;
  }

  /**
   * Get user profiles for multiple user IDs
   */
  private static async getUserProfiles(
    userIds: string[]
  ): Promise<Map<string, Record<string, unknown>>> {
    if (userIds.length === 0) return new Map();
    const map = new Map<string, Record<string, unknown>>();
    // Chunk to keep the `.in()` query string well under PostgREST/URL length limits.
    const chunkSize = 100;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const { data, error } = await db.from('users').select('*').in('id', chunk);
      if (error) {
        log.error('getUserProfiles chunk failed', error instanceof Error ? error : undefined);
        continue;
      }
      for (const user of data || []) {
        map.set(user.id as string, user);
      }
    }
    return map;
  }

  /**
   * Create a new member — inserts into user_club_memberships
   */
  static async createMember(input: CreateMemberInput, clubId?: string): Promise<Member> {
    const validation = this.validateMemberInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const { data, error } = await db
      .from('user_club_memberships')
      .insert({
        user_id: input.userId,
        club_id: clubId || null,
        role: 'member',
        is_active: input.membershipStatus === 'active' || input.membershipStatus === 'suspended',
        status: input.membershipStatus || 'active',
        joined_at: input.membershipStart || now,
        created_at: now,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create member: ${error.message}`);
    }

    // Update user profile with extra fields
    if (input.firstName || input.lastName || input.phone || input.address || input.dateOfBirth) {
      const userUpdate: Record<string, unknown> = {};
      if (input.firstName) userUpdate.first_name = input.firstName;
      if (input.lastName) userUpdate.last_name = input.lastName;
      if (input.phone) userUpdate.phone = input.phone;
      if (input.dateOfBirth) userUpdate.date_of_birth = input.dateOfBirth;
      if (input.address) {
        userUpdate.address = input.address;
        userUpdate.city = input.address.city;
        userUpdate.postal_code = input.address.postalCode;
      }
      if (input.emergencyContact) {
        userUpdate.emergency_contact = input.emergencyContact;
        userUpdate.emergency_phone = input.emergencyContact.phone;
      }
      if (input.notes) userUpdate.bio = input.notes;

      await db.from('users').update(userUpdate).eq('id', input.userId);
    }

    return this.mapToMember(data);
  }

  /**
   * Get member by membership ID
   */
  static async getMemberById(id: string): Promise<Member | null> {
    const { data, error } = await db
      .from('user_club_memberships')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    const user = await this.getUserProfile(data.user_id as string);
    return this.mapToMember(data, user);
  }

  /**
   * Get member by user ID
   */
  static async getMemberByUserId(userId: string): Promise<Member | null> {
    const { data, error } = await db
      .from('user_club_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'member')
      .maybeSingle();

    if (error || !data) return null;

    const user = await this.getUserProfile(userId);
    return this.mapToMember(data, user);
  }

  /**
   * Get member by email (via users table)
   */
  static async getMemberByEmail(email: string): Promise<Member | null> {
    const { data: user } = await db.from('users').select('id').eq('email', email).single();

    if (!user) return null;

    return this.getMemberByUserId(user.id as string);
  }

  /**
   * Get all members (across all clubs — use queryMembers for scoped queries)
   */
  static async getAllMembers(): Promise<Member[]> {
    const { data: memberships, error } = await db
      .from('user_club_memberships')
      .select('*')
      .eq('role', 'member')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error || !memberships) return [];

    const userIds = [...new Set(memberships.map((m) => m.user_id as string))];
    const userProfiles = await this.getUserProfiles(userIds);

    return memberships.map((m) => this.mapToMember(m, userProfiles.get(m.user_id as string)));
  }

  /**
   * Query members with filters
   */
  static async queryMembers(query: MemberQuery & { clubId?: string }): Promise<Member[]> {
    let q = db.from('user_club_memberships').select('*').eq('role', 'member');

    if (query.status) {
      if (query.status === 'active') {
        q = q.eq('is_active', true);
      } else if (query.status === 'inactive') {
        q = q.eq('is_active', false);
      } else {
        q = q.eq('status', query.status);
      }
    }

    if (query.clubId) {
      q = q.eq('club_id', query.clubId);
    }

    const { data: memberships, error } = await q
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error || !memberships) return [];

    const userIds = [...new Set(memberships.map((m) => m.user_id as string))];
    const userProfiles = await this.getUserProfiles(userIds);

    let results = memberships.map((m) =>
      this.mapToMember(m, userProfiles.get(m.user_id as string))
    );

    // Apply in-memory filters for fields not in DB
    if (query.type) {
      results = results.filter((m) => m.memberType === query.type);
    }
    if (query.trainingGroup) {
      results = results.filter((m) => m.trainingGroup === query.trainingGroup);
    }
    if (query.search) {
      const lowerQuery = query.search.toLowerCase();
      results = results.filter(
        (m) =>
          `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(lowerQuery) ||
          m.trainingGroup?.toLowerCase().includes(lowerQuery)
      );
    }

    return results;
  }

  /**
   * Get active members
   */
  static async getActiveMembers(): Promise<Member[]> {
    return this.queryMembers({ status: 'active' });
  }

  /**
   * Count active members in a club (lightweight `.select('id', { count: 'exact', head: true })`
   * — does not fetch row data).
   *
   * Used by Stripe Subscription Quantity Sync (ticket 3.6.1) to drive the
   * subscription-item quantity. Returns 0 for clubs with no members.
   *
   * Note: uses `is_active = true` rather than `status = 'active'` because
   * `user_club_memberships` is the authoritative soft-delete layer (GoBD § 147
   * AO 10-year retention requires we keep `status` history; `is_active` is the
   * runtime gate). Members with `status='suspended'` are still counted as
   * "active" because their subscription is still being billed.
   */
  static async getActiveMemberCount(clubId?: string): Promise<number> {
    let q = db
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('role', 'member');
    if (clubId) {
      q = q.eq('club_id', clubId);
    }
    const { count, error } = await q;
    if (error) {
      return 0;
    }
    return count ?? 0;
  }

  /**
   * Get members by training group — joins training_group_memberships
   *
   * Resolves the human-readable group name (e.g. "Anfänger") to a group ID
   * via the training_groups table, then fetches member IDs from
   * training_group_memberships, and finally returns full Member entities.
   */
  static async getMembersByTrainingGroup(trainingGroup: string): Promise<Member[]> {
    // Resolve training group name → ID
    const { data: groupData } = await db
      .from('training_groups')
      .select('id, name')
      .eq('name', trainingGroup)
      .single();

    if (!groupData) return [];

    const groupId = groupData.id as string;
    const groupName = (groupData.name as string) || trainingGroup;

    const { data: membershipRecords } = await db
      .from('training_group_memberships')
      .select('member_id')
      .eq('training_group_id', groupId);

    const userIds = [...new Set((membershipRecords || []).map((r) => r.member_id as string))];
    if (userIds.length === 0) return [];

    // Fetch user_club_memberships for these users
    const { data: memberships } = await db
      .from('user_club_memberships')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    if (!memberships) return [];

    const userProfiles = await this.getUserProfiles(userIds);

    return memberships.map((m) => {
      const member = this.mapToMember(m, userProfiles.get(m.user_id as string));
      member.trainingGroup = groupName;
      return member;
    });
  }

  /**
   * Update member
   */
  static async updateMember(id: string, input: UpdateMemberInput): Promise<Member | null> {
    const existing = await this.getMemberById(id);
    if (!existing) return null;

    // Update user profile fields
    if (
      input.firstName ||
      input.lastName ||
      input.email ||
      input.phone ||
      input.dateOfBirth ||
      input.address ||
      input.emergencyContact ||
      input.notes
    ) {
      const userUpdate: Record<string, unknown> = {};
      if (input.firstName !== undefined) userUpdate.first_name = input.firstName;
      if (input.lastName !== undefined) userUpdate.last_name = input.lastName;
      if (input.email !== undefined) {
        userUpdate.email = input.email;
      }
      if (input.phone !== undefined) userUpdate.phone = input.phone;
      if (input.dateOfBirth !== undefined) userUpdate.date_of_birth = input.dateOfBirth;
      if (input.address !== undefined) {
        userUpdate.address = input.address;
        userUpdate.city = input.address.city;
        userUpdate.postal_code = input.address.postalCode;
      }
      if (input.emergencyContact !== undefined) {
        userUpdate.emergency_contact = input.emergencyContact;
        userUpdate.emergency_phone = input.emergencyContact?.phone;
      }
      if (input.notes !== undefined) userUpdate.bio = input.notes;

      await db.from('users').update(userUpdate).eq('id', existing.userId);
    }

    // Update membership fields
    if (
      input.membershipStatus !== undefined ||
      input.memberType !== undefined ||
      input.membershipStart !== undefined ||
      input.membershipEnd !== undefined ||
      input.trainingGroup !== undefined
    ) {
      const membershipUpdate: Record<string, unknown> = {};
      if (input.membershipStatus !== undefined) {
        membershipUpdate.status = input.membershipStatus;
        membershipUpdate.is_active =
          input.membershipStatus !== 'inactive' && input.membershipStatus !== 'terminated';
      }
      if (input.membershipStart !== undefined) membershipUpdate.joined_at = input.membershipStart;
      if (input.membershipEnd !== undefined) membershipUpdate.deactivated_at = input.membershipEnd;
      // Note: trainingGroup is stored in training_group_memberships, not here

      await db.from('user_club_memberships').update(membershipUpdate).eq('id', id);
    }

    // Re-fetch to return updated entity
    return this.getMemberById(id);
  }

  /**
   * Update member status
   */
  static async updateMemberStatus(
    id: string,
    status: Member['membershipStatus']
  ): Promise<Member | null> {
    return this.updateMember(id, { membershipStatus: status });
  }

  /**
   * Delete member (soft delete — deactivate)
   */
  static async deleteMember(id: string): Promise<boolean> {
    const { error } = await db
      .from('user_club_memberships')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Failed to deactivate member:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Get member statistics from real DB
   */
  static async getMemberStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    terminated: number;
    byType: { member: number; trial: number; inactive: number };
    byTrainingGroup: Record<string, number>;
  }> {
    const { data: memberships, error } = await db
      .from('user_club_memberships')
      .select('is_active, status, role')
      .eq('role', 'member');

    if (error || !memberships) {
      return {
        total: 0,
        active: 0,
        inactive: 0,
        suspended: 0,
        terminated: 0,
        byType: { member: 0, trial: 0, inactive: 0 },
        byTrainingGroup: {},
      };
    }

    const total = memberships.length;
    let active = 0,
      inactive = 0,
      suspended = 0,
      terminated = 0;

    for (const m of memberships) {
      const s = m.status as string;
      if (!m.is_active) inactive++;
      else if (s === 'suspended') suspended++;
      else if (s === 'terminated') terminated++;
      else active++;
    }

    return {
      total,
      active,
      inactive,
      suspended,
      terminated,
      byType: {
        member: active + suspended,
        trial: 0, // trial tracking requires training_group_memberships
        inactive,
      },
      byTrainingGroup: {}, // requires training_group_memberships join
    };
  }

  /**
   * Search members
   */
  static async searchMembers(query: string): Promise<Member[]> {
    return this.queryMembers({ search: query });
  }

  // ---- Private helpers ----

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  private static isValidPostalCode(postalCode: string): boolean {
    const postalCodeRegex = /^\d{5}$/;
    return postalCodeRegex.test(postalCode);
  }
}
