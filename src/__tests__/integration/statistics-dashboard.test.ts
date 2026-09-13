/**
 * Integration Tests — StatisticsService & Dashboard Metrics
 *
 * Verifies that the StatisticsService correctly computes statistics from
 * the in-memory mock data across MemberService, HoursLogService, and
 * TrialTrainingService. The BillingService adapter and FeatureFlags
 * are mocked to ensure in-memory data paths are used.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock hours-log repository (ADR-005: StatisticsService liest jetzt über
//    HoursLogRepository + systemDb, nicht mehr über den gelöschten Drizzle-
//    Adapter). Feldnamen snake_case, wie Tables<'hours_logs'> sie liefert.
vi.mock('@/infrastructure/persistence/repositories/hours-log.repository', () => {
  const now = Date.now();
  const d = (days: number) => new Date(now + days * 86400000).toISOString();

  const hoursLogs = [
    {
      id: 'hours-1',
      trainer_id: 'trainer-1',
      trainer_name: 'Thomas Müller',
      session_id: 'session-1',
      date: new Date(now).toISOString().split('T')[0],
      start_time: '09:00',
      end_time: '10:00',
      duration: 60,
      type: 'training' as const,
      status: 'approved' as const,
      approved_by: 'Admin',
      approved_at: d(-1),
      notes: 'Anfänger-Grundlagentraining',
      rejection_reason: null,
      created_at: d(-2),
      updated_at: d(-1),
    },
    {
      id: 'hours-2',
      trainer_id: 'trainer-1',
      trainer_name: 'Thomas Müller',
      session_id: 'session-2',
      date: new Date(now).toISOString().split('T')[0],
      start_time: '10:00',
      end_time: '11:30',
      duration: 90,
      type: 'training' as const,
      status: 'pending' as const,
      approved_by: null,
      approved_at: null,
      notes: 'Gruppentraining Fortgeschrittene',
      rejection_reason: null,
      created_at: d(-2),
      updated_at: d(-1),
    },
    {
      id: 'hours-3',
      trainer_id: 'trainer-1',
      trainer_name: 'Thomas Müller',
      session_id: 'session-4',
      date: new Date(now).toISOString().split('T')[0],
      start_time: '14:00',
      end_time: '15:30',
      duration: 90,
      type: 'training' as const,
      status: 'pending' as const,
      approved_by: null,
      approved_at: null,
      notes: 'Technik-Einheit Vorhand',
      rejection_reason: null,
      created_at: d(-2),
      updated_at: d(-1),
    },
    {
      id: 'hours-7',
      trainer_id: 'trainer-2',
      trainer_name: 'Julia Weber',
      session_id: 'session-3',
      date: new Date(now).toISOString().split('T')[0],
      start_time: '14:00',
      end_time: '15:00',
      duration: 60,
      type: 'training' as const,
      status: 'approved' as const,
      approved_by: 'Admin',
      approved_at: d(-1),
      notes: 'Probetraining',
      rejection_reason: null,
      created_at: d(-2),
      updated_at: d(-1),
    },
    {
      id: 'hours-8',
      trainer_id: 'trainer-2',
      trainer_name: 'Julia Weber',
      session_id: 'session-7',
      date: new Date(now).toISOString().split('T')[0],
      start_time: '15:00',
      end_time: '16:00',
      duration: 60,
      type: 'training' as const,
      status: 'approved' as const,
      approved_by: 'Admin',
      approved_at: d(-1),
      notes: 'Wettkampfvorbereitung Einzel',
      rejection_reason: null,
      created_at: d(-2),
      updated_at: d(-1),
    },
    {
      id: 'hours-12',
      trainer_id: 'trainer-3',
      trainer_name: 'David Kruse',
      session_id: 'session-9',
      date: new Date(now).toISOString().split('T')[0],
      start_time: '08:00',
      end_time: '09:00',
      duration: 60,
      type: 'training' as const,
      status: 'approved' as const,
      approved_by: 'Admin',
      approved_at: d(-1),
      notes: 'Jugendtraining U12',
      rejection_reason: null,
      created_at: d(-2),
      updated_at: d(-1),
    },
    {
      id: 'hours-13',
      trainer_id: 'trainer-3',
      trainer_name: 'David Kruse',
      session_id: 'session-10',
      date: new Date(now).toISOString().split('T')[0],
      start_time: '09:00',
      end_time: '10:30',
      duration: 90,
      type: 'training' as const,
      status: 'approved' as const,
      approved_by: 'Admin',
      approved_at: d(-1),
      notes: 'Jugendtraining U16',
      rejection_reason: null,
      created_at: d(-2),
      updated_at: d(-1),
    },
    {
      id: 'hours-15',
      trainer_id: 'trainer-4',
      trainer_name: 'Sabine Frost',
      session_id: 'session-11',
      date: new Date(now).toISOString().split('T')[0],
      start_time: '11:00',
      end_time: '12:00',
      duration: 60,
      type: 'training' as const,
      status: 'approved' as const,
      approved_by: 'Admin',
      approved_at: d(-1),
      notes: 'Senioren-Fitness',
      rejection_reason: null,
      created_at: d(-2),
      updated_at: d(-1),
    },
    {
      id: 'hours-16',
      trainer_id: 'trainer-4',
      trainer_name: 'Sabine Frost',
      session_id: 'session-12',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      start_time: '08:00',
      end_time: '09:30',
      duration: 90,
      type: 'training' as const,
      status: 'approved' as const,
      approved_by: 'Admin',
      approved_at: d(-1),
      notes: null,
      rejection_reason: null,
      created_at: d(-3),
      updated_at: d(-1),
    },
    {
      id: 'hours-5',
      trainer_id: 'trainer-5',
      trainer_name: 'Ahmed Al-Rashid',
      session_id: 'session-13',
      date: new Date(now).toISOString().split('T')[0],
      start_time: '16:00',
      end_time: '17:00',
      duration: 60,
      type: 'training' as const,
      status: 'approved' as const,
      approved_by: 'Admin',
      approved_at: d(-1),
      notes: 'Einzeltraining',
      rejection_reason: null,
      created_at: d(-2),
      updated_at: d(-1),
    },
  ];

  return {
    HoursLogRepository: class {
      findAll = vi.fn().mockResolvedValue(hoursLogs);
      findByTrainerId = vi.fn().mockResolvedValue([]);
      findById = vi.fn().mockResolvedValue(null);
      create = vi.fn();
      update = vi.fn();
      delete = vi.fn();
      getSummaryForTrainer = vi.fn();
    },
  };
});

// ── Mock trial-training repository (ADR-005: StatisticsService liest jetzt
//    über TrialTrainingRepository.findAllAcrossClubs() + systemDb, nicht mehr
//    über den gelöschten Adapter) ──
vi.mock('@/infrastructure/persistence/repositories/trial-training.repository', () => {
  const now = Date.now();
  const dp = (days: number) => new Date(now - days * 86400000).toISOString();

  const trialTrainings = [
    {
      id: '1',
      participant: {
        id: 'p1',
        firstName: 'Max',
        lastName: 'Mustermann',
        email: 'max@example.com',
        phone: '+49 123',
        dateOfBirth: '1990-05-15',
      },
      scheduledDate: new Date(now + 2 * 86400000).toISOString().split('T')[0],
      scheduledTime: '10:00',
      duration: 60,
      trainer: { id: 'trainer-1', name: 'Thomas Müller' },
      court: { id: 'c1', name: 'Platz 1' },
      status: 'scheduled' as const,
      createdAt: dp(1),
      updatedAt: dp(1),
    },
    {
      id: '2',
      participant: {
        id: 'p2',
        firstName: 'Anna',
        lastName: 'Schmidt',
        email: 'anna@example.com',
        phone: '+49 987',
        dateOfBirth: '1985-08-22',
      },
      scheduledDate: new Date(now - 86400000).toISOString().split('T')[0],
      scheduledTime: '14:00',
      duration: 60,
      trainer: { id: 'trainer-2', name: 'Julia Weber' },
      court: { id: 'c2', name: 'Platz 2' },
      status: 'completed' as const,
      feedback: { rating: 5, comments: 'Gut!', wouldRecommend: true },
      createdAt: dp(3),
      updatedAt: dp(1),
    },
    {
      id: '3',
      participant: {
        id: 'p3',
        firstName: 'Peter',
        lastName: 'Klein',
        email: 'peter@example.com',
        phone: '+49 555',
        dateOfBirth: '1995-12-03',
      },
      scheduledDate: new Date(now - 5 * 86400000).toISOString().split('T')[0],
      scheduledTime: '16:00',
      duration: 60,
      trainer: { id: 'trainer-1', name: 'Thomas Müller' },
      court: { id: 'c3', name: 'Platz 3' },
      status: 'no_show' as const,
      createdAt: dp(7),
      updatedAt: dp(5),
    },
    {
      id: '4',
      participant: {
        id: 'p4',
        firstName: 'Maria',
        lastName: 'Gross',
        email: 'maria@example.com',
        phone: '+49 444',
        dateOfBirth: '1988-03-17',
      },
      scheduledDate: new Date(now - 10 * 86400000).toISOString().split('T')[0],
      scheduledTime: '11:00',
      duration: 60,
      trainer: { id: 'trainer-2', name: 'Julia Weber' },
      court: { id: 'c1', name: 'Platz 1' },
      status: 'converted' as const,
      feedback: { rating: 4, comments: 'OK', wouldRecommend: true },
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
        email: 'sabine@example.com',
        phone: '+49 151',
        dateOfBirth: '1981-07-07',
      },
      scheduledDate: new Date(now - 15 * 86400000).toISOString().split('T')[0],
      scheduledTime: '10:00',
      duration: 60,
      trainer: { id: 'trainer-1', name: 'Thomas Müller' },
      court: { id: 'c2', name: 'Platz 2' },
      status: 'converted' as const,
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
        email: 'christian@example.com',
        phone: '+49 176',
        dateOfBirth: '1991-09-30',
      },
      scheduledDate: new Date(now - 20 * 86400000).toISOString().split('T')[0],
      scheduledTime: '15:00',
      duration: 90,
      trainer: { id: 'trainer-2', name: 'Julia Weber' },
      court: { id: 'c3', name: 'Platz 3' },
      status: 'converted' as const,
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
        email: 'laura@example.com',
        phone: '+49 163',
        dateOfBirth: '1994-02-18',
      },
      scheduledDate: new Date(now - 25 * 86400000).toISOString().split('T')[0],
      scheduledTime: '12:00',
      duration: 60,
      trainer: { id: 'trainer-1', name: 'Thomas Müller' },
      court: { id: 'c1', name: 'Platz 1' },
      status: 'converted' as const,
      convertedToMemberId: 'member-101',
      createdAt: dp(27),
      updatedAt: dp(25),
    },
  ];

  return {
    TrialTrainingRepository: class {
      findAllAcrossClubs = vi.fn().mockResolvedValue(trialTrainings);
    },
  };
});

// ── Mock member-service adapter (now uses real DB; mock 20 members for stats tests) ──
vi.mock('@/src/application/services/member-service.adapter', () => {
  const now = Date.now();
  const d = (days: number) => new Date(now - days * 86400000).toISOString();

  const members = Array.from({ length: 20 }, (_, i) => ({
    id: `member-${i + 1}`,
    userId: `user-${i + 1}`,
    firstName: `Vorname${i + 1}`,
    lastName: `Nachname${i + 1}`,
    email: `member${i + 1}@example.com`,
    phone: `+49 100${i}`,
    dateOfBirth: '1990-01-15',
    address:
      i % 3 === 0
        ? { street: 'Teststr', houseNumber: `${i + 1}`, postalCode: '12345', city: 'Berlin' }
        : undefined,
    memberType: i < 16 ? ('member' as const) : i < 18 ? ('trial' as const) : ('inactive' as const),
    membershipStatus:
      i < 15
        ? ('active' as const)
        : i < 18
          ? ('active' as const)
          : i === 18
            ? ('inactive' as const)
            : ('terminated' as const),
    membershipStart: d(365),
    membershipEnd: i >= 18 ? d(30) : undefined,
    trainingGroup:
      i < 5 ? 'Anfänger' : i < 10 ? 'Fortgeschrittene' : i < 15 ? 'Turnier' : undefined,
    emergencyContact:
      i % 5 === 0
        ? { name: `Notfall ${i}`, phone: `+49 200${i}`, relationship: 'Partner' }
        : undefined,
    notes: i % 7 === 0 ? 'Notiz' : undefined,
    createdAt: d(365 + i),
    updatedAt: d(i),
  }));

  return {
    memberService: {
      getAllMembers: vi.fn().mockResolvedValue(members),
      getMemberById: vi.fn().mockResolvedValue(members[0]),
      getMemberByUserId: vi.fn().mockResolvedValue(members[0]),
      getMemberByEmail: vi.fn().mockResolvedValue(members[0]),
      queryMembers: vi.fn().mockResolvedValue(members),
      getActiveMembers: vi
        .fn()
        .mockResolvedValue(members.filter((m) => m.membershipStatus === 'active')),
      getMembersByTrainingGroup: vi.fn().mockResolvedValue(members.filter((m) => m.trainingGroup)),
      createMember: vi.fn(),
      updateMember: vi.fn(),
      updateMemberStatus: vi.fn(),
      deleteMember: vi.fn(),
      getMemberStatistics: vi.fn().mockResolvedValue({
        total: 20,
        active: 15,
        inactive: 1,
        suspended: 0,
        terminated: 1,
        byType: { member: 16, trial: 2, inactive: 2 },
        byTrainingGroup: { Anfänger: 5, Fortgeschrittene: 5, Turnier: 5 },
      }),
      searchMembers: vi.fn().mockResolvedValue(members),
      validateMemberInput: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    },
  };
});

// ── Mock billing adapter (BillingService uses direct Supabase, not in-memory) ──
//    Data inline in factory to avoid hoisting issues with vi.mock
vi.mock('@/src/application/services/billing-service.adapter', () => {
  const billingData = [
    {
      id: 'bill-1',
      billingPeriodId: 'period-1',
      trainerId: 'trainer-1',
      trainerName: 'Thomas Müller',
      totalHours: 40,
      hourlyRate: 45,
      totalAmount: 1800,
      status: 'paid' as const,
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-202601-0001',
      dueDate: '2026-02-15',
      paidAt: '2026-02-14',
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
    {
      id: 'bill-2',
      billingPeriodId: 'period-1',
      trainerId: 'trainer-2',
      trainerName: 'Julia Weber',
      totalHours: 35,
      hourlyRate: 55,
      totalAmount: 1925,
      status: 'pending' as const,
      invoiceId: 'inv-2',
      invoiceNumber: 'INV-202601-0002',
      dueDate: '2026-02-15',
      createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    },
    {
      id: 'bill-3',
      billingPeriodId: 'period-1',
      trainerId: 'trainer-3',
      trainerName: 'Michael Bauer',
      totalHours: 50,
      hourlyRate: 70,
      totalAmount: 3500,
      status: 'paid' as const,
      invoiceId: 'inv-3',
      invoiceNumber: 'INV-202601-0003',
      dueDate: '2026-02-15',
      paidAt: '2026-02-10',
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    },
    {
      id: 'bill-4',
      billingPeriodId: 'period-1',
      trainerId: 'trainer-4',
      trainerName: 'Sarah Klein',
      totalHours: 25,
      hourlyRate: 35,
      totalAmount: 875,
      status: 'overdue' as const,
      invoiceId: 'inv-4',
      invoiceNumber: 'INV-202601-0004',
      dueDate: '2026-01-30',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 'bill-5',
      billingPeriodId: 'period-1',
      trainerId: 'trainer-5',
      trainerName: 'Ahmed Al-Rashid',
      totalHours: 30,
      hourlyRate: 50,
      totalAmount: 1500,
      status: 'processed' as const,
      invoiceId: 'inv-5',
      invoiceNumber: 'INV-202601-0005',
      dueDate: '2026-02-15',
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
  ];

  return {
    billingService: {
      getAllTrainerBillings: vi.fn().mockResolvedValue(billingData),
      getAllBillingPeriods: vi.fn().mockResolvedValue([]),
      createBillingPeriod: vi.fn(),
      getBillingPeriodById: vi.fn(),
      getCurrentBillingPeriod: vi.fn(),
      closeBillingPeriod: vi.fn(),
      createTrainerBilling: vi.fn(),
      getTrainerBillingById: vi.fn(),
      getTrainerBillingsByBillingPeriod: vi.fn(),
      getTrainerBillingsByTrainerId: vi.fn(),
      updateTrainerBilling: vi.fn(),
      markTrainerBillingAsPaid: vi.fn(),
      markTrainerBillingAsOverdue: vi.fn(),
      createBillingLineItem: vi.fn(),
      getBillingLineItemsByTrainerBilling: vi.fn(),
      getAllBillingLineItems: vi.fn(),
      calculateBillingSummary: vi.fn(),
      generateInvoiceNumber: vi.fn(),
    },
  };
});

import { StatisticsService } from '@/src/application/services/statistics.service';
import { billingService } from '@/src/application/services/billing-service.adapter';

// ════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════

describe('StatisticsService — Integration with Mock Data', () => {
  let statsService: StatisticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    statsService = new StatisticsService();
  });

  // ── Member Statistics ─────────────────────────────────────

  describe('calculateMemberStatistics()', () => {
    it('returns 20 total members from in-memory mock data', async () => {
      const stats = await statsService.calculateMemberStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.totalMembers).toBe(20);
    });

    it('has active members between 1 and total', async () => {
      const stats = await statsService.calculateMemberStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.activeMembers).toBeGreaterThan(0);
      expect(stats.activeMembers).toBeLessThanOrEqual(stats.totalMembers);
    });

    it('provides members by status breakdown', async () => {
      const stats = await statsService.calculateMemberStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.membersByStatus).toBeDefined();
      expect(Object.keys(stats.membersByStatus).length).toBeGreaterThan(0);
    });

    it('provides members by membership type breakdown', async () => {
      const stats = await statsService.calculateMemberStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.membersByMembershipType).toBeDefined();
      expect(Object.keys(stats.membersByMembershipType).length).toBeGreaterThan(0);
    });

    it('returns zero new members for date range entirely in the past', async () => {
      const stats = await statsService.calculateMemberStatistics(
        new Date('2020-01-01'),
        new Date('2020-01-31')
      );

      expect(stats.newMembers).toBe(0);
    });

    it('returns converted trials count from mock data', async () => {
      const stats = await statsService.calculateMemberStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      // TrialTrainingService mock has 4 converted entries
      expect(stats.convertedTrials).toBe(4);
    });

    it('calculates a positive conversion rate from mock data', async () => {
      const stats = await statsService.calculateMemberStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.conversionRate).toBeGreaterThan(0);
    });

    it('calculates average membership duration in days', async () => {
      const stats = await statsService.calculateMemberStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.averageMembershipDuration).toBeGreaterThan(0);
    });
  });

  // ── Trainer Statistics ────────────────────────────────────

  describe('calculateTrainerStatistics()', () => {
    it('returns positive trainer hours and sessions from mock data', async () => {
      const stats = await statsService.calculateTrainerStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.totalSessions).toBeGreaterThan(0);
      expect(stats.totalHours).toBeGreaterThan(0);
      expect(stats.totalTrainers).toBeGreaterThan(0);
    });

    it('trainer IDs in hoursByTrainer use the expected prefix', async () => {
      const stats = await statsService.calculateTrainerStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(Object.keys(stats.hoursByTrainer).length).toBeGreaterThan(0);
      const trainerIds = Object.keys(stats.hoursByTrainer);
      expect(trainerIds.some((id) => id.startsWith('trainer-'))).toBe(true);
    });

    it('top performers are sorted by hours descending', async () => {
      const stats = await statsService.calculateTrainerStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.topPerformers.length).toBeGreaterThan(0);
      expect(stats.topPerformers.length).toBeLessThanOrEqual(5);

      for (let i = 1; i < stats.topPerformers.length; i++) {
        expect(stats.topPerformers[i - 1].hours).toBeGreaterThanOrEqual(
          stats.topPerformers[i].hours
        );
      }
    });

    it('returns zero hours when date range has no approved logs', async () => {
      const stats = await statsService.calculateTrainerStatistics(
        new Date('2020-01-01'),
        new Date('2020-01-02')
      );

      expect(stats.totalSessions).toBe(0);
      expect(stats.totalHours).toBe(0);
    });

    it('computes average hours and sessions per trainer', async () => {
      const stats = await statsService.calculateTrainerStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.averageHoursPerTrainer).toBe(stats.totalHours / stats.totalTrainers);
      expect(stats.averageSessionsPerTrainer).toBe(stats.totalSessions / stats.totalTrainers);
    });
  });

  // ── Revenue Statistics (with mocked billing) ──────────────

  describe('calculateRevenueStatistics()', () => {
    it('computes total revenue from mocked billing data', async () => {
      const stats = await statsService.calculateRevenueStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      // 1800 + 1925 + 3500 + 875 + 1500 = 9600
      expect(stats.totalRevenue).toBe(9600);
    });

    it('tracks pending and overdue payments separately', async () => {
      const stats = await statsService.calculateRevenueStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.pendingPayments).toBe(1925); // bill-2 is pending
      expect(stats.overduePayments).toBe(875); // bill-4 is overdue
    });

    it('calculates average revenue per member', async () => {
      const stats = await statsService.calculateRevenueStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      // 9600 / 20 members = 480
      expect(stats.averageRevenuePerMember).toBe(480);
    });

    it('groups revenue by month', async () => {
      const stats = await statsService.calculateRevenueStatistics(
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(Array.isArray(stats.revenueByMonth)).toBe(true);
    });

    it('calls billing adapter getAllTrainerBillings', async () => {
      await statsService.calculateRevenueStatistics(new Date('2020-01-01'), new Date('2030-12-31'));

      expect(billingService.getAllTrainerBillings).toHaveBeenCalled();
    });

    it('returns zero revenue when date range has no billing data', async () => {
      const stats = await statsService.calculateRevenueStatistics(
        new Date('2020-01-01'),
        new Date('2020-01-02')
      );

      expect(stats.totalRevenue).toBe(0);
      expect(stats.pendingPayments).toBe(0);
      expect(stats.overduePayments).toBe(0);
    });
  });

  // ── Court Statistics (standalone) ─────────────────────────

  describe('calculateCourtStatistics()', () => {
    it('returns 6 total courts', async () => {
      const stats = await statsService.calculateCourtStatistics(
        new Date('2020-01-01'),
        new Date('2020-01-31')
      );

      expect(stats.totalCourts).toBe(6);
    });

    it('returns utilization rate between 0 and 100', async () => {
      const stats = await statsService.calculateCourtStatistics(
        new Date('2020-01-01'),
        new Date('2020-01-31')
      );

      expect(stats.utilizationRate).toBeGreaterThan(0);
      expect(stats.utilizationRate).toBeLessThanOrEqual(100);
    });

    it('provides peak hours as sorted array of 14 entries', async () => {
      const stats = await statsService.calculateCourtStatistics(
        new Date('2020-01-01'),
        new Date('2020-01-31')
      );

      expect(stats.peakHours).toHaveLength(14);
      // Verify hours are sorted ascending
      for (let i = 1; i < stats.peakHours.length; i++) {
        expect(stats.peakHours[i - 1].hour).toBeLessThan(stats.peakHours[i].hour);
      }
    });

    it('bookings by court covers all 6 courts', async () => {
      const stats = await statsService.calculateCourtStatistics(
        new Date('2020-01-01'),
        new Date('2020-01-31')
      );

      expect(Object.keys(stats.bookingsByCourt)).toHaveLength(6);
    });

    it('bookings by day covers all 7 days', async () => {
      const stats = await statsService.calculateCourtStatistics(
        new Date('2020-01-01'),
        new Date('2020-01-31')
      );

      expect(Object.keys(stats.bookingsByDay)).toHaveLength(7);
    });
  });

  // ── Full Statistics Generation ────────────────────────────

  describe('generateStatistics()', () => {
    it('returns complete Statistics object with all sections', async () => {
      const stats = await statsService.generateStatistics(
        'monthly',
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.id).toBeDefined();
      expect(stats.period).toBe('monthly');
      expect(stats.memberStats).toBeDefined();
      expect(stats.revenueStats).toBeDefined();
      expect(stats.courtStats).toBeDefined();
      expect(stats.trainerStats).toBeDefined();
      expect(stats.createdAt).toBeInstanceOf(Date);
      expect(stats.updatedAt).toBeInstanceOf(Date);
    });

    it('member stats reflect 20 in-memory members', async () => {
      const stats = await statsService.generateStatistics(
        'monthly',
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.memberStats.totalMembers).toBe(20);
    });

    it('trainer stats include top performers', async () => {
      const stats = await statsService.generateStatistics(
        'monthly',
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );

      expect(stats.trainerStats.topPerformers.length).toBeGreaterThan(0);
    });
  });

  // ── Dashboard Metrics ─────────────────────────────────────

  describe('getDashboardMetrics()', () => {
    it('returns exactly 6 dashboard metric cards', async () => {
      const metrics = await statsService.getDashboardMetrics();

      expect(metrics).toHaveLength(6);
      const ids = metrics.map((m) => m.id);
      expect(ids).toContain('total-members');
      expect(ids).toContain('active-members');
      expect(ids).toContain('total-revenue');
      expect(ids).toContain('court-utilization');
      expect(ids).toContain('total-hours');
      expect(ids).toContain('conversion-rate');
    });

    it('each metric has all required DashboardMetric fields', async () => {
      const metrics = await statsService.getDashboardMetrics();

      for (const metric of metrics) {
        expect(metric.id).toBeTruthy();
        expect(metric.name).toBeTruthy();
        expect(typeof metric.value).toBe('number');
        expect(typeof metric.change).toBe('number');
        expect(['increase', 'decrease']).toContain(metric.changeType);
        expect(metric.unit).toBeTruthy();
        expect(Array.isArray(metric.trend)).toBe(true);
        expect(metric.trend.length).toBe(6);
      }
    });

    it('trend data points have date string and numeric value', async () => {
      const metrics = await statsService.getDashboardMetrics();

      for (const metric of metrics) {
        for (const point of metric.trend) {
          expect(point.date).toBeTruthy();
          expect(typeof point.value).toBe('number');
        }
      }
    });

    it('total-members metric reflects 20 mock members', async () => {
      const metrics = await statsService.getDashboardMetrics();
      const memberMetric = metrics.find((m) => m.id === 'total-members')!;

      expect(memberMetric.value).toBe(20);
      expect(memberMetric.unit).toBe('members');
    });

    it('conversion-rate metric uses percentage unit', async () => {
      const metrics = await statsService.getDashboardMetrics();
      const convMetric = metrics.find((m) => m.id === 'conversion-rate')!;

      expect(convMetric.unit).toBe('%');
      expect(convMetric.value).toBeGreaterThan(0);
    });
  });
});
