export type InvoiceType = 'season' | 'membership' | 'adhoc';
export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'sent'
  | 'reminder_sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'dunning'
  | 'cancelled'
  | 'refunded';
export type InstallmentStatus = 'pending' | 'paid' | 'overdue';
export type BalanceEntryReferenceType = 'group_change' | 'invoice' | 'payment' | 'manual';
export type PaymentMethod = 'sepa' | 'transfer' | 'cash' | 'stripe';

export interface Invoice {
  id: string;
  club_id: string;
  member_id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  season_id: string | null;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  amount: number;
  paid_amount: number;
  currency: string;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total_price: number;
  item_type: string;
  reference_id: string | null;
  reference_type: string | null;
  datev_account_number: string | null;
}

export interface InvoiceInstallment {
  id: string;
  invoice_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: InstallmentStatus;
  paid_at: string | null;
  payment_id: string | null;
}

export interface MemberBalance {
  id: string;
  member_id: string;
  club_id: string;
  balance: number;
  updated_at: string;
}

export interface MemberBalanceEntry {
  id: string;
  member_balance_id: string;
  amount: number;
  reason: string;
  reference_type: BalanceEntryReferenceType | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface GenerateSeasonInvoiceParams {
  club_id: string;
  member_id: string;
  season_id: string;
  fee_configuration_id: string;
  installment_count: number;
  installment_due_dates: string[];
  due_date: string;
  created_by: string;
}

export interface GroupChangeParams {
  club_id: string;
  member_id: string;
  old_group_id: string;
  new_group_id: string;
  change_date: string;
  created_by: string;
}

export interface GroupChangeCreditResult {
  credit_amount: number;
  charge_amount: number;
  net_delta: number;
  new_balance: number;
}
