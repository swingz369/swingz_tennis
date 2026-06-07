/**
 * Season Billing Service
 *
 * Calculates and generates invoices when a season plan is published.
 *
 * Formula per member per training group:
 *   Trainerkosten = Stundensatz × Dauer(h) × Termine
 *   Pro Mitglied  = Trainerkosten ÷ Teilnehmeranzahl
 *
 * Additional line items:
 *   + Jahresmitgliedsbeitrag (configurable)
 *   + Zusätzliche Gebühren (JSON-defined)
 */

import { createServiceClient } from '@/lib/supabase/service';

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
  participantCount: number;
  totalTrainerCost: number;
  costPerParticipant: number;
}

export interface MemberBillingPreview {
  memberId: string;
  memberName: string;
  groupName: string;
  trainingCost: number;
  membershipFee: number;
  additionalFees: number;
  totalAmount: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
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
  grandTotal: number;
  memberCount: number;
  groupCount: number;
}

export interface GeneratedInvoice {
  memberId: string;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
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
    return data as SeasonBillingConfig;
  }

  /**
   * Calculate billing preview for a season (no DB writes)
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
      // Auto-create a default config so the admin sees real values in the preview
      try {
        config = await this.upsertConfig(seasonId, season.club_id, {
          trainer_hourly_rate: 50.0,
          use_trainer_profile_rate: false,
          include_membership_fee: true,
          membership_fee_amount: null, // auto-resolve from fee_configurations
          membership_fee_type: 'yearly',
          payment_terms_days: 30,
          tax_rate: 0,
          cost_split_method: 'per_participant',
        });
        console.log('[SeasonBilling] Auto-created default billing config for season', seasonId);
      } catch (err) {
        console.warn(
          '[SeasonBilling] Could not auto-create config, using in-memory defaults:',
          err
        );
      }
    }
    const trainerRate = config?.trainer_hourly_rate ?? 50.0;
    const useProfileRate = config?.use_trainer_profile_rate ?? false;

    // 3. Fetch plan entries with trainer info
    const { data: entries } = await this.supabase
      .from('season_plan_entries')
      .select(
        'id, group_id, trainer_id, duration_minutes, expected_participants, starts_from_week, ends_at_week, day_of_week, start_time, end_time'
      )
      .eq('season_id', seasonId);

    if (!entries || entries.length === 0) {
      return this.emptyPreview(seasonId, season.name, config);
    }

    // 4. Calculate total season weeks
    const seasonStart = new Date(season.start_date);
    const seasonEnd = new Date(season.end_date);
    const seasonLengthDays = Math.ceil(
      (seasonEnd.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalSeasonWeeks = Math.max(1, Math.ceil(seasonLengthDays / 7));

    // 5. Fetch trainer info (names + optional hourly rates from profiles)
    const trainerIds = [...new Set(entries.map((e) => e.trainer_id))];
    const trainerRateMap = new Map<string, number>();
    const trainerNameMap = new Map<string, string>();
    const trainerUserIdMap = new Map<string, string>(); // trainer_id -> user_id

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

    // Fetch trainer_profiles for hourly rates (join via user_id)
    if (useProfileRate) {
      const userIds = [...new Set(trainerUserIdMap.values())];
      if (userIds.length > 0) {
        const { data: profiles } = await this.supabase
          .from('trainer_profiles')
          .select('user_id, hourly_rate')
          .in('user_id', userIds);

        if (profiles) {
          // Build reverse map: user_id -> hourly_rate
          const userIdToRate = new Map<string, number>();
          for (const p of profiles) {
            if (p.hourly_rate) userIdToRate.set(p.user_id, Number(p.hourly_rate));
          }
          // Map trainer_id -> hourly_rate
          for (const [trainerId, userId] of trainerUserIdMap) {
            const rate = userIdToRate.get(userId);
            if (rate) trainerRateMap.set(trainerId, rate);
          }
        }
      }
    }

    // 6. Fetch group names
    const groupIds = [...new Set(entries.map((e) => e.group_id).filter(Boolean))];
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

    // 7. Fetch member names
    const allMemberIds = new Set<string>();
    for (const entry of entries) {
      const pids = (entry.expected_participants as string[]) || [];
      for (const mid of pids) allMemberIds.add(mid);
    }

    const memberNameMap = new Map<string, string>();
    if (allMemberIds.size > 0) {
      const { data: users } = await this.supabase
        .from('users')
        .select('id, full_name')
        .in('id', [...allMemberIds]);

      if (users) {
        for (const u of users) memberNameMap.set(u.id, u.full_name || u.id);
      }
    }

    // 8. Calculate per-group billing
    const groupBreakdown: GroupBillingLine[] = [];
    const memberCostMap = new Map<
      string,
      { trainingCost: number; groupName: string; memberName: string }
    >();

    for (const entry of entries) {
      const participants = (entry.expected_participants as string[]) || [];
      if (participants.length === 0) continue;

      const groupName = groupNameMap.get(entry.group_id) || entry.group_id || 'Unbekannte Gruppe';
      const trainerName = trainerNameMap.get(entry.trainer_id) || entry.trainer_id;
      const effectiveRate = useProfileRate
        ? trainerRateMap.get(entry.trainer_id) || trainerRate
        : trainerRate;

      // Calculate total sessions for this entry
      const startWeek = entry.starts_from_week || 1;
      const endWeek = entry.ends_at_week || totalSeasonWeeks;
      const totalSessions = Math.max(1, endWeek - startWeek + 1);

      const durationHours = entry.duration_minutes / 60;
      const totalTrainerCost = effectiveRate * durationHours * totalSessions;
      const costPerParticipant = this.roundCurrency(totalTrainerCost / participants.length);

      groupBreakdown.push({
        groupName,
        trainerName,
        trainerHourlyRate: effectiveRate,
        sessionDurationHours: durationHours,
        totalSessions,
        participantCount: participants.length,
        totalTrainerCost: this.roundCurrency(totalTrainerCost),
        costPerParticipant,
      });

      // Accumulate per-member costs (a member can be in multiple groups)
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

    // 9. Build member previews
    const membershipFeeAmount = await this.resolveMembershipFeeAmount(config, season.club_id);
    const additionalFeesTotal = this.getAdditionalFeesTotal(config);

    const memberPreviews: MemberBillingPreview[] = [];
    for (const [memberId, info] of memberCostMap) {
      const lineItems: MemberBillingPreview['lineItems'] = [];

      // Training cost line item
      if (info.trainingCost > 0) {
        lineItems.push({
          description: `Training ${info.groupName} (${season.name})`,
          quantity: 1,
          unitPrice: this.roundCurrency(info.trainingCost),
          totalPrice: this.roundCurrency(info.trainingCost),
          itemType: 'training_fee',
        });
      }

      // Membership fee line item
      if (config?.include_membership_fee && membershipFeeAmount > 0) {
        lineItems.push({
          description: this.getMembershipDescription(config, season.name),
          quantity: 1,
          unitPrice: membershipFeeAmount,
          totalPrice: membershipFeeAmount,
          itemType: 'membership_fee',
        });
      }

      // Additional fees
      if (config?.additional_fees && config.additional_fees.length > 0) {
        for (const fee of config.additional_fees) {
          if (fee.amount > 0) {
            lineItems.push({
              description: fee.description,
              quantity: 1,
              unitPrice: fee.amount,
              totalPrice: fee.amount,
              itemType: 'other',
            });
          }
        }
      }

      const totalAmount = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);

      memberPreviews.push({
        memberId,
        memberName: info.memberName,
        groupName: info.groupName,
        trainingCost: this.roundCurrency(info.trainingCost),
        membershipFee: membershipFeeAmount,
        additionalFees: additionalFeesTotal,
        totalAmount: this.roundCurrency(totalAmount),
        lineItems,
      });
    }

    // 10. Sort by name
    memberPreviews.sort((a, b) => a.memberName.localeCompare(b.memberName));

    // 11. Totals
    const totalTrainingCost = memberPreviews.reduce((s, m) => s + m.trainingCost, 0);
    const totalMembershipFees = memberPreviews.reduce((s, m) => s + m.membershipFee, 0);
    const totalAdditionalFees = memberPreviews.reduce((s, m) => s + m.additionalFees, 0);

    return {
      seasonId,
      seasonName: season.name,
      config,
      groupBreakdown,
      memberPreviews,
      totalTrainingCost: this.roundCurrency(totalTrainingCost),
      totalMembershipFees: this.roundCurrency(totalMembershipFees),
      totalAdditionalFees: this.roundCurrency(totalAdditionalFees),
      grandTotal: this.roundCurrency(totalTrainingCost + totalMembershipFees + totalAdditionalFees),
      memberCount: memberPreviews.length,
      groupCount: groupBreakdown.length,
    };
  }

  /**
   * Generate actual invoices from the billing preview.
   * Creates one invoice per member with detailed line items.
   * Idempotent: skips members who already have invoices for this season.
   */
  async generateInvoices(
    seasonId: string
  ): Promise<{ created: GeneratedInvoice[]; skipped: string[] }> {
    const preview = await this.calculatePreview(seasonId);
    if (preview.memberPreviews.length === 0) {
      return { created: [], skipped: [] };
    }

    const config = preview.config;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (config?.payment_terms_days ?? 30));
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    // Check for existing season invoices to avoid duplicates
    const clubId = await this.getSeasonClubId(seasonId);
    const { data: existingInvoices } = await this.supabase
      .from('invoices')
      .select('member_id, notes')
      .eq('club_id', clubId || '')
      .eq('invoice_type', 'season')
      .ilike('notes', `%${preview.seasonName}%`);

    const alreadyInvoiced = new Set(
      (existingInvoices ?? [])
        .map((inv: { member_id: string | null }) => inv.member_id)
        .filter(Boolean)
    );

    const created: GeneratedInvoice[] = [];
    const skipped: string[] = [];

    for (const member of preview.memberPreviews) {
      if (alreadyInvoiced.has(member.memberId)) {
        skipped.push(member.memberId);
        continue;
      }

      try {
        const invoice = await this.createSeasonInvoice(seasonId, member, dueDateStr, config);
        created.push(invoice);
      } catch (err) {
        console.error(`[SeasonBilling] Failed to create invoice for ${member.memberId}:`, err);
      }
    }

    return { created, skipped };
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

  private async createSeasonInvoice(
    seasonId: string,
    member: MemberBillingPreview,
    dueDate: string,
    config: SeasonBillingConfig | null
  ): Promise<GeneratedInvoice> {
    // Use billingEngine for consistent invoice creation
    const { billingEngine } = await import('@/lib/billing-engine');

    const clubId = await this.getSeasonClubId(seasonId);
    if (!clubId) throw new Error('Season club not found');

    const taxRate = config?.tax_rate ?? 0;

    const invoice = await billingEngine.createInvoice({
      club_id: clubId,
      member_id: member.memberId,
      due_date: dueDate,
      type: 'season',
      items: member.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        tax_rate: taxRate,
        item_type: item.itemType,
      })),
      notes: `Saison-Abrechnung ${member.groupName}`,
    });

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
    // Fallback: query fee_configurations for active membership fee
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
      grandTotal: 0,
      memberCount: 0,
      groupCount: 0,
    };
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

export const seasonBillingService = SeasonBillingService.getInstance();
