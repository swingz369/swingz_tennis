import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import type { TablesUpdate } from '@/types/supabase';
import { getUserDb } from '@/infrastructure/db';
import {
  InvoiceRepository,
  type Invoice,
  type InvoiceWithItems,
  type InvoiceListFilters,
} from '@/infrastructure/persistence/repositories/invoice.repository';

export type CreateAdhocInvoiceItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  item_type?: string;
};

export type CreateAdhocInvoiceInput = {
  club_id: string;
  member_id?: string | null;
  due_date: string;
  notes?: string | null;
  items: CreateAdhocInvoiceItemInput[];
};

const DEFAULT_TAX_RATE = 19;

/**
 * Repository-Service für die Domäne "Rechnungen" (ADR-005, Kern-Schnitt).
 * Fachlogik (Steuerberechnung, Rechnungsnummer) hier, Datenzugriff
 * ausschliesslich im Repository — RLS erzwingt die Mandantentrennung.
 */
export class InvoiceService {
  private readonly repo: InvoiceRepository;

  constructor(auth: AuthContext) {
    this.repo = new InvoiceRepository(getUserDb(auth));
  }

  async createAdhocInvoice(input: CreateAdhocInvoiceInput): Promise<InvoiceWithItems> {
    const invoiceNumber = await this.repo.generateInvoiceNumber(input.club_id);

    const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    const taxAmount = input.items.reduce(
      (sum, i) => sum + i.quantity * i.unit_price * ((i.tax_rate ?? DEFAULT_TAX_RATE) / 100),
      0
    );

    const invoice = await this.repo.createInvoice({
      club_id: input.club_id,
      member_id: input.member_id ?? null,
      invoice_number: invoiceNumber,
      invoice_type: 'adhoc',
      due_date: input.due_date,
      status: 'draft',
      subtotal,
      amount: subtotal + taxAmount,
      tax_amount: taxAmount,
      currency: 'EUR',
      notes: input.notes ?? null,
    });

    const items = await this.repo.createInvoiceItems(
      input.items.map((i) => ({
        invoice_id: invoice.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        tax_rate: i.tax_rate ?? DEFAULT_TAX_RATE,
        item_type: i.item_type ?? 'other',
      }))
    );

    return { ...invoice, invoice_items: items, invoice_installments: [] };
  }

  async getInvoiceById(id: string): Promise<InvoiceWithItems> {
    const invoice = await this.repo.findById(id);
    if (!invoice) throw new ApiException('NOT_FOUND', 'Rechnung nicht gefunden');
    return invoice;
  }

  async getInvoicesByClub(clubId: string, filters?: InvoiceListFilters): Promise<Invoice[]> {
    return this.repo.findByClub(clubId, filters);
  }

  async getInvoicesByMember(memberId: string, filters?: InvoiceListFilters): Promise<Invoice[]> {
    return this.repo.findByMember(memberId, filters);
  }

  async updateInvoiceStatus(
    id: string,
    status: 'sent' | 'cancelled' | 'overdue' | 'reminder_sent',
    options: { cancellationReason?: string } = {}
  ): Promise<Invoice> {
    const current = await this.repo.findById(id);
    if (!current) throw new ApiException('NOT_FOUND', 'Rechnung nicht gefunden');

    const updates: TablesUpdate<'invoices'> = { status };
    if (status === 'sent') updates.sent_at = new Date().toISOString();
    if (status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
      updates.cancellation_reason = options.cancellationReason ?? null;
    }

    const updated = await this.repo.updateInvoice(id, updates);
    if (!updated) throw new ApiException('NOT_FOUND', 'Rechnung nicht gefunden');
    return updated;
  }

  async deleteInvoice(id: string): Promise<void> {
    const invoice = await this.repo.findById(id);
    if (!invoice) throw new ApiException('NOT_FOUND', 'Rechnung nicht gefunden');
    if (invoice.status === 'paid') {
      throw new ApiException(
        'CONFLICT',
        'Bezahlte Rechnungen können nicht gelöscht werden. Bitte stornieren Sie die Rechnung stattdessen.'
      );
    }
    await this.repo.deleteInvoice(id);
  }
}
