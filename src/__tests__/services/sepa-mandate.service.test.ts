/**
 * Unit tests for SepaMandateService — zweite Referenzdomäne für ADR-005.
 *
 * Mockt SepaMandateRepository (vi.spyOn auf dem Prototyp). Deckt die
 * Fachlogik ab, die bislang völlig ungetestet war: IBAN-Validierung und die
 * Sperre gegen ein zweites aktives Mandat pro Mitglied.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { SepaMandateService } from '@/application/services/sepa-mandate.service';
import { SepaMandateRepository } from '@/infrastructure/persistence/repositories/sepa-mandate.repository';
import type { SepaMandate } from '@/infrastructure/persistence/repositories/sepa-mandate.repository';

function fakeAuth(clubId: string | null = 'club-1'): AuthContext {
  return {
    user: { id: 'user-1' } as AuthContext['user'],
    session: null,
    supabase: {} as AuthContext['supabase'],
    clubId,
    role: 'admin',
    roles: ['admin'],
    memberships: [{ club_id: clubId, role: 'admin' }],
  };
}

function makeMandate(overrides: Partial<SepaMandate> = {}): SepaMandate {
  return {
    id: 'mandate-1',
    club_id: 'club-1',
    member_id: 'member-1',
    account_holder: 'Anna Mitglied',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    bank_name: 'Commerzbank',
    address: { street: 'Hauptstr.', houseNumber: '1', postalCode: '12345', city: 'Berlin' },
    mandate_reference: 'SWINGZ-1',
    creditor_id: 'DE98ZZZ00000000000',
    signature_date: '2026-01-01',
    created_at: '2026-01-01T00:00:00Z',
    is_active: true,
    revoked_at: null,
    revoke_reason: null,
    ...overrides,
  } as SepaMandate;
}

const validInput = {
  accountHolder: 'Anna Mitglied',
  iban: 'DE89 3704 0044 0532 0130 00',
  bic: 'COBADEFFXXX',
  bankName: 'Commerzbank',
  street: 'Hauptstr.',
  houseNumber: '1',
  postalCode: '12345',
  city: 'Berlin',
  signatureDate: '2026-01-01',
};

describe('SepaMandateService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createMandate', () => {
    beforeEach(() => {
      vi.spyOn(SepaMandateRepository.prototype, 'findActiveByMemberId').mockResolvedValue(null);
      vi.spyOn(SepaMandateRepository.prototype, 'create').mockImplementation(async (input) =>
        makeMandate(input as Partial<SepaMandate>)
      );
    });

    it('lehnt eine ungültige IBAN ab', async () => {
      const service = new SepaMandateService(fakeAuth());
      await expect(
        service.createMandate('member-1', { ...validInput, iban: 'NOT-AN-IBAN' })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('lehnt ein zweites aktives Mandat für dasselbe Mitglied ab', async () => {
      vi.spyOn(SepaMandateRepository.prototype, 'findActiveByMemberId').mockResolvedValue(
        makeMandate()
      );
      const service = new SepaMandateService(fakeAuth());
      await expect(service.createMandate('member-1', validInput)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('gibt club_id aus dem Auth-Kontext an das Repository weiter', async () => {
      const create = vi.spyOn(SepaMandateRepository.prototype, 'create');
      const service = new SepaMandateService(fakeAuth('club-42'));

      await service.createMandate('member-1', validInput);

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ club_id: 'club-42' }));
    });

    it('lässt club_id null, wenn das Mitglied keinem aktiven Verein zugeordnet ist', async () => {
      const create = vi.spyOn(SepaMandateRepository.prototype, 'create');
      const service = new SepaMandateService(fakeAuth(null));

      await service.createMandate('member-1', validInput);

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ club_id: null }));
    });
  });

  describe('getMandateById', () => {
    it('wirft NOT_FOUND, wenn das Mandat fehlt', async () => {
      vi.spyOn(SepaMandateRepository.prototype, 'findById').mockResolvedValue(null);
      const service = new SepaMandateService(fakeAuth());

      await expect(service.getMandateById('missing')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('updateMandate', () => {
    it('lehnt eine ungültige IBAN beim Aktualisieren ab', async () => {
      vi.spyOn(SepaMandateRepository.prototype, 'findById').mockResolvedValue(makeMandate());
      const service = new SepaMandateService(fakeAuth());

      await expect(
        service.updateMandate('mandate-1', { iban: 'NOT-AN-IBAN' })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('wirft NOT_FOUND, wenn das zu ändernde Mandat fehlt', async () => {
      vi.spyOn(SepaMandateRepository.prototype, 'findById').mockResolvedValue(null);
      const service = new SepaMandateService(fakeAuth());

      await expect(
        service.updateMandate('missing', { accountHolder: 'Neuer Name' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
