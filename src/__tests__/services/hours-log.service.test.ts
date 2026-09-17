/**
 * Unit tests for HoursLogService — Trainer-Teildomäne für ADR-005.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fakeAuth } from '../helpers/auth';
import { ApiException } from '@/lib/api-error';
import { HoursLogService } from '@/application/services/hours-log.service';
import { HoursLogRepository } from '@/infrastructure/persistence/repositories/hours-log.repository';
import type { HoursLog } from '@/infrastructure/persistence/repositories/hours-log.repository';

function makeLog(overrides: Partial<HoursLog> = {}): HoursLog {
  return {
    id: 'log-1',
    club_id: 'club-1',
    trainer_id: 'trainer-1',
    trainer_name: 'Anna Trainer',
    session_id: null,
    date: '2026-07-01',
    start_time: '10:00',
    end_time: '11:30',
    duration: 90,
    type: 'training',
    status: 'pending',
    notes: null,
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as HoursLog;
}

describe('HoursLogService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('approveHoursLog / rejectHoursLog', () => {
    it('wirft NOT_FOUND, wenn der Nachweis fehlt', async () => {
      vi.spyOn(HoursLogRepository.prototype, 'update').mockResolvedValue(null);
      const service = new HoursLogService(fakeAuth());

      await expect(service.approveHoursLog('missing', 'admin-1')).rejects.toBeInstanceOf(
        ApiException
      );
    });

    it('schreibt den Ablehnungsgrund beim Ablehnen', async () => {
      const update = vi
        .spyOn(HoursLogRepository.prototype, 'update')
        .mockImplementation(async (_id, input) => makeLog(input as Partial<HoursLog>));
      const service = new HoursLogService(fakeAuth());

      await service.rejectHoursLog('log-1', 'admin-1', 'Unklare Angaben');

      expect(update).toHaveBeenCalledWith(
        'log-1',
        expect.objectContaining({ status: 'rejected', rejection_reason: 'Unklare Angaben' })
      );
    });
  });

  describe('getSummaryForTrainer', () => {
    it('summiert Stunden nach Typ und Status', async () => {
      vi.spyOn(HoursLogRepository.prototype, 'findByTrainerId').mockResolvedValue([
        makeLog({ type: 'training', status: 'approved', duration: 60 }),
        makeLog({ type: 'meeting', status: 'pending', duration: 30 }),
      ]);
      const service = new HoursLogService(fakeAuth());

      const summary = await service.getSummaryForTrainer('trainer-1');

      expect(summary.totalHours).toBe(1.5);
      expect(summary.trainingHours).toBe(1);
      expect(summary.meetingHours).toBe(0.5);
      expect(summary.approvedHours).toBe(1);
      expect(summary.pendingHours).toBe(0.5);
    });
  });
});
