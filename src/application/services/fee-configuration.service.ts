/**
 * Gebührenkategorien (ADR-005). Die Datenbank (RLS) trennt Vereine: Admins lesen und schreiben
 * die Kategorien ihres Vereins, Trainer lesen sie, Mitglieder sehen nur die aktiven.
 */
import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import type {
  FeeConfiguration,
  CreateFeeConfigurationInput,
  UpdateFeeConfigurationInput,
} from '@/domain/entities/fee-configuration.entity';
import { FeeConfigurationRepository } from '@/infrastructure/persistence/repositories/fee-configuration.repository';

function isValidDate(dateString: string): boolean {
  return !isNaN(new Date(dateString).getTime());
}

export class FeeConfigurationService {
  private readonly repo: FeeConfigurationRepository;

  constructor(db: AuthContext['supabase']) {
    this.repo = new FeeConfigurationRepository(db);
  }

  /**
   * Validate fee configuration input
   */
  static validateFeeConfigurationInput(input: CreateFeeConfigurationInput): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!input.name || input.name.trim().length < 2) {
      errors.push('Name muss mindestens 2 Zeichen lang sein');
    }

    if (input.amount == null || input.amount < 0) {
      errors.push('Betrag darf nicht negativ sein');
    }

    if (!input.type) {
      errors.push('Typ ist erforderlich');
    }

    if (!input.billingCycle) {
      errors.push('Abrechnungszyklus ist erforderlich');
    }

    if (input.validFrom && !isValidDate(input.validFrom)) {
      errors.push('Ungültiges Gültig-ab-Datum');
    }

    if (input.validUntil && !isValidDate(input.validUntil)) {
      errors.push('Ungültiges Gültig-bis-Datum');
    }

    if (
      input.validFrom &&
      input.validUntil &&
      new Date(input.validFrom) > new Date(input.validUntil)
    ) {
      errors.push('Gültig-ab muss vor Gültig-bis liegen');
    }

    if (input.conditions?.minAge && input.conditions.minAge < 0) {
      errors.push('Mindestalter darf nicht negativ sein');
    }

    if (input.conditions?.maxAge && input.conditions.maxAge < 0) {
      errors.push('Höchstalter darf nicht negativ sein');
    }

    if (
      input.conditions?.minAge &&
      input.conditions?.maxAge &&
      input.conditions.minAge > input.conditions.maxAge
    ) {
      errors.push('Mindestalter darf nicht größer als Höchstalter sein');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async create(input: CreateFeeConfigurationInput, clubId: string): Promise<FeeConfiguration> {
    const { valid, errors } = FeeConfigurationService.validateFeeConfigurationInput(input);
    if (!valid) throw new ApiException('VALIDATION_ERROR', errors.join(', '));
    return this.repo.create(input, clubId);
  }

  get(id: string) {
    return this.repo.findById(id);
  }

  list(clubId: string, filter: { type?: string; billingCycle?: string } = {}) {
    return this.repo.list(clubId, filter);
  }

  listActive(clubId: string) {
    return this.repo.listActive(clubId);
  }

  /** Aktive Kategorien, deren Bedingungen (Alter, Mitgliedsart) auf das Mitglied passen. */
  async calculateForMember(clubId: string, memberType: string, memberAge: number) {
    const active = await this.repo.listActive(clubId);
    return active.filter(({ conditions: c }) => {
      if (!c) return true;
      if (c.minAge != null && memberAge < c.minAge) return false;
      if (c.maxAge != null && memberAge > c.maxAge) return false;
      if (c.memberType && !c.memberType.includes(memberType)) return false;
      return true;
    });
  }

  update(id: string, input: UpdateFeeConfigurationInput) {
    return this.repo.update(id, input);
  }

  delete(id: string) {
    return this.repo.delete(id);
  }
}
