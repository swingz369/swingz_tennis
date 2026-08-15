import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { BillingEngine } from '@/lib/billing-engine';
import type { CreateInvoice, CreateSepaMandate } from '@/lib/types/billing';
import { hasIntegrationEnv } from '../helpers/integration';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const hasSupabase = hasIntegrationEnv();
const hasSepaCreditorId = !!process.env.SEPA_CREDITOR_ID;
const describeIntegration = hasSupabase ? describe : describe.skip;
const describeSepa = hasSupabase && hasSepaCreditorId ? describe : describe.skip;

describeIntegration('Payment Flow Integration Tests', () => {
  let supabase: ReturnType<typeof createClient>;
  let billingEngine: BillingEngine;
  let testClubId = '';
  let testMemberId = '';
  let testInvoiceId = '';
  let testPaymentId = '';
  let testMandateId = '';

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    billingEngine = BillingEngine.getInstance();

    // Create test club
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .insert({ name: `Payment Test Club ${Date.now()}`, opening_hours: {} } as never)
      .select('id')
      .single();

    if (clubError || !club) {
      throw new Error(`Failed to create test club: ${clubError?.message}`);
    }
    testClubId = (club as { id: string }).id;

    // Create test user in auth.users (real user for FK compliance)
    const email = `payment-test-${Date.now()}@swingz.local`;
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: 'test123456!A',
      email_confirm: true,
      user_metadata: { role: 'member' },
    });

    if (authError || !authUser?.user) {
      throw new Error(`Failed to create auth user: ${authError?.message}`);
    }
    testMemberId = authUser.user.id;

    // Insert into users/profile table
    // The `as any` cast bypasses Supabase's typed-schema mismatch (test
    // uses dynamic field names that the generated types don't know about).
    // NB: public.users hat keine role-Spalte — Rolle lebt in user_club_memberships.
    const { error: profileError } = await supabase.from('users').upsert({
      id: testMemberId,
      email,
      full_name: 'Payment Test User',
      created_at: new Date().toISOString(),
    } as any);
    if (profileError) {
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }
  });

  afterAll(async () => {
    if (!hasSupabase) return;

    if (testInvoiceId) {
      // Clean up invoice-related records
      const { data: paymentRecords } = await supabase
        .from('payments')
        .select('id')
        .eq('invoice_id', testInvoiceId);
      if (paymentRecords?.length) {
        await supabase
          .from('payments')
          .delete()
          .in(
            'id',
            (paymentRecords as Array<{ id: string }>).map((p) => p.id)
          );
      }

      await supabase.from('dunning_records').delete().eq('invoice_id', testInvoiceId);
      await supabase.from('invoice_items').delete().eq('invoice_id', testInvoiceId);
    }

    if (testClubId) {
      await supabase.from('invoices').delete().eq('club_id', testClubId);
      await supabase.from('sepa_mandates').delete().eq('club_id', testClubId);
      await supabase.from('user_club_memberships').delete().eq('club_id', testClubId);
      await supabase.from('clubs').delete().eq('id', testClubId);
    }

    if (testMemberId) {
      await supabase.auth.admin.deleteUser(testMemberId);
      await supabase.from('users').delete().eq('id', testMemberId);
    }
  });

  describe('Invoice → Payment → SEPA Mandate → Pain.008 Full Flow', () => {
    it('Step 1: should create an invoice', async () => {
      const createData: CreateInvoice = {
        club_id: testClubId,
        member_id: testMemberId,
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        items: [
          {
            description: 'Mitgliedsbeitrag Juni 2026',
            quantity: 1,
            unit_price: 50.0,
            tax_rate: 19,
            item_type: 'membership_fee',
          },
          {
            description: 'Trainingsgebühr',
            quantity: 2,
            unit_price: 25.0,
            tax_rate: 7,
            item_type: 'training_fee',
          },
        ],
      };

      const invoice = await billingEngine.createInvoice(createData);
      testInvoiceId = invoice.id;

      expect(invoice).toBeDefined();
      expect(invoice.club_id).toBe(testClubId);
      expect(invoice.member_id).toBe(testMemberId);
      expect(invoice.status).toBe('draft');
      expect(invoice.invoice_type).toBe('adhoc');
      expect(invoice.currency).toBe('EUR');
      expect(invoice.items).toHaveLength(2);
      // Subtotal = 50 + 50 = 100. Tax = 50*0.19 + 50*0.07 = 9.5 + 3.5 = 13. Total = 113
      expect(invoice.amount).toBeCloseTo(113, 2);
      expect(invoice.tax_amount).toBeCloseTo(13, 2);
    });

    it('Step 2: should update invoice status to open', async () => {
      const updated = await billingEngine.updateInvoiceStatus(testInvoiceId, 'open');
      expect(updated.status).toBe('open');
    });

    it('Step 3: should create a payment for the invoice', async () => {
      const payment = await billingEngine.createPayment({
        invoice_id: testInvoiceId,
        amount: 113.0,
        payment_method: 'sepa',
      });
      testPaymentId = payment.id;

      expect(payment).toBeDefined();
      expect(payment.invoice_id).toBe(testInvoiceId);
      expect(payment.amount).toBe(113.0);
      expect(payment.payment_method).toBe('sepa');
      expect(payment.status).toBe('pending');
      expect(payment.external_id).toBeDefined();
    });

    (hasSepaCreditorId ? it : it.skip)('Step 4: should create a SEPA mandate', async () => {
      const mandateData: CreateSepaMandate = {
        club_id: testClubId,
        member_id: testMemberId,
        iban: 'DE89370400440532013000',
        bic: 'COBADEFFXXX',
        account_holder: 'Max Mustermann',
        bank_name: 'Commerzbank',
        address: {
          street: 'Musterstraße 1',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      };

      const mandate = await billingEngine.createSepaMandate(mandateData);
      testMandateId = mandate.id;

      expect(mandate).toBeDefined();
      expect(mandate.club_id).toBe(testClubId);
      expect(mandate.member_id).toBe(testMemberId);
      expect(mandate.iban).toBe('DE89370400440532013000');
      expect(mandate.account_holder).toBe('Max Mustermann');
      expect(mandate.is_active).toBe(true);
      expect(mandate.mandate_reference).toBeDefined();
    });

    (hasSepaCreditorId ? it : it.skip)('Step 5: should generate SEPA Pain.008 XML', async () => {
      const result = await billingEngine.generateSepaDirectDebit([testPaymentId], {
        creditorAccountIban: process.env.SEPA_CREDITOR_IBAN || 'DE12500105170648489890', // test fallback
      });

      expect(result).toBeDefined();
      expect(result.xml).toContain('<?xml version="1.0"');
      expect(result.xml).toContain('pain.008.001.02');
      expect(result.xml).toContain('<CstmrDrctDbtInitn>');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].paymentId).toBe(testPaymentId);
      expect(result.transactions[0].mandateId).toBe(testMandateId);
      expect(result.transactions[0].amount).toBe(113.0);
    });

    it('Step 6: should complete the payment', async () => {
      if (!testPaymentId) {
        console.warn('Step 6 SKIPPED: no payment created (Step 3 may have failed)');
        return;
      }
      const completed = await billingEngine.updatePaymentStatus(testPaymentId, 'completed');
      expect(completed.status).toBe('completed');
      expect(completed.paid_at).toBeDefined();
    });

    it('Step 7: should mark invoice as paid', async () => {
      if (!testInvoiceId) {
        console.warn('Step 7 SKIPPED: no invoice created (Step 1 may have failed)');
        return;
      }
      const paid = await billingEngine.updateInvoiceStatus(testInvoiceId, 'paid');
      expect(paid.status).toBe('paid');
      expect(paid.paid_at).toBeDefined();
    });
  });

  describeSepa('SEPA Mandate Lifecycle', () => {
    it('should retrieve active mandate', async () => {
      const mandate = await billingEngine.getActiveSepaMandate(testMemberId, testClubId);
      expect(mandate).toBeDefined();
      expect(mandate?.is_active).toBe(true);
      expect(mandate?.member_id).toBe(testMemberId);
    });

    it('should revoke a mandate', async () => {
      const revoked = await billingEngine.revokeSepaMandate(testMandateId, 'Member cancelled');
      expect(revoked.is_active).toBe(false);
      expect(revoked.revoked_at).toBeDefined();
      expect(revoked.revoke_reason).toBe('Member cancelled');
    });

    it('should return null for revoked mandate', async () => {
      const mandate = await billingEngine.getActiveSepaMandate(testMemberId, testClubId);
      expect(mandate).toBeNull();
    });
  });

  describe('Dunning Flow', () => {
    it('should create dunning records for overdue invoices', async () => {
      let overdueInvoiceId = '';

      try {
        // Create an overdue invoice
        const overdueInvoice = await billingEngine.createInvoice({
          club_id: testClubId,
          member_id: testMemberId,
          due_date: '2026-01-01',
          items: [
            {
              description: 'Overdue item',
              quantity: 1,
              unit_price: 100.0,
              tax_rate: 19,
              item_type: 'other',
            },
          ],
        });
        overdueInvoiceId = overdueInvoice.id;

        // Set to overdue
        await billingEngine.updateInvoiceStatus(overdueInvoice.id, 'overdue');

        // Create dunning records
        const d1 = await billingEngine.createDunningRecord({
          invoice_id: overdueInvoice.id,
          level: 1,
          due_date: '2026-01-15',
          is_b2b: false,
        });

        expect(d1).toBeDefined();
        expect(d1.invoice_id).toBe(overdueInvoice.id);
        expect(d1.level).toBe(1);
        expect(d1.fee_amount).toBe(5.0);
        expect(d1.sent_at).toBeDefined();

        const d2 = await billingEngine.createDunningRecord({
          invoice_id: overdueInvoice.id,
          level: 2,
          due_date: '2026-01-29',
          is_b2b: false,
        });

        expect(d2.level).toBe(2);
        expect(d2.fee_amount).toBe(10.0);

        // Verify dunning records retrieval
        const records = await billingEngine.getDunningRecordsByInvoice(overdueInvoice.id);
        expect(records).toHaveLength(2);
      } finally {
        // Always clean up dunning test data
        if (overdueInvoiceId) {
          await supabase.from('dunning_records').delete().eq('invoice_id', overdueInvoiceId);
          await supabase.from('invoice_items').delete().eq('invoice_id', overdueInvoiceId);
          await supabase.from('invoices').delete().eq('id', overdueInvoiceId);
        }
      }
    });
  });

  describe('Billing Stats', () => {
    it('should calculate club billing stats', async () => {
      const stats = await billingEngine.getClubBillingStats(testClubId);
      expect(stats.club_id).toBe(testClubId);
      expect(stats.total_invoices).toBeGreaterThanOrEqual(1);
      expect(stats.total_revenue).toBeGreaterThanOrEqual(0);
    });

    it('should calculate member billing summary', async () => {
      const summary = await billingEngine.getMemberBillingSummary(testMemberId);
      expect(summary.member_id).toBe(testMemberId);
      expect(summary.total_invoices).toBeGreaterThanOrEqual(1);
      expect(summary.total_amount).toBeGreaterThan(0);
    });

    it('should retrieve overdue invoices', async () => {
      const overdue = await billingEngine.getOverdueInvoices(testClubId);
      expect(Array.isArray(overdue)).toBe(true);
    });
  });
});
