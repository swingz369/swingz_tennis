/**
 * Season Billing Service (ADR-005, Domäne Abrechnung Teil 2, Saison-Schnitt).
 *
 * Ersetzt `lib/billing/season-billing.service.ts` (Singleton auf
 * `createServiceClient()`) — Datenzugriff jetzt ausschliesslich über
 * `SeasonBillingRepository` auf `getUserDb(auth)`. Fachlogik (Formel,
 * Rundung, Familien-Zusammenfassung, RPC-Fallback) unverändert übernommen.
 *
 * Formel per Mitglied und Trainingsgruppe:
 *   Trainerkosten = Stundensatz × Dauer(h) × (Termine − inaktive Wochen)
 *   Pro Mitglied  = Trainerkosten ÷ Teilnehmeranzahl
 *
 * Transaktion: bevorzugt die atomare RPC
 *   `public.generate_season_invoices_atomic(season_id, club_id, invoices jsonb)`,
 *   die jeden Mitglieds-Datensatz in einem Savepoint schreibt (ein einzelner
 *   Fehler wirft nicht den ganzen Lauf um). Fällt bei RPC-Fehler auf die
 *   Legacy-Schleife zurück, die dasselbe `failed[]`-Vertrag liefert.
 */
import { getUserDb } from '@/infrastructure/db';
import type { AuthContext } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import type { MemberBillingPreview } from '@/lib/types/billing.types';
import { mergeFamilyMemberPreviews, type FamilyMember } from '@/lib/billing/family-invoice-merge';
import {
  SeasonBillingRepository,
  type SeasonBillingConfigRow,
} from '@/infrastructure/persistence/repositories/season-billing.repository';

const log = createLogger('application:season-billing.service');

// ─── Types ───────────────────────────────────────────────────────────────────

export type SeasonBillingConfig = SeasonBillingConfigRow;

export interface GroupBillingLine {
  groupName: string;
  trainerName: string;
  trainerHourlyRate: number;
  sessionDurationHours: number;
  totalSessions: number;
  inactiveWeeks: number;
  participantCount: number;
  totalTrainerCost: number;
  costPerParticipant: number;
}

export interface SeasonBillingPreview {
  seasonId: string;
  seasonName: string;
  config: SeasonBillingConfig | null;
  groupBreakdown: GroupBillingLine[];
  memberPreviews: MemberBillingPreview[];
  totalTrainingCost: number;
  totalMembershipFees: number;
  totalAdditionalFees: number;
  subtotalAmount: number;
  totalTaxAmount: number;
  grandTotal: number;
  memberCount: number;
  /** Anzahl der Rechnungen nach Familien-Zusammenfassung (= memberPreviews.length). */
  invoiceCount: number;
  groupCount: number;
}

export interface GeneratedInvoice {
  memberId: string;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
}

