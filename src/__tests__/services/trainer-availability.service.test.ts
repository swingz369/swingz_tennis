/**
 * Unit tests for TrainerAvailabilityService — Trainer-Teildomäne für ADR-005.
 *
 * Mockt TrainerAvailabilityRepository. Deckt die Konfliktermittlung ab
 * (Gruppierung nach Trainer+Datum, Zeitüberschneidung), die zuvor nur in
 * einer nie befüllten In-Memory-Implementierung existierte.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fakeAuth } from '../helpers/auth';
import { ApiException } from '@/lib/api-error';
import { TrainerAvailabilityService } from '@/application/services/trainer-availability.service';
import { TrainerAvailabilityRepository } from '@/infrastructure/persistence/repositories/trainer-availability.repository';
import type { TrainerAvailability } from '@/infrastructure/persistence/repositories/trainer-availability.repository';

function makeSlot(overrides: Partial<TrainerAvailability> = {}): TrainerAvailability {
  return {
    id: 'slot-1',
    trainer_id: 'trainer-1',
    date: '2026-07-01',
    start_time: '10:00',
    end_time: '12:00',
    status: 'available',
    notes: null,
    recurring_pattern: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as TrainerAvailability;
}

describe('TrainerAvailabilityService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAvailabilityConflicts', () => {
    it('findet eine Überschneidung zweier Slots desselben Trainers am selben Tag', async () => {
      vi.spyOn(TrainerAvailabilityRepository.prototype, 'findByDateRange').mockResolvedValue([
        makeSlot({ id: 'a', start_time: '10:00', end_time: '12:00' }),
        makeSlot({ id: 'b', start_time: '11:00', end_time: '13:00' }),
      ]);
      const service = new TrainerAvailabilityService(fakeAuth());

      const conflicts = await service.getAvailabilityConflicts('2026-07-01', '2026-07-01');

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflictingWith).toEqual(['a', 'b']);
    });

    it('meldet keinen Konflikt für nicht überlappende Slots', async () => {
      vi.spyOn(TrainerAvailabilityRepository.prototype, 'findByDateRange').mockResolvedValue([
        makeSlot({ id: 'a', start_time: '10:00', end_time: '11:00' }),
        makeSlot({ id: 'b', start_time: '11:00', end_time: '12:00' }),
      ]);
      const service = new TrainerAvailabilityService(fakeAuth());

      const conflicts = await service.getAvailabilityConflicts('2026-07-01', '2026-07-01');

      expect(conflicts).toEqual([]);
    });

    it('gruppiert getrennt nach Trainer — kein Konflikt zwischen verschiedenen Trainern', async () => {
      vi.spyOn(TrainerAvailabilityRepository.prototype, 'findByDateRange').mockResolvedValue([
        makeSlot({ id: 'a', trainer_id: 'trainer-1', start_time: '10:00', end_time: '12:00' }),
        makeSlot({ id: 'b', trainer_id: 'trainer-2', start_time: '10:00', end_time: '12:00' }),
      ]);
      const service = new TrainerAvailabilityService(fakeAuth());

      const conflicts = await service.getAvailabilityConflicts('2026-07-01', '2026-07-01');

      expect(conflicts).toEqual([]);
    });
  });

  describe('getTrainerAvailabilityById', () => {
    it('wirft NOT_FOUND, wenn der Slot fehlt', async () => {
      vi.spyOn(TrainerAvailabilityRepository.prototype, 'findById').mockResolvedValue(null);
      const service = new TrainerAvailabilityService(fakeAuth());

      await expect(service.getTrainerAvailabilityById('missing')).rejects.toBeInstanceOf(
        ApiException
      );
    });
  });
});
