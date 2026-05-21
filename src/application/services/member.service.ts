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
    const d = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    const dateOnly = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    this.members = [
      // === Active Full Members ===
      {
        id: 'member-1', userId: 'user-1', firstName: 'Max', lastName: 'Mustermann',
        email: 'max.mustermann@example.com', phone: '+49 123 456 7890', dateOfBirth: '1990-05-15',
        address: { street: 'Musterstraße', houseNumber: '123', postalCode: '12345', city: 'Musterstadt' },
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-365),
        trainingGroup: 'Anfänger A',
        emergencyContact: { name: 'Erika Mustermann', phone: '+49 123 456 7891', relationship: 'Ehefrau' },
        createdAt: d(-365), updatedAt: d(-30),
      },
      {
        id: 'member-2', userId: 'user-2', firstName: 'Anna', lastName: 'Schmidt',
        email: 'anna.schmidt@example.com', phone: '+49 987 654 3210', dateOfBirth: '1985-08-22',
        address: { street: 'Schulstraße', houseNumber: '45', postalCode: '54321', city: 'Schulstadt' },
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-180),
        trainingGroup: 'Fortgeschritten B',
        emergencyContact: { name: 'Hans Schmidt', phone: '+49 987 654 3211', relationship: 'Ehemann' },
        createdAt: d(-180), updatedAt: d(-15),
      },
      {
        id: 'member-3', userId: 'user-3', firstName: 'Peter', lastName: 'Klein',
        email: 'peter.klein@example.com', phone: '+49 555 123 4567', dateOfBirth: '1995-12-03',
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-90),
        trainingGroup: 'Anfänger A',
        emergencyContact: { name: 'Lisa Klein', phone: '+49 555 123 4568', relationship: 'Schwester' },
        createdAt: d(-90), updatedAt: d(-7),
      },
      {
        id: 'member-4', userId: 'user-4', firstName: 'Sophie', lastName: 'Wagner',
        email: 'sophie.wagner@example.com', phone: '+49 171 111 2222', dateOfBirth: '1992-07-19',
        address: { street: 'Lindenstraße', houseNumber: '8a', postalCode: '10115', city: 'Berlin' },
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-240),
        trainingGroup: 'Fortgeschritten B',
        emergencyContact: { name: 'Klaus Wagner', phone: '+49 171 111 2223', relationship: 'Vater' },
        createdAt: d(-240), updatedAt: d(-10),
      },
      {
        id: 'member-5', userId: 'user-5', firstName: 'Felix', lastName: 'Hoffmann',
        email: 'felix.hoffmann@example.com', phone: '+49 160 333 4444', dateOfBirth: '1998-01-30',
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-150),
        trainingGroup: 'Erfahren C',
        emergencyContact: { name: 'Petra Hoffmann', phone: '+49 160 333 4445', relationship: 'Mutter' },
        createdAt: d(-150), updatedAt: d(-3),
      },
      {
        id: 'member-6', userId: 'user-6', firstName: 'Laura', lastName: 'Becker',
        email: 'laura.becker@example.com', phone: '+49 152 555 6666', dateOfBirth: '1987-11-12',
        address: { street: 'Hauptstraße', houseNumber: '22', postalCode: '80331', city: 'München' },
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-400),
        trainingGroup: 'Erfahren C',
        emergencyContact: { name: 'Thomas Becker', phone: '+49 152 555 6667', relationship: 'Ehemann' },
        notes: 'Mannschaftskapitänin', createdAt: d(-400), updatedAt: d(-5),
      },
      {
        id: 'member-7', userId: 'user-7', firstName: 'Lukas', lastName: 'Fischer',
        email: 'lukas.fischer@example.com', phone: '+49 176 777 8888', dateOfBirth: '2001-04-25',
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-60),
        trainingGroup: 'Anfänger A',
        emergencyContact: { name: 'Katrin Fischer', phone: '+49 176 777 8889', relationship: 'Mutter' },
        createdAt: d(-60), updatedAt: d(-1),
      },
      {
        id: 'member-8', userId: 'user-8', firstName: 'Nina', lastName: 'Schwarz',
        email: 'nina.schwarz@example.com', phone: '+49 170 999 0001', dateOfBirth: '1983-09-08',
        address: { street: 'Parkweg', houseNumber: '3', postalCode: '50933', city: 'Köln' },
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-500),
        trainingGroup: 'Fortgeschritten B',
        emergencyContact: { name: 'Dieter Schwarz', phone: '+49 170 999 0002', relationship: 'Vater' },
        createdAt: d(-500), updatedAt: d(-14),
      },
      {
        id: 'member-9', userId: 'user-9', firstName: 'Tom', lastName: 'Richter',
        email: 'tom.richter@example.com', phone: '+49 163 222 3333', dateOfBirth: '1994-06-14',
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-120),
        trainingGroup: 'Anfänger A',
        emergencyContact: { name: 'Sabine Richter', phone: '+49 163 222 3334', relationship: 'Ehefrau' },
        createdAt: d(-120), updatedAt: d(-2),
      },
      {
        id: 'member-10', userId: 'user-10', firstName: 'Julia', lastName: 'König',
        email: 'julia.koenig@example.com', phone: '+49 175 444 5555', dateOfBirth: '1979-02-28',
        address: { street: 'Bergstraße', houseNumber: '17', postalCode: '79104', city: 'Freiburg' },
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-600),
        trainingGroup: 'Erfahren C',
        emergencyContact: { name: 'Markus König', phone: '+49 175 444 5556', relationship: 'Sohn' },
        notes: 'Ehrenmitglied seit 2020', createdAt: d(-600), updatedAt: d(-20),
      },
      // === Trial Members ===
      {
        id: 'member-11', userId: 'user-11', firstName: 'Daniel', lastName: 'Bauer',
        email: 'daniel.bauer@example.com', phone: '+49 157 666 7777', dateOfBirth: '1996-10-05',
        memberType: 'trial', membershipStatus: 'active', membershipStart: dateOnly(-14),
        createdAt: d(-14), updatedAt: d(-14),
      },
      {
        id: 'member-12', userId: 'user-12', firstName: 'Elena', lastName: 'Wolf',
        email: 'elena.wolf@example.com', phone: '+49 151 888 9999', dateOfBirth: '1993-03-21',
        memberType: 'trial', membershipStatus: 'active', membershipStart: dateOnly(-5),
        trainingGroup: 'Anfänger A',
        emergencyContact: { name: 'Karl Wolf', phone: '+49 151 888 9990', relationship: 'Vater' },
        createdAt: d(-5), updatedAt: d(-5),
      },
      {
        id: 'member-13', userId: 'user-13', firstName: 'Marco', lastName: 'Zimmermann',
        email: 'marco.zimmermann@example.com', phone: '+49 179 111 3333', dateOfBirth: '2000-12-12',
        memberType: 'trial', membershipStatus: 'active', membershipStart: dateOnly(-2),
        createdAt: d(-2), updatedAt: d(-2),
      },
      // === Inactive / Suspended ===
      {
        id: 'member-14', userId: 'user-14', firstName: 'Maria', lastName: 'Gross',
        email: 'maria.gross@example.com', phone: '+49 444 987 6543', dateOfBirth: '1988-03-17',
        memberType: 'member', membershipStatus: 'suspended', membershipStart: dateOnly(-730),
        trainingGroup: 'Erfahren C', notes: 'Zahlungsrückstand — Mahnung läuft',
        createdAt: d(-730), updatedAt: d(-60),
      },
      {
        id: 'member-15', userId: 'user-15', firstName: 'Stefan', lastName: 'Lehmann',
        email: 'stefan.lehmann@example.com', phone: '+49 172 555 8888', dateOfBirth: '1975-05-05',
        memberType: 'member', membershipStatus: 'inactive', membershipStart: dateOnly(-500),
        membershipEnd: dateOnly(-30), trainingGroup: 'Fortgeschritten B',
        notes: 'Pausiert wegen Verletzung', createdAt: d(-500), updatedAt: d(-30),
      },
      {
        id: 'member-16', userId: 'user-16', firstName: 'Claudia', lastName: 'Neumann',
        email: 'claudia.neumann@example.com', phone: '+49 173 666 1111', dateOfBirth: '1982-08-18',
        memberType: 'member', membershipStatus: 'suspended', membershipStart: dateOnly(-300),
        trainingGroup: 'Anfänger A', notes: '3× nicht erschienen — Verwarnung',
        createdAt: d(-300), updatedAt: d(-10),
      },
      // === Terminated ===
      {
        id: 'member-17', userId: 'user-17', firstName: 'Oliver', lastName: 'Schmitt',
        email: 'oliver.schmitt@example.com', phone: '+49 162 777 2222', dateOfBirth: '1991-11-30',
        memberType: 'member', membershipStatus: 'terminated', membershipStart: dateOnly(-400),
        membershipEnd: dateOnly(-90), trainingGroup: 'Fortgeschritten B',
        notes: 'Gekündigt — beruflicher Umzug nach Hamburg',
        createdAt: d(-400), updatedAt: d(-90),
      },
      {
        id: 'member-18', userId: 'user-18', firstName: 'Hanna', lastName: 'Krüger',
        email: 'hanna.krueger@example.com', phone: '+49 178 444 6666', dateOfBirth: '1989-04-09',
        memberType: 'member', membershipStatus: 'terminated', membershipStart: dateOnly(-200),
        membershipEnd: dateOnly(-45), trainingGroup: 'Erfahren C',
        notes: 'Eigenkündigung — keine Zeit mehr',
        createdAt: d(-200), updatedAt: d(-45),
      },
      // === More Active Members ===
      {
        id: 'member-19', userId: 'user-19', firstName: 'David', lastName: 'Lang',
        email: 'david.lang@example.com', phone: '+49 174 888 1111', dateOfBirth: '1997-07-07',
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-45),
        trainingGroup: 'Anfänger A',
        emergencyContact: { name: 'Ute Lang', phone: '+49 174 888 1112', relationship: 'Mutter' },
        createdAt: d(-45), updatedAt: d(-1),
      },
      {
        id: 'member-20', userId: 'user-20', firstName: 'Birgit', lastName: 'Vogel',
        email: 'birgit.vogel@example.com', phone: '+49 177 333 9999', dateOfBirth: '1980-12-25',
        address: { street: 'Seestraße', houseNumber: '42', postalCode: '78462', city: 'Konstanz' },
        memberType: 'member', membershipStatus: 'active', membershipStart: dateOnly(-300),
        trainingGroup: 'Fortgeschritten B',
        emergencyContact: { name: 'Rainer Vogel', phone: '+49 177 333 9990', relationship: 'Ehemann' },
        createdAt: d(-300), updatedAt: d(-7),
      },
    ];
  }
}

// Initialize mock data (development only)
if (process.env.NODE_ENV !== 'production') {
  MemberService.initializeMockData();
}