export interface GenerateInvoicesResult {
  created: GeneratedInvoice[];
  skipped: string[];
  failed: Array<{ memberId: string; error: string }>;
  /** Difference between preview grandTotal and sum of created invoice amounts. */
  roundingDrift: number;
  /** Preview snapshot used for audit / debug output. */
  previewGrandTotal: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class SeasonBillingService {
  private readonly repo: SeasonBillingRepository;

  constructor(auth: AuthContext) {
    this.repo = new SeasonBillingRepository(getUserDb(auth));
  }

  async getConfig(seasonId: string): Promise<SeasonBillingConfig | null> {
    return this.repo.getConfig(seasonId);
  }

  async upsertConfig(
    seasonId: string,
    clubId: string,
    config: Partial<SeasonBillingConfig>
  ): Promise<SeasonBillingConfig> {
    return this.repo.upsertConfig(seasonId, clubId, config);
  }

  /**
   * Calculate billing preview for a season (no DB writes).
   * Honors `season_group_weeks.is_active = false` rows by reducing
   * `totalSessions` for the affected group/week combinations.
   */
  async calculatePreview(seasonId: string): Promise<SeasonBillingPreview> {
    const season = await this.repo.getSeason(seasonId);
    if (!season) throw new Error('Season not found');

    let config = await this.repo.getConfig(seasonId);
    if (!config) {
      try {
        config = await this.repo.upsertConfig(seasonId, season.club_id, {
          trainer_hourly_rate: 50.0,
          use_trainer_profile_rate: false,
          include_membership_fee: true,
          membership_fee_amount: null,
          membership_fee_type: 'yearly',
          payment_terms_days: 30,
          tax_rate: 0,
          cost_split_method: 'per_participant',
        });
        log.info('Auto-created default billing config for season', { seasonId });
      } catch (err) {
        log.warn('Konnte Config nicht automatisch anlegen, nutze In-Memory-Defaults', {
          err: String(err),
        });
      }
    }
    const trainerRate = config?.trainer_hourly_rate ?? 50.0;
    const useProfileRate = config?.use_trainer_profile_rate ?? false;
    const taxRate = config?.tax_rate ?? 0;

    const entries = await this.repo.getPlanEntries(seasonId);
    if (entries.length === 0) {
      return this.emptyPreview(seasonId, season.name, config);
    }

    const seasonStart = new Date(season.start_date);
    const seasonEnd = new Date(season.end_date);
    const seasonLengthDays = Math.ceil(
      (seasonEnd.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalSeasonWeeks = Math.max(1, Math.ceil(seasonLengthDays / 7));

    const inactiveWeeksByGroup = await this.repo.loadInactiveWeeks(seasonId);

    // Tatsächlich veröffentlichte Einheiten je Planeintrag zählen. Sie sind
    // nach der Veröffentlichung die verbindliche Abrechnungsgrundlage, weil
    // sie Ferien und übersprungene Wochen bereits berücksichtigen.
    const publishedSessionsByEntry = await this.repo.getPublishedSessionCounts(
      entries.map((e) => e.id)
    );

    const trainerIds = [...new Set(entries.map((e) => e.trainer_id))];
    const trainerRateMap = new Map<string, number>();
    const trainerNameMap = new Map<string, string>();
    const trainerUserIdMap = new Map<string, string>();

    const trainerRows = await this.repo.getTrainers(trainerIds);
    for (const t of trainerRows) {
      trainerNameMap.set(t.id, t.name);
      if (t.user_id) trainerUserIdMap.set(t.id, t.user_id);
    }

    if (useProfileRate) {
      const userIds = [...new Set(trainerUserIdMap.values())];
      const rateByUserId = await this.repo.getTrainerProfileRates(userIds);
      for (const [trainerId, userId] of trainerUserIdMap) {
        const rate = rateByUserId.get(userId);
        if (rate) trainerRateMap.set(trainerId, rate);
      }
    }

    const groupIds = [
      ...new Set(entries.map((e) => e.group_id).filter((g): g is string => Boolean(g))),
    ];
    const groupNameMap = await this.repo.getGroupNames(groupIds);

    const allMemberIds = new Set<string>();
    for (const entry of entries) {
      const pids = (entry.expected_participants as string[]) || [];
      for (const mid of pids) allMemberIds.add(mid);
    }

    const memberNameMap = new Map<string, string>();
    const memberDobMap = new Map<string, string | null>();
    const users = await this.repo.getUsers([...allMemberIds]);
    for (const u of users) {
      memberNameMap.set(u.id, u.full_name || u.id);
      memberDobMap.set(u.id, u.date_of_birth ?? null);
    }

    // Per-group billing — with inactive-week discount
    const groupBreakdown: GroupBillingLine[] = [];
    const memberCostMap = new Map<
      string,
      { trainingCost: number; groupName: string; memberName: string }
    >();

    for (const entry of entries) {
      const participants = (entry.expected_participants as string[]) || [];
      if (participants.length === 0) continue;
      if (!entry.group_id) continue;

      const groupName = groupNameMap.get(entry.group_id) || entry.group_id;
      const trainerName = trainerNameMap.get(entry.trainer_id) || entry.trainer_id;
      const effectiveRate = useProfileRate
        ? trainerRateMap.get(entry.trainer_id) || trainerRate
        : trainerRate;

      const startWeek = entry.starts_from_week || 1;
      const endWeek = entry.ends_at_week || totalSeasonWeeks;
      const sessionsPerWeek = entry.sessions_per_week || 1;
      const grossSessions = Math.max(1, endWeek - startWeek + 1) * sessionsPerWeek;

      const inactiveSet = inactiveWeeksByGroup.get(entry.group_id);
      const inactiveCount = inactiveSet ? inactiveSet.size : 0;
      const plannedSessions = Math.max(0, grossSessions - inactiveCount * sessionsPerWeek);

      const publishedSessions = publishedSessionsByEntry.get(entry.id);
      const netSessions = publishedSessions ?? plannedSessions;

      const durationHours = entry.duration_minutes / 60;
      const totalTrainerCost = effectiveRate * durationHours * netSessions;
      const costPerParticipant = this.roundCurrency(totalTrainerCost / participants.length);

      groupBreakdown.push({
        groupName,
        trainerName,
        trainerHourlyRate: effectiveRate,
        sessionDurationHours: durationHours,
        totalSessions: netSessions,
        inactiveWeeks: inactiveCount,
        participantCount: participants.length,
        totalTrainerCost: this.roundCurrency(totalTrainerCost),
        costPerParticipant,
      });

      if (netSessions === 0) continue;

      for (const memberId of participants) {
        const existing = memberCostMap.get(memberId);
        if (existing) {
          existing.trainingCost += costPerParticipant;
        } else {
          memberCostMap.set(memberId, {
            trainingCost: costPerParticipant,
            groupName,
            memberName: memberNameMap.get(memberId) || memberId,
          });
        }
      }
    }

    // Build member previews — with proper line-item-level tax
    const membershipFeeAmount = await this.resolveMembershipFeeAmount(config, season.club_id);
    const additionalFeesTotal = this.getAdditionalFeesTotal(config);

    const memberPreviews: MemberBillingPreview[] = [];
    for (const [memberId, info] of memberCostMap) {
      const lineItems: MemberBillingPreview['lineItems'] = [];

      if (info.trainingCost > 0) {
        const lineSubtotal = this.roundCurrency(info.trainingCost);
        const lineTax = this.roundCurrency(lineSubtotal * (taxRate / 100));
        lineItems.push({
          description: `Training ${info.groupName} (${season.name})`,
          quantity: 1,
          unitPrice: lineSubtotal,
          taxRate,
          totalPrice: lineSubtotal,
          taxPrice: lineTax,
          itemType: 'training_fee',
        });
      }

      if (config?.include_membership_fee && membershipFeeAmount > 0) {
        const lineSubtotal = membershipFeeAmount;
        const lineTax = this.roundCurrency(lineSubtotal * (taxRate / 100));
        lineItems.push({
          description: this.getMembershipDescription(config, season.name),
          quantity: 1,
          unitPrice: lineSubtotal,
          taxRate,
          totalPrice: lineSubtotal,
          taxPrice: lineTax,
          itemType: 'membership_fee',
        });
      }

      if (config?.additional_fees && Array.isArray(config.additional_fees)) {
        for (const fee of config.additional_fees as Array<{
          description: string;
          amount: number;
        }>) {
          if (fee.amount > 0) {
            const lineSubtotal = fee.amount;
            const lineTax = this.roundCurrency(lineSubtotal * (taxRate / 100));
            lineItems.push({
              description: fee.description,
              quantity: 1,
              unitPrice: lineSubtotal,
              taxRate,
              totalPrice: lineSubtotal,
              taxPrice: lineTax,
              itemType: 'other',
            });
          }
        }
      }

      const subtotalAmount = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const taxAmount = lineItems.reduce((sum, item) => sum + item.taxPrice, 0);

      memberPreviews.push({
        memberId,
        memberName: info.memberName,
        groupName: info.groupName,
        trainingCost: this.roundCurrency(info.trainingCost),
        membershipFee: membershipFeeAmount,
        additionalFees: additionalFeesTotal,
        subtotalAmount: this.roundCurrency(subtotalAmount),
        taxAmount: this.roundCurrency(taxAmount),
        totalAmount: this.roundCurrency(subtotalAmount + taxAmount),
        lineItems,
      });
    }

    // Familien zusammenfassen: eine Sammel-Rechnung an den Erwachsenen der Gruppe.
    const familyRoster = await this.loadFamilyRoster(
      [...allMemberIds],
      memberNameMap,
      memberDobMap
    );
    const merged = mergeFamilyMemberPreviews(memberPreviews, familyRoster);
    const billingPreviews = merged.previews;

    billingPreviews.sort((a, b) => a.memberName.localeCompare(b.memberName));

    const totalTrainingCost = billingPreviews.reduce((s, m) => s + m.trainingCost, 0);
    const totalMembershipFees = billingPreviews.reduce((s, m) => s + m.membershipFee, 0);
    const totalAdditionalFees = billingPreviews.reduce((s, m) => s + m.additionalFees, 0);
    const subtotalAmount = billingPreviews.reduce((s, m) => s + m.subtotalAmount, 0);
    const totalTaxAmount = billingPreviews.reduce((s, m) => s + m.taxAmount, 0);

    return {
      seasonId,
      seasonName: season.name,
      config,
      groupBreakdown,
      memberPreviews: billingPreviews,
      totalTrainingCost: this.roundCurrency(totalTrainingCost),
      totalMembershipFees: this.roundCurrency(totalMembershipFees),
      totalAdditionalFees: this.roundCurrency(totalAdditionalFees),
      subtotalAmount: this.roundCurrency(subtotalAmount),
      totalTaxAmount: this.roundCurrency(totalTaxAmount),
      grandTotal: this.roundCurrency(subtotalAmount + totalTaxAmount),
      memberCount: merged.memberCount,
      invoiceCount: billingPreviews.length,
      groupCount: groupBreakdown.length,
    };
  }

  /**
   * Generate actual invoices from the billing preview.
   *
   * Idempotency: filters on `season_id` (the FK column) — NOT on `ilike notes`.
   * @param options.replaceDrafts  Beim erneuten Veröffentlichen: noch offene
   *   (draft) Saison-Rechnungen verwerfen und neu erzeugen. Bereits versendete
   *   oder bezahlte Rechnungen bleiben unangetastet.
   */
  async generateInvoices(
    seasonId: string,
    options: { replaceDrafts?: boolean } = {}
  ): Promise<GenerateInvoicesResult> {
    const billingConfig = await this.repo.getConfig(seasonId);
    if (
      (billingConfig as { billing_model?: string } | null)?.billing_model === 'membership_included'
    ) {
      return { created: [], skipped: [], failed: [], roundingDrift: 0, previewGrandTotal: 0 };
    }

    const preview = await this.calculatePreview(seasonId);
    if (preview.memberPreviews.length === 0) {
      return {
        created: [],
        skipped: [],
        failed: [],
        roundingDrift: 0,
        previewGrandTotal: preview.grandTotal,
      };
    }

    const config = preview.config;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (config?.payment_terms_days ?? 30));
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const season = await this.repo.getSeason(seasonId);
    const clubId = season?.club_id;
    if (!clubId) throw new Error('Season club not found');

    if (options.replaceDrafts) {
      const count = await this.repo.discardDraftSeasonInvoices(clubId, seasonId);
      log.info('Entwurfs-Rechnungen vor Neuberechnung verworfen', { count });
    }

    const alreadyInvoiced = await this.repo.getExistingSeasonInvoiceMemberIds(clubId, seasonId);

    const rpcPayload = preview.memberPreviews
      .filter((m) => !alreadyInvoiced.has(m.memberId))
      .map((m) => ({
        member_id: m.memberId,
        due_date: dueDateStr,
        notes: `Saison-Abrechnung ${m.groupName}`,
        items: m.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          tax_rate: item.taxRate,
          item_type: item.itemType,
        })),
      }));

