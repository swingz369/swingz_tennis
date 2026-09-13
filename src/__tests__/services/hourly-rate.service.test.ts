/**
 * Unit tests for HourlyRateService — die Referenzdomäne für Option B (ADR-005).
 *
 * Mockt HourlyRateRepository (vi.spyOn auf dem Prototyp, da der Service sein
 * Repository selbst konstruiert). Kein DB-Zugriff nötig; deckt die
 * Fachlogik ab, die bei einer echten Datenbank am schwersten zu beobachten
 * wäre: den Effektivsatz und wann ein Historieneintrag entsteht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { HourlyRateService } from '@/application/services/hourly-rate.service';
import { HourlyRateRepository } from '@/infrastructure/persistence/repositories/hourly-rate.repository';
import type { TrainerHourlyRate } from '@/infrastructure/persistence/repositories/hourly-rate.repository';

function fakeAuth(): AuthContext {
  return {
    user: { id: 'user-1' } as AuthContext['user'],
    session: null,
    supabase: {} as AuthContext['supabase'],
    clubId: 'club-1',
    role: 'admin',
    roles: ['admin'],
    memberships: [{ club_id: 'club-1', role: 'admin' }],
  };
}

function makeTrainerRate(overrides: Partial<TrainerHourlyRate> = {}): TrainerHourlyRate {
  return {
    id: 'rate-1',
    club_id: 'club-1',
    trainer_id: 'trainer-1',
    trainer_name: 'Anna Trainer',
    base_rate: 30,
    override_rate: null,
    effective_rate: 30,
    valid_from: '2026-01-01',
    valid_until: null,
    reason: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as TrainerHourlyRate;
}

describe('HourlyRateService', () => {
  let service: HourlyRateService;

  beforeEach(() => {
    service = new HourlyRateService(fakeAuth());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTrainerRate — Effektivsatz', () => {
    it('nutzt override_rate als Effektivsatz, wenn gesetzt', async () => {
      const create = vi
        .spyOn(HourlyRateRepository.prototype, 'createTrainerRate')
        .mockImplementation(async (input) => makeTrainerRate(input as Partial<TrainerHourlyRate>));

      await service.createTrainerRate('club-1', {
        trainer_id: 't1',
        trainer_name: 'Anna',
        base_rate: 30,
        override_rate: 40,
        valid_from: '2026-01-01',
      });

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ effective_rate: 40 }));
    });

    it('fällt auf base_rate zurück, wenn kein override_rate gesetzt ist', async () => {
      const create = vi
        .spyOn(HourlyRateRepository.prototype, 'createTrainerRate')
        .mockImplementation(async (input) => makeTrainerRate(input as Partial<TrainerHourlyRate>));

      await service.createTrainerRate('club-1', {
        trainer_id: 't1',
        trainer_name: 'Anna',
        base_rate: 30,
        valid_from: '2026-01-01',
      });

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ effective_rate: 30 }));
    });
  });

  describe('updateTrainerRate — Historie', () => {
    it('schreibt einen Historieneintrag, wenn sich der Effektivsatz ändert', async () => {
      vi.spyOn(HourlyRateRepository.prototype, 'findTrainerRateById').mockResolvedValue(
        makeTrainerRate({ effective_rate: 30 })
      );
      vi.spyOn(HourlyRateRepository.prototype, 'updateTrainerRate').mockImplementation(
        async (id, input) => makeTrainerRate(input as Partial<TrainerHourlyRate>)
      );
      const addHistory = vi
        .spyOn(HourlyRateRepository.prototype, 'addHistoryEntry')
        .mockResolvedValue({} as never);

      await service.updateTrainerRate('rate-1', 'admin-1', { override_rate: 45 });

      expect(addHistory).toHaveBeenCalledWith(
        expect.objectContaining({ old_rate: 30, new_rate: 45 })
      );
    });

    it('schreibt keinen Historieneintrag, wenn sich der Effektivsatz nicht ändert', async () => {
      vi.spyOn(HourlyRateRepository.prototype, 'findTrainerRateById').mockResolvedValue(
        makeTrainerRate({ effective_rate: 30, base_rate: 30 })
      );
      vi.spyOn(HourlyRateRepository.prototype, 'updateTrainerRate').mockImplementation(
        async (id, input) => makeTrainerRate(input as Partial<TrainerHourlyRate>)
      );
      const addHistory = vi
        .spyOn(HourlyRateRepository.prototype, 'addHistoryEntry')
        .mockResolvedValue({} as never);

      // Nur der Grund ändert sich sich, der Satz bleibt bei base_rate (30)
      await service.updateTrainerRate('rate-1', 'admin-1', { reason: 'Notiz' });

      expect(addHistory).not.toHaveBeenCalled();
    });

    it('wirft NOT_FOUND, wenn der Trainer-Stundensatz nicht existiert', async () => {
      vi.spyOn(HourlyRateRepository.prototype, 'findTrainerRateById').mockResolvedValue(null);

      await expect(
        service.updateTrainerRate('missing', 'admin-1', { override_rate: 40 })
      ).rejects.toThrow(ApiException);
    });
  });

  describe('getTierById / getTrainerRateById — Not Found', () => {
    it('wirft ApiException NOT_FOUND, wenn die Tarifstufe fehlt', async () => {
      vi.spyOn(HourlyRateRepository.prototype, 'findTierById').mockResolvedValue(null);

      await expect(service.getTierById('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('gibt die Tarifstufe zurück, wenn sie existiert', async () => {
      vi.spyOn(HourlyRateRepository.prototype, 'findTierById').mockResolvedValue({
        id: 'tier-1',
      } as never);

      const result = await service.getTierById('tier-1');

      expect(result.id).toBe('tier-1');
    });
  });
});
