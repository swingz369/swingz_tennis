import { z } from 'zod';

export const InvoiceStatus = z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'dunning']);
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

export const SepaMandateStatus = z.enum(['active', 'revoked', 'expired', 'failed']);
export type SepaMandateStatus = z.infer<typeof SepaMandateStatus>;

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

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  invoice_number: z.string().min(1),
  invoice_date: z.string().or(z.date()),
  due_date: z.string().or(z.date()),
  status: InvoiceStatus,
  subtotal: z.number().nonnegative(),
  tax_amount: z.number().nonnegative(),
  total_amount: z.number().nonnegative(),
  paid_amount: z.number().nonnegative(),
  currency: z.string().length(3).default('EUR'),
  notes: z.string().nullable().optional(),
  sent_at: z.string().or(z.date()).nullable().optional(),
  paid_at: z.string().or(z.date()).nullable().optional(),
  cancelled_at: z.string().or(z.date()).nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type Invoice = z.infer<typeof InvoiceSchema>;

export const InvoiceItemSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
  tax_rate: z.number().nonnegative(),
  total_price: z.number().nonnegative(),
  item_type: InvoiceItemType,
  reference_id: z.string().uuid().nullable().optional(),
  reference_type: z.string().nullable().optional(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  invoice_id: z.string().uuid().nullable().optional(),
  payment_number: z.string().min(1),
  payment_date: z.string().or(z.date()),
  amount: z.number().positive(),
  payment_method: PaymentMethod,
  status: PaymentStatus,
  transaction_id: z.string().nullable().optional(),
  stripe_payment_intent_id: z.string().nullable().optional(),
  sepa_mandate_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  processed_at: z.string().or(z.date()).nullable().optional(),
  failed_at: z.string().or(z.date()).nullable().optional(),
  failure_reason: z.string().nullable().optional(),
  refunded_at: z.string().or(z.date()).nullable().optional(),
  refund_amount: z.number().nonnegative().nullable().optional(),
  refund_reason: z.string().nullable().optional(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type Payment = z.infer<typeof PaymentSchema>;

export const SepaMandateSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  mandate_reference: z.string().min(1),
  creditor_id: z.string().min(1),
  iban: z.string().min(1),
  bic: z.string().nullable().optional(),
  account_holder_name: z.string().min(1),
  signature_date: z.string().or(z.date()),
  status: SepaMandateStatus,
  last_used_date: z.string().or(z.date()).nullable().optional(),
  revoked_at: z.string().or(z.date()).nullable().optional(),
  revoked_reason: z.string().nullable().optional(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type SepaMandate = z.infer<typeof SepaMandateSchema>;

export const DunningRecordSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  dunning_level: z.number().int().min(1).max(3),
  dunning_date: z.string().or(z.date()),
  due_date: z.string().or(z.date()),
  dunning_fee: z.number().nonnegative(),
  original_amount: z.number().nonnegative(),
  total_amount: z.number().nonnegative(),
  status: DunningStatus,
  sent_at: z.string().or(z.date()).nullable().optional(),
  paid_at: z.string().or(z.date()).nullable().optional(),
  escalated_at: z.string().or(z.date()).nullable().optional(),
  cancelled_at: z.string().or(z.date()).nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type DunningRecord = z.infer<typeof DunningRecordSchema>;

export const CreateInvoiceSchema = z.object({
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  invoice_date: z.string().or(z.date()).optional(),
  due_date: z.string().or(z.date()),
  items: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number().int().positive(),
      unit_price: z.number().nonnegative(),
      tax_rate: z.number().nonnegative().default(19.0),
      item_type: InvoiceItemType,
      reference_id: z.string().uuid().nullable().optional(),
      reference_type: z.string().nullable().optional(),
    })
  ),
  notes: z.string().nullable().optional(),
});

export type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;

export const UpdateInvoiceSchema = z.object({
  status: InvoiceStatus.optional(),
  notes: z.string().nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
});

export type UpdateInvoice = z.infer<typeof UpdateInvoiceSchema>;

export const CreatePaymentSchema = z.object({
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  invoice_id: z.string().uuid().optional(),
  payment_date: z.string().or(z.date()).optional(),
  amount: z.number().positive(),
  payment_method: PaymentMethod,
  transaction_id: z.string().nullable().optional(),
  stripe_payment_intent_id: z.string().nullable().optional(),
  sepa_mandate_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CreatePayment = z.infer<typeof CreatePaymentSchema>;

export const CreateSepaMandateSchema = z.object({
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  iban: z.string().min(1),
  bic: z.string().nullable().optional(),
  account_holder_name: z.string().min(1),
  signature_date: z.string().or(z.date()).optional(),
});

export type CreateSepaMandate = z.infer<typeof CreateSepaMandateSchema>;

export const CreateDunningRecordSchema = z.object({
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  dunning_level: z.number().int().min(1).max(3),
  dunning_date: z.string().or(z.date()).optional(),
  due_date: z.string().or(z.date()),
  dunning_fee: z.number().nonnegative().optional(),
  notes: z.string().nullable().optional(),
});

export type CreateDunningRecord = z.infer<typeof CreateDunningRecordSchema>;

export const InvoiceWithItemsSchema = InvoiceSchema.extend({
  items: z.array(InvoiceItemSchema),
  payments: z.array(PaymentSchema).optional(),
  dunning_records: z.array(DunningRecordSchema).optional(),
});

export type InvoiceWithItems = z.infer<typeof InvoiceWithItemsSchema>;

export const MemberBillingSummarySchema = z.object({
  member_id: z.string().uuid(),
  total_invoices: z.number().int().nonnegative(),
  total_amount: z.number().nonnegative(),
  paid_amount: z.number().nonnegative(),
  outstanding_amount: z.number().nonnegative(),
  overdue_invoices: z.number().int().nonnegative(),
  active_mandates: z.number().int().nonnegative(),
});

export type MemberBillingSummary = z.infer<typeof MemberBillingSummarySchema>;

export const ClubBillingStatsSchema = z.object({
  club_id: z.string().uuid(),
  total_invoices: z.number().int().nonnegative(),
  total_revenue: z.number().nonnegative(),
  paid_amount: z.number().nonnegative(),
  outstanding_amount: z.number().nonnegative(),
  overdue_amount: z.number().nonnegative(),
  payment_methods: z.record(z.string(), z.number().int()),
  dunning_level_1: z.number().int().nonnegative(),
  dunning_level_2: z.number().int().nonnegative(),
  dunning_level_3: z.number().int().nonnegative(),
});

export type ClubBillingStats = z.infer<typeof ClubBillingStatsSchema>;
