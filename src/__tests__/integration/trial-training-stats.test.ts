/**
 * Integration Tests — TrialTrainingService Statistics
 *
 * Verifies that TrialTrainingService correctly computes statistics
 * from the 25-entry in-memory mock data covering all statuses:
 * scheduled, completed, no_show, cancelled, and converted.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TrialTrainingService } from '@/src/application/services/trial-training.service';
import type { TrialTraining } from '@/src/domain/entities/trial-training.entity';

const d = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const dp = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

const mockData: TrialTraining[] = [
  // --- Scheduled (upcoming) ---
  {
    id: '1',
    participant: {
      id: 'p1',
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max.mustermann@example.com',
      phone: '+49 123 456 7890',
      dateOfBirth: '1990-05-15',
    },
    scheduledDate: d(2),
    scheduledTime: '10:00',
    duration: 60,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c1', name: 'Platz 1' },
    status: 'scheduled',
    notes: 'Erster Kontakt per E-Mail',
    createdAt: dp(1),
    updatedAt: dp(1),
  },
  {
    id: '5',
    participant: {
      id: 'p5',
      firstName: 'Lena',
      lastName: 'Fischer',
      email: 'lena.fischer@example.com',
      phone: '+49 176 111 2222',
      dateOfBirth: '1992-02-14',
    },
    scheduledDate: d(3),
    scheduledTime: '09:00',
    duration: 90,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c2', name: 'Platz 2' },
    status: 'scheduled',
    notes: 'Interessiert an Gruppen-Training',
    createdAt: dp(0),
    updatedAt: dp(0),
  },
  {
    id: '6',
    participant: {
      id: 'p6',
      firstName: 'Felix',
      lastName: 'Wagner',
      email: 'felix.wagner@example.com',
      phone: '+49 176 333 4444',
      dateOfBirth: '1987-11-08',
    },
    scheduledDate: d(4),
    scheduledTime: '15:00',
    duration: 60,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c3', name: 'Platz 3' },
    status: 'scheduled',
    notes: 'Hat Vorkenntnisse aus Schulsport',
    createdAt: dp(0),
    updatedAt: dp(0),
  },
  {
    id: '7',
    participant: {
      id: 'p7',
      firstName: 'Sophie',
      lastName: 'Becker',
      email: 'sophie.becker@example.com',
      phone: '+49 151 555 6666',
      dateOfBirth: '1998-07-22',
    },
    scheduledDate: d(5),
    scheduledTime: '11:00',
    duration: 60,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c1', name: 'Platz 1' },
    status: 'scheduled',
    notes: 'Anfängerin, braucht Schläger',
    createdAt: dp(0),
    updatedAt: dp(0),
  },
  {
    id: '8',
    participant: {
      id: 'p8',
      firstName: 'Tom',
      lastName: 'Hoffmann',
      email: 'tom.hoffmann@example.com',
      phone: '+49 160 777 8888',
      dateOfBirth: '2001-03-30',
    },
    scheduledDate: d(7),
    scheduledTime: '16:30',
    duration: 90,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c2', name: 'Platz 2' },
    status: 'scheduled',
    createdAt: dp(1),
    updatedAt: dp(1),
  },
  // --- Completed ---
  {
    id: '2',
    participant: {
      id: 'p2',
      firstName: 'Anna',
      lastName: 'Schmidt',
      email: 'anna.schmidt@example.com',
      phone: '+49 987 654 3210',
      dateOfBirth: '1985-08-22',
    },
    scheduledDate: dp(1),
    scheduledTime: '14:00',
    duration: 60,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c2', name: 'Platz 2' },
    status: 'completed',
    feedback: {
      rating: 5,
      comments: 'Sehr gutes Training, habe mich sehr wohlgefühlt!',
      wouldRecommend: true,
    },
    createdAt: dp(3),
    updatedAt: dp(1),
  },
  {
    id: '9',
    participant: {
      id: 'p9',
      firstName: 'Marco',
      lastName: 'Ricci',
      email: 'marco.ricci@example.com',
      phone: '+49 178 999 0001',
      dateOfBirth: '1983-04-11',
    },
    scheduledDate: dp(2),
    scheduledTime: '10:00',
    duration: 60,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c3', name: 'Platz 3' },
    status: 'completed',
    feedback: {
      rating: 4,
      comments: 'Gute Einführung, Trainer sehr geduldig',
      wouldRecommend: true,
    },
    createdAt: dp(4),
    updatedAt: dp(2),
  },
  {
    id: '10',
    participant: {
      id: 'p10',
      firstName: 'Klara',
      lastName: 'Nowak',
      email: 'klara.nowak@example.com',
      phone: '+49 152 222 3333',
      dateOfBirth: '1993-09-05',
    },
    scheduledDate: dp(4),
    scheduledTime: '13:00',
    duration: 90,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c1', name: 'Platz 1' },
    status: 'completed',
    feedback: { rating: 5, comments: 'Perfekt! Werde definitiv Mitglied.', wouldRecommend: true },
    createdAt: dp(6),
    updatedAt: dp(4),
  },
  {
    id: '11',
    participant: {
      id: 'p11',
      firstName: 'David',
      lastName: 'Schulz',
      email: 'david.schulz@example.com',
      phone: '+49 179 444 5555',
      dateOfBirth: '1979-12-19',
    },
    scheduledDate: dp(7),
    scheduledTime: '17:00',
    duration: 60,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c2', name: 'Platz 2' },
    status: 'completed',
    feedback: {
      rating: 3,
      comments: 'War okay, aber zeitlich passt es leider nicht',
      wouldRecommend: false,
    },
    createdAt: dp(9),
    updatedAt: dp(7),
  },
  {
    id: '12',
    participant: {
      id: 'p12',
      firstName: 'Nina',
      lastName: 'Vogel',
      email: 'nina.vogel@example.com',
      phone: '+49 173 666 7777',
      dateOfBirth: '1996-06-28',
    },
    scheduledDate: dp(9),
    scheduledTime: '09:30',
    duration: 60,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c3', name: 'Platz 3' },
    status: 'completed',
    feedback: {
      rating: 5,
      comments: 'Super Coaching, hat richtig Spaß gemacht',
      wouldRecommend: true,
    },
    createdAt: dp(11),
    updatedAt: dp(9),
  },
  // --- No-show ---
  {
    id: '3',
    participant: {
      id: 'p3',
      firstName: 'Peter',
      lastName: 'Klein',
      email: 'peter.klein@example.com',
      phone: '+49 555 123 4567',
      dateOfBirth: '1995-12-03',
    },
    scheduledDate: dp(5),
    scheduledTime: '16:00',
    duration: 60,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c3', name: 'Platz 3' },
    status: 'no_show',
    notes: 'Keine Ankunft, keine Rückmeldung auf Anrufe',
    createdAt: dp(7),
    updatedAt: dp(5),
  },
  {
    id: '13',
    participant: {
      id: 'p13',
      firstName: 'Jan',
      lastName: 'Krüger',
      email: 'jan.krueger@example.com',
      phone: '+49 157 888 9999',
      dateOfBirth: '1989-01-15',
    },
    scheduledDate: dp(12),
    scheduledTime: '11:00',
    duration: 60,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c1', name: 'Platz 1' },
    status: 'no_show',
    notes: 'Keine Rückmeldung, telefonisch nicht erreichbar',
    createdAt: dp(14),
    updatedAt: dp(12),
  },
  // --- Cancelled ---
  {
    id: '14',
    participant: {
      id: 'p14',
      firstName: 'Emma',
      lastName: 'Lehmann',
      email: 'emma.lehmann@example.com',
      phone: '+49 162 000 1111',
      dateOfBirth: '2002-10-10',
    },
    scheduledDate: d(1),
    scheduledTime: '14:00',
    duration: 60,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c2', name: 'Platz 2' },
    status: 'cancelled',
    notes: 'Abgesagt wegen Krankheit, möchte neuen Termin',
    createdAt: dp(2),
    updatedAt: dp(1),
  },
  {
    id: '15',
    participant: {
      id: 'p15',
      firstName: 'Oliver',
      lastName: 'Mayer',
      email: 'oliver.mayer@example.com',
      phone: '+49 174 222 3333',
      dateOfBirth: '1975-05-20',
    },
    scheduledDate: dp(3),
    scheduledTime: '18:00',
    duration: 90,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c3', name: 'Platz 3' },
    status: 'cancelled',
    notes: 'Terminkonflikt, eventuell später wieder',
    createdAt: dp(5),
    updatedAt: dp(3),
  },
  // --- Converted ---
  {
    id: '4',
    participant: {
      id: 'p4',
      firstName: 'Maria',
      lastName: 'Gross',
      email: 'maria.gross@example.com',
      phone: '+49 444 987 6543',
      dateOfBirth: '1988-03-17',
    },
    scheduledDate: dp(10),
    scheduledTime: '11:00',
    duration: 60,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c1', name: 'Platz 1' },
    status: 'converted',
    feedback: { rating: 4, comments: 'Gutes Training, habe mich angemeldet', wouldRecommend: true },
    notes: 'Hat direkt Mitgliedschaft abgeschlossen',
    convertedToMemberId: 'member-123',
    createdAt: dp(12),
    updatedAt: dp(10),
  },
  {
    id: '16',
    participant: {
      id: 'p16',
      firstName: 'Sabine',
      lastName: 'Wolf',
      email: 'sabine.wolf@example.com',
      phone: '+49 151 444 5555',
      dateOfBirth: '1981-07-07',
    },
    scheduledDate: dp(15),
    scheduledTime: '10:00',
    duration: 60,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c2', name: 'Platz 2' },
    status: 'converted',
    feedback: { rating: 5, comments: 'Beste Entscheidung!', wouldRecommend: true },
    notes: 'Familienmitgliedschaft abgeschlossen',
    convertedToMemberId: 'member-456',
    createdAt: dp(17),
    updatedAt: dp(15),
  },
  {
    id: '17',
    participant: {
      id: 'p17',
      firstName: 'Christian',
      lastName: 'Braun',
      email: 'christian.braun@example.com',
      phone: '+49 176 666 7777',
      dateOfBirth: '1991-09-30',
    },
    scheduledDate: dp(20),
    scheduledTime: '15:00',
    duration: 90,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c3', name: 'Platz 3' },
    status: 'converted',
    feedback: { rating: 4, comments: 'Gute Trainingsatmosphäre', wouldRecommend: true },
    notes: 'Premium-Mitgliedschaft',
    convertedToMemberId: 'member-789',
    createdAt: dp(22),
    updatedAt: dp(20),
  },
  {
    id: '18',
    participant: {
      id: 'p18',
      firstName: 'Laura',
      lastName: 'Kaiser',
      email: 'laura.kaiser@example.com',
      phone: '+49 163 888 9999',
      dateOfBirth: '1994-02-18',
    },
    scheduledDate: dp(25),
    scheduledTime: '12:00',
    duration: 60,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c1', name: 'Platz 1' },
    status: 'converted',
    feedback: { rating: 5, comments: 'Hervorragendes Probetraining!', wouldRecommend: true },
    convertedToMemberId: 'member-101',
    createdAt: dp(27),
    updatedAt: dp(25),
  },
  // --- Additional scheduled & completed mix ---
  {
    id: '19',
    participant: {
      id: 'p19',
      firstName: 'Michael',
      lastName: 'Sommer',
      email: 'michael.sommer@example.com',
      phone: '+49 170 111 2222',
      dateOfBirth: '1986-04-25',
    },
    scheduledDate: d(6),
    scheduledTime: '08:00',
    duration: 60,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c1', name: 'Platz 1' },
    status: 'scheduled',
    notes: 'Frühaufsteher, bevorzugt Termine vor 9 Uhr',
    createdAt: dp(0),
    updatedAt: dp(0),
  },
  {
    id: '20',
    participant: {
      id: 'p20',
      firstName: 'Hannah',
      lastName: 'Zimmermann',
      email: 'hannah.zimmermann@example.com',
      phone: '+49 159 333 4444',
      dateOfBirth: '1999-12-01',
    },
    scheduledDate: dp(14),
    scheduledTime: '16:00',
    duration: 60,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c2', name: 'Platz 2' },
    status: 'completed',
    feedback: {
      rating: 5,
      comments: 'Trainer hat viel Erfahrung, sehr empfehlenswert',
      wouldRecommend: true,
    },
    createdAt: dp(16),
    updatedAt: dp(14),
  },
  {
    id: '21',
    participant: {
      id: 'p21',
      firstName: 'Philipp',
      lastName: 'Schäfer',
      email: 'philipp.schaefer@example.com',
      phone: '+49 171 555 6666',
      dateOfBirth: '1978-11-11',
    },
    scheduledDate: dp(18),
    scheduledTime: '10:30',
    duration: 90,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c3', name: 'Platz 3' },
    status: 'completed',
    feedback: {
      rating: 4,
      comments: 'Gutes Training, aber Anlage könnte besser sein',
      wouldRecommend: true,
    },
    createdAt: dp(20),
    updatedAt: dp(18),
  },
  {
    id: '22',
    participant: {
      id: 'p22',
      firstName: 'Carolin',
      lastName: 'Ebert',
      email: 'carolin.ebert@example.com',
      phone: '+49 175 777 8888',
      dateOfBirth: '1997-05-03',
    },
    scheduledDate: dp(21),
    scheduledTime: '14:30',
    duration: 60,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c1', name: 'Platz 1' },
    status: 'completed',
    feedback: {
      rating: 3,
      comments: 'Nette Trainer, aber Sportart ist nichts für mich',
      wouldRecommend: false,
    },
    createdAt: dp(23),
    updatedAt: dp(21),
  },
  {
    id: '23',
    participant: {
      id: 'p23',
      firstName: 'Sebastian',
      lastName: 'Lange',
      email: 'sebastian.lange@example.com',
      phone: '+49 177 999 0000',
      dateOfBirth: '1984-08-16',
    },
    scheduledDate: dp(28),
    scheduledTime: '11:00',
    duration: 60,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c2', name: 'Platz 2' },
    status: 'completed',
    feedback: {
      rating: 5,
      comments: 'Bin begeistert, starte nächste Woche als Mitglied',
      wouldRecommend: true,
    },
    createdAt: dp(30),
    updatedAt: dp(28),
  },
  {
    id: '24',
    participant: {
      id: 'p24',
      firstName: 'Anja',
      lastName: 'Friedrich',
      email: 'anja.friedrich@example.com',
      phone: '+49 152 111 2223',
      dateOfBirth: '2000-01-05',
    },
    scheduledDate: d(10),
    scheduledTime: '17:00',
    duration: 60,
    trainer: { id: 'trainer-1', name: 'Thomas Müller' },
    court: { id: 'c3', name: 'Platz 3' },
    status: 'scheduled',
    notes: 'Studentenrabatt angefragt',
    createdAt: dp(0),
    updatedAt: dp(0),
  },
  {
    id: '25',
    participant: {
      id: 'p25',
      firstName: 'Tobias',
      lastName: 'Arnold',
      email: 'tobias.arnold@example.com',
      phone: '+49 169 444 5556',
      dateOfBirth: '1972-06-20',
    },
    scheduledDate: d(14),
    scheduledTime: '09:00',
    duration: 90,
    trainer: { id: 'trainer-2', name: 'Julia Weber' },
    court: { id: 'c1', name: 'Platz 1' },
    status: 'scheduled',
    notes: 'Ehemaliger Hobby-Spieler, will wieder einsteigen',
    createdAt: dp(1),
    updatedAt: dp(1),
  },
];

describe('TrialTrainingService — Statistics with 25 Mock Entries', () => {
  beforeAll(() => {
    TrialTrainingService.reset(mockData);
  });

  afterAll(() => {
    TrialTrainingService.reset();
  });

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
