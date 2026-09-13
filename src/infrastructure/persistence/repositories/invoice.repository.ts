/**
 * Mitglieder-Teildomäne "Rechnungen" für ADR-005 (Domäne Abrechnung, Teil 2,
 * Kern-Schnitt). Ein Repository für invoices + invoice_items +
 * invoice_installments, kein Adapter, keine Interfaces — Muster in
 * docs/ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md § 6.
 *
 * Ersetzt für diesen Ausschnitt den Service-Client-Zugriff in
 * `lib/billing/invoice.service.ts` (Singleton auf `createServiceClient()`,
 * kein RLS). RLS auf `invoices`/`invoice_items`/`invoice_installments` steht
 * bereits korrekt auf `is_club_admin(club_id)` (live per pg_policies
 * geprüft, 14.09.2026) — kein neuer Migrationsschritt nötig, nur der
 * Datenzugriff wechselt auf `getUserDb(auth)`.
 *
 * Zahlungen, Mahnwesen, SEPA, DATEV-Export und der Abrechnungslauf
 * (season-billing.service.ts) bleiben bewusst außen vor — eigener Schnitt.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:invoice.repository');

export type Invoice = Tables<'invoices'>;
export type InvoiceItem = Tables<'invoice_items'>;
export type InvoiceInstallment = Tables<'invoice_installments'>;
export type InvoiceWithItems = Invoice & {
  invoice_items: InvoiceItem[];
  invoice_installments: InvoiceInstallment[];
};

export type InvoiceListFilters = {
  status?: string;
  type?: string;
  memberId?: string;
  limit?: number;
  offset?: number;
  includeItems?: boolean;
};

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

const SELECT_WITH_ITEMS = '*, invoice_items(*), invoice_installments(*)';

export class InvoiceRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async generateInvoiceNumber(clubId: string): Promise<string> {
    const { data, error } = await this.db.rpc('generate_invoice_number', { p_club_id: clubId });
    assertNoError(error, 'Ermitteln der Rechnungsnummer fehlgeschlagen');
    return data as string;
  }

  async createInvoice(input: TablesInsert<'invoices'>): Promise<Invoice> {
    const { data, error } = await this.db.from('invoices').insert(input).select().single();
    assertNoError(error, 'Anlegen der Rechnung fehlgeschlagen');
    return data!;
  }

  async createInvoiceItems(items: TablesInsert<'invoice_items'>[]): Promise<InvoiceItem[]> {
    if (items.length === 0) return [];
    const { data, error } = await this.db.from('invoice_items').insert(items).select();
    assertNoError(error, 'Anlegen der Rechnungspositionen fehlgeschlagen');
    return data ?? [];
  }

  async findById(id: string): Promise<InvoiceWithItems | null> {
    const { data, error } = await this.db
      .from('invoices')
      .select(SELECT_WITH_ITEMS)
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, 'Lesen der Rechnung fehlgeschlagen');
    return data as InvoiceWithItems | null;
  }

  async findByClub(clubId: string, filters: InvoiceListFilters = {}): Promise<Invoice[]> {
    let query = this.db
      .from('invoices')
      .select(filters.includeItems ? SELECT_WITH_ITEMS : '*')
      .eq('club_id', clubId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.type) query = query.eq('invoice_type', filters.type);
    if (filters.memberId) query = query.eq('member_id', filters.memberId);
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset)
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    const { data, error } = await query.order('invoice_date', { ascending: false });
    assertNoError(error, 'Lesen der Rechnungen fehlgeschlagen');
    return (data ?? []) as unknown as Invoice[];
  }

  async findByMember(memberId: string, filters: InvoiceListFilters = {}): Promise<Invoice[]> {
    let query = this.db
      .from('invoices')
      .select(filters.includeItems ? SELECT_WITH_ITEMS : '*')
      .eq('member_id', memberId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.type) query = query.eq('invoice_type', filters.type);
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset)
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    const { data, error } = await query.order('created_at', { ascending: false });
    assertNoError(error, 'Lesen der Rechnungen fehlgeschlagen');
    return (data ?? []) as unknown as Invoice[];
  }

  async updateInvoice(id: string, updates: TablesUpdate<'invoices'>): Promise<Invoice | null> {
    const { data, error } = await this.db
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Aktualisieren der Rechnung fehlgeschlagen');
    return data;
  }

  /** Cascade: RLS erlaubt Admin/Superadmin des Clubs ALL auf allen drei Tabellen. */
  async deleteInvoice(id: string): Promise<void> {
    const { error: itemsError } = await this.db.from('invoice_items').delete().eq('invoice_id', id);
    assertNoError(itemsError, 'Löschen der Rechnungspositionen fehlgeschlagen');
    const { error: installmentsError } = await this.db
      .from('invoice_installments')
      .delete()
      .eq('invoice_id', id);
    assertNoError(installmentsError, 'Löschen der Ratenzahlungen fehlgeschlagen');
    const { error } = await this.db.from('invoices').delete().eq('id', id);
    assertNoError(error, 'Löschen der Rechnung fehlgeschlagen');
  }
}
