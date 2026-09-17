/**
 * Unit tests for BillingService (ADR-005, Domäne Abrechnung).
 *
 * Mockt BillingRepository (vi.spyOn auf dem Prototyp, da der Service sein
 * Repository selbst konstruiert). Deckt die Fachlogik ab, die bei einer
 * echten Datenbank am schwersten zu beobachten wäre: die
 * Übungsleiterpauschale (§ 3 Nr. 26 EStG, max. 3.000 € steuerfrei p.a.).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeAuth } from '../helpers/auth';
import { ApiException } from '@/lib/api-error';
import { BillingService } from '@/application/services/billing.service';
import {
  BillingRepository,
  type TrainerBilling,
} from '@/infrastructure/persistence/repositories/billing.repository';

function makeTrainerBilling(overrides: Partial<TrainerBilling> = {}): TrainerBilling {
  return {
    id: 'bill-1',
    billing_period_id: 'period-1',
    trainer_id: 'trainer-1',
    trainer_name: 'Anna Trainer',
    total_hours: 10,
    hourly_rate: 30,
    total_amount: 300,
    tax_free_amount: 0,
    taxable_amount: 300,
    status: 'pending',
    invoice_id: null,
    invoice_number: null,
    due_date: null,
    paid_at: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as TrainerBilling;
}

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(() => {
    service = new BillingService(fakeAuth());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTrainerBilling — Übungsleiterpauschale (§ 3 Nr. 26 EStG)', () => {
    it('ist voll steuerfrei, wenn im laufenden Jahr noch nichts genutzt wurde', async () => {
      vi.spyOn(BillingRepository.prototype, 'findTaxFreeAmountsForTrainerInYear').mockResolvedValue(
        []
      );
      const create = vi
        .spyOn(BillingRepository.prototype, 'createTrainerBilling')
        .mockImplementation(async (input) => makeTrainerBilling(input as Partial<TrainerBilling>));

      await service.createTrainerBilling({
        billing_period_id: 'period-1',
        trainer_id: 'trainer-1',
        trainer_name: 'Anna',
        total_hours: 10,
        hourly_rate: 30,
        total_amount: 300,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ tax_free_amount: 300, taxable_amount: 0 })
      );
    });

    it('deckelt den steuerfreien Anteil auf den verbleibenden Jahresfreibetrag', async () => {
      vi.spyOn(BillingRepository.prototype, 'findTaxFreeAmountsForTrainerInYear').mockResolvedValue(
        [{ taxFreeAmount: 2900, createdAt: '2026-02-01T00:00:00Z' }]
      );
      const create = vi
        .spyOn(BillingRepository.prototype, 'createTrainerBilling')
        .mockImplementation(async (input) => makeTrainerBilling(input as Partial<TrainerBilling>));

      // 3000 - 2900 = 100 € verbleiben, obwohl die Abrechnung 300 € beträgt
      await service.createTrainerBilling({
        billing_period_id: 'period-1',
        trainer_id: 'trainer-1',
        trainer_name: 'Anna',
        total_hours: 10,
        hourly_rate: 30,
        total_amount: 300,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ tax_free_amount: 100, taxable_amount: 200 })
      );
    });

    it('ist voll steuerpflichtig, wenn der Jahresfreibetrag bereits ausgeschöpft ist', async () => {
      vi.spyOn(BillingRepository.prototype, 'findTaxFreeAmountsForTrainerInYear').mockResolvedValue(
        [{ taxFreeAmount: 3000, createdAt: '2026-02-01T00:00:00Z' }]
      );
      const create = vi
        .spyOn(BillingRepository.prototype, 'createTrainerBilling')
        .mockImplementation(async (input) => makeTrainerBilling(input as Partial<TrainerBilling>));

      await service.createTrainerBilling({
        billing_period_id: 'period-1',
        trainer_id: 'trainer-1',
        trainer_name: 'Anna',
        total_hours: 10,
        hourly_rate: 30,
        total_amount: 300,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ tax_free_amount: 0, taxable_amount: 300 })
      );
    });
  });

  describe('getTrainerBillingById — Not Found', () => {
    it('wirft ApiException NOT_FOUND, wenn die Abrechnung fehlt', async () => {
      vi.spyOn(BillingRepository.prototype, 'findTrainerBillingById').mockResolvedValue(null);

      await expect(service.getTrainerBillingById('missing')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('gibt die Abrechnung zurück, wenn sie existiert', async () => {
      vi.spyOn(BillingRepository.prototype, 'findTrainerBillingById').mockResolvedValue(
        makeTrainerBilling()
      );

      const result = await service.getTrainerBillingById('bill-1');

      expect(result.id).toBe('bill-1');
    });
  });

  describe('markTrainerBillingAsPaid / markTrainerBillingAsOverdue — Not Found', () => {
    it('wirft ApiException NOT_FOUND bei markTrainerBillingAsPaid', async () => {
      vi.spyOn(BillingRepository.prototype, 'markTrainerBillingAsPaid').mockResolvedValue(null);

      await expect(service.markTrainerBillingAsPaid('missing')).rejects.toThrow(ApiException);
    });

    it('wirft ApiException NOT_FOUND bei markTrainerBillingAsOverdue', async () => {
      vi.spyOn(BillingRepository.prototype, 'markTrainerBillingAsOverdue').mockResolvedValue(null);

      await expect(service.markTrainerBillingAsOverdue('missing')).rejects.toThrow(ApiException);
    });
  });
});
