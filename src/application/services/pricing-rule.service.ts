import { randomUUID } from 'crypto';
import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { getUserDb } from '@/infrastructure/db';
import { PricingRuleRepository } from '@/infrastructure/persistence/repositories/pricing-rule.repository';
import type { PricingRule } from '@/domain/entities/pricing-rule.entity';
import { ClubId, CourtId } from '@/domain/value-objects';

export type CreatePricingRuleInput = Omit<
  PricingRule,
  'id' | 'clubId' | 'courtId' | 'createdAt' | 'updatedAt'
> & {
  clubId: string;
  courtId?: string | null;
};

export type UpdatePricingRuleInput = Partial<
  Omit<PricingRule, 'id' | 'clubId' | 'courtId' | 'createdAt' | 'updatedAt'>
>;

/**
 * Preisregel-Service (ADR-005): CRUD und Preisberechnung. Datenzugriff
 * ausschliesslich über das PricingRuleRepository (RLS über getUserDb).
 */
export class PricingRuleService {
  private readonly repo: PricingRuleRepository;

  constructor(auth: AuthContext) {
    this.repo = new PricingRuleRepository(getUserDb(auth));
  }

  async listByClub(clubId: string): Promise<PricingRule[]> {
    return this.repo.findByClubId(ClubId.fromString(clubId));
  }

  async create(input: CreatePricingRuleInput): Promise<PricingRule> {
    const now = new Date();
    const rule: PricingRule = {
      ...input,
      id: randomUUID(),
      clubId: ClubId.fromString(input.clubId),
      courtId: input.courtId ? CourtId.fromString(input.courtId) : undefined,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.save(rule);
    return rule;
  }

  async update(id: string, input: UpdatePricingRuleInput): Promise<PricingRule> {
    const existing = await this.getById(id);
    const updated: PricingRule = { ...existing, ...input, updatedAt: new Date() };
    await this.repo.save(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.repo.delete(id);
  }

  /** Unbekannte oder (per RLS) nicht sichtbare Regel → NOT_FOUND. */
  private async getById(id: string): Promise<PricingRule> {
    const rule = await this.repo.findById(id);
    if (!rule) throw new ApiException('NOT_FOUND', 'Preisregel nicht gefunden');
    return rule;
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
    let rules = await this.repo.findByClubId(clubId, true);

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
}
