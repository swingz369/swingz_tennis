/**
 * Unit tests for AbsenceService — Trainer-Teildomäne für ADR-005.
 *
 * Mockt AbsenceRepository (vi.spyOn auf dem Prototyp). Deckt die
 * Fachlogik ab, die zuvor ungetestet war: die Konfliktsperre gegen
 * überlappende genehmigte Abwesenheiten.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fakeAuth } from '../helpers/auth';
import { AbsenceService } from '@/application/services/absence.service';
import { AbsenceRepository } from '@/infrastructure/persistence/repositories/absence.repository';
import type { Absence } from '@/infrastructure/persistence/repositories/absence.repository';

function makeAbsence(overrides: Partial<Absence> = {}): Absence {
  return {
    id: 'absence-1',
    club_id: 'club-1',
    trainer_id: 'trainer-1',
    trainer_name: 'Anna Trainer',
    type: 'vacation',
    start_date: '2026-07-01',
    end_date: '2026-07-10',
    status: 'pending',
    reason: null,
    notes: null,
    approved_by: null,
    approved_at: null,
    substitute_trainer_id: null,
    user_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as Absence;
}

const validInput = {
  trainerId: 'trainer-1',
  trainerName: 'Anna Trainer',
  type: 'vacation' as const,
  startDate: '2026-07-01',
  endDate: '2026-07-10',
};

describe('AbsenceService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAbsence', () => {
    it('lehnt eine Anfrage ab, die eine genehmigte Abwesenheit überschneidet', async () => {
      vi.spyOn(AbsenceRepository.prototype, 'findConflicting').mockResolvedValue([makeAbsence()]);
      const service = new AbsenceService(fakeAuth());

      await expect(service.createAbsence(validInput, 'club-1')).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('legt die Abwesenheit an, wenn kein Konflikt besteht', async () => {
      vi.spyOn(AbsenceRepository.prototype, 'findConflicting').mockResolvedValue([]);
      const create = vi
        .spyOn(AbsenceRepository.prototype, 'create')
        .mockImplementation(async (input) => makeAbsence(input as Partial<Absence>));
      const service = new AbsenceService(fakeAuth());

      const result = await service.createAbsence(validInput, 'club-1');

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ club_id: 'club-1' }));
      expect(result.trainer_id).toBe('trainer-1');
    });
  });

  describe('updateAbsence', () => {
    it('prüft auf Konflikte, wenn sich die Daten ändern', async () => {
      vi.spyOn(AbsenceRepository.prototype, 'findById').mockResolvedValue(makeAbsence());
      const findConflicting = vi
        .spyOn(AbsenceRepository.prototype, 'findConflicting')
        .mockResolvedValue([makeAbsence({ id: 'other' })]);
      const service = new AbsenceService(fakeAuth());

      await expect(
        service.updateAbsence('absence-1', { startDate: '2026-08-01' }, 'club-1')
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(findConflicting).toHaveBeenCalledWith(
        'trainer-1',
        '2026-08-01',
        '2026-07-10',
        'club-1',
        'absence-1'
      );
    });

    it('prüft NICHT auf Konflikte, wenn nur der Status auf rejected wechselt', async () => {
      vi.spyOn(AbsenceRepository.prototype, 'findById').mockResolvedValue(makeAbsence());
      const findConflicting = vi.spyOn(AbsenceRepository.prototype, 'findConflicting');
      vi.spyOn(AbsenceRepository.prototype, 'update').mockResolvedValue(
        makeAbsence({ status: 'rejected' })
      );
      const service = new AbsenceService(fakeAuth());

      await service.updateAbsence(
        'absence-1',
        { startDate: '2026-08-01', status: 'rejected' },
        'club-1'
      );

      expect(findConflicting).not.toHaveBeenCalled();
    });

    it('wirft NOT_FOUND, wenn die Abwesenheit fehlt', async () => {
      vi.spyOn(AbsenceRepository.prototype, 'findById').mockResolvedValue(null);
      const service = new AbsenceService(fakeAuth());

      await expect(
        service.updateAbsence('missing', { notes: 'x' }, 'club-1')
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('rejectAbsence', () => {
    it('schreibt den Ablehnungsgrund mit', async () => {
      const update = vi
        .spyOn(AbsenceRepository.prototype, 'update')
        .mockImplementation(async (id, input) => makeAbsence(input as Partial<Absence>));
      const service = new AbsenceService(fakeAuth());

      await service.rejectAbsence('absence-1', 'admin-1', 'club-1', 'Zu viele Anfragen');

      expect(update).toHaveBeenCalledWith(
        'absence-1',
        expect.objectContaining({ status: 'rejected', reason: 'Zu viele Anfragen' }),
        'club-1'
      );
    });
  });
});
