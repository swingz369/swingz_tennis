import { z } from 'zod';

export const InvoiceStatus = z.enum(['draft', 'open', 'paid', 'overdue', 'cancelled', 'refunded']);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

export const PaymentMethod = z.enum(['sepa', 'stripe', 'cash', 'bank_transfer', 'other']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const PaymentStatus = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded',
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const DunningStatus = z.enum(['sent', 'paid', 'escalated', 'cancelled']);
export type DunningStatus = z.infer<typeof DunningStatus>;

export const InvoiceItemType = z.enum([
  'membership_fee',
  'training_fee',
  'court_fee',
  'dunning_fee',
  'other',
]);
export type InvoiceItemType = z.infer<typeof InvoiceItemType>;

// === DB-aligned schemas ===

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  member_id: z.string().uuid().nullable(),
  trainer_id: z.string().uuid().nullable(),
  invoice_number: z.string().min(1),
  type: z.string().nullable(),
  amount: z.number(),
  tax_amount: z.number().nullable(),
  currency: z.string().nullable(),
  status: z.string().nullable(),
  due_date: z.string().nullable(),
  paid_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export const InvoiceItemSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  description: z.string().min(1),
  quantity: z.number().nullable(),
  unit_price: z.number(),
  total_price: z.number().nullable(),
  created_at: z.string().nullable(),
});
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  amount: z.number(),
  currency: z.string().nullable(),
  payment_method: z.string().nullable(),
  status: z.string().nullable(),
  external_id: z.string().nullable(),
  paid_at: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const SepaMandateSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid().nullable(),
  member_id: z.string().uuid(),
  account_holder: z.string(),
  iban: z.string(),
  bic: z.string(),
  bank_name: z.string(),
  address: z.unknown(),
  mandate_reference: z.string(),
  creditor_id: z.string(),
  signature_date: z.string(),
  is_active: z.boolean(),
  revoked_at: z.string().nullable(),
  revoke_reason: z.string().nullable(),
  created_at: z.string(),
});
export type SepaMandate = z.infer<typeof SepaMandateSchema>;

export const DunningRecordSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  level: z.number().nullable(),
  sent_at: z.string().nullable(),
  due_date: z.string().nullable(),
  fee_amount: z.number().nullable(),
  notes: z.string().nullable(),
});
export type DunningRecord = z.infer<typeof DunningRecordSchema>;

// === Create/Input schemas (keep original API shape, map internally) ===

export const CreateInvoiceSchema = z.object({
  club_id: z.string().uuid(),
  member_id: z.string().uuid().nullable().optional(),
  due_date: z.string(),
  items: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number(),
      unit_price: z.number(),
      tax_rate: z.number().default(19),
      item_type: z.string().optional(),
    })
  ),
  notes: z.string().nullable().optional(),
});
export type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;

export const CreatePaymentSchema = z.object({
  invoice_id: z.string().uuid().optional(),
  amount: z.number().positive(),
  payment_method: z.string(),
  external_id: z.string().nullable().optional(),
});
export type CreatePayment = z.infer<typeof CreatePaymentSchema>;

export const CreateSepaMandateSchema = z.object({
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  iban: z.string().min(1),
  bic: z.string().nullable().optional(),
  account_holder: z.string().min(1),
  bank_name: z.string().optional(),
  address: z.unknown().optional(),
  signature_date: z.string().optional(),
});
export type CreateSepaMandate = z.infer<typeof CreateSepaMandateSchema>;

export const CreateDunningRecordSchema = z.object({
  invoice_id: z.string().uuid(),
  level: z.number().int().min(1).max(3),
  due_date: z.string(),
  fee_amount: z.number().optional(),
  notes: z.string().nullable().optional(),
});
export type CreateDunningRecord = z.infer<typeof CreateDunningRecordSchema>;

// === Composite types ===

export const InvoiceWithItemsSchema = InvoiceSchema.extend({
  items: z.array(InvoiceItemSchema),
  payments: z.array(PaymentSchema).optional(),
  dunning_records: z.array(DunningRecordSchema).optional(),
});
export type InvoiceWithItems = z.infer<typeof InvoiceWithItemsSchema>;

export const MemberBillingSummarySchema = z.object({
  member_id: z.string().uuid(),
  total_invoices: z.number().int().nonnegative(),
  total_amount: z.number(),
  paid_amount: z.number(),
  outstanding_amount: z.number(),
  overdue_invoices: z.number().int().nonnegative(),
  active_mandates: z.number().int().nonnegative(),
});
export type MemberBillingSummary = z.infer<typeof MemberBillingSummarySchema>;

export const ClubBillingStatsSchema = z.object({
  club_id: z.string().uuid(),
  total_invoices: z.number().int().nonnegative(),
  total_revenue: z.number(),
  paid_amount: z.number(),
  outstanding_amount: z.number(),
  overdue_amount: z.number(),
  payment_methods: z.record(z.string(), z.number().int()),
  dunning_level_1: z.number().int().nonnegative(),
  dunning_level_2: z.number().int().nonnegative(),
  dunning_level_3: z.number().int().nonnegative(),
});
export type ClubBillingStats = z.infer<typeof ClubBillingStatsSchema>;
