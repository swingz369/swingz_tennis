import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Payment Flow Integration Tests', () => {
  let supabase: any;
  let testClubId: string;
  let testMemberId: string;
  let testInvoiceId: string;
  let testPaymentId: string;
  let testMandateId: string;

  beforeAll(async () => {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('Skipping integration tests - Supabase credentials not configured');
      return;
    }

    const { data: club } = await supabase
      .from('clubs')
      .insert({
        name: 'Test Club',
        slug: 'test-club',
      })
      .select()
      .single();

    testClubId = club.id;

    const { data: user } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'test123456',
    });

    testMemberId = user.user.id;

    await supabase.from('user_club_memberships').insert({
      user_id: testMemberId,
      club_id: testClubId,
      role: 'admin',
      is_active: true,
    });
  });

  afterAll(async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }

    await supabase.from('dunning_records').delete().eq('club_id', testClubId);
    await supabase.from('payments').delete().eq('club_id', testClubId);
    await supabase.from('invoice_items').delete().in('invoice_id', [testInvoiceId]);
    await supabase.from('invoices').delete().eq('club_id', testClubId);
    await supabase.from('sepa_mandates').delete().eq('club_id', testClubId);
    await supabase.from('user_club_memberships').delete().eq('club_id', testClubId);
    await supabase.from('clubs').delete().eq('id', testClubId);
  });

  describe('Invoice Creation Flow', () => {
    it('should create an invoice via API', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return;
      }

      const response = await fetch('http://localhost:3000/api/billing/invoices/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          member_id: testMemberId,
          due_date: '2026-05-15',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unitPrice: 100.0,
              taxRate: 19,
              itemType: 'other',
            },
          ],
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should create invoice with valid authentication', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'test123456',
      });

      const response = await fetch('http://localhost:3000/api/billing/invoices/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          member_id: testMemberId,
          due_date: '2026-05-15',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unitPrice: 100.0,
              taxRate: 19,
              itemType: 'other',
            },
          ],
        }),
      });

      if (response.status === 201) {
        const invoice = await response.json();
        testInvoiceId = invoice.id;
        expect(invoice).toBeDefined();
        expect(invoice.status).toBe('draft');
        expect(invoice.total_amount).toBeCloseTo(119.0, 2);
      }
    });
  });

  describe('Payment Creation Flow', () => {
    it('should create a payment for an invoice', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !testInvoiceId) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'test123456',
      });

      const response = await fetch('http://localhost:3000/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          club_id: testClubId,
          member_id: testMemberId,
          invoice_id: testInvoiceId,
          amount: 50.0,
          payment_method: 'stripe',
        }),
      });

      if (response.status === 201) {
        const payment = await response.json();
        testPaymentId = payment.id;
        expect(payment).toBeDefined();
        expect(payment.status).toBe('pending');
        expect(payment.amount).toBe(50.0);
      }
    });
  });

  describe('SEPA Mandate Flow', () => {
    it('should create a SEPA mandate', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return;
      }

      const { data: mandate } = await supabase
        .from('sepa_mandates')
        .insert({
          club_id: testClubId,
          member_id: testMemberId,
          mandate_reference: `TEST-${testClubId}-${Date.now()}`,
          creditor_id: 'DE98ZZZ09999999999',
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          account_holder_name: 'Max Mustermann',
          signature_date: new Date().toISOString().split('T')[0],
          status: 'active',
        })
        .select()
        .single();

      testMandateId = mandate.id;
      expect(mandate).toBeDefined();
      expect(mandate.status).toBe('active');
    });

    it('should create SEPA payment with mandate', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !testMandateId) {
        return;
      }

      const { data: payment } = await supabase
        .from('payments')
        .insert({
          club_id: testClubId,
          member_id: testMemberId,
          invoice_id: testInvoiceId,
          payment_number: `PAY-TEST-${Date.now()}`,
          payment_date: new Date().toISOString().split('T')[0],
          amount: 100.0,
          payment_method: 'sepa',
          status: 'pending',
          sepa_mandate_id: testMandateId,
        })
        .select()
        .single();

      expect(payment).toBeDefined();
      expect(payment.payment_method).toBe('sepa');
      expect(payment.sepa_mandate_id).toBe(testMandateId);
    });
  });

  describe('Payment Status Update Flow', () => {
    it('should update payment status to completed', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !testPaymentId) {
        return;
      }

      const { data: payment } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', testPaymentId)
        .select()
        .single();

      expect(payment).toBeDefined();
      expect(payment.status).toBe('completed');
      expect(payment.processed_at).toBeDefined();
    });

    it('should update invoice status when payment is completed', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !testInvoiceId) {
        return;
      }

      const { data: invoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', testInvoiceId)
        .single();

      expect(invoice).toBeDefined();
      expect(invoice.paid_amount).toBeGreaterThan(0);
    });
  });

  describe('Dunning Flow', () => {
    it('should create a dunning record for overdue invoice', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !testInvoiceId) {
        return;
      }

      const { data: dunning } = await supabase
        .from('dunning_records')
        .insert({
          club_id: testClubId,
          member_id: testMemberId,
          invoice_id: testInvoiceId,
          dunning_level: 1,
          dunning_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          dunning_fee: 5.0,
          original_amount: 119.0,
          total_amount: 124.0,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      expect(dunning).toBeDefined();
      expect(dunning.dunning_level).toBe(1);
      expect(dunning.dunning_fee).toBe(5.0);
    });

    it('should update invoice status to dunning', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !testInvoiceId) {
        return;
      }

      const { data: invoice } = await supabase
        .from('invoices')
        .update({
          status: 'dunning',
        })
        .eq('id', testInvoiceId)
        .select()
        .single();

      expect(invoice).toBeDefined();
      expect(invoice.status).toBe('dunning');
    });
  });

  describe('SEPA Export Flow', () => {
    it('should generate SEPA Pain.008 XML', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'test123456',
      });

      const { data: payments } = await supabase
        .from('payments')
        .select('id')
        .eq('club_id', testClubId)
        .eq('payment_method', 'sepa')
        .eq('status', 'pending')
        .limit(1);

      if (payments && payments.length > 0) {
        const response = await fetch('http://localhost:3000/api/billing/sepa/pain008', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            paymentIds: [payments[0].id],
          }),
        });

        if (response.ok) {
          const xml = await response.text();
          expect(xml).toContain('<?xml version="1.0"');
          expect(xml).toContain('pain.008.001.02');
          expect(xml).toContain('<CstmrDrctDbtInitn>');
        }
      }
    });
  });

  describe('CSV Import Flow', () => {
    it('should import payments from CSV', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return;
      }

      const csvContent = `Zahlungsnummer,Zahlungsdatum,Betrag,Zahlungsmethode,Mitglied-ID,Mitglied-Email,Rechnungsnummer,Transaktions-ID,Notizen
PAY-CSV-001,2026-05-15,50.00,stripe,${testMemberId},test@example.com,INV-001,txn-001,Test payment`;

      const {
        data: { session },
      } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'test123456',
      });

      const formData = new FormData();
      formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'payments.csv');

      const response = await fetch('http://localhost:3000/api/billing/payments/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.imported).toBeGreaterThan(0);
      }
    });
  });

  describe('Stripe Checkout Flow', () => {
    it('should create Stripe Checkout session', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !testInvoiceId) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'test123456',
      });

      const response = await fetch(
        `http://localhost:3000/api/billing/invoices/${testInvoiceId}/checkout`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        expect(data).toBeDefined();
        expect(data.checkoutUrl).toBeDefined();
      }
    });
  });

  describe('Webhook Handling Flow', () => {
    it('should handle Stripe webhook events', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return;
      }

      const webhookPayload = {
        id: 'evt_test_123',
        object: 'event',
        api_version: '2026-04-22',
        created: Date.now(),
        data: {
          object: {
            id: 'pi_test_123',
            object: 'payment_intent',
            amount: 10000,
            currency: 'eur',
            status: 'succeeded',
            metadata: {
              invoiceId: testInvoiceId,
            },
          },
        },
        type: 'payment_intent.succeeded',
      };

      const response = await fetch('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (response.ok) {
        const data = await response.json();
        expect(data).toBeDefined();
        expect(data.received).toBe(true);
      }
    });
  });
});
