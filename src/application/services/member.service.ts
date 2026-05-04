import type {
  Member,
  CreateMemberInput,
  UpdateMemberInput,
  MemberQuery,
} from '../../domain/entities/member.entity';

export class MemberService {
  private static members: Member[] = [];

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `member-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate member input
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
   * Validate email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate date format
   */
  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Validate postal code format (German format)
   */
  private static isValidPostalCode(postalCode: string): boolean {
    const postalCodeRegex = /^\d{5}$/;
    return postalCodeRegex.test(postalCode);
  }

  /**
   * Create a new member
   */
  static async createMember(input: CreateMemberInput): Promise<Member> {
    const validation = this.validateMemberInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const member: Member = {
      id: this.generateId(),
      userId: input.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      address: input.address,
      memberType: input.memberType,
      membershipStatus: input.membershipStatus,
      membershipStart: input.membershipStart,
      membershipEnd: input.membershipEnd,
      trainingGroup: input.trainingGroup,
      emergencyContact: input.emergencyContact,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    this.members.push(member);
    return member;
  }

  /**
   * Get member by ID
   */
  static async getMemberById(id: string): Promise<Member | null> {
    return this.members.find((m) => m.id === id) || null;
  }

  /**
   * Get member by user ID
   */
  static async getMemberByUserId(userId: string): Promise<Member | null> {
    return this.members.find((m) => m.userId === userId) || null;
  }

  /**
   * Get member by email
   */
  static async getMemberByEmail(email: string): Promise<Member | null> {
    return this.members.find((m) => m.email.toLowerCase() === email.toLowerCase()) || null;
  }

  /**
   * Get all members
   */
  static async getAllMembers(): Promise<Member[]> {
    return [...this.members];
  }

  /**
   * Query members with filters
   */
  static async queryMembers(query: MemberQuery): Promise<Member[]> {
    let results = this.members;

    if (query.status) {
      results = results.filter((m) => m.membershipStatus === query.status);
    }

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
    return this.members.filter((m) => m.membershipStatus === 'active');
  }

  /**
   * Get members by training group
   */
  static async getMembersByTrainingGroup(trainingGroup: string): Promise<Member[]> {
    return this.members.filter((m) => m.trainingGroup === trainingGroup);
  }

  /**
   * Update member
   */
  static async updateMember(id: string, input: UpdateMemberInput): Promise<Member | null> {
    const index = this.members.findIndex((m) => m.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.members[index];
    const updated: Member = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.members[index] = updated;
    return updated;
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
   * Delete member
   */
  static async deleteMember(id: string): Promise<boolean> {
    const index = this.members.findIndex((m) => m.id === id);
    if (index === -1) {
      return false;
    }

    this.members.splice(index, 1);
    return true;
  }

  /**
   * Get member statistics
   */
  static async getMemberStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    terminated: number;
    byType: {
      member: number;
      trial: number;
      inactive: number;
    };
    byTrainingGroup: Record<string, number>;
  }> {
    const total = this.members.length;
    const active = this.members.filter((m) => m.membershipStatus === 'active').length;
    const inactive = this.members.filter((m) => m.membershipStatus === 'inactive').length;
    const suspended = this.members.filter((m) => m.membershipStatus === 'suspended').length;
    const terminated = this.members.filter((m) => m.membershipStatus === 'terminated').length;

    const byType = {
      member: this.members.filter((m) => m.memberType === 'member').length,
      trial: this.members.filter((m) => m.memberType === 'trial').length,
      inactive: this.members.filter((m) => m.memberType === 'inactive').length,
    };

    const byTrainingGroup: Record<string, number> = {};
    for (const member of this.members) {
      if (member.trainingGroup) {
        byTrainingGroup[member.trainingGroup] = (byTrainingGroup[member.trainingGroup] || 0) + 1;
      }
    }

    return {
      total,
      active,
      inactive,
      suspended,
      terminated,
      byType,
      byTrainingGroup,
    };
  }

  /**
   * Search members
   */
  static async searchMembers(query: string): Promise<Member[]> {
    const lowerQuery = query.toLowerCase();
    return this.members.filter(
      (m) =>
        `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(lowerQuery) ||
        m.trainingGroup?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Initialize with mock data (for development)
   */
  static initializeMockData(): void {
    const now = new Date();

    this.members = [
      {
        id: 'member-1',
        userId: 'user-1',
        firstName: 'Max',
        lastName: 'Mustermann',
        email: 'max.mustermann@example.com',
        phone: '+49 123 456 7890',
        dateOfBirth: '1990-05-15',
        address: {
          street: 'Musterstraße',
          houseNumber: '123',
          postalCode: '12345',
          city: 'Musterstadt',
        },
        memberType: 'member',
        membershipStatus: 'active',
        membershipStart: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        trainingGroup: 'Anfänger A',
        emergencyContact: {
          name: 'Erika Mustermann',
          phone: '+49 123 456 7891',
          relationship: 'Ehefrau',
        },
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'member-2',
        userId: 'user-2',
        firstName: 'Anna',
        lastName: 'Schmidt',
        email: 'anna.schmidt@example.com',
        phone: '+49 987 654 3210',
        dateOfBirth: '1985-08-22',
        address: {
          street: 'Schulstraße',
          houseNumber: '45',
          postalCode: '54321',
          city: 'Schulstadt',
        },
        memberType: 'member',
        membershipStatus: 'active',
        membershipStart: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        trainingGroup: 'Fortgeschritten B',
        emergencyContact: {
          name: 'Hans Schmidt',
          phone: '+49 987 654 3211',
          relationship: 'Ehemann',
        },
        createdAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'member-3',
        userId: 'user-3',
        firstName: 'Peter',
        lastName: 'Klein',
        email: 'peter.klein@example.com',
        phone: '+49 555 123 4567',
        dateOfBirth: '1995-12-03',
        memberType: 'trial',
        membershipStatus: 'active',
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'member-4',
        userId: 'user-4',
        firstName: 'Maria',
        lastName: 'Gross',
        email: 'maria.gross@example.com',
        phone: '+49 444 987 6543',
        dateOfBirth: '1988-03-17',
        memberType: 'member',
        membershipStatus: 'suspended',
        membershipStart: new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        trainingGroup: 'Erfahren C',
        notes: 'Zahlungsrückstand',
        createdAt: new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }
}

// Initialize mock data
MemberService.initializeMockData();
