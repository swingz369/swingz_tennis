import { injectable, inject } from 'tsyringe';
import type { ClubId, CourtId } from '@/domain/value-objects';
import type { PricingRuleRepository } from '@/domain/repositories';
import type { ClubRepository } from '@/domain/repositories/club-repository.interface';
import { TOKENS } from '@/application/container';

export interface PriceInfo {
  pricePerHour: number;
  source: 'pricing_rule' | 'default';
  ruleId?: string;
}

@injectable()
export class PricingService {
  constructor(
    @inject(TOKENS.PricingRuleRepository) private pricingRepo: PricingRuleRepository,
    @inject(TOKENS.ClubRepository) private clubRepo: ClubRepository
  ) {}

  async getPriceForBooking(
    clubId: ClubId,
    durationHours: number,
    options?: {
      courtId?: CourtId;
      memberType?: string;
      groupIds?: string[];
      advanceDays?: number;
    }
  ): Promise<PriceInfo> {
    const rule = await this.pricingRepo.findBestMatch(
      clubId,
      options?.courtId,
      options?.memberType,
      options?.groupIds,
      durationHours,
      options?.advanceDays
    );

    if (rule) {
      return {
        pricePerHour: rule.pricePerHour,
        source: 'pricing_rule',
        ruleId: rule.id,
      };
    }

    // Fallback to club default
    const club = await this.clubRepo.findById(clubId);
    // Club entity currently doesn't expose defaultHourlyRate; fetch from DB directly or add to domain
    // For now, we'll fetch from DB via clubRepo's internal DB call or extend Club domain
    // We'll read from DB inline:
    const { getDb } = await import('@/infrastructure/persistence/client');
    const db = getDb();
    const { clubs } = await import('@/infrastructure/persistence/schema');
    const { eq } = await import('drizzle-orm');
    const result = await db
      .select({ default_hourly_rate: clubs.default_hourly_rate })
      .from(clubs)
      .where(eq(clubs.id, clubId.getValue()))
      .limit(1);
    const defaultRate = result[0]?.default_hourly_rate || 15.0;
    const rateNum = Number(defaultRate);

    return {
      pricePerHour: rateNum,
      source: 'default',
    };
  }
}
