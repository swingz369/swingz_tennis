import type { ClubId } from '../value-objects/ids';
import type { CourtId } from '../value-objects/ids';

export type PricingRuleType = 'hourly' | 'member' | 'trial' | 'group' | 'season';

export interface TimeRange {
  start: string; // "HH:MM" format
  end: string; // "HH:MM" format
  priceMultiplier: number; // e.g. 1.5 = 150% of base price
}

export interface PricingRule {
  readonly id: string;
  readonly clubId: ClubId;
  readonly courtId?: CourtId;
  readonly ruleType: PricingRuleType;
  readonly name?: string;
  readonly description?: string;
  readonly minBookingHours: number;
  readonly maxBookingHours: number;
  readonly pricePerHour: number;
  readonly advanceBookingDays: number;
  readonly appliesToMemberTypes: string[]; // ['member', 'trial', ...] empty = all
  readonly appliesToGroups: string[]; // group IDs, empty = all
  readonly timeRanges: TimeRange[]; // time-of-day pricing tiers
  readonly daysOfWeek?: number[]; // 0=Sun...6=Sat, undefined=all
  readonly seasonId?: string;
  readonly validFrom?: Date;
  readonly validUntil?: Date;
  readonly priority: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreatePricingRuleInput {
  clubId: string;
  courtId?: string;
  ruleType: PricingRuleType;
  name?: string;
  description?: string;
  minBookingHours?: number;
  maxBookingHours?: number;
  pricePerHour: number;
  advanceBookingDays?: number;
  appliesToMemberTypes?: string[];
  appliesToGroups?: string[];
  timeRanges?: TimeRange[];
  daysOfWeek?: number[];
  seasonId?: string;
  validFrom?: string;
  validUntil?: string;
  priority?: number;
}

export interface UpdatePricingRuleInput {
  ruleType?: PricingRuleType;
  name?: string;
  description?: string;
  minBookingHours?: number;
  maxBookingHours?: number;
  pricePerHour?: number;
  advanceBookingDays?: number;
  appliesToMemberTypes?: string[];
  appliesToGroups?: string[];
  timeRanges?: TimeRange[];
  daysOfWeek?: number[];
  seasonId?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  priority?: number;
  isActive?: boolean;
}
