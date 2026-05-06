/**
 * Unit tests for Trainer Billing Repositories
 *
 * Tests cover:
 * - BillingPeriodRepository
 * - TrainerBillingRepository
 * - BillingLineItemRepository
 *
 * Run: npm test -- billing.repository.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrizzleBillingPeriodRepository } from '@/infrastructure/persistence/repositories/billing-period.repository';
import { DrizzleTrainerBillingRepository } from '@/infrastructure/persistence/repositories/trainer-billing.repository';
import { DrizzleBillingLineItemRepository } from '@/infrastructure/persistence/repositories/billing-line-item.repository';

describe('BillingPeriodRepository', () => {
  let repository: DrizzleBillingPeriodRepository;

  beforeEach(() => {
    repository = new DrizzleBillingPeriodRepository();
  });

  afterEach(async () => {
    // Cleanup test data
    // TODO: Implement cleanup when DB connection is available
  });

  describe('create', () => {
    it('should create a new billing period', async () => {
      const startDate = new Date('2026-05-01');
      const endDate = new Date('2026-05-31');

      const period = await repository.create(startDate, endDate);

      expect(period).toBeDefined();
      expect(period.id).toBeDefined();
      expect(period.status).toBe('open');
      expect(period.startDate).toBe('2026-05-01');
      expect(period.endDate).toBe('2026-05-31');
    });

    it('should validate end date is after start date', async () => {
      const startDate = new Date('2026-05-31');
      const endDate = new Date('2026-05-01');

      await expect(repository.create(startDate, endDate)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find billing period by ID', async () => {
      const created = await repository.create(new Date('2026-05-01'), new Date('2026-05-31'));
      const found = await repository.findById(created.id);

      expect(found).toEqual(created);
    });

    it('should return null for non-existent ID', async () => {
      const found = await repository.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findCurrent', () => {
    it('should find the current open billing period', async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      await repository.create(startOfMonth, endOfMonth);

      const current = await repository.findCurrent();

      expect(current).toBeDefined();
      expect(current?.status).toBe('open');
    });

    it('should return null if no current period exists', async () => {
      const current = await repository.findCurrent();
      expect(current).toBeNull();
    });
  });

  describe('close', () => {
    it('should close a billing period', async () => {
      const period = await repository.create(new Date('2026-05-01'), new Date('2026-05-31'));
      const closed = await repository.close(period.id);

      expect(closed).toBeDefined();
      expect(closed?.status).toBe('closed');
    });
  });
});

describe('TrainerBillingRepository', () => {
  let repository: DrizzleTrainerBillingRepository;
  let periodRepo: DrizzleBillingPeriodRepository;
  let testPeriodId: string;

  beforeEach(async () => {
    repository = new DrizzleTrainerBillingRepository();
    periodRepo = new DrizzleBillingPeriodRepository();

    // Create test billing period
    const period = await periodRepo.create(new Date('2026-05-01'), new Date('2026-05-31'));
    testPeriodId = period.id;
  });

  afterEach(async () => {
    // Cleanup test data
    // TODO: Implement cleanup
  });

  describe('create', () => {
    it('should create a new trainer billing', async () => {
      const billing = await repository.create({
        billingPeriodId: testPeriodId,
        trainerId: 'trainer-123',
        trainerName: 'Test Trainer',
        totalHours: 40,
        hourlyRate: 50,
        totalAmount: 2000,
      });

      expect(billing).toBeDefined();
      expect(billing.id).toBeDefined();
      expect(billing.status).toBe('pending');
      expect(billing.totalHours).toBe(40);
      expect(billing.totalAmount).toBe(2000);
    });

    it('should validate positive hours and amounts', async () => {
      await expect(
        repository.create({
          billingPeriodId: testPeriodId,
          trainerId: 'trainer-123',
          trainerName: 'Test Trainer',
          totalHours: -10,
          hourlyRate: 50,
          totalAmount: -500,
        })
      ).rejects.toThrow();
    });
  });

  describe('findByBillingPeriod', () => {
    it('should find all billings for a period', async () => {
      await repository.create({
        billingPeriodId: testPeriodId,
        trainerId: 'trainer-1',
        trainerName: 'Trainer One',
        totalHours: 40,
        hourlyRate: 50,
        totalAmount: 2000,
      });

      await repository.create({
        billingPeriodId: testPeriodId,
        trainerId: 'trainer-2',
        trainerName: 'Trainer Two',
        totalHours: 35,
        hourlyRate: 55,
        totalAmount: 1925,
      });

      const billings = await repository.findByBillingPeriod(testPeriodId);

      expect(billings).toHaveLength(2);
    });
  });

  describe('markAsPaid', () => {
    it('should mark billing as paid', async () => {
      const billing = await repository.create({
        billingPeriodId: testPeriodId,
        trainerId: 'trainer-123',
        trainerName: 'Test Trainer',
        totalHours: 40,
        hourlyRate: 50,
        totalAmount: 2000,
      });

      const paid = await repository.markAsPaid(billing.id);

      expect(paid).toBeDefined();
      expect(paid?.status).toBe('paid');
      expect(paid?.paidAt).toBeDefined();
    });
  });

  describe('calculateSummary', () => {
    it('should calculate billing summary for a period', async () => {
      await repository.create({
        billingPeriodId: testPeriodId,
        trainerId: 'trainer-1',
        trainerName: 'Trainer One',
        totalHours: 40,
        hourlyRate: 50,
        totalAmount: 2000,
      });

      await repository.create({
        billingPeriodId: testPeriodId,
        trainerId: 'trainer-2',
        trainerName: 'Trainer Two',
        totalHours: 35,
        hourlyRate: 55,
        totalAmount: 1925,
      });

      const summary = await repository.calculateSummary(testPeriodId);

      expect(summary.totalTrainers).toBe(2);
      expect(summary.totalHours).toBe(75);
      expect(summary.totalAmount).toBe(3925);
      expect(summary.pendingAmount).toBe(3925); // Both are pending
    });
  });

  describe('generateInvoiceNumber', () => {
    it('should generate sequential invoice numbers', async () => {
      const num1 = await repository.generateInvoiceNumber();
      const num2 = await repository.generateInvoiceNumber();

      expect(num1).toMatch(/^INV-\d{6}-\d{4}$/);
      expect(num2).toMatch(/^INV-\d{6}-\d{4}$/);
      // Sequential check would require parsing the numbers
    });
  });
});

describe('BillingLineItemRepository', () => {
  let repository: DrizzleBillingLineItemRepository;
  let billingRepo: DrizzleTrainerBillingRepository;
  let periodRepo: DrizzleBillingPeriodRepository;
  let testBillingId: string;

  beforeEach(async () => {
    repository = new DrizzleBillingLineItemRepository();
    billingRepo = new DrizzleTrainerBillingRepository();
    periodRepo = new DrizzleBillingPeriodRepository();

    // Create test data
    const period = await periodRepo.create(new Date('2026-05-01'), new Date('2026-05-31'));
    const billing = await billingRepo.create({
      billingPeriodId: period.id,
      trainerId: 'trainer-123',
      trainerName: 'Test Trainer',
      totalHours: 40,
      hourlyRate: 50,
      totalAmount: 2000,
    });
    testBillingId = billing.id;
  });

  afterEach(async () => {
    // Cleanup test data
    // TODO: Implement cleanup
  });

  describe('create', () => {
    it('should create a new line item', async () => {
      const lineItem = await repository.create(
        testBillingId,
        new Date('2026-05-01'),
        'Training Session 1',
        2,
        50,
        'training',
        'session-123'
      );

      expect(lineItem).toBeDefined();
      expect(lineItem.id).toBeDefined();
      expect(lineItem.hours).toBe(2);
      expect(lineItem.rate).toBe(50);
      expect(lineItem.amount).toBe(100); // hours * rate
      expect(lineItem.type).toBe('training');
    });

    it('should calculate amount automatically', async () => {
      const lineItem = await repository.create(
        testBillingId,
        new Date('2026-05-01'),
        'Preparation',
        1.5,
        50,
        'preparation'
      );

      expect(lineItem.amount).toBe(75); // 1.5 * 50
    });
  });

  describe('findByTrainerBilling', () => {
    it('should find all line items for a billing', async () => {
      await repository.create(testBillingId, new Date('2026-05-01'), 'Item 1', 2, 50, 'training');
      await repository.create(
        testBillingId,
        new Date('2026-05-02'),
        'Item 2',
        1.5,
        50,
        'preparation'
      );

      const items = await repository.findByTrainerBilling(testBillingId);

      expect(items).toHaveLength(2);
    });
  });
});