    const rpcResult =
      rpcPayload.length > 0
        ? await this.repo.generateInvoicesAtomic(seasonId, clubId, rpcPayload)
        : null;

    if (rpcResult === null && rpcPayload.length > 0) {
      return this.generateInvoicesLegacyLoop(
        seasonId,
        clubId,
        preview,
        dueDateStr,
        alreadyInvoiced
      );
    }
    if (rpcResult === null) {
      return {
        created: [],
        skipped: [...alreadyInvoiced],
        failed: [],
        roundingDrift: 0,
        previewGrandTotal: preview.grandTotal,
      };
    }

    const created: GeneratedInvoice[] = rpcResult.created.map((row) => ({
      memberId: row.member_id,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      totalAmount: Number(row.total_amount),
    }));
    const skipped: string[] = [...alreadyInvoiced, ...rpcResult.skipped.map((s) => s.member_id)];
    const failed: Array<{ memberId: string; error: string }> = rpcResult.failed.map((f) => ({
      memberId: f.member_id ?? 'unknown',
      error: f.error,
    }));

    const actualTotal = created.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const roundingDrift = this.roundCurrency(preview.grandTotal - actualTotal);
    if (Math.abs(roundingDrift) >= 0.01) {
      log.warn('Rounding drift detected', {
        seasonId,
        grandTotal: preview.grandTotal,
        createdTotal: actualTotal,
        driftEUR: roundingDrift,
      });
    }

