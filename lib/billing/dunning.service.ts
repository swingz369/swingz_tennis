import { createServiceClient } from '@/lib/supabase/service';
import { Resend } from 'resend';
import { createLogger } from '@/lib/logger';
import type { DunningRecord, CreateDunningRecord } from '../types/billing';
import { InvoiceService } from './invoice.service';
import { calculateVerzugszinsForInvoice, type BaseRateSnapshot } from './verzugszins';

const supabase = createServiceClient();
const log = createLogger('billing:dunning');

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

  /**
   * Mahngebühren-Staffel je Mahnstufe.
   * B2C: branchenübliche Pauschalen (streng genommen müssen Vereine vor
   * Gericht echten Schaden nachweisen — daher klein gehalten).
   * B2B: §288 Abs. 5 BGB erlaubt 40 € Verzugspauschale.
   *
   * TODO: perspektivisch pro Verein in system_settings konfigurierbar.
   */
  private calculateDunningFee(level: number, isB2B = false): number {
    if (isB2B) return 40.0; // §288 Abs. 5 BGB
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

  /**
   * Lädt die Basiszinssatz-Historie aus base_interest_rates.
   * Fallback auf leere Liste wenn Tabelle nicht existiert (Pre-Migration-Phase).
   */
  async loadBaseRates(): Promise<BaseRateSnapshot[]> {
    try {
      const { data, error } = await supabase
        .from('base_interest_rates')
        .select('valid_from, rate')
        .order('valid_from', { ascending: true });

      if (error) {
        log.warn('base_interest_rates nicht lesbar (Pre-Migration oder RLS-Block)', {
          message: error.message,
        });
        return [];
      }
      return (data ?? []).map((row: { valid_from: string; rate: number }) => ({
        validFrom: row.valid_from,
        rate: row.rate,
      }));
    } catch (err) {
      log.warn('loadBaseRates fehlgeschlagen', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Erstellt einen Mahndatensatz inkl. Verzugszins-Berechnung nach §288 BGB.
   */
  async createDunningRecord(data: CreateDunningRecord): Promise<DunningRecord> {
    const isB2B = data.is_b2b ?? false;
    const dunningFee = data.fee_amount ?? this.calculateDunningFee(data.level, isB2B);

    // Invoice-Lookup (mind. club_id + member_id + amount + due_date)
    const { data: invoice } = await supabase
      .from('invoices')
      .select('club_id, member_id, amount, due_date')
      .eq('id', data.invoice_id)
      .single();

    if (!invoice?.club_id) {
      throw new Error(`Cannot create dunning record: invoice ${data.invoice_id} has no club_id`);
    }

    // Verzugszins §288 BGB
    const baseRates = await this.loadBaseRates();
    let interestAmount = 0;
    let interestDays = 0;
    let baseRateApplied = 0;
    let totalDue = (invoice.amount ?? 0) + dunningFee;
    let legalBasis: string | null = null;

    if (baseRates.length > 0 && invoice.due_date) {
      const today = data.due_date ? new Date(data.due_date) : new Date();
      try {
        // Erstes Mahndatum = das hier (current date) — Verzug startet davor
        const result = calculateVerzugszinsForInvoice({
          invoiceAmountEur: Number(invoice.amount ?? 0),
          dueDate: new Date(invoice.due_date),
          isB2B,
          baseRates,
          firstDunningAt: today,
          computationDate: today,
        });
        interestAmount = result.totalInterest;
        interestDays = result.totalDays;
        baseRateApplied = result.lineItems[0]?.baseRate ?? 0;
        totalDue = (invoice.amount ?? 0) + dunningFee + interestAmount;
        legalBasis = result.legalBasis;
      } catch (err) {
        log.warn('Verzugszins-Berechnung fehlgeschlagen — fahre mit 0 fort', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const { data: dunning, error } = await supabase
      .from('dunning_records')
      .insert({
        invoice_id: data.invoice_id,
        club_id: invoice.club_id,
        member_id: invoice.member_id ?? null,
        level: data.level,
        due_date: data.due_date,
        fee_amount: dunningFee,
        original_amount: invoice.amount ?? 0,
        sent_at: new Date().toISOString(),
        notes: data.notes ?? null,
        interest_amount: interestAmount,
        interest_days: interestDays,
        is_b2b: isB2B,
        base_rate_applied: baseRateApplied,
        total_due: totalDue,
        legal_basis: legalBasis,
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
    dueDate: string,
    isB2B: boolean,
    interestAmount: number,
    totalDue: number,
    legalBasis: string | null
  ): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      log.warn('No RESEND_API_KEY — skipping email', { to: memberEmail, level });
      return;
    }

    const levelLabel =
      level === 1 ? '1. Mahnung' : level === 2 ? '2. Mahnung' : '3. Mahnung (Letzte)';
    const fee = this.calculateDunningFee(level, isB2B);

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
        ${interestAmount > 0 ? `<p>Aufgelaufene Verzugszinsen <strong>${legalBasis ?? '§288 BGB'}</strong>: <strong>€${interestAmount.toFixed(2)}</strong></p>` : ''}
        <p><strong>Gesamtforderung: €${totalDue.toFixed(2)}</strong></p>
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
          level: Number(nextLevel),
          due_date: dueDateStr,
          is_b2b: false,
        });

        newDunningRecords.push(dunning);

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
                dueDateStr,
                dunning.is_b2b ?? false,
                dunning.interest_amount ?? 0,
                dunning.total_due ?? invoice.amount,
                dunning.legal_basis
              );
            } else {
              log.warn('No email found for member', {
                memberId: invoice.member_id,
                invoice: invoice.invoice_number,
              });
            }
          } catch (emailError) {
            log.error('Failed to send dunning email', {
              invoice: invoice.invoice_number,
              error: emailError instanceof Error ? emailError.message : String(emailError),
            });
          }
        }
      }
    }

    return newDunningRecords;
  }
}

export const dunningService = DunningService.getInstance();
