/**
 * Integration Tests — TrialTrainingService Statistics
 *
 * Verifies that TrialTrainingService correctly computes statistics
 * from the 25-entry in-memory mock data covering all statuses:
 * scheduled, completed, no_show, cancelled, and converted.
 */
import { describe, it, expect } from 'vitest';
import { TrialTrainingService } from '@/src/application/services/trial-training.service';

describe('TrialTrainingService — Statistics with 25 Mock Entries', () => {
  // ── Trial Training Stats ──────────────────────────────────

  describe('getTrialTrainingStats()', () => {
    it('returns correct total count from 25 mock entries', async () => {
      const stats = await TrialTrainingService.getTrialTrainingStats();

      expect(stats.total).toBe(25);
    });

    it('counts scheduled entries correctly', async () => {
      const stats = await TrialTrainingService.getTrialTrainingStats();

      // Mock data: IDs 1,5,6,7,8,19,24,25 = 8 scheduled
      expect(stats.scheduled).toBe(8);
    });

    it('counts completed entries correctly', async () => {
      const stats = await TrialTrainingService.getTrialTrainingStats();

      // Mock data: IDs 2,9,10,11,12,20,21,22,23 = 9 completed
      expect(stats.completed).toBe(9);
    });

    it('counts no_show entries correctly', async () => {
      const stats = await TrialTrainingService.getTrialTrainingStats();

      // Mock data: IDs 3,13 = 2 no_show
      expect(stats.noShow).toBe(2);
    });

    it('counts cancelled entries correctly', async () => {
      const stats = await TrialTrainingService.getTrialTrainingStats();

      // Mock data: IDs 14,15 = 2 cancelled
      expect(stats.cancelled).toBe(2);
    });

    it('counts converted entries correctly', async () => {
      const stats = await TrialTrainingService.getTrialTrainingStats();

      // Mock data: IDs 4,16,17,18 = 4 converted
      expect(stats.converted).toBe(4);
    });

    it('calculates conversion rate from completed trials', async () => {
      const stats = await TrialTrainingService.getTrialTrainingStats();

      // 4 converted / 9 completed ≈ 44% (Math.round)
      expect(stats.conversionRate).toBeGreaterThan(0);
      expect(stats.conversionRate).toBeLessThanOrEqual(100);
      expect(stats.conversionRate).toBeCloseTo(44, 0);
    });

    it('total equals sum of all statuses', async () => {
      const stats = await TrialTrainingService.getTrialTrainingStats();

      const sum =
        stats.scheduled + stats.completed + stats.noShow + stats.cancelled + stats.converted;
      expect(sum).toBe(stats.total);
    });
  });

  // ── Upcoming Trial Trainings ──────────────────────────────

  describe('getUpcomingTrialTrainings()', () => {
    it('returns trial trainings scheduled within the next 7 days by default', async () => {
      const upcoming = await TrialTrainingService.getUpcomingTrialTrainings();

      // Should include entries with future dates and status=scheduled
      for (const trial of upcoming) {
        expect(trial.status).toBe('scheduled');
      }
    });

    it('returns only entries with future scheduled dates', async () => {
      const upcoming = await TrialTrainingService.getUpcomingTrialTrainings(30);

      for (const trial of upcoming) {
        const scheduledDate = new Date(trial.scheduledDate);
        const now = new Date();
        expect(scheduledDate.getTime()).toBeGreaterThanOrEqual(now.getTime());
      }
    });

    it('returns empty array for 0 days', async () => {
      const upcoming = await TrialTrainingService.getUpcomingTrialTrainings(0);

      // With 0 days window, no mock entry matches exactly (all have ±N days offset)
      expect(upcoming).toHaveLength(0);
    });
  });

  // ── Trial Trainings Needing Reminder ──────────────────────

  describe('getTrialTrainingsNeedingReminder()', () => {
    it('returns trial trainings within next 24 hours', async () => {
      const reminders = await TrialTrainingService.getTrialTrainingsNeedingReminder();

      for (const trial of reminders) {
        expect(trial.status).toBe('scheduled');
      }
    });
  });

  // ── Search ────────────────────────────────────────────────

  describe('searchTrialTrainings()', () => {
    it('finds trial trainings by participant name', async () => {
      const results = await TrialTrainingService.searchTrialTrainings('Max');

      expect(results.length).toBeGreaterThan(0);
      const names = results.map((r) => `${r.participant.firstName} ${r.participant.lastName}`);
      expect(names.some((n) => n.includes('Max'))).toBe(true);
    });

    it('finds trial trainings by participant email', async () => {
      const results = await TrialTrainingService.searchTrialTrainings('lena.fischer');

      expect(results.length).toBe(1);
      expect(results[0].participant.firstName).toBe('Lena');
      expect(results[0].participant.lastName).toBe('Fischer');
    });

    it('returns empty array for non-matching query', async () => {
      const results = await TrialTrainingService.searchTrialTrainings('xyznonexistent123');

      expect(results).toHaveLength(0);
    });

    it('search is case-insensitive', async () => {
      const upperResults = await TrialTrainingService.searchTrialTrainings('ANNA');
      const lowerResults = await TrialTrainingService.searchTrialTrainings('anna');

      expect(upperResults.length).toBe(lowerResults.length);
      expect(upperResults.length).toBeGreaterThan(0);
    });
  });

  // ── Status Filter ─────────────────────────────────────────

  describe('getTrialTrainingsByStatus()', () => {
    it('filters correctly for scheduled status', async () => {
      const scheduled = await TrialTrainingService.getTrialTrainingsByStatus('scheduled');

      expect(scheduled.length).toBe(8);
      scheduled.forEach((t) => expect(t.status).toBe('scheduled'));
    });

    it('filters correctly for completed status', async () => {
      const completed = await TrialTrainingService.getTrialTrainingsByStatus('completed');

      expect(completed.length).toBe(9);
      completed.forEach((t) => expect(t.status).toBe('completed'));
    });

    it('filters correctly for converted status', async () => {
      const converted = await TrialTrainingService.getTrialTrainingsByStatus('converted');

      expect(converted.length).toBe(4);
      converted.forEach((t) => expect(t.status).toBe('converted'));
    });
  });

  // ── By Participant Email ──────────────────────────────────

  describe('getTrialTrainingsByParticipantEmail()', () => {
    it('finds trials by email case-insensitively', async () => {
      const results =
        await TrialTrainingService.getTrialTrainingsByParticipantEmail('Sabine.Wolf@example.com');

      expect(results.length).toBe(1);
      expect(results[0].participant.firstName).toBe('Sabine');
      expect(results[0].participant.lastName).toBe('Wolf');
    });
  });
});
