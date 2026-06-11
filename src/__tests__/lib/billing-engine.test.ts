import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { BillingEngine } from '@/lib/billing-engine';
import type { CreateInvoice, CreatePayment, CreateDunningRecord } from '@/lib/types/billing';
import { CreateSepaMandate } from '@/lib/types/billing';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SEPA_CREDITOR_ID = process.env.SEPA_CREDITOR_ID || '';

const hasSupabase = !!SUPABASE_SERVICE_KEY;
const hasSepaCreditor = !!SEPA_CREDITOR_ID;
const describeIntegration = hasSupabase ? describe : describe.skip;
const describeSepa = hasSupabase && hasSepaCreditor ? describe : describe.skip;

// Use a real auth.users UUID from seed script, or fallback to fake UUID for non-FK tests
const TEST_MEMBER = process.env.TEST_MEMBER_UUID || '00000000-0000-0000-0000-000000000001';
const hasRealTestUser = !!process.env.TEST_MEMBER_UUID;

describeIntegration('BillingEngine (Integration Tests - Requires Database)', () => {
  let supabase: ReturnType<typeof createClient>;
  let billingEngine: BillingEngine;
  let testClubId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    billingEngine = BillingEngine.getInstance();

    // Create test club
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .insert({ name: `Billing Test Club ${Date.now()}`, opening_hours: {} })
      .select()
      .single();

    if (club && !clubError) {
      testClubId = (club as { id: string }).id;
    }
  });

  /** Helper to create a test invoice with member_id=null (avoids FK to auth.users) */
  function makeInvoice(overrides: Partial<CreateInvoice> = {}): CreateInvoice {
    return {
      club_id: testClubId,
      member_id: null,
      due_date: '2026-05-15',
      items: [
        {
          description: 'Test item',
          quantity: 1,
          unit_price: 10.0,
          tax_rate: 19,
          item_type: 'other',
        },
      ],
      ...overrides,
    };
  }

  describe('Invoice Management', () => {
    describe('createInvoice', () => {
      it('should create an invoice with items', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: testClubId,
          member_id: null,
          due_date: '2026-05-15',
          items: [
            {
              description: 'Mitgliedsbeitrag Mai 2026',
              quantity: 1,
              unit_price: 29.99,
              tax_rate: 19,
              item_type: 'membership_fee',
            },
            {
              description: 'Trainingsgebühr',
              quantity: 2,
              unit_price: 15.0,
              tax_rate: 19,
              item_type: 'training_fee',
            },
          ],
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);

        expect(invoice).toBeDefined();
        expect(invoice.club_id).toBe(createInvoiceData.club_id);
        expect(invoice.member_id).toBeNull();
        expect(invoice.due_date).toBe(createInvoiceData.due_date);
        expect(invoice.status).toBe('draft');
        expect(invoice.invoice_type).toBe('adhoc');
        expect(invoice.amount).toBeCloseTo(71.39, 2);
        expect(invoice.tax_amount).toBeCloseTo(11.4, 2);
        expect(invoice.currency).toBe('EUR');
        expect(invoice.items).toHaveLength(2);
      });

      it('should calculate correct totals for multiple items', async () => {
        const invoice = await billingEngine.createInvoice(
          makeInvoice({
            items: [
              {
                description: 'Item 1',
                quantity: 2,
                unit_price: 10.0,
                tax_rate: 19,
                item_type: 'other',
              },
              {
                description: 'Item 2',
                quantity: 3,
                unit_price: 20.0,
                tax_rate: 7,
                item_type: 'other',
              },
            ],
          })
        );
        // subtotal = 2*10 + 3*20 = 80, tax = 20*0.19 + 60*0.07 = 3.8+4.2 = 8.0, total = 88
        expect(invoice.amount).toBeCloseTo(88, 2);
        expect(invoice.tax_amount).toBeCloseTo(8, 2);
      });

      it('should handle zero tax rate', async () => {
        const invoice = await billingEngine.createInvoice(
          makeInvoice({
            items: [
              {
                description: 'Tax-free item',
                quantity: 1,
                unit_price: 100.0,
                tax_rate: 0,
                item_type: 'other',
              },
            ],
          })
        );
        expect(invoice.amount).toBe(100.0);
        expect(invoice.tax_amount).toBe(0);
      });

      it('should generate unique invoice numbers', async () => {
        const d = makeInvoice();
        const invoice1 = await billingEngine.createInvoice(d);
        const invoice2 = await billingEngine.createInvoice(d);
        expect(invoice1.invoice_number).not.toBe(invoice2.invoice_number);
      });
    });

    describe('getInvoiceById', () => {
      it('should retrieve invoice by ID with items', async () => {
        const created = await billingEngine.createInvoice(makeInvoice());
        const retrieved = await billingEngine.getInvoiceById(created.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.items).toHaveLength(1);
        expect(retrieved?.items[0].description).toBe('Test item');
      });

      it('should return null for non-existent invoice', async () => {
        const invoice = await billingEngine.getInvoiceById('00000000-0000-0000-0000-000000000000');
        expect(invoice).toBeNull();
      });
    });

    describe('getInvoicesByClub', () => {
      it('should retrieve invoices for a club', async () => {
        const d = makeInvoice();
        await billingEngine.createInvoice(d);
        await billingEngine.createInvoice(d);
        const invoices = await billingEngine.getInvoicesByClub(testClubId);
        expect(invoices.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter invoices by status', async () => {
        const d = makeInvoice();
        const i1 = await billingEngine.createInvoice(d);
        const i2 = await billingEngine.createInvoice(d);
        await billingEngine.updateInvoiceStatus(i1.id, 'open');
        await billingEngine.updateInvoiceStatus(i2.id, 'paid');

        const openInvoices = await billingEngine.getInvoicesByClub(testClubId, { status: 'open' });
        const paidInvoices = await billingEngine.getInvoicesByClub(testClubId, { status: 'paid' });
        expect(openInvoices.length).toBeGreaterThanOrEqual(1);
        expect(paidInvoices.length).toBeGreaterThanOrEqual(1);
      });

      it('should apply limit and offset', async () => {
        const d = makeInvoice();
        await billingEngine.createInvoice(d);
        await billingEngine.createInvoice(d);
        await billingEngine.createInvoice(d);
        const limited = await billingEngine.getInvoicesByClub(testClubId, { limit: 2 });
        expect(limited.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('updateInvoiceStatus', () => {
      it('should update invoice status to open', async () => {
        const invoice = await billingEngine.createInvoice(makeInvoice());
        const updated = await billingEngine.updateInvoiceStatus(invoice.id, 'open');
        expect(updated.status).toBe('open');
      });

      it('should update invoice status to paid', async () => {
        const invoice = await billingEngine.createInvoice(makeInvoice());
        const updated = await billingEngine.updateInvoiceStatus(invoice.id, 'paid');
        expect(updated.status).toBe('paid');
        expect(updated.paid_at).toBeDefined();
      });

      it('should update invoice status to cancelled', async () => {
        const invoice = await billingEngine.createInvoice(makeInvoice());
        const updated = await billingEngine.updateInvoiceStatus(invoice.id, 'cancelled');
        expect(updated.status).toBe('cancelled');
      });
    });
  });

  describe('Payment Management', () => {
    describe('createPayment', () => {
      it('should create a payment', async () => {
        const invoice = await billingEngine.createInvoice(makeInvoice());
        const payment = await billingEngine.createPayment({
          invoice_id: invoice.id,
          amount: 100.0,
          payment_method: 'stripe',
        });
        expect(payment).toBeDefined();
        expect(payment.invoice_id).toBe(invoice.id);
        expect(payment.amount).toBe(100.0);
        expect(payment.payment_method).toBe('stripe');
        expect(payment.status).toBe('pending');
        expect(payment.external_id).toBeDefined();
      });

      it('should generate unique external IDs', async () => {
        const invoice = await billingEngine.createInvoice(makeInvoice());
        const data = { invoice_id: invoice.id, amount: 100.0, payment_method: 'stripe' as const };
        const p1 = await billingEngine.createPayment(data);
        const p2 = await billingEngine.createPayment(data);
        expect(p1.external_id).not.toBe(p2.external_id);
      });
    });

    describe('updatePaymentStatus', () => {
      it('should update payment status to completed', async () => {
        const invoice = await billingEngine.createInvoice(makeInvoice());
        const payment = await billingEngine.createPayment({
          invoice_id: invoice.id,
          amount: 100.0,
          payment_method: 'stripe',
        });
        const updated = await billingEngine.updatePaymentStatus(payment.id, 'completed');
        expect(updated.status).toBe('completed');
        expect(updated.paid_at).toBeDefined();
      });

      it('should update payment status to failed', async () => {
        const invoice = await billingEngine.createInvoice(makeInvoice());
        const payment = await billingEngine.createPayment({
          invoice_id: invoice.id,
          amount: 100.0,
          payment_method: 'stripe',
        });
        const updated = await billingEngine.updatePaymentStatus(payment.id, 'failed');
        expect(updated.status).toBe('failed');
      });
    });

    describe('getPaymentById', () => {
      it('should retrieve payment by ID', async () => {
        const invoice = await billingEngine.createInvoice(makeInvoice());
        const created = await billingEngine.createPayment({
          invoice_id: invoice.id,
          amount: 100.0,
          payment_method: 'stripe',
        });
        const retrieved = await billingEngine.getPaymentById(created.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
      });

      it('should return null for non-existent payment', async () => {
        const payment = await billingEngine.getPaymentById('00000000-0000-0000-0000-000000000000');
        expect(payment).toBeNull();
      });
    });

    describe('getPaymentsByInvoice', () => {
      it('should retrieve payments for an invoice', async () => {
        const invoice = await billingEngine.createInvoice(makeInvoice());
        const data = { invoice_id: invoice.id, amount: 50.0, payment_method: 'stripe' as const };
        await billingEngine.createPayment(data);
        await billingEngine.createPayment(data);
        const payments = await billingEngine.getPaymentsByInvoice(invoice.id);
        expect(payments).toHaveLength(2);
        expect(payments.every((p) => p.invoice_id === invoice.id)).toBe(true);
      });
    });
  });

  describeSepa('SEPA Mandate Management', () => {
    describe('createSepaMandate', () => {
      it('should create a SEPA mandate', async () => {
        const mandate = await billingEngine.createSepaMandate({
          club_id: testClubId,
          member_id: TEST_MEMBER,
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder: 'Max Mustermann',
        });
        expect(mandate).toBeDefined();
        expect(mandate.club_id).toBe(testClubId);
        expect(mandate.member_id).toBe(TEST_MEMBER);
        expect(mandate.iban).toBe('DE89370400440532013000');
        expect(mandate.bic).toBe('COBADEFFXXX');
        expect(mandate.account_holder).toBe('Max Mustermann');
        expect(mandate.is_active).toBe(true);
        expect(mandate.mandate_reference).toBeDefined();
      });

      it('should generate unique mandate references', async () => {
        const data = {
          club_id: testClubId,
          member_id: TEST_MEMBER,
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder: 'Max Mustermann',
        };
        const m1 = await billingEngine.createSepaMandate(data);
        const m2 = await billingEngine.createSepaMandate(data);
        expect(m1.mandate_reference).not.toBe(m2.mandate_reference);
      });
    });

    describe('getActiveSepaMandate', () => {
      it('should retrieve active SEPA mandate for member', async () => {
        const data = {
          club_id: testClubId,
          member_id: TEST_MEMBER,
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder: 'Max Mustermann',
        };
        const created = await billingEngine.createSepaMandate(data);
        const retrieved = await billingEngine.getActiveSepaMandate(TEST_MEMBER, testClubId);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.is_active).toBe(true);
      });

      it('should return null for non-existent mandate', async () => {
        const mandate = await billingEngine.getActiveSepaMandate(
          '00000000-0000-0000-0000-000000009999',
          testClubId
        );
        expect(mandate).toBeNull();
      });
    });

    describe('revokeSepaMandate', () => {
      it('should revoke a SEPA mandate', async () => {
        const mandate = await billingEngine.createSepaMandate({
          club_id: testClubId,
          member_id: TEST_MEMBER,
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder: 'Max Mustermann',
        });
        const revoked = await billingEngine.revokeSepaMandate(mandate.id, 'Member requested');
        expect(revoked.is_active).toBe(false);
        expect(revoked.revoked_at).toBeDefined();
        expect(revoked.revoke_reason).toBe('Member requested');
      });
    });
  });

  describe('Dunning Management', () => {
    describe('createDunningRecord', () => {
      it('should create a dunning record', async () => {
        const invoice = await billingEngine.createInvoice(
          makeInvoice({
            items: [
              {
                description: 'Test item',
                quantity: 1,
                unit_price: 100.0,
                tax_rate: 19,
                item_type: 'other',
              },
            ],
          })
        );
        const dunning = await billingEngine.createDunningRecord({
          invoice_id: invoice.id,
          level: 1,
          due_date: '2026-05-29',
        });
        expect(dunning).toBeDefined();
        expect(dunning.invoice_id).toBe(invoice.id);
        expect(dunning.level).toBe(1);
        expect(dunning.fee_amount).toBe(5.0);
        expect(dunning.sent_at).toBeDefined();
      });

      it('should calculate correct dunning fees', async () => {
        const invoice = await billingEngine.createInvoice(
          makeInvoice({
            items: [
              {
                description: 'Test item',
                quantity: 1,
                unit_price: 100.0,
                tax_rate: 19,
                item_type: 'other',
              },
            ],
          })
        );
        const l1 = await billingEngine.createDunningRecord({
          invoice_id: invoice.id,
          level: 1,
          due_date: '2026-05-29',
        });
        const l2 = await billingEngine.createDunningRecord({
          invoice_id: invoice.id,
          level: 2,
          due_date: '2026-06-12',
        });
        const l3 = await billingEngine.createDunningRecord({
          invoice_id: invoice.id,
          level: 3,
          due_date: '2026-06-26',
        });
        expect(l1.fee_amount).toBe(5.0);
        expect(l2.fee_amount).toBe(10.0);
        expect(l3.fee_amount).toBe(20.0);
      });
    });

    describe('getDunningRecordsByInvoice', () => {
      it('should retrieve dunning records for an invoice', async () => {
        const invoice = await billingEngine.createInvoice(
          makeInvoice({
            items: [
              {
                description: 'Test item',
                quantity: 1,
                unit_price: 100.0,
                tax_rate: 19,
                item_type: 'other',
              },
            ],
          })
        );
        await billingEngine.createDunningRecord({
          invoice_id: invoice.id,
          level: 1,
          due_date: '2026-05-29',
        });
        await billingEngine.createDunningRecord({
          invoice_id: invoice.id,
          level: 2,
          due_date: '2026-06-12',
        });
        const records = await billingEngine.getDunningRecordsByInvoice(invoice.id);
        expect(records).toHaveLength(2);
        expect(records.every((d) => d.invoice_id === invoice.id)).toBe(true);
      });
    });
  });

  describe('Reporting', () => {
    describe('getMemberBillingSummary', () => {
      const itMember = hasRealTestUser ? it : it.skip;
      itMember('should calculate member billing summary', async () => {
        const memberId = TEST_MEMBER;
        const d = makeInvoice({
          member_id: memberId,
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unit_price: 100.0,
              tax_rate: 19,
              item_type: 'other',
            },
          ],
        });
        const i1 = await billingEngine.createInvoice(d);
        const i2 = await billingEngine.createInvoice(d);
        await billingEngine.updateInvoiceStatus(i1.id, 'paid');
        await billingEngine.createPayment({
          invoice_id: i1.id,
          amount: 119.0,
          payment_method: 'stripe',
        });

        const summary = await billingEngine.getMemberBillingSummary(memberId);
        expect(summary.member_id).toBe(memberId);
        expect(summary.total_invoices).toBeGreaterThanOrEqual(2);
        expect(summary.total_amount).toBeGreaterThan(0);
      });
    });

    describe('getClubBillingStats', () => {
      it('should calculate club billing statistics', async () => {
        const d = makeInvoice({
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unit_price: 100.0,
              tax_rate: 19,
              item_type: 'other',
            },
          ],
        });
        const i1 = await billingEngine.createInvoice(d);
        const i2 = await billingEngine.createInvoice(d);
        await billingEngine.updateInvoiceStatus(i1.id, 'paid');
        await billingEngine.createPayment({
          invoice_id: i1.id,
          amount: 119.0,
          payment_method: 'stripe',
        });

        const stats = await billingEngine.getClubBillingStats(testClubId);
        expect(stats.club_id).toBe(testClubId);
        expect(stats.total_invoices).toBeGreaterThanOrEqual(2);
      });
    });

    describe('getOverdueInvoices', () => {
      it('should retrieve overdue invoices', async () => {
        const d = makeInvoice({
          due_date: '2026-04-01',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unit_price: 100.0,
              tax_rate: 19,
              item_type: 'other',
            },
          ],
        });
        const i1 = await billingEngine.createInvoice(d);
        const i2 = await billingEngine.createInvoice(d);
        await billingEngine.updateInvoiceStatus(i1.id, 'overdue');
        await billingEngine.updateInvoiceStatus(i2.id, 'overdue');

        const overdue = await billingEngine.getOverdueInvoices(testClubId);
        expect(overdue.length).toBeGreaterThanOrEqual(2);
        expect(overdue.every((inv) => inv.status === 'overdue')).toBe(true);
      });
    });
  });

  describe('SEPA Direct Debit Generation', () => {
    describe('generateSepaDirectDebit', () => {
      it('should throw error when invoice has no member_id', async () => {
        const invoice = await billingEngine.createInvoice(
          makeInvoice({
            items: [
              {
                description: 'Test item',
                quantity: 1,
                unit_price: 100.0,
                tax_rate: 19,
                item_type: 'other',
              },
            ],
          })
        );
        const payment = await billingEngine.createPayment({
          invoice_id: invoice.id,
          amount: 100.0,
          payment_method: 'sepa',
        });
        await expect(billingEngine.generateSepaDirectDebit([payment.id])).rejects.toThrow(
          'no member_id'
        );
      });

      it('should throw error for no active mandate', async () => {
        const invoice = await billingEngine.createInvoice(
          makeInvoice({
            items: [
              {
                description: 'Test item',
                quantity: 1,
                unit_price: 100.0,
                tax_rate: 19,
                item_type: 'other',
              },
            ],
          })
        );
        const payment = await billingEngine.createPayment({
          invoice_id: invoice.id,
          amount: 100.0,
          payment_method: 'sepa',
        });
        await expect(billingEngine.generateSepaDirectDebit([payment.id])).rejects.toThrow(
          'no member_id'
        );
      });
    });

    describe('getPendingSepaPayments', () => {
      it('should retrieve pending SEPA payments', async () => {
        const invoice = await billingEngine.createInvoice(makeInvoice());
        const data = { invoice_id: invoice.id, amount: 100.0, payment_method: 'sepa' as const };
        await billingEngine.createPayment(data);
        await billingEngine.createPayment(data);

        const pending = await billingEngine.getPendingSepaPayments(testClubId);
        expect(pending.length).toBeGreaterThanOrEqual(2);
        expect(pending.every((p) => p.payment_method === 'sepa' && p.status === 'pending')).toBe(
          true
        );
      });
    });
  });
});
