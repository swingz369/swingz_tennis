import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
import { systemDb } from '@/infrastructure/db';
import { EmailService } from '@/infrastructure/email/email.service';
import {
  DunningRepository,
  type DunningRecord,
} from '@/infrastructure/persistence/repositories/dunning.repository';
import { InvoiceRepository } from '@/infrastructure/persistence/repositories/invoice.repository';
import { calculateVerzugszinsForInvoice, type BaseRateSnapshot } from '@/lib/billing/verzugszins';
import type { CreateDunningRecord } from '@/lib/types/billing';

const log = createLogger('application:dunning.service');

export interface DunningKpis {
  totalRecords: number;
  thisMonthCount: number;
  totalInterest: number;
  openRecords: number;
  openAmount: number;
  byLevel: { level1: number; level2: number; level3: number };
  overdueInvoices: number;
}

/**
 * Teildomäne "Mahnwesen" für ADR-005 (Domäne Abrechnung, Teil 2,
 * Zahlungsseite). Fachlogik (Mahngebühren-Staffel, Verzugszins nach §288
 * BGB) hier, Datenzugriff ausschliesslich im Repository.
 *
 * Nimmt den Supabase-Client statt AuthContext entgegen, weil der Cron-Lauf
 * (app/api/cron/billing-overdue/route.ts) ohne User-Kontext läuft und daher
 * systemDb() statt getUserDb(auth) übergibt — analog zu
 * trial-training.service.ts.
 */
export class DunningService {
  private readonly repo: DunningRepository;
  private readonly invoiceRepo: InvoiceRepository;

  constructor(db: AuthContext['supabase']) {
    this.repo = new DunningRepository(db);
    this.invoiceRepo = new InvoiceRepository(db);
  }

