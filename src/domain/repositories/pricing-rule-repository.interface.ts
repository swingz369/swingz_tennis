import type { PricingRule } from '../entities/pricing-rule.entity';
import type { ClubId, CourtId } from '../value-objects';

export interface PricingRuleRepository {
  findById(id: string): Promise<PricingRule | null>;
  findByClubId(clubId: ClubId, activeOnly?: boolean): Promise<PricingRule[]>;
  findByCourtId(courtId: CourtId, activeOnly?: boolean): Promise<PricingRule[]>;
  findByClubAndMemberType(
    clubId: ClubId,
    memberType: string,
    activeOnly?: boolean
  ): Promise<PricingRule[]>;
  save(rule: PricingRule): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;

  // Find the best matching rule based on criteria
  findBestMatch(
    clubId: ClubId,
    courtId?: CourtId,
    memberType?: string,
    groupIds?: string[],
    bookingHours?: number,
    advanceDays?: number
  ): Promise<PricingRule | null>;
}