    return { created, skipped, failed, roundingDrift, previewGrandTotal: preview.grandTotal };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Legacy per-invoice loop used as fallback when the atomic RPC is
   * unavailable. Marked @deprecated; remove once the RPC is confirmed
   * deployed in all environments.
   * @deprecated Use `generateInvoices` (which calls the atomic RPC) instead.
   */
  private async generateInvoicesLegacyLoop(
    seasonId: string,
    clubId: string,
    preview: SeasonBillingPreview,
    dueDateStr: string,
    alreadyInvoiced: Set<string>
  ): Promise<GenerateInvoicesResult> {
    const created: GeneratedInvoice[] = [];
    const skipped: string[] = [...alreadyInvoiced];
    const failed: Array<{ memberId: string; error: string }> = [];

    for (const member of preview.memberPreviews) {
      if (alreadyInvoiced.has(member.memberId)) continue;

      try {
        const subtotal = member.lineItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
        const taxAmount = member.lineItems.reduce((sum, i) => sum + i.taxPrice, 0);
        const invoice = await this.repo.createInvoice({
          club_id: clubId,
          member_id: member.memberId,
          season_id: seasonId,
          invoice_type: 'season',
          invoice_number: `INV-${clubId.slice(0, 8).toUpperCase()}-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
          due_date: dueDateStr,
          status: 'draft',
          subtotal,
          amount: subtotal + taxAmount,
          tax_amount: taxAmount,
          currency: 'EUR',
          notes: `Saison-Abrechnung ${member.groupName}`,
        });
        await this.repo.createInvoiceItems(
          member.lineItems.map((item) => ({
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            tax_rate: item.taxRate,
            item_type: item.itemType,
          }))
        );
        created.push({
          memberId: member.memberId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          totalAmount: member.totalAmount,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log.error(
          `Rechnung für ${member.memberId} konnte nicht erzeugt werden`,
          err instanceof Error ? err : undefined
        );
        failed.push({ memberId: member.memberId, error: errorMessage });
      }
    }

    const actualTotal = created.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const roundingDrift = this.roundCurrency(preview.grandTotal - actualTotal);
    if (Math.abs(roundingDrift) >= 0.01) {
      log.warn('Rounding drift detected (legacy loop)', {
        seasonId,
        grandTotal: preview.grandTotal,
        createdTotal: actualTotal,
        driftEUR: roundingDrift,
      });
    }

    return { created, skipped, failed, roundingDrift, previewGrandTotal: preview.grandTotal };
  }

  private async loadFamilyRoster(
    billableMemberIds: string[],
    nameMap: Map<string, string>,
    dobMap: Map<string, string | null>
  ): Promise<Map<string, FamilyMember[]>> {
    const roster = new Map<string, FamilyMember[]>();
    if (billableMemberIds.length === 0) return roster;

    try {
      const links = await this.repo.getFamilyLinksByUser(billableMemberIds);
      const groupIds = [...new Set(links.map((l) => l.family_group_id))];
      if (groupIds.length === 0) return roster;

      const members = await this.repo.getFamilyMembersByGroup(groupIds);
      const userIds = [...new Set(members.map((m) => m.user_id))];
      const users = await this.repo.getUsers(userIds);
      const userMap = new Map(users.map((u) => [u.id, u]));

      for (const m of members) {
        const user = userMap.get(m.user_id);
        if (!roster.has(m.family_group_id)) roster.set(m.family_group_id, []);
        roster.get(m.family_group_id)!.push({
          memberId: m.user_id,
          name: user?.full_name ?? nameMap.get(m.user_id) ?? m.user_id,
          relationship: m.relationship,
          dateOfBirth: user?.date_of_birth ?? dobMap.get(m.user_id) ?? null,
        });
      }
    } catch (err) {
      log.warn('Familien-Roster nicht lesbar, keine Sammel-Rechnung', { err: String(err) });
    }

    return roster;
  }

  private async resolveMembershipFeeAmount(
    config: SeasonBillingConfig | null,
    clubId: string
  ): Promise<number> {
    if (!config?.include_membership_fee) return 0;
    if (config.membership_fee_amount != null) return Number(config.membership_fee_amount);
    return (await this.repo.getActiveMembershipFee(clubId)) ?? 0;
  }

  private getAdditionalFeesTotal(config: SeasonBillingConfig | null): number {
    const fees = config?.additional_fees as Array<{ amount: number }> | null;
    if (!fees) return 0;
    return fees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
  }

  private getMembershipDescription(config: SeasonBillingConfig | null, seasonName: string): string {
    const type = config?.membership_fee_type ?? 'yearly';
    switch (type) {
      case 'yearly':
        return `Jahresmitgliedsbeitrag ${new Date().getFullYear()}`;
      case 'seasonal':
        return `Saisonbeitrag ${seasonName}`;
      case 'monthly':
        return `Monatsbeitrag ${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
      default:
        return `Mitgliedsbeitrag ${seasonName}`;
    }
  }

  private emptyPreview(
    seasonId: string,
    seasonName: string,
    config: SeasonBillingConfig | null
  ): SeasonBillingPreview {
    return {
      seasonId,
      seasonName,
      config,
      groupBreakdown: [],
      memberPreviews: [],
      totalTrainingCost: 0,
      totalMembershipFees: 0,
      totalAdditionalFees: 0,
      subtotalAmount: 0,
      totalTaxAmount: 0,
      grandTotal: 0,
      memberCount: 0,
      invoiceCount: 0,
      groupCount: 0,
    };
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
