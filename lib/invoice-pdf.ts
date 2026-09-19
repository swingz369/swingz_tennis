export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  customerName: string;
  customerEmail: string;
  customerAddress?: string;
  items: InvoiceItem[];
  /** `membership` | `season` | `adhoc` — bestimmt, unter welcher Rubrik die
   *  Rechnung in der Kostenübersicht des Mitglieds erscheint. */
  invoiceType?: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status:
    | 'paid'
    | 'pending'
    | 'overdue'
    | 'cancelled'
    | 'refunded'
    | 'open'
    | 'sent'
    | 'draft'
    | 'partially_paid'
    | 'dunning'
    | 'reminder_sent';
  notes?: string;
}
