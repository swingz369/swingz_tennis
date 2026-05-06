export interface SEPAMandate {
  id: string;
  clubId?: string; // Multi-tenant
  memberId: string;
  accountHolder: string;
  iban: string;
  bic: string;
  bankName: string;
  address: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
  };
  mandateReference: string;
  creditorId: string;
  signatureDate: Date;
  createdAt: Date;
  isActive: boolean;
  revokedAt?: Date;
  revokeReason?: string;
}

export interface CreateSEPAMandateInput {
  clubId?: string;
  memberId: string;
  accountHolder: string;
  iban: string;
  bic: string;
  bankName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  mandateReference?: string;
  signatureDate: string;
}

export interface UpdateSEPAMandateInput {
  accountHolder?: string;
  iban?: string;
  bic?: string;
  bankName?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
}

export interface ISEPAMandateRepository {
  /**
   * Create a new SEPA mandate
   */
  create(input: CreateSEPAMandateInput): Promise<SEPAMandate>;

  /**
   * Find mandate by ID
   */
  findById(id: string): Promise<SEPAMandate | null>;

  /**
   * Find active mandate for member
   */
  findActiveMandateByMemberId(memberId: string): Promise<SEPAMandate | null>;

  /**
   * Find all mandates for member
   */
  findByMemberId(memberId: string): Promise<SEPAMandate[]>;

  /**
   * Find all mandates by club
   */
  findByClubId(clubId: string): Promise<SEPAMandate[]>;

  /**
   * Update mandate
   */
  update(id: string, input: UpdateSEPAMandateInput): Promise<SEPAMandate | null>;

  /**
   * Revoke mandate
   */
  revoke(id: string, reason: string): Promise<SEPAMandate | null>;

  /**
   * Check if member has active mandate
   */
  hasActiveMandate(memberId: string): Promise<boolean>;
}
