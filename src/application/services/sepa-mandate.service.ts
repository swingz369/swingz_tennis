import type { SEPAMandateFormData } from '../validation/schemas/sepa-mandate.schema';
import {
  validateIBAN,
  formatIBAN,
  generateMandateReference,
} from '../validation/schemas/sepa-mandate.schema';
import type {
  SEPAMandate,
  CreateSEPAMandateInput,
  UpdateSEPAMandateInput,
} from '../../domain/repositories/sepa-mandate-repository.interface';
import { SEPAMandateRepository } from '../../infrastructure/persistence/repositories/sepa-mandate.repository';

/**
 * SEPAMandateService — Drizzle-backed service.
 * All data operations go through the Drizzle repository directly.
 */
export class SEPAMandateService {
  private static creditorId = 'DE98ZZZ00000000000';
  private static repository = new SEPAMandateRepository();

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

    // Check if mandate already exists
    const existingMandate = await this.repository.findActiveMandateByMemberId(memberId);
    if (existingMandate) {
      throw new Error('Es existiert bereits ein aktives Mandat für dieses Mitglied');
    }

    const input: CreateSEPAMandateInput = {
      memberId,
      accountHolder: data.accountHolder,
      iban: data.iban,
      bic: data.bic,
      bankName: data.bankName,
      street: data.street,
      houseNumber: data.houseNumber,
      postalCode: data.postalCode,
      city: data.city,
      mandateReference: data.mandateReference || generateMandateReference(memberId),
      signatureDate: data.signatureDate,
    };

    return await this.repository.create(input);
  }

  /**
   * Get mandate by ID
   */
  static async getMandateById(mandateId: string): Promise<SEPAMandate | null> {
    return await this.repository.findById(mandateId);
  }

  /**
   * Get active mandate for member
   */
  static async getActiveMandateForMember(memberId: string): Promise<SEPAMandate | null> {
    return await this.repository.findActiveMandateByMemberId(memberId);
  }

  /**
   * Get all mandates for member
   */
  static async getAllMandatesForMember(memberId: string): Promise<SEPAMandate[]> {
    return await this.repository.findByMemberId(memberId);
  }

  /**
   * Revoke mandate
   */
  static async revokeMandate(mandateId: string, reason: string): Promise<SEPAMandate> {
    const revoked = await this.repository.revoke(mandateId, reason);
    if (!revoked) {
      throw new Error('Mandat nicht gefunden');
    }
    return revoked;
  }

  /**
   * Update mandate information
   */
  static async updateMandate(
    mandateId: string,
    data: Partial<Omit<SEPAMandateFormData, 'acceptTerms' | 'acceptDirectDebit'>>
  ): Promise<SEPAMandate> {
    // Validate IBAN if provided
    if (data.iban && !validateIBAN(data.iban)) {
      throw new Error('Ungültige IBAN');
    }

    const input: UpdateSEPAMandateInput = {};
    if (data.accountHolder) input.accountHolder = data.accountHolder;
    if (data.iban) input.iban = data.iban;
    if (data.bic) input.bic = data.bic;
    if (data.bankName) input.bankName = data.bankName;
    if (data.street) input.street = data.street;
    if (data.houseNumber) input.houseNumber = data.houseNumber;
    if (data.postalCode) input.postalCode = data.postalCode;
    if (data.city) input.city = data.city;

    const updated = await this.repository.update(mandateId, input);
    if (!updated) {
      throw new Error('Mandat nicht gefunden');
    }
    return updated;
  }

  /**
   * Validate mandate data
   */
  static validateMandateData(data: Record<string, string | undefined>): {
    valid: boolean;
    errors: string[];
  } {
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
    return await this.repository.hasActiveMandate(memberId);
  }
}

export type { SEPAMandate };
