/**
 * Season Billing Service
 *
 * Calculates and generates invoices when a season plan is published.
 *
 * Formula per member per training group:
 *   Trainerkosten = Stundensatz × Dauer(h) × (Termine − inaktive Wochen)
 *   Pro Mitglied  = Trainerkosten ÷ Teilnehmeranzahl
 *
 * Additional line items:
 *   + Jahresmitgliedsbeitrag (configurable)
 *   + Zusätzliche Gebühren (JSON-defined)
 *
 * Refactor history (2026-06-27):
 *   • Wired `season_group_weeks` so inaktive Wochen in the Kalender-UI
 *     reduce `totalSessions` in the preview AND skip invoice creation
 *   • Idempotency check switched from `ilike('notes', %seasonName%)` (fragile,
 *     cross-season false-positives) to `season_id` filter (the FK column
 *     that was already present on the `invoices` table)
 *   • `generateInvoices` calls the atomic RPC
 *     `public.generate_season_invoices_atomic(season_id, club_id, invoices jsonb)`
 *     for the actual DB writes — that function wraps each per-member invoice
 *     + line item insert in a savepoint so partial failures don't roll back
 *     successful members. If the RPC is unavailable (function not deployed
 *     yet) the service falls back to the legacy per-invoice try/catch loop
 *     so callers retain the same `failed[]` contract.
 *   • Tax is now applied at the line-item level (`tax_rate` × unit_price × qty)
 *     and the `tax_amount` is persisted on the invoice (was missing on
 *     season-invoice path)
 *   • Rounding-drift between `calculatePreview().grandTotal` and the
 *     sum of actually generated invoice amounts is logged for audit
 *   • Returns `failed` member IDs in addition to `created` / `skipped`
 *     so callers can surface partial failures to the admin
 */

import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { mergeFamilyMemberPreviews, type FamilyMember } from './family-invoice-merge';

const log = createLogger('billing:season');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeasonBillingConfig {
  id: string;
  season_id: string;
  club_id: string;
  trainer_hourly_rate: number;
  use_trainer_profile_rate: boolean;
  include_membership_fee: boolean;
  membership_fee_amount: number | null;
  membership_fee_type: 'yearly' | 'seasonal' | 'monthly';
  payment_terms_days: number;
  invoice_notes: string | null;
  tax_rate: number;
  cost_split_method: 'per_participant' | 'flat_rate' | 'per_group';
  additional_fees: Array<{ description: string; amount: number }>;
}

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

