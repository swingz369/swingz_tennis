import { createClient } from '@supabase/supabase-js';
import type { DunningRecord, CreateDunningRecord } from '../types/billing';
import { InvoiceService } from './invoice.service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class DunningService {
  private static instance: DunningService;
  private invoiceService = InvoiceService.getInstance();

  private constructor() {}

  public static getInstance(): DunningService {
    if (!DunningService.instance) {
      DunningService.instance = new DunningService();
    }
    return DunningService.instance;
  }

  private calculateDunningFee(level: number): number {
    switch (level) {
      case 1:
        return 5.0;
      case 2:
        return 10.0;
      case 3:
        return 20.0;
      default:
        return 0;
    }
  }

  async createDunningRecord(data: CreateDunningRecord): Promise<DunningRecord> {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('total_amount')
      .eq('id', data.invoice_id)
      .single();

    if (invoiceError) {
      throw new Error(`Failed to get invoice: ${invoiceError.message}`);
    }

    const dunningFee = data.dunning_fee || this.calculateDunningFee(data.dunning_level);
    const totalAmount = invoice.total_amount + dunningFee;

    const { data: dunning, error } = await supabase
      .from('dunning_records')
      .insert({
        club_id: data.club_id,
        member_id: data.member_id,
        invoice_id: data.invoice_id,
        dunning_level: data.dunning_level,
        dunning_date: data.dunning_date || new Date().toISOString().split('T')[0],
        due_date: data.due_date,
        dunning_fee: dunningFee,
        original_amount: invoice.total_amount,
        total_amount: totalAmount,
        status: 'sent',
        sent_at: new Date().toISOString(),
        notes: data.notes,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create dunning record: ${error.message}`);
    }

    await this.invoiceService.updateInvoiceStatus(data.invoice_id, 'dunning');

    return dunning;
  }

  async getDunningRecordsByInvoice(invoiceId: string): Promise<DunningRecord[]> {
    const { data, error } = await supabase
      .from('dunning_records')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('dunning_level', { ascending: true });

    if (error) {
      throw new Error(`Failed to get dunning records: ${error.message}`);
    }

    return data || [];
  }

  async processAutomaticDunning(clubId: string): Promise<DunningRecord[]> {
    const overdueInvoices = await this.invoiceService.getOverdueInvoices(clubId);
    const newDunningRecords: DunningRecord[] = [];

    for (const invoice of overdueInvoices) {
      const { data: existingDunning } = await supabase
        .from('dunning_records')
        .select('*')
        .eq('invoice_id', invoice.id)
        .eq('status', 'sent')
        .order('dunning_level', { ascending: false })
        .limit(1);

      const currentLevel = existingDunning?.[0]?.dunning_level || 0;
      const { data: level } = await supabase.rpc('calculate_dunning_level', {
        p_invoice_id: invoice.id,
      });

      if (level && level > currentLevel) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        const dunning = await this.createDunningRecord({
          club_id: invoice.club_id,
          member_id: invoice.member_id,
          invoice_id: invoice.id,
          dunning_level: level,
          due_date: dueDate.toISOString().split('T')[0],
        });

        newDunningRecords.push(dunning);
      }
    }

    return newDunningRecords;
  }
}

export const dunningService = DunningService.getInstance();