  /**
   * Mahngebühren-Staffel je Mahnstufe.
   * B2C: branchenübliche Pauschalen (streng genommen müssen Vereine vor
   * Gericht echten Schaden nachweisen — daher klein gehalten).
   * B2B: §288 Abs. 5 BGB erlaubt 40 € Verzugspauschale.
   */
  private calculateDunningFee(level: number, isB2B = false): number {
    if (isB2B) return 40.0;
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
   * Basiszinssatz-Historie aus base_interest_rates — globale Referenztabelle
   * ohne Club-Bezug, RLS beschränkt sie auf is_superadmin(). Läuft deshalb
   * immer über systemDb(), unabhängig vom Aufrufkontext (Admin oder Cron).
   */
  async loadBaseRates(): Promise<BaseRateSnapshot[]> {
    try {
      const system = systemDb(
        'Basiszinssatz-Historie lesen (globale Referenztabelle, RLS nur superadmin)'
      );
      const { data, error } = await system
        .from('base_interest_rates')
        .select('valid_from, rate')
        .order('valid_from', { ascending: true });

      if (error) {
        log.warn('base_interest_rates nicht lesbar', { message: error.message });
        return [];
      }
      return (data ?? []).map((row) => ({ validFrom: row.valid_from, rate: row.rate }));
    } catch (err) {
      log.warn('loadBaseRates fehlgeschlagen', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /** Erstellt einen Mahndatensatz inkl. Verzugszins-Berechnung nach §288 BGB. */
  async createDunningRecord(data: CreateDunningRecord): Promise<DunningRecord> {
    const isB2B = data.is_b2b ?? false;
    const dunningFee = data.fee_amount ?? this.calculateDunningFee(data.level, isB2B);

    const invoice = await this.invoiceRepo.findById(data.invoice_id);
    if (!invoice?.club_id) {
      throw new ApiException('NOT_FOUND', `Rechnung ${data.invoice_id} hat keine club_id`);
    }

    const baseRates = await this.loadBaseRates();
    let interestAmount = 0;
    let interestDays = 0;
    let baseRateApplied = 0;
    let totalDue = (invoice.amount ?? 0) + dunningFee;
    let legalBasis: string | null = null;

    if (baseRates.length > 0 && invoice.due_date) {
      const today = data.due_date ? new Date(data.due_date) : new Date();
      try {
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

    return this.repo.create({
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
    });
  }

  async getDunningRecordsByInvoice(invoiceId: string): Promise<DunningRecord[]> {
    return this.repo.findByInvoiceId(invoiceId);
  }

  /** Mahnläufe + Kennzahlen für das Mahnlauf-Dashboard. */
  async getDashboardData(clubId: string): Promise<{ records: DunningRecord[]; kpis: DunningKpis }> {
    const [records, overdueInvoices] = await Promise.all([
      this.repo.findByClub(clubId, 100),
      this.invoiceRepo.countOverdueByClub(clubId),
    ]);
    return { records, kpis: computeKpis(records, overdueInvoices) };
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
    const levelLabel =
      level === 1 ? '1. Mahnung' : level === 2 ? '2. Mahnung' : '3. Mahnung (Letzte)';
    const fee = this.calculateDunningFee(level, isB2B);

    await new EmailService().sendEmail({
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

  /**
   * Läuft ausschliesslich per Cron (app/api/cron/billing-overdue/route.ts),
   * also immer mit `this.db` = systemDb(). Mitglieds-E-Mails werden deshalb
   * explizit über systemDb() gelesen statt über `this.db` — bleibt korrekt,
   * falls diese Methode jemals mit einem User-Kontext aufgerufen wird.
   */
  async processAutomaticDunning(clubId: string): Promise<DunningRecord[]> {
    const overdueInvoices = await this.invoiceRepo.findByClub(clubId, { status: 'overdue' });
    const newDunningRecords: DunningRecord[] = [];

    for (const invoice of overdueInvoices) {
      const existingDunning = await this.repo.findLatestByInvoiceId(invoice.id);
      const currentLevel = existingDunning?.level ?? 0;
      const nextLevel = currentLevel + 1;

      const lastDunningDate = existingDunning?.sent_at
        ? new Date(existingDunning.sent_at).toDateString()
        : null;
      if (lastDunningDate === new Date().toDateString()) {
        continue;
      }

      if (nextLevel > 3) continue;

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
          const system = systemDb(
            'Mahnungs-E-Mail: Mitglieds-E-Mail lesen (Cron, kein User-Kontext)'
          );
          const { data: user } = await system
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
              dunning.is_b2b,
              dunning.interest_amount,
              dunning.total_due,
              dunning.legal_basis
            );
          } else {
            log.warn('Keine E-Mail für Mitglied gefunden', {
              memberId: invoice.member_id,
              invoice: invoice.invoice_number,
            });
          }
        } catch (emailError) {
          log.error(
            'Mahnungs-E-Mail konnte nicht versendet werden',
            emailError instanceof Error ? emailError : new Error(String(emailError))
          );
        }
      }
    }

    return newDunningRecords;
  }
}

function computeKpis(records: DunningRecord[], overdueInvoices: number): DunningKpis {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let thisMonthCount = 0;
  let totalInterest = 0;
  let openRecords = 0;
  let openAmount = 0;
  let level1 = 0;
  let level2 = 0;
  let level3 = 0;

  for (const r of records) {
    if (r.sent_at && new Date(r.sent_at) >= monthStart) thisMonthCount += 1;
    totalInterest += Number(r.interest_amount ?? 0);
    const isOpen = !r.paid_at && !r.cancelled_at && (r.status ?? '') !== 'paid';
    if (isOpen) {
      openRecords += 1;
      openAmount += Number(r.total_due ?? r.total_amount ?? 0);
    }
    const lvl = Number(r.level ?? 0);
    if (lvl === 1) level1 += 1;
    else if (lvl === 2) level2 += 1;
    else if (lvl === 3) level3 += 1;
  }

  return {
    totalRecords: records.length,
    thisMonthCount,
    totalInterest,
    openRecords,
    openAmount,
    byLevel: { level1, level2, level3 },
    overdueInvoices,
  };
}
