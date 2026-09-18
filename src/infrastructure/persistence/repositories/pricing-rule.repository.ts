/**
 * Preisregeln für ADR-005: ein Repository, Supabase-Client mit Nutzer-Token
 * (RLS: admins_manage_pricing, club_members_see_pricing). Die Preisberechnung
 * liegt im PricingRuleService, hier nur Lesen/Schreiben.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { PricingRule, TimeRange } from '@/domain/entities/pricing-rule.entity';
import { ClubId, CourtId } from '@/domain/value-objects';
import type { Tables, TablesInsert } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:pricing-rule.repository');

type PricingRuleRow = Tables<'pricing_rules'>;

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

function mapToDomain(row: PricingRuleRow): PricingRule {
  return {
    id: row.id,
    clubId: ClubId.fromString(row.club_id),
    courtId: row.court_id ? CourtId.fromString(row.court_id) : undefined,
    ruleType: (row.rule_type ?? 'hourly') as PricingRule['ruleType'],
    name: row.name || undefined,
    description: row.description || undefined,
    minBookingHours: row.min_booking_hours != null ? Number(row.min_booking_hours) : 1,
    maxBookingHours: row.max_booking_hours != null ? Number(row.max_booking_hours) : 4,
    pricePerHour: Number(row.price_per_hour ?? 0),
    advanceBookingDays: row.advance_booking_days ?? 7,
    appliesToMemberTypes: (row.applies_to_member_types as string[] | null) ?? [],
    appliesToGroups: (row.applies_to_groups as string[] | null) ?? [],
    timeRanges: (row.time_ranges as unknown as TimeRange[] | null) ?? [],
    daysOfWeek: row.days_of_week?.length ? row.days_of_week : undefined,
    seasonId: row.season_id || undefined,
    validFrom: row.valid_from ? new Date(row.valid_from) : undefined,
    validUntil: row.valid_until ? new Date(row.valid_until) : undefined,
    priority: row.priority,
    isActive: row.is_active ?? true,
    createdAt: new Date(row.created_at ?? Date.now()),
    updatedAt: new Date(row.updated_at),
  };
}

function toRow(rule: PricingRule): TablesInsert<'pricing_rules'> {
  return {
    id: rule.id,
    club_id: rule.clubId.getValue(),
    court_id: rule.courtId?.getValue() ?? null,
    rule_type: rule.ruleType,
    name: rule.name ?? 'Preisregel',
    description: rule.description ?? null,
    min_booking_hours: rule.minBookingHours,
    max_booking_hours: rule.maxBookingHours,
    price_per_hour: rule.pricePerHour,
    advance_booking_days: rule.advanceBookingDays,
    applies_to_member_types: rule.appliesToMemberTypes,
    applies_to_groups: rule.appliesToGroups,
    time_ranges: rule.timeRanges as unknown as TablesInsert<'pricing_rules'>['time_ranges'],
    days_of_week: rule.daysOfWeek ?? null,
    season_id: rule.seasonId ?? null,
    valid_from: rule.validFrom?.toISOString() ?? null,
    valid_until: rule.validUntil?.toISOString() ?? null,
    priority: rule.priority,
    is_active: rule.isActive,
    updated_at: new Date().toISOString(),
  };
}

export class PricingRuleRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async findById(id: string): Promise<PricingRule | null> {
    const { data, error } = await this.db.from('pricing_rules').select().eq('id', id).maybeSingle();
    assertNoError(error, 'Lesen der Preisregel fehlgeschlagen');
    return data ? mapToDomain(data) : null;
  }

  async findByClubId(clubId: ClubId, activeOnly: boolean = true): Promise<PricingRule[]> {
    let query = this.db.from('pricing_rules').select().eq('club_id', clubId.getValue());
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    assertNoError(error, 'Lesen der Preisregeln fehlgeschlagen');
    return (data ?? []).map(mapToDomain);
  }

  async save(rule: PricingRule): Promise<void> {
    const { error } = await this.db.from('pricing_rules').upsert(toRow(rule));
    assertNoError(error, 'Speichern der Preisregel fehlgeschlagen');
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('pricing_rules').delete().eq('id', id);
    assertNoError(error, 'Löschen der Preisregel fehlgeschlagen');
  }
}
