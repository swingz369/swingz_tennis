import { ValueObject } from '../value-objects/ids';
import type { ClubId } from '../value-objects/ids';
import type { CourtId } from '../value-objects/ids';

export type PricingRuleType = 'hourly' | 'member' | 'trial' | 'group' | 'season';

export interface PricingRule {
  readonly id: string;
  readonly clubId: ClubId;
  readonly courtId?: CourtId;
  readonly ruleType: PricingRuleType;
  readonly minBookingHours: number;
  readonly maxBookingHours: number;
  readonly pricePerHour: number;
  readonly advanceBookingDays: number;
  readonly appliesToMemberTypes: string[]; // ['member', 'trial', ...] empty = all
  readonly appliesToGroups: string[]; // group IDs, empty = all
  readonly priority: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreatePricingRuleInput {
  clubId: string;
  courtId?: string;
  ruleType: PricingRuleType;
  minBookingHours?: number;
  maxBookingHours?: number;
  pricePerHour: number;
  advanceBookingDays?: number;
  appliesToMemberTypes?: string[];
  appliesToGroups?: string[];
  priority?: number;
}

export interface UpdatePricingRuleInput {
  ruleType?: PricingRuleType;
  minBookingHours?: number;
  maxBookingHours?: number;
  pricePerHour?: number;
  advanceBookingDays?: number;
  appliesToMemberTypes?: string[];
  appliesToGroups?: string[];
  priority?: number;
  isActive?: boolean;
}