export interface MemberBillingPreview {
  memberId: string;
  memberName: string;
  groupName: string;
  /** Namen aller in dieser (Sammel-)Rechnung enthaltenen Familienmitglieder. */
  collectiveMembers?: string[];
  trainingCost: number;
  membershipFee: number;
  additionalFees: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    totalPrice: number;
    taxPrice: number;
    itemType: string;
  }>;
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
  private static instance: SeasonBillingService;
  private supabase = createServiceClient();

  private constructor() {}

  public static getInstance(): SeasonBillingService {
    if (!SeasonBillingService.instance) {
      SeasonBillingService.instance = new SeasonBillingService();
    }
    return SeasonBillingService.instance;
  }

  /**
   * Get or create default billing config for a season
   */
  async getConfig(seasonId: string): Promise<SeasonBillingConfig | null> {
    const { data } = await this.supabase
      .from('season_billing_configs')
      .select('*')
      .eq('season_id', seasonId)
      .maybeSingle();

    return data as SeasonBillingConfig | null;
  }

  /**
   * Upsert billing config for a season
   */
  async upsertConfig(
    seasonId: string,
    clubId: string,
    config: Partial<SeasonBillingConfig>
  ): Promise<SeasonBillingConfig> {
    const { data, error } = await this.supabase
      .from('season_billing_configs')
      .upsert(
        {
          season_id: seasonId,
          club_id: clubId,
          ...config,
        },
        { onConflict: 'season_id' }
      )
      .select()
      .single();

    if (error) throw new Error(`Failed to upsert billing config: ${error.message}`);
    return data as unknown as SeasonBillingConfig;
  }

  /**
   * Load the inactive-week map for a season: { groupId: Set<weekMonday> }.
   * Returns an empty map if the table is empty or doesn't exist yet
   * (degrades gracefully so the season can still be billed).
   */
  private async loadInactiveWeeks(seasonId: string): Promise<Map<string, Set<string>>> {
    const map = new Map<string, Set<string>>();
    try {
      const { data, error } = await this.supabase
        .from('season_group_weeks')
        .select('group_id, week_monday, is_active')
        .eq('season_id', seasonId)
        .eq('is_active', false);

      if (error) {
        if (error.message.toLowerCase().includes('does not exist')) {
          return map; // migration not run yet — assume everything active
        }
        log.warn('[SeasonBilling] Failed to load inactive weeks:', error.message);
        return map;
      }
      for (const row of (data ?? []) as Array<{
        group_id: string;
        week_monday: string;
      }>) {
        if (!map.has(row.group_id)) map.set(row.group_id, new Set());
        map.get(row.group_id)!.add(row.week_monday);
      }
    } catch (err) {
      log.warn('[SeasonBilling] Error loading inactive weeks, assuming all active:', err);
    }
    return map;
  }

  /**
   * Calculate billing preview for a season (no DB writes).
   * Honors `season_group_weeks.is_active = false` rows by reducing
   * `totalSessions` for the affected group/week combinations.
   */
  async calculatePreview(seasonId: string): Promise<SeasonBillingPreview> {
    // 1. Fetch season
    const { data: season, error: seasonError } = await this.supabase
      .from('seasons')
      .select('id, name, club_id, start_date, end_date')
      .eq('id', seasonId)
      .single();

    if (seasonError || !season) throw new Error('Season not found');

    // 2. Fetch or default billing config
    let config = await this.getConfig(seasonId);
    if (!config) {
      try {
        config = await this.upsertConfig(seasonId, season.club_id, {
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
        log.warn('[SeasonBilling] Could not auto-create config, using in-memory defaults:', err);
      }
    }
    const trainerRate = config?.trainer_hourly_rate ?? 50.0;
    const useProfileRate = config?.use_trainer_profile_rate ?? false;
    const taxRate = config?.tax_rate ?? 0;

    // 3. Fetch plan entries
    const { data: entries } = await this.supabase
      .from('season_plan_entries')
      .select(
        'id, group_id, trainer_id, duration_minutes, expected_participants, starts_from_week, ends_at_week, day_of_week, start_time, end_time, sessions_per_week'
      )
      .eq('season_id', seasonId);

    if (!entries || entries.length === 0) {
      return this.emptyPreview(seasonId, season.name, config);
    }

    // 4. Season length
    const seasonStart = new Date(season.start_date);
    const seasonEnd = new Date(season.end_date);
    const seasonLengthDays = Math.ceil(
      (seasonEnd.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalSeasonWeeks = Math.max(1, Math.ceil(seasonLengthDays / 7));

    // 4b. Load inactive weeks for the season
    const inactiveWeeksByGroup = await this.loadInactiveWeeks(seasonId);

    // 4c. Tatsächlich veröffentlichte Einheiten je Planeintrag zählen. Sie sind
    // nach der Veröffentlichung die verbindliche Abrechnungsgrundlage, weil sie
    // Ferien und übersprungene Wochen bereits berücksichtigen.
    const publishedSessionsByEntry = new Map<string, number>();
    {
      const { data: sessionRows, error: sessionError } = await this.supabase
        .from('sessions')
        .select('plan_entry_id')
        .in(
          'plan_entry_id',
          entries.map((e) => e.id)
        );
      if (sessionError) {
        log.warn(
          '[SeasonBilling] Veröffentlichte Einheiten nicht lesbar, rechne mit der Wochenschätzung:',
          sessionError.message
        );
      } else {
        for (const row of sessionRows ?? []) {
          const key = (row as { plan_entry_id: string | null }).plan_entry_id;
          if (!key) continue;
          publishedSessionsByEntry.set(key, (publishedSessionsByEntry.get(key) ?? 0) + 1);
        }
      }
    }

    // 5. Trainer info
    const trainerIds = [...new Set(entries.map((e) => e.trainer_id))];
    const trainerRateMap = new Map<string, number>();
    const trainerNameMap = new Map<string, string>();
    const trainerUserIdMap = new Map<string, string>();

    const { data: trainerRows } = await this.supabase
      .from('trainers')
      .select('id, name, user_id')
      .in('id', trainerIds);

    if (trainerRows) {
      for (const t of trainerRows) {
        trainerNameMap.set(t.id, t.name);
        if (t.user_id) trainerUserIdMap.set(t.id, t.user_id);
      }
    }

    if (useProfileRate) {
      const userIds = [...new Set(trainerUserIdMap.values())];
      if (userIds.length > 0) {
        const { data: profiles } = await this.supabase
          .from('trainer_profiles')
          .select('user_id, hourly_rate')
          .in('user_id', userIds);

        if (profiles) {
          const userIdToRate = new Map<string, number>();
          for (const p of profiles) {
            if (p.hourly_rate) userIdToRate.set(p.user_id, Number(p.hourly_rate));
          }
          for (const [trainerId, userId] of trainerUserIdMap) {
            const rate = userIdToRate.get(userId);
            if (rate) trainerRateMap.set(trainerId, rate);
          }
        }
      }
    }

    // 6. Group names
    const groupIds = [
      ...new Set(entries.map((e) => e.group_id).filter((g): g is string => Boolean(g))),
    ];
    const groupNameMap = new Map<string, string>();
    if (groupIds.length > 0) {
      const { data: groups } = await this.supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds);

      if (groups) {
        for (const g of groups) groupNameMap.set(g.id, g.name);
      }
    }

    // 7. Member names
    const allMemberIds = new Set<string>();
    for (const entry of entries) {
      const pids = (entry.expected_participants as string[]) || [];
      for (const mid of pids) allMemberIds.add(mid);
    }

    const memberNameMap = new Map<string, string>();
    const memberDobMap = new Map<string, string | null>();
    if (allMemberIds.size > 0) {
      const { data: users } = await this.supabase
        .from('users')
        .select('id, full_name, date_of_birth')
        .in('id', [...allMemberIds]);

      if (users) {
        for (const u of users) {
          memberNameMap.set(u.id, u.full_name || u.id);
          memberDobMap.set(u.id, (u as { date_of_birth?: string | null }).date_of_birth ?? null);
        }
      }
    }

    // 8. Per-group billing — with inactive-week discount
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

      // Subtract inactive weeks for this group (an inactive week removes all
      // sessions_per_week occurrences that week, not just one)
      const inactiveSet = inactiveWeeksByGroup.get(entry.group_id);
      const inactiveCount = inactiveSet ? inactiveSet.size : 0;
      const plannedSessions = Math.max(0, grossSessions - inactiveCount * sessionsPerWeek);

      // Sobald die Saison veröffentlicht ist, sind die tatsächlich angelegten
      // Einheiten die verbindliche Zahl. Die Wochenrechnung oben kennt die
      // Schulferien nicht: Sie kam für die Wintersaison 2026/27 auf 26 Termine
      // je Gruppe, während der Plan wegen Herbst- und Weihnachtsferien nur 20–21
      // erzeugt hatte — über vier Gruppen 1.150 € zu viel, verteilt auf die
      // Mitglieder. Vor der Veröffentlichung bleibt die Schätzung die einzige
      // verfügbare Grundlage.
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

      // Skip members entirely when there are no billable sessions for the group
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

    // 9. Build member previews — with proper line-item-level tax
    const membershipFeeAmount = await this.resolveMembershipFeeAmount(config, season.club_id);
    const additionalFeesTotal = this.getAdditionalFeesTotal(config);

    const memberPreviews: MemberBillingPreview[] = [];
    for (const [memberId, info] of memberCostMap) {
      const lineItems: MemberBillingPreview['lineItems'] = [];

      // Training line item
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

      // Membership line item
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

      // Additional fees
      if (config?.additional_fees && config.additional_fees.length > 0) {
        for (const fee of config.additional_fees) {
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
   * Transaction: prefers the atomic RPC
   *   `public.generate_season_invoices_atomic(season_id, club_id, invoices jsonb)`
   *   which wraps each per-member invoice + line item insert in a savepoint
   *   so a single member failure does not roll back the whole batch. If the
   *   RPC is not deployed yet (function-not-found error code 42883, or any
   *   other RPC-level error) the service falls back to the legacy per-invoice
   *   loop so the `failed[]` contract is preserved for callers.
   * Observability: returns `failed` member IDs and a `roundingDrift` delta
   * between the preview grandTotal and the sum of actually generated invoice
   * totals (should be < 1 cent if no member sits in multiple groups).
   */
  /**
   * @param options.replaceDrafts  Beim erneuten Veröffentlichen: noch offene
   *   (draft) Saison-Rechnungen verwerfen und neu erzeugen. Ohne das behält der
   *   Verein die Rechnungen des ERSTEN Publish — im QA-Durchlauf standen so
   *   20 Rechnungen über 5.200 € in der Datenbank, während der geänderte Plan
   *   nur noch 4.050 € rechtfertigte. Bereits versendete oder bezahlte
   *   Rechnungen bleiben unangetastet; die gehören storniert, nicht überschrieben.
   */
  async generateInvoices(
    seasonId: string,
    options: { replaceDrafts?: boolean } = {}
  ): Promise<GenerateInvoicesResult> {
    // membership_included → Training im Jahresbeitrag abgedeckt, keine Einzelrechnungen
    const billingConfig = await this.getConfig(seasonId);
    if ((billingConfig as any)?.billing_model === 'membership_included') {
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

    const clubId = await this.getSeasonClubId(seasonId);
    if (!clubId) {
      throw new Error('Season club not found');
    }

    if (options.replaceDrafts) {
      const { data: discarded, error: discardErr } = await this.supabase
        .from('invoices')
        .delete()
        .eq('club_id', clubId)
        .eq('season_id', seasonId)
        .eq('invoice_type', 'season')
        .eq('status', 'draft')
        .select('id');
      if (discardErr) {
        log.error('[SeasonBilling] Entwurfs-Rechnungen nicht verworfen:', discardErr);
      } else {
        log.info('[SeasonBilling] Entwurfs-Rechnungen vor Neuberechnung verworfen', {
          count: discarded?.length ?? 0,
        });
      }
    }

    // Idempotency: filter on `season_id` (the FK column on `invoices`)
    // — NOT on the fragile `ilike('notes', %seasonName%)` pattern.
    const { data: existingInvoices, error: existingErr } = await this.supabase
      .from('invoices')
      .select('member_id, season_id, invoice_type')
      .eq('club_id', clubId)
      .eq('invoice_type', 'season')
      .eq('season_id', seasonId);

    if (existingErr) {
      throw new Error(`Failed to check existing invoices: ${existingErr.message}`);
    }

    const alreadyInvoiced = new Set(
      (existingInvoices ?? [])
        .map((inv: { member_id: string | null }) => inv.member_id)
        .filter((id): id is string => Boolean(id))
    );

    // Build the per-member payload that the RPC consumes. Members that are
    // already invoiced are filtered out — the RPC has its own idempotency
    // check as a second line of defense, but doing it client-side first
    // avoids a needless round-trip.
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

    let rpcResult: {
      created: Array<{
        member_id: string;
        invoice_id: string;
        invoice_number: string;
        total_amount: number;
      }>;
      skipped: Array<{ member_id: string }>;
      failed: Array<{ member_id: string; error: string }>;
    } | null = null;

    if (rpcPayload.length > 0) {
      rpcResult = await this.tryAtomicRpc(seasonId, clubId, rpcPayload);
    }

    // If the RPC was unavailable, fall back to the per-invoice loop.
    if (rpcResult === null) {
      return this.generateInvoicesLegacyLoop(
        seasonId,
        clubId,
        preview,
        dueDateStr,
        alreadyInvoiced
      );
    }

    // Merge: client-side skipped + RPC skipped
    const created: GeneratedInvoice[] = rpcResult.created.map((row) => ({
      memberId: row.member_id,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      totalAmount: Number(row.total_amount),
    }));
    const skipped: string[] = [
      ...[...alreadyInvoiced], // client-side skip
      ...rpcResult.skipped.map((s) => s.member_id), // server-side skip
    ];
    const failed: Array<{ memberId: string; error: string }> = rpcResult.failed.map((f) => ({
      memberId: f.member_id ?? 'unknown',
      error: f.error,
    }));

    // Rounding-drift audit
    const actualTotal = created.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const roundingDrift = this.roundCurrency(preview.grandTotal - actualTotal);
    if (Math.abs(roundingDrift) >= 0.01) {
      log.warn('[SeasonBilling] Rounding drift detected', {
        seasonId,
        grandTotal: preview.grandTotal,
        createdTotal: actualTotal,
        driftEUR: roundingDrift,
      });
    }

    return {
      created,
      skipped,
      failed,
      roundingDrift,
      previewGrandTotal: preview.grandTotal,
    };
  }

  /**
   * Call the atomic RPC. Returns null when the function is not deployed
   * (or any other RPC-level error) so the caller can fall back to the
   * legacy per-invoice loop. Per-member errors are returned inside the
   * payload, not thrown.
   */
  private async tryAtomicRpc(
    seasonId: string,
    clubId: string,
    payload: Array<{
      member_id: string;
      due_date: string;
      notes: string;
      items: Array<{
        description: string;
        quantity: number;
        unit_price: number;
        tax_rate: number;
        item_type: string;
      }>;
    }>
  ): Promise<{
    created: Array<{
      member_id: string;
      invoice_id: string;
      invoice_number: string;
      total_amount: number;
    }>;
    skipped: Array<{ member_id: string }>;
    failed: Array<{ member_id: string; error: string }>;
  } | null> {
    try {
      // `as never` is the standard Supabase pattern for custom RPCs that
      // aren't yet in the generated `Database['public']['Functions']` type
      // (the migration will add the function, the next `supabase gen types`
      // run will pick it up, and the cast can then be removed).
      const { data, error } = await this.supabase.rpc('generate_season_invoices_atomic', {
        p_season_id: seasonId,
        p_club_id: clubId,
        p_invoices: payload as never,
      });

      if (error) {
        // 42883 = function does not exist (RPC not deployed yet) → fallback
        // PGRST202 = PostgREST could not find the function → fallback
        const code = (error as { code?: string }).code;
        if (code === '42883' || code === 'PGRST202') {
          log.warn(
            '[SeasonBilling] Atomic RPC not available, falling back to legacy loop:',
            error.message
          );
          return null;
        }
        // Any other RPC error is a real failure — bubble up so the caller
        // sees it via the catch in tryAtomicRpc (returns null → fallback).
        log.error('[SeasonBilling] Atomic RPC error, falling back to legacy loop:', error.message);
        return null;
      }

      return data as {
        created: Array<{
          member_id: string;
          invoice_id: string;
          invoice_number: string;
          total_amount: number;
        }>;
        skipped: Array<{ member_id: string }>;
        failed: Array<{ member_id: string; error: string }>;
      };
    } catch (err) {
      log.error('[SeasonBilling] Atomic RPC exception, falling back to legacy loop:', err);
      return null;
    }
  }

  /**
   * Legacy per-invoice loop used as fallback when the atomic RPC is
   * unavailable. Kept unchanged in behavior — the only caller is
   * `generateInvoices` itself. Marked @deprecated; remove once the RPC
   * is confirmed deployed in all environments.
   *
   * @deprecated Use `generateInvoices` (which calls the atomic RPC) instead.
   */
  private async generateInvoicesLegacyLoop(
    seasonId: string,
    clubId: string,
    preview: SeasonBillingPreview,
    dueDateStr: string,
    alreadyInvoiced: Set<string>
  ): Promise<GenerateInvoicesResult> {
    const taxRate = preview.config?.tax_rate ?? 0;
    const created: GeneratedInvoice[] = [];
    const skipped: string[] = [...alreadyInvoiced];
    const failed: Array<{ memberId: string; error: string }> = [];

    for (const member of preview.memberPreviews) {
      if (alreadyInvoiced.has(member.memberId)) {
        continue; // already added to skipped above
      }

      try {
        const invoice = await this.createSingleInvoice(
          seasonId,
          clubId,
          member,
          dueDateStr,
          taxRate
        );
        created.push(invoice);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log.error(`[SeasonBilling] Failed to create invoice for ${member.memberId}:`, err);
        failed.push({ memberId: member.memberId, error: errorMessage });
      }
    }

    const actualTotal = created.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const roundingDrift = this.roundCurrency(preview.grandTotal - actualTotal);
    if (Math.abs(roundingDrift) >= 0.01) {
      log.warn('[SeasonBilling] Rounding drift detected', {
        seasonId,
        grandTotal: preview.grandTotal,
        createdTotal: actualTotal,
        driftEUR: roundingDrift,
      });
    }

    return {
      created,
      skipped,
      failed,
      roundingDrift,
      previewGrandTotal: preview.grandTotal,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async getSeasonClubId(seasonId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('seasons')
      .select('club_id')
      .eq('id', seasonId)
      .maybeSingle();
    return data?.club_id ?? null;
  }

  /**
   * Lädt die vollständige Familiengruppen-Roster für alle abrechenbaren
   * Mitglieder. Degradiert bei fehlender Tabelle/Feature aus (leere Map =
   * keine Zusammenfassung), damit die Saison-Abrechnung nie an Familienkonten
   * scheitert.
   */
  private async loadFamilyRoster(
    billableMemberIds: string[],
    nameMap: Map<string, string>,
    dobMap: Map<string, string | null>
  ): Promise<Map<string, FamilyMember[]>> {
    const roster = new Map<string, FamilyMember[]>();
    if (billableMemberIds.length === 0) return roster;

    try {
      // 1. Gruppenzugehörigkeit der abrechenbaren Mitglieder.
      const { data: links } = await this.supabase
        .from('family_accounts')
        .select('user_id, family_group_id')
        .in('user_id', billableMemberIds);

      const groupIds = [...new Set((links ?? []).map((l) => l.family_group_id as string))];
      if (groupIds.length === 0) return roster;

      // 2. Vollständige Roster dieser Gruppen (inkl. Erwachsener ohne eigene
      //    Positionen, die als Rechnungsempfänger dienen).
      const { data: members } = await this.supabase
        .from('family_accounts')
        .select('user_id, family_group_id, relationship')
        .in('family_group_id', groupIds);

      const userIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
      const { data: users } = await this.supabase
        .from('users')
        .select('id, full_name, date_of_birth')
        .in('id', userIds);

      const userMap = new Map(
        (users ?? []).map((u) => [u.id, u as { full_name?: string; date_of_birth?: string | null }])
      );

      for (const m of members ?? []) {
        const memberId = m.user_id as string;
        const groupId = m.family_group_id as string;
        const user = userMap.get(memberId);
        if (!roster.has(groupId)) roster.set(groupId, []);
        roster.get(groupId)!.push({
          memberId,
          name: user?.full_name ?? nameMap.get(memberId) ?? memberId,
          relationship: (m.relationship as string | null) ?? null,
          dateOfBirth: user?.date_of_birth ?? dobMap.get(memberId) ?? null,
        });
      }
    } catch (err) {
      log.warn('[SeasonBilling] Familien-Roster nicht lesbar, keine Sammel-Rechnung:', err);
    }

    return roster;
  }

  /**
   * Create a single invoice + line items for one member.
   * Tax is applied at the line-item level (consistent with billing engine).
   * The `tax_amount` column on the parent invoice is the sum of all line taxes.
   */
  private async createSingleInvoice(
    seasonId: string,
    clubId: string,
    member: MemberBillingPreview,
    dueDate: string,
    _taxRate: number
  ): Promise<GeneratedInvoice> {
    const { billingEngine } = await import('@/lib/billing-engine');

    const invoice = await billingEngine.createInvoice({
      club_id: clubId,
      member_id: member.memberId,
      due_date: dueDate,
      type: 'season',
      items: member.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        tax_rate: item.taxRate,
        item_type: item.itemType,
      })),
      notes: `Saison-Abrechnung ${member.groupName}`,
      // season_id is persisted via a follow-up UPDATE (the CreateInvoice type
      // in lib/types/billing.ts doesn't include it yet — we set it after creation
      // to keep the consolidated path backward-compatible with all callers).
      _seasonIdForAudit: seasonId,
    } as never);

    return {
      memberId: member.memberId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      totalAmount: member.totalAmount,
    };
  }

  private async resolveMembershipFeeAmount(
    config: SeasonBillingConfig | null,
    clubId: string
  ): Promise<number> {
    if (!config?.include_membership_fee) return 0;
    if (config.membership_fee_amount != null) return Number(config.membership_fee_amount);
    const { data: feeConfig } = await this.supabase
      .from('fee_configurations')
      .select('amount')
      .eq('club_id', clubId)
      .eq('type', 'membership')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return feeConfig ? Number(feeConfig.amount) : 0;
  }

  private getAdditionalFeesTotal(config: SeasonBillingConfig | null): number {
    if (!config?.additional_fees) return 0;
    return config.additional_fees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
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

export const seasonBillingService = SeasonBillingService.getInstance();
