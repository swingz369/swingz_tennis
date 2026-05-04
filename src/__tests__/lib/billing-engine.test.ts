import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingEngine } from '@/lib/billing-engine';
import type { CreateInvoice, CreatePayment, CreateDunningRecord } from '@/lib/types/billing';
import { CreateSepaMandate } from '@/lib/types/billing';

describe.skip('BillingEngine (Integration Tests - Requires Database)', () => {
  let billingEngine: BillingEngine;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.SEPA_CREDITOR_ID = 'DE98ZZZ09999999999';

    billingEngine = BillingEngine.getInstance();
  });

  describe('Invoice Management', () => {
    describe('createInvoice', () => {
      it('should create an invoice with items', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
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
        expect(invoice.member_id).toBe(createInvoiceData.member_id);
        expect(invoice.due_date).toBe(createInvoiceData.due_date);
        expect(invoice.status).toBe('draft');
        expect(invoice.subtotal).toBe(59.99);
        expect(invoice.tax_amount).toBeCloseTo(11.4, 2);
        expect(invoice.total_amount).toBeCloseTo(71.39, 2);
        expect(invoice.paid_amount).toBe(0);
        expect(invoice.currency).toBe('EUR');
        expect(invoice.items).toHaveLength(2);
      });

      it('should calculate correct totals for multiple items', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          due_date: '2026-05-15',
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
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);

        expect(invoice.subtotal).toBe(80.0);
        expect(invoice.tax_amount).toBeCloseTo(5.9, 2);
        expect(invoice.total_amount).toBeCloseTo(85.9, 2);
      });

      it('should handle zero tax rate', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          due_date: '2026-05-15',
          items: [
            {
              description: 'Tax-free item',
              quantity: 1,
              unit_price: 100.0,
              tax_rate: 0,
              item_type: 'other',
            },
          ],
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);

        expect(invoice.subtotal).toBe(100.0);
        expect(invoice.tax_amount).toBe(0);
        expect(invoice.total_amount).toBe(100.0);
      });

      it('should generate unique invoice numbers', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
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
        };

        const invoice1 = await billingEngine.createInvoice(createInvoiceData);
        const invoice2 = await billingEngine.createInvoice(createInvoiceData);

        expect(invoice1.invoice_number).not.toBe(invoice2.invoice_number);
      });
    });

    describe('getInvoiceById', () => {
      it('should retrieve invoice by ID with items', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
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
        };

        const createdInvoice = await billingEngine.createInvoice(createInvoiceData);
        const retrievedInvoice = await billingEngine.getInvoiceById(createdInvoice.id);

        expect(retrievedInvoice).toBeDefined();
        expect(retrievedInvoice?.id).toBe(createdInvoice.id);
        expect(retrievedInvoice?.items).toHaveLength(1);
        expect(retrievedInvoice?.items[0].description).toBe('Test item');
      });

      it('should return null for non-existent invoice', async () => {
        const invoice = await billingEngine.getInvoiceById('non-existent-id');
        expect(invoice).toBeNull();
      });
    });

    describe('getInvoicesByMember', () => {
      it('should retrieve invoices for a member', async () => {
        const memberId = 'test-member-id';

        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: memberId,
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
        };

        await billingEngine.createInvoice(createInvoiceData);
        await billingEngine.createInvoice(createInvoiceData);

        const invoices = await billingEngine.getInvoicesByMember(memberId);

        expect(invoices).toHaveLength(2);
        expect(invoices.every((inv) => inv.member_id === memberId)).toBe(true);
      });

      it('should filter invoices by status', async () => {
        const memberId = 'test-member-id';

        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: memberId,
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
        };

        const invoice1 = await billingEngine.createInvoice(createInvoiceData);
        const invoice2 = await billingEngine.createInvoice(createInvoiceData);

        await billingEngine.updateInvoiceStatus(invoice1.id, 'sent');
        await billingEngine.updateInvoiceStatus(invoice2.id, 'paid');

        const sentInvoices = await billingEngine.getInvoicesByMember(memberId, { status: 'sent' });
        const paidInvoices = await billingEngine.getInvoicesByMember(memberId, { status: 'paid' });

        expect(sentInvoices).toHaveLength(1);
        expect(paidInvoices).toHaveLength(1);
      });

      it('should apply limit and offset', async () => {
        const memberId = 'test-member-id';

        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: memberId,
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
        };

        await billingEngine.createInvoice(createInvoiceData);
        await billingEngine.createInvoice(createInvoiceData);
        await billingEngine.createInvoice(createInvoiceData);

        const limitedInvoices = await billingEngine.getInvoicesByMember(memberId, { limit: 2 });

        expect(limitedInvoices).toHaveLength(2);
      });
    });

    describe('updateInvoiceStatus', () => {
      it('should update invoice status to sent', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
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
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);
        const updatedInvoice = await billingEngine.updateInvoiceStatus(invoice.id, 'sent');

        expect(updatedInvoice.status).toBe('sent');
        expect(updatedInvoice.sent_at).toBeDefined();
      });

      it('should update invoice status to paid', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
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
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);
        const updatedInvoice = await billingEngine.updateInvoiceStatus(invoice.id, 'paid');

        expect(updatedInvoice.status).toBe('paid');
        expect(updatedInvoice.paid_at).toBeDefined();
      });

      it('should update invoice status to cancelled', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
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
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);
        const updatedInvoice = await billingEngine.updateInvoiceStatus(invoice.id, 'cancelled');

        expect(updatedInvoice.status).toBe('cancelled');
        expect(updatedInvoice.cancelled_at).toBeDefined();
      });
    });
  });

  describe('Payment Management', () => {
    describe('createPayment', () => {
      it('should create a payment', async () => {
        const createPaymentData: CreatePayment = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          amount: 100.0,
          payment_method: 'stripe',
        };

        const payment = await billingEngine.createPayment(createPaymentData);

        expect(payment).toBeDefined();
        expect(payment.club_id).toBe(createPaymentData.club_id);
        expect(payment.member_id).toBe(createPaymentData.member_id);
        expect(payment.amount).toBe(createPaymentData.amount);
        expect(payment.payment_method).toBe(createPaymentData.payment_method);
        expect(payment.status).toBe('pending');
        expect(payment.payment_number).toBeDefined();
      });

      it('should generate unique payment numbers', async () => {
        const createPaymentData: CreatePayment = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          amount: 100.0,
          payment_method: 'stripe',
        };

        const payment1 = await billingEngine.createPayment(createPaymentData);
        const payment2 = await billingEngine.createPayment(createPaymentData);

        expect(payment1.payment_number).not.toBe(payment2.payment_number);
      });
    });

    describe('updatePaymentStatus', () => {
      it('should update payment status to completed', async () => {
        const createPaymentData: CreatePayment = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          amount: 100.0,
          payment_method: 'stripe',
        };

        const payment = await billingEngine.createPayment(createPaymentData);
        const updatedPayment = await billingEngine.updatePaymentStatus(payment.id, 'completed', {
          processed_at: new Date().toISOString(),
        });

        expect(updatedPayment.status).toBe('completed');
        expect(updatedPayment.processed_at).toBeDefined();
      });

      it('should update payment status to failed', async () => {
        const createPaymentData: CreatePayment = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          amount: 100.0,
          payment_method: 'stripe',
        };

        const payment = await billingEngine.createPayment(createPaymentData);
        const updatedPayment = await billingEngine.updatePaymentStatus(payment.id, 'failed', {
          failed_at: new Date().toISOString(),
          failure_reason: 'Insufficient funds',
        });

        expect(updatedPayment.status).toBe('failed');
        expect(updatedPayment.failed_at).toBeDefined();
        expect(updatedPayment.failure_reason).toBe('Insufficient funds');
      });
    });

    describe('getPaymentById', () => {
      it('should retrieve payment by ID', async () => {
        const createPaymentData: CreatePayment = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          amount: 100.0,
          payment_method: 'stripe',
        };

        const createdPayment = await billingEngine.createPayment(createPaymentData);
        const retrievedPayment = await billingEngine.getPaymentById(createdPayment.id);

        expect(retrievedPayment).toBeDefined();
        expect(retrievedPayment?.id).toBe(createdPayment.id);
      });

      it('should return null for non-existent payment', async () => {
        const payment = await billingEngine.getPaymentById('non-existent-id');
        expect(payment).toBeNull();
      });
    });

    describe('getPaymentByStripeId', () => {
      it('should retrieve payment by Stripe payment intent ID', async () => {
        const stripePaymentIntentId = 'pi_test_123456';

        const createPaymentData: CreatePayment = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          amount: 100.0,
          payment_method: 'stripe',
          stripe_payment_intent_id: stripePaymentIntentId,
        };

        const createdPayment = await billingEngine.createPayment(createPaymentData);
        const retrievedPayment = await billingEngine.getPaymentByStripeId(stripePaymentIntentId);

        expect(retrievedPayment).toBeDefined();
        expect(retrievedPayment?.id).toBe(createdPayment.id);
        expect(retrievedPayment?.stripe_payment_intent_id).toBe(stripePaymentIntentId);
      });

      it('should return null for non-existent Stripe payment intent ID', async () => {
        const payment = await billingEngine.getPaymentByStripeId('pi_non_existent');
        expect(payment).toBeNull();
      });
    });

    describe('getPaymentsByInvoice', () => {
      it('should retrieve payments for an invoice', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
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
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);

        const createPaymentData: CreatePayment = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          invoice_id: invoice.id,
          amount: 50.0,
          payment_method: 'stripe',
        };

        await billingEngine.createPayment(createPaymentData);
        await billingEngine.createPayment(createPaymentData);

        const payments = await billingEngine.getPaymentsByInvoice(invoice.id);

        expect(payments).toHaveLength(2);
        expect(payments.every((p) => p.invoice_id === invoice.id)).toBe(true);
      });
    });

    describe('getPaymentsByMember', () => {
      it('should retrieve payments for a member', async () => {
        const memberId = 'test-member-id';

        const createPaymentData: CreatePayment = {
          club_id: 'test-club-id',
          member_id: memberId,
          amount: 100.0,
          payment_method: 'stripe',
        };

        await billingEngine.createPayment(createPaymentData);
        await billingEngine.createPayment(createPaymentData);

        const payments = await billingEngine.getPaymentsByMember(memberId);

        expect(payments).toHaveLength(2);
        expect(payments.every((p) => p.member_id === memberId)).toBe(true);
      });
    });
  });

  describe('SEPA Mandate Management', () => {
    describe('createSepaMandate', () => {
      it('should create a SEPA mandate', async () => {
        const createMandateData = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder_name: 'Max Mustermann',
        };

        const mandate = await billingEngine.createSepaMandate(createMandateData);

        expect(mandate).toBeDefined();
        expect(mandate.club_id).toBe(createMandateData.club_id);
        expect(mandate.member_id).toBe(createMandateData.member_id);
        expect(mandate.iban).toBe(createMandateData.iban);
        expect(mandate.bic).toBe(createMandateData.bic);
        expect(mandate.account_holder_name).toBe(createMandateData.account_holder_name);
        expect(mandate.status).toBe('active');
        expect(mandate.mandate_reference).toBeDefined();
      });

      it('should generate unique mandate references', async () => {
        const createMandateData = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder_name: 'Max Mustermann',
        };

        const mandate1 = await billingEngine.createSepaMandate(createMandateData);
        const mandate2 = await billingEngine.createSepaMandate(createMandateData);

        expect(mandate1.mandate_reference).not.toBe(mandate2.mandate_reference);
      });
    });

    describe('getActiveSepaMandate', () => {
      it('should retrieve active SEPA mandate for member', async () => {
        const clubId = 'test-club-id';
        const memberId = 'test-member-id';

        const createMandateData = {
          club_id: clubId,
          member_id: memberId,
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder_name: 'Max Mustermann',
        };

        const createdMandate = await billingEngine.createSepaMandate(createMandateData);
        const retrievedMandate = await billingEngine.getActiveSepaMandate(memberId, clubId);

        expect(retrievedMandate).toBeDefined();
        expect(retrievedMandate?.id).toBe(createdMandate.id);
        expect(retrievedMandate?.status).toBe('active');
      });

      it('should return null for non-existent mandate', async () => {
        const mandate = await billingEngine.getActiveSepaMandate(
          'non-existent-member',
          'test-club-id'
        );
        expect(mandate).toBeNull();
      });
    });

    describe('revokeSepaMandate', () => {
      it('should revoke a SEPA mandate', async () => {
        const createMandateData = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder_name: 'Max Mustermann',
        };

        const mandate = await billingEngine.createSepaMandate(createMandateData);
        const revokedMandate = await billingEngine.revokeSepaMandate(
          mandate.id,
          'Member requested'
        );

        expect(revokedMandate.status).toBe('revoked');
        expect(revokedMandate.revoked_at).toBeDefined();
        expect(revokedMandate.revoked_reason).toBe('Member requested');
      });
    });
  });

  describe('Dunning Management', () => {
    describe('createDunningRecord', () => {
      it('should create a dunning record', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          due_date: '2026-05-15',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unit_price: 100.0,
              tax_rate: 19,
              item_type: 'other',
            },
          ],
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);

        const createDunningData: CreateDunningRecord = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          invoice_id: invoice.id,
          dunning_level: 1,
          due_date: '2026-05-29',
        };

        const dunning = await billingEngine.createDunningRecord(createDunningData);

        expect(dunning).toBeDefined();
        expect(dunning.club_id).toBe(createDunningData.club_id);
        expect(dunning.member_id).toBe(createDunningData.member_id);
        expect(dunning.invoice_id).toBe(createDunningData.invoice_id);
        expect(dunning.dunning_level).toBe(createDunningData.dunning_level);
        expect(dunning.dunning_fee).toBe(5.0);
        expect(dunning.status).toBe('sent');
      });

      it('should calculate correct dunning fees', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          due_date: '2026-05-15',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unit_price: 100.0,
              tax_rate: 19,
              item_type: 'other',
            },
          ],
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);

        const dunningLevel1 = await billingEngine.createDunningRecord({
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          invoice_id: invoice.id,
          dunning_level: 1,
          due_date: '2026-05-29',
        });

        const dunningLevel2 = await billingEngine.createDunningRecord({
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          invoice_id: invoice.id,
          dunning_level: 2,
          due_date: '2026-06-12',
        });

        const dunningLevel3 = await billingEngine.createDunningRecord({
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          invoice_id: invoice.id,
          dunning_level: 3,
          due_date: '2026-06-26',
        });

        expect(dunningLevel1.dunning_fee).toBe(5.0);
        expect(dunningLevel2.dunning_fee).toBe(10.0);
        expect(dunningLevel3.dunning_fee).toBe(20.0);
      });

      it('should update invoice status to dunning', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          due_date: '2026-05-15',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unit_price: 100.0,
              tax_rate: 19,
              item_type: 'other',
            },
          ],
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);

        await billingEngine.createDunningRecord({
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          invoice_id: invoice.id,
          dunning_level: 1,
          due_date: '2026-05-29',
        });

        const updatedInvoice = await billingEngine.getInvoiceById(invoice.id);

        expect(updatedInvoice?.status).toBe('dunning');
      });
    });

    describe('getDunningRecordsByInvoice', () => {
      it('should retrieve dunning records for an invoice', async () => {
        const createInvoiceData: CreateInvoice = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          due_date: '2026-05-15',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unit_price: 100.0,
              tax_rate: 19,
              item_type: 'other',
            },
          ],
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);

        await billingEngine.createDunningRecord({
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          invoice_id: invoice.id,
          dunning_level: 1,
          due_date: '2026-05-29',
        });

        await billingEngine.createDunningRecord({
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          invoice_id: invoice.id,
          dunning_level: 2,
          due_date: '2026-06-12',
        });

        const dunningRecords = await billingEngine.getDunningRecordsByInvoice(invoice.id);

        expect(dunningRecords).toHaveLength(2);
        expect(dunningRecords.every((d) => d.invoice_id === invoice.id)).toBe(true);
      });
    });
  });

  describe('Reporting', () => {
    describe('getMemberBillingSummary', () => {
      it('should calculate member billing summary', async () => {
        const memberId = 'test-member-id';
        const clubId = 'test-club-id';

        const createInvoiceData: CreateInvoice = {
          club_id: clubId,
          member_id: memberId,
          due_date: '2026-05-15',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unit_price: 100.0,
              tax_rate: 19,
              item_type: 'other',
            },
          ],
        };

        const invoice1 = await billingEngine.createInvoice(createInvoiceData);
        const invoice2 = await billingEngine.createInvoice(createInvoiceData);

        await billingEngine.updateInvoiceStatus(invoice1.id, 'paid');

        const summary = await billingEngine.getMemberBillingSummary(memberId);

        expect(summary.member_id).toBe(memberId);
        expect(summary.total_invoices).toBe(2);
        expect(summary.total_amount).toBeCloseTo(238.0, 2);
        expect(summary.paid_amount).toBeCloseTo(119.0, 2);
        expect(summary.outstanding_amount).toBeCloseTo(119.0, 2);
        expect(summary.overdue_invoices).toBe(0);
      });
    });

    describe('getClubBillingStats', () => {
      it('should calculate club billing statistics', async () => {
        const clubId = 'test-club-id';

        const createInvoiceData: CreateInvoice = {
          club_id: clubId,
          member_id: 'test-member-id',
          due_date: '2026-05-15',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unit_price: 100.0,
              tax_rate: 19,
              item_type: 'other',
            },
          ],
        };

        const invoice1 = await billingEngine.createInvoice(createInvoiceData);
        const invoice2 = await billingEngine.createInvoice(createInvoiceData);

        await billingEngine.updateInvoiceStatus(invoice1.id, 'paid');

        const stats = await billingEngine.getClubBillingStats(clubId);

        expect(stats.club_id).toBe(clubId);
        expect(stats.total_invoices).toBe(2);
        expect(stats.total_revenue).toBeCloseTo(119.0, 2);
        expect(stats.paid_amount).toBeCloseTo(119.0, 2);
        expect(stats.outstanding_amount).toBeCloseTo(119.0, 2);
      });
    });

    describe('getOverdueInvoices', () => {
      it('should retrieve overdue invoices', async () => {
        const clubId = 'test-club-id';

        const createInvoiceData: CreateInvoice = {
          club_id: clubId,
          member_id: 'test-member-id',
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
        };

        const invoice1 = await billingEngine.createInvoice(createInvoiceData);
        const invoice2 = await billingEngine.createInvoice(createInvoiceData);

        await billingEngine.updateInvoiceStatus(invoice1.id, 'overdue');
        await billingEngine.updateInvoiceStatus(invoice2.id, 'dunning');

        const overdueInvoices = await billingEngine.getOverdueInvoices(clubId);

        expect(overdueInvoices).toHaveLength(2);
        expect(overdueInvoices.every((inv) => ['overdue', 'dunning'].includes(inv.status))).toBe(
          true
        );
      });
    });
  });

  describe('SEPA Direct Debit Generation', () => {
    describe('generateSepaDirectDebit', () => {
      it('should generate SEPA direct debit XML', async () => {
        const clubId = 'test-club-id';
        const memberId = 'test-member-id';

        const createMandateData = {
          club_id: clubId,
          member_id: memberId,
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder_name: 'Max Mustermann',
        };

        const mandate = await billingEngine.createSepaMandate(createMandateData);

        const createPaymentData: CreatePayment = {
          club_id: clubId,
          member_id: memberId,
          amount: 100.0,
          payment_method: 'sepa',
          sepa_mandate_id: mandate.id,
        };

        const payment = await billingEngine.createPayment(createPaymentData);

        const result = await billingEngine.generateSepaDirectDebit([payment.id]);

        expect(result.xml).toBeDefined();
        expect(result.fileName).toBeDefined();
        expect(result.transactions).toHaveLength(1);
        expect(result.transactions[0].paymentId).toBe(payment.id);
        expect(result.transactions[0].mandateId).toBe(mandate.id);
        expect(result.transactions[0].amount).toBe(100.0);
      });

      it('should throw error for payment without SEPA mandate', async () => {
        const createPaymentData: CreatePayment = {
          club_id: 'test-club-id',
          member_id: 'test-member-id',
          amount: 100.0,
          payment_method: 'sepa',
        };

        const payment = await billingEngine.createPayment(createPaymentData);

        await expect(billingEngine.generateSepaDirectDebit([payment.id])).rejects.toThrow(
          'has no SEPA mandate'
        );
      });

      it('should throw error for inactive SEPA mandate', async () => {
        const clubId = 'test-club-id';
        const memberId = 'test-member-id';

        const createMandateData = {
          club_id: clubId,
          member_id: memberId,
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder_name: 'Max Mustermann',
        };

        const mandate = await billingEngine.createSepaMandate(createMandateData);
        await billingEngine.revokeSepaMandate(mandate.id);

        const createPaymentData: CreatePayment = {
          club_id: clubId,
          member_id: memberId,
          amount: 100.0,
          payment_method: 'sepa',
          sepa_mandate_id: mandate.id,
        };

        const payment = await billingEngine.createPayment(createPaymentData);

        await expect(billingEngine.generateSepaDirectDebit([payment.id])).rejects.toThrow(
          'is not active'
        );
      });
    });

    describe('getPendingSepaPayments', () => {
      it('should retrieve pending SEPA payments', async () => {
        const clubId = 'test-club-id';
        const memberId = 'test-member-id';

        const createMandateData = {
          club_id: clubId,
          member_id: memberId,
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder_name: 'Max Mustermann',
        };

        const mandate = await billingEngine.createSepaMandate(createMandateData);

        const createPaymentData: CreatePayment = {
          club_id: clubId,
          member_id: memberId,
          amount: 100.0,
          payment_method: 'sepa',
          sepa_mandate_id: mandate.id,
        };

        await billingEngine.createPayment(createPaymentData);
        await billingEngine.createPayment(createPaymentData);

        const pendingPayments = await billingEngine.getPendingSepaPayments(clubId);

        expect(pendingPayments).toHaveLength(2);
        expect(
          pendingPayments.every((p) => p.payment_method === 'sepa' && p.status === 'pending')
        ).toBe(true);
      });
    });
  });
});
