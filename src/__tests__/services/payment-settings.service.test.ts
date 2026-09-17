/**
 * Unit tests for PaymentSettingsService — vierte Referenzdomäne für ADR-005.
 *
 * Die alte Implementierung war ein reiner In-Memory-Stub ohne Persistenz und
 * hatte keine Tests. Deckt hier die Fachlogik ab: clubId-Weitergabe an das
 * Repository und NOT_FOUND bei fehlenden Datensätzen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fakeAuth } from '../helpers/auth';
import { PaymentSettingsService } from '@/application/services/payment-settings.service';
import { PaymentSettingsRepository } from '@/infrastructure/persistence/repositories/payment-settings.repository';
import type { PaymentSettings } from '@/infrastructure/persistence/repositories/payment-settings.repository';

function makeSettings(overrides: Partial<PaymentSettings> = {}): PaymentSettings {
  return {
    id: 'settings-1',
    club_id: 'club-1',
    gateway: 'stripe',
    gateway_name: 'Stripe',
    is_active: true,
    is_default: true,
    config: {},
    supported_currencies: ['EUR'],
    supported_methods: ['card'],
    min_amount: null,
    max_amount: null,
    fees: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as PaymentSettings;
}

describe('PaymentSettingsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createPaymentSettings', () => {
    it('gibt die clubId an das Repository weiter', async () => {
      const create = vi
        .spyOn(PaymentSettingsRepository.prototype, 'create')
        .mockImplementation(async (input) => makeSettings(input as Partial<PaymentSettings>));
      const service = new PaymentSettingsService(fakeAuth());

      await service.createPaymentSettings('club-42', {
        gateway: 'stripe',
        gateway_name: 'Stripe',
        config: { apiKey: 'sk_test' },
        supported_currencies: ['EUR'],
        supported_methods: ['card'],
      });

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ club_id: 'club-42' }));
    });
  });

  describe('getPaymentSettingsById', () => {
    it('wirft NOT_FOUND, wenn die Einstellungen fehlen', async () => {
      vi.spyOn(PaymentSettingsRepository.prototype, 'findById').mockResolvedValue(null);
      const service = new PaymentSettingsService(fakeAuth());

      await expect(service.getPaymentSettingsById('missing', 'club-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('gibt die Einstellungen zurück, wenn sie existieren', async () => {
      vi.spyOn(PaymentSettingsRepository.prototype, 'findById').mockResolvedValue(makeSettings());
      const service = new PaymentSettingsService(fakeAuth());

      const result = await service.getPaymentSettingsById('settings-1', 'club-1');

      expect(result.id).toBe('settings-1');
    });
  });

  describe('updatePaymentSettings', () => {
    it('wirft NOT_FOUND, wenn die zu ändernden Einstellungen fehlen', async () => {
      vi.spyOn(PaymentSettingsRepository.prototype, 'update').mockResolvedValue(null);
      const service = new PaymentSettingsService(fakeAuth());

      await expect(
        service.updatePaymentSettings('missing', 'club-1', { is_active: false })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('deletePaymentSettings', () => {
    it('wirft NOT_FOUND, wenn nichts gelöscht wurde', async () => {
      vi.spyOn(PaymentSettingsRepository.prototype, 'delete').mockResolvedValue(false);
      const service = new PaymentSettingsService(fakeAuth());

      await expect(service.deletePaymentSettings('missing', 'club-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('testPaymentSettings', () => {
    it('wirft NOT_FOUND für eine unbekannte oder fremde ID', async () => {
      vi.spyOn(PaymentSettingsRepository.prototype, 'findById').mockResolvedValue(null);
      const service = new PaymentSettingsService(fakeAuth());

      await expect(service.testPaymentSettings('missing', 'club-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('meldet Erfolg für existierende Einstellungen', async () => {
      vi.spyOn(PaymentSettingsRepository.prototype, 'findById').mockResolvedValue(makeSettings());
      const service = new PaymentSettingsService(fakeAuth());

      const result = await service.testPaymentSettings('settings-1', 'club-1');

      expect(result.message).toContain('erfolgreich');
    });
  });
});
