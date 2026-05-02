import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase, mockQueryBuilder } from './supabase-mock';
import { BillingEngine } from '@/lib/billing-engine';
import {
  CreateInvoice,
  CreateSepaMandate,
  CreateDunningRecord,
  InvoiceStatus,
  PaymentStatus,
  InvoiceItemType,
} from '@/lib/types/billing';

describe('BillingEngine', () => {
  let billingEngine: BillingEngine;

  beforeEach(() => {
    billingEngine = BillingEngine.getInstance();

    mockSupabase.from.mockReturnValue(mockQueryBuilder);
    mockSupabase.rpc.mockResolvedValue({
      data: 'INV-202605-00001',
      error: null,
    });

    mockQueryBuilder.single.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  describe('generateInvoiceNumber', () => {
    it('should generate a unique invoice number', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'INV-202605-00001',
        error: null,
      });

      const result = await billingEngine.generateInvoiceNumber('test-club-id');

      expect(result).toBe('INV-202605-00001');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('generate_invoice_number', {
        p_club_id: 'test-club-id',
      });
    });

    it('should throw error when generation fails', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(billingEngine.generateInvoiceNumber('test-club-id')).rejects.toThrow(
        'Failed to generate invoice number: Database error'
      );
    });
  });

  describe('generatePaymentNumber', () => {
    it('should generate a unique payment number', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'PAY-202605-00001',
        error: null,
      });

      const result = await billingEngine.generatePaymentNumber('test-club-id');

      expect(result).toBe('PAY-202605-00001');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('generate_payment_number', {
        p_club_id: 'test-club-id',
      });
    });
  });

  describe('createInvoice', () => {
    it('should create an invoice with items', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'INV-202605-00001',
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => mockQueryBuilder),
      });

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => mockQueryBuilder),
      });

      const createInvoiceData: CreateInvoice = {
        club_id: 'club-1',
        member_id: 'member-1',
        due_date: '2026-05-16',
        items: [
          {
            description: 'Membership fee',
            quantity: 1,
            unit_price: 100,
            tax_rate: 19,
            item_type: InvoiceItemType.MembershipFee,
          },
        ],
      };

      const result = await billingEngine.createInvoice(createInvoiceData);

      expect(result).toBeDefined();
      expect(result.invoice_number).toBe('INV-202605-00001');
      expect(result.total_amount).toBe(119);
    });

    it('should calculate correct totals for multiple items', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'INV-202605-00001',
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => mockQueryBuilder),
      });

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => mockQueryBuilder),
      });

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => mockQueryBuilder),
      });

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => mockQueryBuilder),
      });

      const createInvoiceData: CreateInvoice = {
        club_id: 'club-1',
        member_id: 'member-1',
        due_date: '2026-05-16',
        items: [
          {
            description: 'Membership fee',
            quantity: 1,
            unit_price: 100,
            tax_rate: 19,
            item_type: InvoiceItemType.MembershipFee,
          },
          {
            description: 'Training fee',
            quantity: 2,
            unit_price: 50,
            tax_rate: 19,
            item_type: InvoiceItemType.TrainingFee,
          },
        ],
      };

      const result = await billingEngine.createInvoice(createInvoiceData);

      expect(result.subtotal).toBe(200);
      expect(result.tax_amount).toBe(38);
      expect(result.total_amount).toBe(238);
    });
  });

  describe('getInvoiceById', () => {
    it('should return invoice with items', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        invoice_number: 'INV-202605-00001',
        items: [{ id: 'item-1', description: 'Membership fee', quantity: 1, unit_price: 100 }],
        payments: [],
        dunning_records: [],
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockInvoice, error: null })),
          })),
        })),
      });

      const result = await billingEngine.getInvoiceById('invoice-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('invoice-1');
      expect(result?.items).toHaveLength(1);
    });

    it('should return null when invoice not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: { code: 'PGRST116' },
              })
            ),
          })),
        })),
      });

      const result = await billingEngine.getInvoiceById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateInvoiceStatus', () => {
    it('should update invoice status to sent', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: 'sent',
        sent_at: '2026-05-02T10:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockInvoice, error: null })),
            })),
          })),
        })),
      });

      const result = await billingEngine.updateInvoiceStatus('invoice-1', InvoiceStatus.Sent);

      expect(result.status).toBe('sent');
      expect(result.sent_at).toBeDefined();
    });

    it('should update invoice status to paid', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: 'paid',
        paid_at: '2026-05-02T10:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockInvoice, error: null })),
            })),
          })),
        })),
      });

      const result = await billingEngine.updateInvoiceStatus('invoice-1', InvoiceStatus.Paid);

      expect(result.status).toBe('paid');
      expect(result.paid_at).toBeDefined();
    });
  });

  describe('createPayment', () => {
    it('should create a payment', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'PAY-202605-00001',
        error: null,
      });

      const mockPayment = {
        id: 'payment-1',
        payment_number: 'PAY-202605-00001',
        amount: 119,
        payment_method: 'sepa',
        status: 'pending',
      };

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockPayment, error: null })),
          })),
        })),
      });

      const createPaymentData: CreatePayment = {
        club_id: 'club-1',
        member_id: 'member-1',
        invoice_id: 'invoice-1',
        amount: 119,
        payment_method: 'sepa',
      };

      const result = await billingEngine.createPayment(createPaymentData);

      expect(result).toBeDefined();
      expect(result.payment_number).toBe('PAY-202605-00001');
      expect(result.amount).toBe(119);
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status to completed', async () => {
      const mockPayment = {
        id: 'payment-1',
        status: 'completed',
        processed_at: '2026-05-02T10:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockPayment, error: null })),
            })),
          })),
        })),
      });

      const result = await billingEngine.updatePaymentStatus('payment-1', PaymentStatus.Completed, {
        processed_at: '2026-05-02T10:00:00Z',
      });

      expect(result.status).toBe('completed');
      expect(result.processed_at).toBeDefined();
    });
  });

  describe('createSepaMandate', () => {
    it('should create a SEPA mandate', async () => {
      const mockMandate = {
        id: 'mandate-1',
        mandate_reference: 'SWINGZ-club-1-1234567890',
        iban: 'DE89370400440532013000',
        account_holder_name: 'John Doe',
        status: 'active',
      };

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockMandate, error: null })),
          })),
        })),
      });

      const createMandateData: CreateSepaMandate = {
        club_id: 'club-1',
        member_id: 'member-1',
        iban: 'DE89 3704 0044 0532 0130 00',
        account_holder_name: 'John Doe',
      };

      const result = await billingEngine.createSepaMandate(createMandateData);

      expect(result).toBeDefined();
      expect(result.mandate_reference).toContain('SWINGZ');
      expect(result.iban).toBe('DE89370400440532013000');
      expect(result.status).toBe('active');
    });

    it('should clean IBAN by removing spaces', async () => {
      const mockMandate = {
        id: 'mandate-1',
        iban: 'DE89370400440532013000',
      };

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockMandate, error: null })),
          })),
        })),
      });

      const createMandateData: CreateSepaMandate = {
        club_id: 'club-1',
        member_id: 'member-1',
        iban: 'DE89 3704 0044 0532 0130 00',
        account_holder_name: 'John Doe',
      };

      const result = await billingEngine.createSepaMandate(createMandateData);

      expect(result.iban).toBe('DE89370400440532013000');
    });
  });

  describe('createDunningRecord', () => {
    it('should create a dunning record with correct fee', async () => {
      const mockInvoice = {
        total_amount: 100,
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockInvoice, error: null })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  id: 'dunning-1',
                  dunning_level: 1,
                  dunning_fee: 5,
                  total_amount: 105,
                },
                error: null,
              })
            ),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
            })),
          })),
        })),
      });

      const createDunningData: CreateDunningRecord = {
        club_id: 'club-1',
        member_id: 'member-1',
        invoice_id: 'invoice-1',
        dunning_level: 1,
        due_date: '2026-05-16',
      };

      const result = await billingEngine.createDunningRecord(createDunningData);

      expect(result).toBeDefined();
      expect(result.dunning_level).toBe(1);
      expect(result.dunning_fee).toBe(5);
      expect(result.total_amount).toBe(105);
    });

    it('should calculate correct dunning fees for different levels', async () => {
      const mockInvoice = {
        total_amount: 100,
      };

      mockSupabase.from.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.single.mockResolvedValue({ data: mockInvoice, error: null });
      mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);

      const levels = [
        { level: 1, expectedFee: 5 },
        { level: 2, expectedFee: 10 },
        { level: 3, expectedFee: 20 },
      ];

      for (const { level, expectedFee } of levels) {
        const createDunningData: CreateDunningRecord = {
          club_id: 'club-1',
          member_id: 'member-1',
          invoice_id: 'invoice-1',
          dunning_level: level,
          due_date: '2026-05-16',
        };

        const result = await billingEngine.createDunningRecord(createDunningData);

        expect(result.dunning_fee).toBe(expectedFee);
        expect(result.total_amount).toBe(100 + expectedFee);
      }
    });
  });

  describe('getMemberBillingSummary', () => {
    it('should return member billing summary', async () => {
      mockSupabase.from.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.single.mockResolvedValue({ count: 1, error: null });

      const result = await billingEngine.getMemberBillingSummary('member-1');

      expect(result).toBeDefined();
      expect(result.member_id).toBe('member-1');
      expect(result.total_invoices).toBe(2);
      expect(result.total_amount).toBe(150);
      expect(result.paid_amount).toBe(100);
      expect(result.outstanding_amount).toBe(50);
      expect(result.overdue_invoices).toBe(1);
    });
  });

  describe('getClubBillingStats', () => {
    it('should return club billing statistics', async () => {
      mockSupabase.from.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.single.mockResolvedValue({ data: mockInvoices, error: null });

      const result = await billingEngine.getClubBillingStats('club-1');

      expect(result).toBeDefined();
      expect(result.club_id).toBe('club-1');
      expect(result.total_invoices).toBe(2);
      expect(result.total_revenue).toBe(100);
      expect(result.outstanding_amount).toBe(50);
      expect(result.overdue_amount).toBe(50);
      expect(result.payment_methods).toEqual({
        sepa: 2,
        stripe: 1,
      });
      expect(result.dunning_level_1).toBe(1);
      expect(result.dunning_level_2).toBe(1);
      expect(result.dunning_level_3).toBe(0);
    });
  });
});
