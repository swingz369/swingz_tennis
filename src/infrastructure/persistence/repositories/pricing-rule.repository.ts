import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { pricing_rules } from '../schema';
import type { PricingRule, TimeRange } from '@/domain/entities/pricing-rule.entity';
import { ClubId, CourtId } from '@/domain/value-objects';

export class DrizzlePricingRuleRepository {
  async findById(id: string): Promise<PricingRule | null> {
    const result = await db.select().from(pricing_rules).where(eq(pricing_rules.id, id)).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByClubId(clubId: ClubId, activeOnly: boolean = true): Promise<PricingRule[]> {
    const conditions = [eq(pricing_rules.club_id, clubId.getValue())];
    if (activeOnly) {
      conditions.push(eq(pricing_rules.is_active, true));
    }
    const result = await db
      .select()
      .from(pricing_rules)
      .where(and(...conditions));
    return result.map((row) => this.mapToDomain(row));
  }

  async findByCourtId(courtId: CourtId, activeOnly: boolean = true): Promise<PricingRule[]> {
    const conditions = [eq(pricing_rules.court_id, courtId.getValue())];
    if (activeOnly) {
      conditions.push(eq(pricing_rules.is_active, true));
    }
    const result = await db
      .select()
      .from(pricing_rules)
      .where(and(...conditions));
    return result.map((row) => this.mapToDomain(row));
  }

  async findByClubAndMemberType(
    clubId: ClubId,
    memberType: string,
    activeOnly: boolean = true
  ): Promise<PricingRule[]> {
    const conditions = [eq(pricing_rules.club_id, clubId.getValue())];
    if (activeOnly) {
      conditions.push(eq(pricing_rules.is_active, true));
    }
    const result = await db
      .select()
      .from(pricing_rules)
      .where(and(...conditions));
    return result
      .map((row) => this.mapToDomain(row))
      .filter(
        (rule) =>
          rule.appliesToMemberTypes.length === 0 || rule.appliesToMemberTypes.includes(memberType)
      );
  }

  async save(rule: PricingRule): Promise<void> {
    const now = new Date();
    const values: Record<string, unknown> = {
      id: rule.id,
      club_id: rule.clubId.getValue(),
      court_id: rule.courtId?.getValue() || null,
      rule_type: rule.ruleType,
      name: rule.name || null,
      description: rule.description || null,
      min_booking_hours: rule.minBookingHours.toString(),
      max_booking_hours: rule.maxBookingHours.toString(),
      price_per_hour: rule.pricePerHour.toString(),
      advance_booking_days: rule.advanceBookingDays,
      applies_to_member_types: rule.appliesToMemberTypes,
      applies_to_groups: rule.appliesToGroups,
      time_ranges: rule.timeRanges || [],
      days_of_week: rule.daysOfWeek || null,
      season_id: rule.seasonId || null,
      valid_from: rule.validFrom || null,
      valid_until: rule.validUntil || null,
      priority: rule.priority,
      is_active: rule.isActive,
      updated_at: now,
    };

    const existing = await this.findById(rule.id);
    if (existing) {
      await db
        .update(pricing_rules)
        .set(values as Partial<typeof pricing_rules.$inferInsert>)
        .where(eq(pricing_rules.id, rule.id));
    } else {
      await db.insert(pricing_rules).values({
        ...values,
        created_at: now,
      } as typeof pricing_rules.$inferInsert);
    }
  }

  async delete(id: string): Promise<void> {
    await db.delete(pricing_rules).where(eq(pricing_rules.id, id));
  }

  async exists(id: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(pricing_rules)
      .where(eq(pricing_rules.id, id));
    return result[0]?.count > 0;
  }

  /**
   * Calculate the effective price for a booking scenario.
   * Considers time-of-day multipliers, day-of-week, season, and all existing filters.
   */
  async calculatePrice(
    clubId: ClubId,
    opts: {
      courtId?: CourtId;
      memberType?: string;
      groupIds?: string[];
      bookingHours?: number;
      advanceDays?: number;
      startTime?: Date;
      dayOfWeek?: number;
      seasonId?: string;
      basePricePerHour?: number;
    }
  ): Promise<{ pricePerHour: number; multiplier: number; ruleId?: string; source: string }> {
    const rule = await this.findBestMatch(
      clubId,
      opts.courtId,
      opts.memberType,
      opts.groupIds,
      opts.bookingHours,
      opts.advanceDays,
      opts.startTime,
      opts.dayOfWeek,
      opts.seasonId
    );

    if (!rule) {
      return { pricePerHour: opts.basePricePerHour ?? 15.0, multiplier: 1.0, source: 'default' };
    }

    let multiplier = 1.0;

    // Apply time-of-day multiplier if the rule has time ranges and we have a start time
    if (opts.startTime && rule.timeRanges && rule.timeRanges.length > 0) {
      const hours = opts.startTime.getHours().toString().padStart(2, '0');
      const mins = opts.startTime.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${mins}`;

      for (const range of rule.timeRanges) {
        if (timeStr >= range.start && timeStr < range.end) {
          multiplier = range.priceMultiplier;
          break;
        }
      }
    }

    return {
      pricePerHour: rule.pricePerHour,
      multiplier,
      ruleId: rule.id,
      source: 'pricing_rule',
    };
  }

  async findBestMatch(
    clubId: ClubId,
    courtId?: CourtId,
    memberType?: string,
    groupIds?: string[],
    bookingHours?: number,
    advanceDays?: number,
    _startTime?: Date,
    dayOfWeek?: number,
    seasonId?: string
  ): Promise<PricingRule | null> {
    let rules = await this.findByClubId(clubId, true);

    const now = new Date();

    // Filter by date validity (valid_from / valid_until)
    rules = rules.filter((r) => {
      if (r.validFrom && new Date(r.validFrom) > now) return false;
      if (r.validUntil && new Date(r.validUntil) < now) return false;
      return true;
    });

    // Filter by season
    if (seasonId) {
      const seasonRules = rules.filter((r) => r.seasonId === seasonId);
      if (seasonRules.length > 0) {
        rules = seasonRules;
      } else {
        // If no season-specific rules, allow season-agnostic rules (seasonId === undefined)
        rules = rules.filter((r) => r.seasonId === undefined);
      }
    } else {
      // If no season context, prefer rules without season binding
      rules = rules.filter((r) => r.seasonId === undefined);
    }

    // Filter by court (prefer court-specific, then club-wide)
    if (courtId) {
      const courtRules = rules.filter((r) => r.courtId?.equals(courtId));
      if (courtRules.length > 0) {
        rules = courtRules;
      } else {
        rules = rules.filter((r) => r.courtId === undefined);
      }
    }

    // Filter by day of week
    if (dayOfWeek !== undefined) {
      rules = rules.filter(
        (r) =>
          r.daysOfWeek === undefined ||
          r.daysOfWeek.length === 0 ||
          r.daysOfWeek.includes(dayOfWeek)
      );
    }

    // Filter by member type
    if (memberType) {
      rules = rules.filter(
        (r) => r.appliesToMemberTypes.length === 0 || r.appliesToMemberTypes.includes(memberType)
      );
    }

    // Filter by group membership (if any group matches)
    if (groupIds && groupIds.length > 0) {
      rules = rules.filter(
        (r) => r.appliesToGroups.length === 0 || r.appliesToGroups.some((g) => groupIds.includes(g))
      );
    }

    // Filter by booking hours range
    if (bookingHours !== undefined) {
      rules = rules.filter(
        (r) => bookingHours >= r.minBookingHours && bookingHours <= r.maxBookingHours
      );
    }

    // Filter by advance booking days (optional)
    if (advanceDays !== undefined) {
      rules = rules.filter((r) => advanceDays <= r.advanceBookingDays);
    }

    if (rules.length === 0) {
      return null;
    }

    // Sort by priority descending, then by specificity
    rules.sort((a, b) => {
      // Season-specific wins over general
      if (a.seasonId && !b.seasonId) return -1;
      if (!a.seasonId && b.seasonId) return 1;

      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      const aIsCourtSpecific = a.courtId !== undefined;
      const bIsCourtSpecific = b.courtId !== undefined;
      if (aIsCourtSpecific && !bIsCourtSpecific) return -1;
      if (!aIsCourtSpecific && bIsCourtSpecific) return 1;

      // Day-specific wins over all-days
      const aHasDays = a.daysOfWeek && a.daysOfWeek.length > 0;
      const bHasDays = b.daysOfWeek && b.daysOfWeek.length > 0;
      if (aHasDays && !bHasDays) return -1;
      if (!aHasDays && bHasDays) return 1;

      return 0;
    });

    return rules[0];
  }

  private mapToDomain(row: typeof pricing_rules.$inferSelect): PricingRule {
    return {
      id: row.id,
      clubId: ClubId.fromString(row.club_id),
      courtId: row.court_id ? CourtId.fromString(row.court_id) : undefined,
      ruleType: row.rule_type as PricingRule['ruleType'],
      name: (row.name as string) || undefined,
      description: (row.description as string) || undefined,
      minBookingHours: row.min_booking_hours != null ? Number(row.min_booking_hours) : 1,
      maxBookingHours: row.max_booking_hours != null ? Number(row.max_booking_hours) : 4,
      pricePerHour: Number(row.price_per_hour),
      advanceBookingDays: row.advance_booking_days != null ? row.advance_booking_days : 7,
      appliesToMemberTypes: (row.applies_to_member_types as string[]) || [],
      appliesToGroups: (row.applies_to_groups as string[]) || [],
      timeRanges: (row.time_ranges as unknown as TimeRange[]) || [],
      daysOfWeek: (row.days_of_week as number[] | null) || undefined,
      seasonId: (row.season_id as string) || undefined,
      validFrom: row.valid_from ? new Date(String(row.valid_from)) : undefined,
      validUntil: row.valid_until ? new Date(String(row.valid_until)) : undefined,
      priority: row.priority,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
