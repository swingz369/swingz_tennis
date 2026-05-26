import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { pricing_rules } from '../schema';
import type { PricingRule } from '@/domain/entities/pricing-rule.entity';
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
    return result.map((row: typeof pricing_rules.$inferSelect) => this.mapToDomain(row));
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
    return result.map((row: typeof pricing_rules.$inferSelect) => this.mapToDomain(row));
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
      .map((row: typeof pricing_rules.$inferSelect) => this.mapToDomain(row))
      .filter(
        (rule) =>
          rule.appliesToMemberTypes.length === 0 || rule.appliesToMemberTypes.includes(memberType)
      );
  }

  async save(rule: PricingRule): Promise<void> {
    const now = new Date();
    const values = {
      id: rule.id,
      club_id: rule.clubId.getValue(),
      court_id: rule.courtId?.getValue() || null,
      rule_type: rule.ruleType,
      min_booking_hours: rule.minBookingHours.toString(),
      max_booking_hours: rule.maxBookingHours.toString(),
      price_per_hour: rule.pricePerHour.toString(),
      advance_booking_days: rule.advanceBookingDays,
      applies_to_member_types: rule.appliesToMemberTypes,
      applies_to_groups: rule.appliesToGroups,
      priority: rule.priority,
      is_active: rule.isActive,
      updated_at: now,
    };

    const existing = await this.findById(rule.id);
    if (existing) {
      await db.update(pricing_rules).set(values).where(eq(pricing_rules.id, rule.id));
    } else {
      await db.insert(pricing_rules).values({
        ...values,
        created_at: now,
      });
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

  async findBestMatch(
    clubId: ClubId,
    courtId?: CourtId,
    memberType?: string,
    groupIds?: string[],
    bookingHours?: number,
    advanceDays?: number
  ): Promise<PricingRule | null> {
    let rules = await this.findByClubId(clubId, true);

    // Filter by court (prefer court-specific, then club-wide)
    if (courtId) {
      const courtRules = rules.filter((r) => r.courtId?.equals(courtId));
      if (courtRules.length > 0) {
        rules = courtRules;
      } else {
        rules = rules.filter((r) => r.courtId === undefined);
      }
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

    // Sort by priority descending, then by specificity (court-specific > club-wide)
    rules.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      const aIsCourtSpecific = a.courtId !== undefined;
      const bIsCourtSpecific = b.courtId !== undefined;
      if (aIsCourtSpecific && !bIsCourtSpecific) return -1;
      if (!aIsCourtSpecific && bIsCourtSpecific) return 1;
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
      minBookingHours: row.min_booking_hours != null ? Number(row.min_booking_hours) : 1,
      maxBookingHours: row.max_booking_hours != null ? Number(row.max_booking_hours) : 4,
      pricePerHour: Number(row.price_per_hour),
      advanceBookingDays: row.advance_booking_days != null ? row.advance_booking_days : 7,
      appliesToMemberTypes: row.applies_to_member_types as string[],
      appliesToGroups: row.applies_to_groups as string[],
      priority: row.priority,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
