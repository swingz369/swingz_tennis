import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { getUserDb } from '@/infrastructure/db';
import { validateIBAN } from '@/lib/iban';
import {
  SepaMandateRepository,
  type SepaMandate,
} from '@/infrastructure/persistence/repositories/sepa-mandate.repository';

export type CreateSepaMandateInput = {
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
};

export type UpdateSepaMandateInput = Partial<
  Pick<
    CreateSepaMandateInput,
    'accountHolder' | 'iban' | 'bic' | 'bankName' | 'street' | 'houseNumber' | 'postalCode' | 'city'
  >
>;

/** Platzhalter, bis der Verein seine Gläubiger-ID hinterlegt hat (Einstellungen → Rechtliches). */
const PLACEHOLDER_CREDITOR_ID = 'DE98ZZZ00000000000';

function generateMandateReference(memberId: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MANDAT-${memberId}-${timestamp}-${random}`.substring(0, 35);
}

/**
 * Referenz-Domäne #2 für ADR-005: ein Service, ein Repository, kein
 * Adapter, keine Interfaces. `auth.clubId` (falls vorhanden — bei
 * Mitgliedern mit mehreren Vereinen ist er null) wird beim Anlegen
 * mitgegeben, damit clubadministrierte RLS-Policies greifen; das Mandat
 * selbst ist clubübergreifend an das Mitglied gebunden (club_id ist in der
 * DB optional, siehe types/supabase.ts).
 */
export class SepaMandateService {
  private readonly repo: SepaMandateRepository;

  constructor(private readonly auth: AuthContext) {
    this.repo = new SepaMandateRepository(getUserDb(auth));
  }

  async createMandate(memberId: string, data: CreateSepaMandateInput): Promise<SepaMandate> {
    if (!validateIBAN(data.iban)) {
      throw new ApiException('VALIDATION_ERROR', 'Ungültige IBAN');
    }

    const existing = await this.repo.findActiveByMemberId(memberId);
    if (existing) {
      throw new ApiException(
        'CONFLICT',
        'Es existiert bereits ein aktives Mandat für dieses Mitglied'
      );
    }

    return this.repo.create({
      club_id: this.auth.clubId,
      member_id: memberId,
      account_holder: data.accountHolder,
      iban: data.iban,
      bic: data.bic,
      bank_name: data.bankName,
      address: {
        street: data.street,
        houseNumber: data.houseNumber,
        postalCode: data.postalCode,
        city: data.city,
      },
      mandate_reference: data.mandateReference || generateMandateReference(memberId),
      creditor_id: await this.clubCreditorId(),
      signature_date: data.signatureDate,
    });
  }

  private async clubCreditorId(): Promise<string> {
    if (!this.auth.clubId) return PLACEHOLDER_CREDITOR_ID;
    return (await this.repo.findClubCreditorId(this.auth.clubId)) ?? PLACEHOLDER_CREDITOR_ID;
  }

  async getMandateById(mandateId: string): Promise<SepaMandate> {
    const mandate = await this.repo.findById(mandateId);
    if (!mandate) throw new ApiException('NOT_FOUND', 'Mandat nicht gefunden');
    return mandate;
  }

  async getActiveMandateForMember(memberId: string): Promise<SepaMandate | null> {
    return this.repo.findActiveByMemberId(memberId);
  }

  async getAllMandatesForMember(memberId: string): Promise<SepaMandate[]> {
    return this.repo.findByMemberId(memberId);
  }

  async updateMandate(mandateId: string, data: UpdateSepaMandateInput): Promise<SepaMandate> {
    if (data.iban && !validateIBAN(data.iban)) {
      throw new ApiException('VALIDATION_ERROR', 'Ungültige IBAN');
    }

    const existing = await this.repo.findById(mandateId);
    if (!existing) throw new ApiException('NOT_FOUND', 'Mandat nicht gefunden');

    const address = existing.address as {
      street: string;
      houseNumber: string;
      postalCode: string;
      city: string;
    };

    const updated = await this.repo.update(mandateId, {
      ...(data.accountHolder && { account_holder: data.accountHolder }),
      ...(data.iban && { iban: data.iban }),
      ...(data.bic && { bic: data.bic }),
      ...(data.bankName && { bank_name: data.bankName }),
      ...((data.street || data.houseNumber || data.postalCode || data.city) && {
        address: {
          street: data.street ?? address.street,
          houseNumber: data.houseNumber ?? address.houseNumber,
          postalCode: data.postalCode ?? address.postalCode,
          city: data.city ?? address.city,
        },
      }),
    });
    if (!updated) throw new ApiException('NOT_FOUND', 'Mandat nicht gefunden');
    return updated;
  }

  async revokeMandate(mandateId: string, reason: string): Promise<SepaMandate> {
    const revoked = await this.repo.revoke(mandateId, reason);
    if (!revoked) throw new ApiException('NOT_FOUND', 'Mandat nicht gefunden');
    return revoked;
  }
}
