import { createServiceClient } from '@/lib/supabase/service';
import { Resend } from 'resend';
import type { DunningRecord, CreateDunningRecord } from '../types/billing';
import { InvoiceService } from './invoice.service';

const supabase = createServiceClient();

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
    const dunningFee = data.fee_amount || this.calculateDunningFee(data.level);

    // Look up club_id from the invoice (club_id is NOT NULL on dunning_records)
    const { data: invoice } = await supabase
      .from('invoices')
      .select('club_id, member_id')
      .eq('id', data.invoice_id)
      .single();

    if (!invoice?.club_id) {
      throw new Error(`Cannot create dunning record: invoice ${data.invoice_id} has no club_id`);
    }

    const { data: dunning, error } = await supabase
      .from('dunning_records')
      .insert({
        invoice_id: data.invoice_id,
        club_id: invoice?.club_id ?? null,
        member_id: invoice?.member_id ?? null,
        level: data.level,
        due_date: data.due_date,
        fee_amount: dunningFee,
        sent_at: new Date().toISOString(),
        notes: data.notes ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create dunning record: ${error.message}`);
    }

    return dunning;
  }

  async getDunningRecordsByInvoice(invoiceId: string): Promise<DunningRecord[]> {
    const { data, error } = await supabase
      .from('dunning_records')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('level', { ascending: true });

    if (error) {
      throw new Error(`Failed to get dunning records: ${error.message}`);
    }

    return data || [];
  }

  private async sendDunningEmail(
    memberEmail: string,
    invoiceNumber: string,
    amount: number,
    level: number,
    dueDate: string
  ): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        `[dunning] No RESEND_API_KEY — skipping email to ${memberEmail} (invoice ${invoiceNumber}, level ${level})`
      );
      return;
    }

    const levelLabel =
      level === 1 ? '1. Mahnung' : level === 2 ? '2. Mahnung' : '3. Mahnung (Letzte)';
    const fee = this.calculateDunningFee(level);

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'SWINGZ <noreply@swingz.cloud>',
      to: memberEmail,
      subject: `${levelLabel}: Rechnung ${invoiceNumber} ist überfällig`,
      html: `
        <h2>${levelLabel}</h2>
        <p>Sehr geehrtes Mitglied,</p>
        <p>Ihre Rechnung <strong>${invoiceNumber}</strong> über <strong>€${amount.toFixed(2)}</strong> ist noch offen.</p>
        <p>Bitte begleichen Sie den ausstehenden Betrag bis zum <strong>${dueDate}</strong>.</p>
        ${fee > 0 ? `<p>Für diese Mahnung wird eine Mahngebühr von <strong>€${fee.toFixed(2)}</strong> erhoben.</p>` : ''}
        <p>Bei Fragen wenden Sie sich bitte an Ihren Verein.</p>
        <p>Mit freundlichen Grüßen,<br/>SWINGZ</p>
      `,
    });
  }

  async processAutomaticDunning(clubId: string): Promise<DunningRecord[]> {
    const overdueInvoices = await this.invoiceService.getOverdueInvoices(clubId);
    const newDunningRecords: DunningRecord[] = [];

    for (const invoice of overdueInvoices) {
      const { data: existingDunning } = await supabase
        .from('dunning_records')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('level', { ascending: false })
        .limit(1);

      const currentLevel = existingDunning?.[0]?.level || 0;
      const nextLevel = currentLevel + 1;

      // Prevent duplicate dunning on the same day for the same level
      const lastDunningDate = existingDunning?.[0]?.sent_at
        ? new Date(existingDunning[0].sent_at).toDateString()
        : null;
      if (lastDunningDate === new Date().toDateString()) {
        continue;
      }

      if (nextLevel <= 3) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        const dunning = await this.createDunningRecord({
          invoice_id: invoice.id,
          level: nextLevel,
          due_date: dueDateStr,
        });

        newDunningRecords.push(dunning);

        // Fetch member email to send notification
        if (invoice.member_id) {
          try {
            const { data: user } = await supabase
              .from('users')
              .select('email')
              .eq('id', invoice.member_id)
              .single();

            const memberEmail = user?.email;
            if (memberEmail) {
              await this.sendDunningEmail(
                memberEmail,
                invoice.invoice_number,
                invoice.amount,
                nextLevel,
                dueDateStr
              );
            } else {
              console.warn(
                `[dunning] No email found for member ${invoice.member_id}, invoice ${invoice.invoice_number}`
              );
            }
          } catch (emailError) {
            console.error(
              `[dunning] Failed to send email for invoice ${invoice.invoice_number}:`,
              emailError
            );
          }
        }
      }
    }

    return newDunningRecords;
  }
}

export const dunningService = DunningService.getInstance();
