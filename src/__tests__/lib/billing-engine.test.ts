import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from './supabase-mock';
import { BillingEngine } from '@/lib/billing-engine';
import { CreateInvoice, CreatePayment } from '@/lib/types/billing';

describe('BillingEngine', () => {
  let billingEngine: BillingEngine;

  beforeEach(() => {
    billingEngine = BillingEngine.getInstance();
    vi.clearAllMocks();

    // Reset mock Supabase
    mockSupabase.from.mockReset();
    mockSupabase.rpc.mockReset();

    // Default RPC responses
    mockSupabase.rpc.mockResolvedValue({
      data: 'INV-202605-00001',
      error: null,
    });
  });

  describe('generateInvoiceNumber', () => {
    it('should generate a unique invoice number', async () => {
      const result = await billingEngine.generateInvoiceNumber('test-club-id');
      expect(result).toBe('INV-202605-00001');
    });

    it('should throw error when generation fails', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(billingEngine.generateInvoiceNumber('test-club-id')).rejects.toThrow(
        'Failed to generate invoice number: Database error'
      );
    });
  });

  describe('createInvoice', () => {
    it('should create an invoice with items', async () => {
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
            item_type: 'membership_fee',
          },
        ],
      };

      const result = await billingEngine.createInvoice(createInvoiceData);
      expect(result).toBeDefined();
      expect(result.total_amount).toBe(119);
    });

    it('should calculate correct totals for multiple items', async () => {
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
            item_type: 'membership_fee',
          },
          {
            description: 'Training fee',
            quantity: 2,
            unit_price: 50,
            tax_rate: 19,
            item_type: 'training_fee',
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
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'invoice-1',
                  invoice_number: 'INV-202605-00001',
                  items: [
                    { id: 'item-1', description: 'Membership fee', quantity: 1, unit_price: 100 },
                  ],
                  payments: [],
                  dunning_records: [],
                },
                error: null,
              }),
          }),
        }),
      });

      const result = await billingEngine.getInvoiceById('invoice-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('invoice-1');
      expect(result?.items).toHaveLength(1);
    });

    it('should return null when invoice not found', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: { code: 'PGRST116' },
              }),
          }),
        }),
      });

      const result = await billingEngine.getInvoiceById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateInvoiceStatus', () => {
    it('should update invoice status to sent', async () => {
      mockSupabase.from.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'invoice-1',
                    status: 'sent',
                    sent_at: '2026-05-02T10:00:00Z',
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });

      const result = await billingEngine.updateInvoiceStatus('invoice-1', 'sent');
      expect(result.status).toBe('sent');
      expect(result.sent_at).toBeDefined();
    });

    it('should update invoice status to paid', async () => {
      mockSupabase.from.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'invoice-1',
                    status: 'paid',
                    paid_at: '2026-05-02T10:00:00Z',
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });

      const result = await billingEngine.updateInvoiceStatus('invoice-1', 'paid');
      expect(result.status).toBe('paid');
      expect(result.paid_at).toBeDefined();
    });
  });

  describe('createPayment', () => {
    it('should create a payment', async () => {
      const createPaymentData: CreatePayment = {
        club_id: 'club-1',
        member_id: 'member-1',
        invoice_id: 'invoice-1',
        amount: 119,
        payment_method: 'sepa',
      };

      mockSupabase.from.mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'payment-1',
                  payment_number: 'PAY-202605-00001',
                  amount: 119,
                  payment_method: 'sepa',
                  status: 'pending',
                },
                error: null,
              }),
          }),
        }),
      });

      const result = await billingEngine.createPayment(createPaymentData);
      expect(result).toBeDefined();
      expect(result.payment_number).toBe('PAY-202605-00001');
      expect(result.amount).toBe(119);
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status to completed', async () => {
      mockSupabase.from.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'payment-1',
                    status: 'completed',
                    processed_at: '2026-05-02T10:00:00Z',
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });

      const result = await billingEngine.updatePaymentStatus('payment-1', 'completed', {
        processed_at: '2026-05-02T10:00:00Z',
      });
      expect(result.status).toBe('completed');
      expect(result.processed_at).toBeDefined();
    });
  });

  describe('createSepaMandate', () => {
    it('should create a SEPA mandate', async () => {
      const createMandateData = {
        club_id: 'club-1',
        member_id: 'member-1',
        iban: 'DE89 3704 0044 0532 0130 00',
        account_holder_name: 'John Doe',
      };

      mockSupabase.from.mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'mandate-1',
                  mandate_reference: 'SWINGZ-club-1-1234567890',
                  iban: 'DE89370400440532013000',
                  account_holder_name: 'John Doe',
                  status: 'active',
                },
                error: null,
              }),
          }),
        }),
      });

      const result = await billingEngine.createSepaMandate(createMandateData);
      expect(result).toBeDefined();
      expect(result.mandate_reference).toContain('SWINGZ');
      expect(result.iban).toBe('DE89370400440532013000');
      expect(result.status).toBe('active');
    });

    it('should clean IBAN by removing spaces', async () => {
      const createMandateData = {
        club_id: 'club-1',
        member_id: 'member-1',
        iban: 'DE89 3704 0044 0532 0130 00',
        account_holder_name: 'John Doe',
      };

      mockSupabase.from.mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  iban: 'DE89370400440532013000',
                },
                error: null,
              }),
          }),
        }),
      });

      const result = await billingEngine.createSepaMandate(createMandateData);
      expect(result.iban).toBe('DE89370400440532013000');
    });
  });

  describe('createDunningRecord', () => {
    it('should create a dunning record with correct fee', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  total_amount: 100,
                },
                error: null,
              }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'dunning-1',
                  dunning_level: 1,
                  dunning_fee: 5,
                  total_amount: 105,
                },
                error: null,
              }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {},
                error: null,
              }),
          }),
        }),
      });

      const createDunningData = {
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
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: { total_amount: 100 },
                error: null,
              }),
          }),
        }),
      });

      const levels = [
        { level: 1, expectedFee: 5 },
        { level: 2, expectedFee: 10 },
        { level: 3, expectedFee: 20 },
      ];

      for (const { level, expectedFee } of levels) {
        mockSupabase.from.mockReturnValueOnce({
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    dunning_level: level,
                    dunning_fee: expectedFee,
                    total_amount: 100 + expectedFee,
                  },
                  error: null,
                }),
            }),
          }),
        });

        mockSupabase.from.mockReturnValueOnce({
          update: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {},
                  error: null,
                }),
            }),
          }),
        });

        const createDunningData = {
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
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ count: 2, error: null }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: { total_amount: 150, paid_amount: 100 },
                error: null,
              }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: { overdue_invoices: 1 },
                error: null,
              }),
          }),
        }),
      });

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
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: [
                  { id: '1', total_amount: 50, status: 'paid' },
                  { id: '2', total_amount: 50, status: 'overdue' },
                ],
                error: null,
              }),
          }),
        }),
      });

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
