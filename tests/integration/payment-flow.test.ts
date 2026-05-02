import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BillingEngine } from '@/lib/billing-engine';
import { 
  CreateInvoice, 
  CreateSepaMandate,
  InvoiceStatus,
  PaymentStatus,
  InvoiceItemType
} from '@/lib/types/billing';

describe('Payment Flow Integration Tests', () => {
  let billingEngine: BillingEngine;
  let testClubId: string;
  let testMemberId: string;

  beforeEach(() => {
    billingEngine = BillingEngine.getInstance();
    testClubId = 'test-club-' + Date.now();
    testMemberId = 'test-member-' + Date.now();
  });

  afterEach(() => {
    // Cleanup test data
  });

  describe('Complete Payment Flow', () => {
    it('should create invoice, process payment, and update status', async () => {
      // Step 1: Create an invoice
      const createInvoiceData: CreateInvoice = {
        club_id: testClubId,
        member_id: testMemberId,
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [
          {
            description: 'Membership fee',
            quantity: 1,
            unit_price: 100,
            tax_rate: 19,
            item_type: InvoiceItemType.MembershipFee,
          }
        ],
      };

      const invoice = await billingEngine.createInvoice(createInvoiceData);
      testInvoiceId = invoice.id;

      expect(invoice).toBeDefined();
      expect(invoice.status).toBe('draft');
      expect(invoice.total_amount).toBe(119);
      expect(invoice.paid_amount).toBe(0);

      // Step 2: Send the invoice
      const sentInvoice = await billingEngine.updateInvoiceStatus(invoice.id, InvoiceStatus.Sent);
      expect(sentInvoice.status).toBe('sent');
      expect(sentInvoice.sent_at).toBeDefined();

      // Step 3: Create a payment
      const createPaymentData = {
        club_id: testClubId,
        member_id: testMemberId,
        invoice_id: invoice.id,
        amount: 119,
        payment_method: 'sepa' as const,
      };

      const payment = await billingEngine.createPayment(createPaymentData);
      testPaymentId = payment.id;

      expect(payment).toBeDefined();
      expect(payment.status).toBe('pending');
      expect(payment.amount).toBe(119);

      // Step 4: Process the payment
      const processedPayment = await billingEngine.updatePaymentStatus(
        payment.id,
        PaymentStatus.Completed,
        { processed_at: new Date().toISOString() }
      );

      expect(processedPayment.status).toBe('completed');
      expect(processedPayment.processed_at).toBeDefined();

      // Step 5: Verify invoice status is updated
      const updatedInvoice = await billingEngine.getInvoiceById(invoice.id);
      expect(updatedInvoice?.status).toBe('paid');
      expect(updatedInvoice?.paid_amount).toBe(119);
      expect(updatedInvoice?.paid_at).toBeDefined();
    });

    it('should handle partial payments correctly', async () => {
      // Create an invoice
      const createInvoiceData: CreateInvoice = {
        club_id: testClubId,
        member_id: testMemberId,
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [
          {
            description: 'Membership fee',
            quantity: 1,
            unit_price: 100,
            tax_rate: 19,
            item_type: InvoiceItemType.MembershipFee,
          }
        ],
      };

      const invoice = await billingEngine.createInvoice(createInvoiceData);
      await billingEngine.updateInvoiceStatus(invoice.id, InvoiceStatus.Sent);

      // Create first partial payment
      const payment1 = await billingEngine.createPayment({
        club_id: testClubId,
        member_id: testMemberId,
        invoice_id: invoice.id,
        amount: 50,
        payment_method: 'sepa' as const,
      });

      await billingEngine.updatePaymentStatus(payment1.id, PaymentStatus.Completed);

      // Verify invoice is not fully paid
      let updatedInvoice = await billingEngine.getInvoiceById(invoice.id);
      expect(updatedInvoice?.status).toBe('sent');
      expect(updatedInvoice?.paid_amount).toBe(50);

      // Create second partial payment
      const payment2 = await billingEngine.createPayment({
        club_id: testClubId,
        member_id: testMemberId,
        invoice_id: invoice.id,
        amount: 69,
        payment_method: 'sepa' as const,
      });

      await billingEngine.updatePaymentStatus(payment2.id, PaymentStatus.Completed);

      // Verify invoice is now fully paid
      updatedInvoice = await billingEngine.getInvoiceById(invoice.id);
      expect(updatedInvoice?.status).toBe('paid');
      expect(updatedInvoice?.paid_amount).toBe(119);
    });

    it('should handle payment failure correctly', async () => {
      // Create an invoice
      const createInvoiceData: CreateInvoice = {
        club_id: testClubId,
        member_id: testMemberId,
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [
          {
            description: 'Membership fee',
            quantity: 1,
            unit_price: 100,
            tax_rate: 19,
            item_type: InvoiceItemType.MembershipFee,
          }
        ],
      };

      const invoice = await billingEngine.createInvoice(createInvoiceData);
      await billingEngine.updateInvoiceStatus(invoice.id, InvoiceStatus.Sent);

      // Create a payment
      const payment = await billingEngine.createPayment({
        club_id: testClubId,
        member_id: testMemberId,
        invoice_id: invoice.id,
        amount: 119,
        payment_method: 'sepa' as const,
      });

      // Mark payment as failed
      const failedPayment = await billingEngine.updatePaymentStatus(
        payment.id,
        PaymentStatus.Failed,
        {
          failed_at: new Date().toISOString(),
          failure_reason: 'Insufficient funds',
        }
      );

      expect(failedPayment.status).toBe('failed');
      expect(failedPayment.failed_at).toBeDefined();
      expect(failedPayment.failure_reason).toBe('Insufficient funds');

      // Verify invoice status is not updated
      const updatedInvoice = await billingEngine.getInvoiceById(invoice.id);
      expect(updatedInvoice?.status).toBe('sent');
      expect(updatedInvoice?.paid_amount).toBe(0);
    });
  });

  describe('SEPA Payment Flow', () => {
    it('should create SEPA mandate and process payment', async () => {
      // Create SEPA mandate
      const createMandateData: CreateSepaMandate = {
        club_id: testClubId,
        member_id: testMemberId,
        iban: 'DE89 3704 0044 0532 0130 00',
        account_holder_name: 'Test User',
      };

      const mandate = await billingEngine.createSepaMandate(createMandateData);
      testMandateId = mandate.id;

      expect(mandate).toBeDefined();
      expect(mandate.status).toBe('active');
      expect(mandate.iban).toBe('DE89370400440532013000');

      // Create invoice
      const createInvoiceData: CreateInvoice = {
        club_id: testClubId,
        member_id: testMemberId,
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [
          {
            description: 'Membership fee',
            quantity: 1,
            unit_price: 100,
            tax_rate: 19,
            item_type: InvoiceItemType.MembershipFee,
          }
        ],
      };

      const invoice = await billingEngine.createInvoice(createInvoiceData);
      await billingEngine.updateInvoiceStatus(invoice.id, InvoiceStatus.Sent);

      // Create SEPA payment
      const payment = await billingEngine.createPayment({
        club_id: testClubId,
        member_id: testMemberId,
        invoice_id: invoice.id,
        amount: 119,
        payment_method: 'sepa' as const,
        sepa_mandate_id: mandate.id,
      });

      expect(payment.sepa_mandate_id).toBe(mandate.id);

      // Process payment
      await billingEngine.updatePaymentStatus(payment.id, PaymentStatus.Completed);

      // Verify invoice is paid
      const updatedInvoice = await billingEngine.getInvoiceById(invoice.id);
      expect(updatedInvoice?.status).toBe('paid');

      // Verify mandate was used
      const updatedMandate = await billingEngine.getSepaMandateById(mandate.id);
      expect(updatedMandate?.last_used_date).toBeDefined();
    });

    it('should revoke SEPA mandate', async () => {
      // Create SEPA mandate
      const createMandateData: CreateSepaMandate = {
        club_id: testClubId,
        member_id: testMemberId,
        iban: 'DE89 3704 0044 0532 0130 00',
        account_holder_name: 'Test User',
      };

      const mandate = await billingEngine.createSepaMandate(createMandateData);

      // Revoke mandate
      const revokedMandate = await billingEngine.revokeSepaMandate(mandate.id, 'Member requested cancellation');

      expect(revokedMandate.status).toBe('revoked');
      expect(revokedMandate.revoked_at).toBeDefined();
      expect(revokedMandate.revoked_reason).toBe('Member requested cancellation');
    });
  });

  describe('Billing Summary and Statistics', () => {
    it('should calculate member billing summary correctly', async () => {
      // Create multiple invoices
      const invoices = [];
      for (let i = 0; i < 3; i++) {
        const createInvoiceData: CreateInvoice = {
          club_id: testClubId,
          member_id: testMemberId,
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          items: [
            {
              description: `Invoice ${i + 1}`,
              quantity: 1,
              unit_price: 100,
              tax_rate: 19,
              item_type: InvoiceItemType.MembershipFee,
            }
          ],
        };

        const invoice = await billingEngine.createInvoice(createInvoiceData);
        invoices.push(invoice);
      }

      // Pay first invoice
      const payment = await billingEngine.createPayment({
        club_id: testClubId,
        member_id: testMemberId,
        invoice_id: invoices[0].id,
        amount: 119,
        payment_method: 'sepa' as const,
      });

      await billingEngine.updatePaymentStatus(payment.id, PaymentStatus.Completed);

      // Mark second invoice as overdue
      await billingEngine.updateInvoiceStatus(invoices[1].id, InvoiceStatus.Overdue);

      // Get billing summary
      const summary = await billingEngine.getMemberBillingSummary(testMemberId);

      expect(summary).toBeDefined();
      expect(summary.total_invoices).toBe(3);
      expect(summary.total_amount).toBe(357);
      expect(summary.paid_amount).toBe(119);
      expect(summary.outstanding_amount).toBe(238);
      expect(summary.overdue_invoices).toBe(1);
    });

    it('should calculate club billing statistics correctly', async () => {
      // Create invoices for different members
      const member1Id = 'member-1-' + Date.now();
      const member2Id = 'member-2-' + Date.now();

      const invoice1 = await billingEngine.createInvoice({
        club_id: testClubId,
        member_id: member2Id,
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [
          {
            description: 'Invoice 2',
            quantity: 1,
            unit_price: 50,
            tax_rate: 19,
            item_type: InvoiceItemType.TrainingFee,
          }
        ],
      });

      // Pay first invoice
      const payment1 = await billingEngine.createPayment({
        club_id: testClubId,
        member_id: member1Id,
        invoice_id: invoice1.id,
        amount: 119,
        payment_method: 'sepa' as const,
      });

      await billingEngine.updatePaymentStatus(payment1.id, PaymentStatus.Completed);

      // Get club statistics
      const stats = await billingEngine.getClubBillingStats(testClubId);

      expect(stats).toBeDefined();
      expect(stats.total_invoices).toBeGreaterThanOrEqual(2);
      expect(stats.total_revenue).toBeGreaterThanOrEqual(119);
    });
  });
});
