import { SEPAMandateFormData, validateIBAN, formatIBAN, generateMandateReference } from '../validation/schemas/sepa-mandate.schema';

export interface SEPAMandate {
  id: string;
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

export class SEPAMandateService {
  private static mandates: Map<string, SEPAMandate> = new Map();
  private static creditorId = 'DE98ZZZ00000000000';

  /**
   * Create a new SEPA mandate
   */
  static async createMandate(
    memberId: string,
    data: Omit<SEPAMandateFormData, 'acceptTerms' | 'acceptDirectDebit'>
  ): Promise<SEPAMandate> {
    // Validate IBAN
    if (!validateIBAN(data.iban)) {
      throw new Error('Ungültige IBAN');
    }

    // Generate mandate reference if not provided
    const mandateReference = data.mandateReference || generateMandateReference(memberId);

    // Check if mandate already exists
    const existingMandate = Array.from(this.mandates.values()).find(
      (m) => m.memberId === memberId && m.isActive
    );

    if (existingMandate) {
      throw new Error('Es existiert bereits ein aktives Mandat für dieses Mitglied');
    }

    const mandate: SEPAMandate = {
      id: `mandate-${Date.now()}`,
      memberId,
      accountHolder: data.accountHolder,
      iban: data.iban.replace(/\s/g, '').toUpperCase(),
      bic: data.bic.replace(/\s/g, '').toUpperCase(),
      bankName: data.bankName,
      address: {
        street: data.street,
        houseNumber: data.houseNumber,
        postalCode: data.postalCode,
        city: data.city,
      },
      mandateReference,
      creditorId: this.creditorId,
      signatureDate: new Date(data.signatureDate),
      createdAt: new Date(),
      isActive: true,
    };

    this.mandates.set(mandate.id, mandate);
    return mandate;
  }

  /**
   * Get mandate by ID
   */
  static async getMandateById(mandateId: string): Promise<SEPAMandate | null> {
    return this.mandates.get(mandateId) || null;
  }

  /**
   * Get active mandate for member
   */
  static async getActiveMandateForMember(memberId: string): Promise<SEPAMandate | null> {
    return (
      Array.from(this.mandates.values()).find(
        (m) => m.memberId === memberId && m.isActive
      ) || null
    );
  }

  /**
   * Get all mandates for member
   */
  static async getAllMandatesForMember(memberId: string): Promise<SEPAMandate[]> {
    return Array.from(this.mandates.values()).filter((m) => m.memberId === memberId);
  }

  /**
   * Revoke mandate
   */
  static async revokeMandate(
    mandateId: string,
    reason: string
  ): Promise<SEPAMandate> {
    const mandate = this.mandates.get(mandateId);

    if (!mandate) {
      throw new Error('Mandat nicht gefunden');
    }

    if (!mandate.isActive) {
      throw new Error('Mandat ist bereits widerrufen');
    }

    mandate.isActive = false;
    mandate.revokedAt = new Date();
    mandate.revokeReason = reason;

    this.mandates.set(mandateId, mandate);
    return mandate;
  }

  /**
   * Update mandate information
   */
  static async updateMandate(
    mandateId: string,
    data: Partial<Omit<SEPAMandateFormData, 'acceptTerms' | 'acceptDirectDebit'>>
  ): Promise<SEPAMandate> {
    const mandate = this.mandates.get(mandateId);

    if (!mandate) {
      throw new Error('Mandat nicht gefunden');
    }

    // Validate IBAN if provided
    if (data.iban && !validateIBAN(data.iban)) {
      throw new Error('Ungültige IBAN');
    }

    // Update fields
    if (data.accountHolder) mandate.accountHolder = data.accountHolder;
    if (data.iban) mandate.iban = data.iban.replace(/\s/g, '').toUpperCase();
    if (data.bic) mandate.bic = data.bic.replace(/\s/g, '').toUpperCase();
    if (data.bankName) mandate.bankName = data.bankName;
    if (data.street) mandate.address.street = data.street;
    if (data.houseNumber) mandate.address.houseNumber = data.houseNumber;
    if (data.postalCode) mandate.address.postalCode = data.postalCode;
    if (data.city) mandate.address.city = data.city;

    this.mandates.set(mandateId, mandate);
    return mandate;
  }

  /**
   * Validate mandate data
   */
  static validateMandateData(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.accountHolder || data.accountHolder.length < 2) {
      errors.push('Kontoinhaber ist ungültig');
    }

    if (!data.iban || !validateIBAN(data.iban)) {
      errors.push('IBAN ist ungültig');
    }

    if (!data.bic || data.bic.length < 8) {
      errors.push('BIC ist ungültig');
    }

    if (!data.bankName || data.bankName.length < 2) {
      errors.push('Bankname ist ungültig');
    }

    if (!data.street || data.street.length < 2) {
      errors.push('Straße ist ungültig');
    }

    if (!data.houseNumber || data.houseNumber.length < 1) {
      errors.push('Hausnummer ist ungültig');
    }

    if (!data.postalCode || !/^\d{5}$/.test(data.postalCode)) {
      errors.push('Postleitzahl ist ungültig');
    }

    if (!data.city || data.city.length < 2) {
      errors.push('Stadt ist ungültig');
    }

    if (!data.signatureDate) {
      errors.push('Unterschriftdatum ist erforderlich');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format IBAN for display
   */
  static formatIBANForDisplay(iban: string): string {
    return formatIBAN(iban);
  }

  /**
   * Mask IBAN for security (show only first 4 and last 4 characters)
   */
  static maskIBAN(iban: string): string {
    const cleaned = iban.replace(/\s/g, '').toUpperCase();
    if (cleaned.length <= 8) {
      return cleaned;
    }
    const first = cleaned.substring(0, 4);
    const last = cleaned.substring(cleaned.length - 4);
    const middle = '*'.repeat(cleaned.length - 8);
    return `${first} ${middle} ${last}`;
  }

  /**
   * Get creditor ID
   */
  static getCreditorId(): string {
    return this.creditorId;
  }

  /**
   * Check if member has active mandate
   */
  static async hasActiveMandate(memberId: string): Promise<boolean> {
    const mandate = await this.getActiveMandateForMember(memberId);
    return mandate !== null;
  }
}