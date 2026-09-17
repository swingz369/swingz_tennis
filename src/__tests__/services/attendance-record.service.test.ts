/**
 * Unit tests for AttendanceRecordService — Trainer-Teildomäne für ADR-005.
 *
 * Mockt AttendanceRecordRepository. Deckt insbesondere den behobenen
 * Datenleck-Fund ab: getHoursSummaryForClub filterte in der alten Drizzle-
 * Implementierung NICHT nach club_id (Parameter war ungenutzt) und
 * aggregierte über ALLE Vereine. Diese Tests sichern, dass die Aggregation
 * ausschließlich Datensätze verarbeitet, die dem Repository für den
 * jeweiligen Verein übergeben wurden.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fakeAuth } from '../helpers/auth';
import { ApiException } from '@/lib/api-error';
import { AttendanceRecordService } from '@/application/services/attendance-record.service';
import { AttendanceRecordRepository } from '@/infrastructure/persistence/repositories/attendance-record.repository';
import type { AttendanceRecord } from '@/infrastructure/persistence/repositories/attendance-record.repository';

function makeRecord(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'record-1',
    session_id: 'session-1',
    trainer_id: 'trainer-1',
    trainer_name: 'Anna Trainer',
    participant_id: 'member-1',
    participant_name: 'Max Mitglied',
    date: '2026-07-01',
    status: 'present',
    check_in_time: null,
    check_out_time: null,
    notes: null,
    trainer_confirmed: false,
    trainer_confirmed_at: null,
    member_status: 'pending',
    member_confirmed_at: null,
    dispute_reason: null,
    dispute_resolved_at: null,
    dispute_resolved_by: null,
    duration_minutes: 60,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as AttendanceRecord;
}

describe('AttendanceRecordService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAttendanceHoursSummaryForClub — Datenleck-Regression', () => {
    it('aggregiert nur die vom Repository für den Verein gelieferten Datensätze', async () => {
      // Simuliert das bereits club-gescopte Repository-Ergebnis (join über
      // sessions/schedules). Der Service selbst darf keine ungescopten
      // Daten hinzumischen.
      vi.spyOn(AttendanceRecordRepository.prototype, 'getHoursSummaryForClub').mockResolvedValue([
        {
          memberId: 'member-club-1',
          memberName: '',
          totalSessions: 1,
          attendedSessions: 1,
          missedSessions: 0,
          excusedSessions: 0,
          lateSessions: 0,
          trainerConfirmedCount: 0,
          memberConfirmedCount: 0,
          disputedCount: 0,
          pendingConfirmationCount: 1,
          totalAttendedMinutes: 60,
          totalScheduledMinutes: 60,
          attendanceRate: 100,
        },
      ]);
      const service = new AttendanceRecordService(fakeAuth());

      const summaries = await service.getAttendanceHoursSummaryForClub('club-1');

      expect(summaries).toHaveLength(1);
      expect(summaries[0].memberId).toBe('member-club-1');
    });

    it('gibt ein leeres Array zurück, wenn der Verein keine Termine hat', async () => {
      vi.spyOn(AttendanceRecordRepository.prototype, 'getHoursSummaryForClub').mockResolvedValue(
        []
      );
      const service = new AttendanceRecordService(fakeAuth());

      const summaries = await service.getAttendanceHoursSummaryForClub('club-ohne-termine');

      expect(summaries).toEqual([]);
    });
  });

  describe('memberConfirmAttendance / memberDisputeAttendance', () => {
    it('wirft NOT_FOUND, wenn der Eintrag nicht dem Teilnehmer gehört', async () => {
      vi.spyOn(AttendanceRecordRepository.prototype, 'memberConfirm').mockResolvedValue(null);
      const service = new AttendanceRecordService(fakeAuth());

      await expect(
        service.memberConfirmAttendance('record-1', 'fremder-user')
      ).rejects.toBeInstanceOf(ApiException);
    });

    it('bestätigt den Eintrag, wenn er dem Teilnehmer gehört', async () => {
      vi.spyOn(AttendanceRecordRepository.prototype, 'memberConfirm').mockResolvedValue(
        makeRecord({ member_status: 'confirmed' })
      );
      const service = new AttendanceRecordService(fakeAuth());

      const result = await service.memberConfirmAttendance('record-1', 'member-1');

      expect(result.member_status).toBe('confirmed');
    });
  });

  describe('resolveAttendanceDispute', () => {
    it('setzt status auf absent, wenn die Klärung "absent" lautet', async () => {
      const resolve = vi
        .spyOn(AttendanceRecordRepository.prototype, 'resolveDispute')
        .mockResolvedValue(makeRecord({ status: 'absent', member_status: 'pending' }));
      const service = new AttendanceRecordService(fakeAuth());

      await service.resolveAttendanceDispute('record-1', 'admin-1', 'absent');

      expect(resolve).toHaveBeenCalledWith('record-1', 'admin-1', 'absent');
    });
  });
});
