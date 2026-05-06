/**
 * Enhanced Booking Rules Types
 * Based on TSOWAPP booking system analysis
 */

export type UserRole = 'member' | 'trainer' | 'admin' | 'superadmin' | 'guest';

export type RestrictionType = 'holiday' | 'maintenance' | 'event' | 'weather' | 'other';

export interface BookingRule {
  id: string;
  club_id: string;
  name: string;
  description?: string;
  role: UserRole;

  // Duration restrictions
  max_booking_duration_minutes: number;
  min_booking_duration_minutes: number;

  // Advance booking restrictions
  advance_booking_days: number;
  min_advance_booking_hours: number;

  // Frequency restrictions
  max_bookings_per_day: number;
  max_bookings_per_week: number;
  max_concurrent_bookings: number;

  // Weekend and prime time
  allow_weekend_booking: boolean;
  weekend_advance_days: number;
  allow_prime_time_booking: boolean;
  prime_time_start?: string; // time format
  prime_time_end?: string;

  // Recurring bookings
  allow_recurring: boolean;
  max_recurring_weeks: number;

  // Payment and approval
  require_payment: boolean;
  require_approval: boolean;
  cancellation_hours: number;

  // Advanced settings
  allow_partner_booking: boolean;
  priority: number;

  // Time slot configuration
  allowed_time_slots: TimeSlot[];
  blocked_time_slots: TimeSlot[];

  // Seasonal restrictions
  season_start_date?: string;
  season_end_date?: string;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  day_of_week: number; // 0-6 (Sunday-Saturday)
  start_time: string;
  end_time: string;
}

export interface MemberBookingPreferences {
  id: string;
  user_id: string;
  club_id: string;
  preferred_courts: string[];
  preferred_time_slots: TimeSlot[];
  preferred_partners: string[];
  avoid_partners: string[];
  notification_preferences: NotificationPreferences;
  auto_cancel_no_show: boolean;
  default_booking_duration: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  booking_confirmed: boolean;
  booking_cancelled: boolean;
  waitlist_available: boolean;
  reminder_24h: boolean;
  reminder_1h: boolean;
}

export interface BookingRestriction {
  id: string;
  club_id: string;
  court_id?: string; // null = all courts
  restriction_type: RestrictionType;
  name: string;
  description?: string;
  start_datetime: string;
  end_datetime: string;
  affects_existing_bookings: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BookingValidationResult {
  is_valid: boolean;
  error_code?: string;
  error_message?: string;
}

export interface CreateBookingInput {
  club_id: string;
  court_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  booking_type?: 'regular' | 'lesson' | 'tournament' | 'maintenance' | 'blocked';
  is_recurring?: boolean;
  recurring_pattern?: RecurringPattern;
  number_of_players?: number;
  notes?: string;
  partner_ids?: string[];
}

export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  interval: number;
  days_of_week?: number[]; // for weekly pattern
  end_date?: string;
  occurrences?: number;
}

export interface BookingRuleSet {
  club_id: string;
  member_rules: BookingRule;
  trainer_rules: BookingRule;
  admin_rules: BookingRule;
  guest_rules?: BookingRule;
}

/**
 * Default booking rules for different roles
 */
export const DEFAULT_BOOKING_RULES: Record<UserRole, Partial<BookingRule>> = {
  member: {
    role: 'member',
    max_booking_duration_minutes: 90,
    min_booking_duration_minutes: 30,
    advance_booking_days: 7,
    min_advance_booking_hours: 1,
    max_bookings_per_day: 2,
    max_bookings_per_week: 10,
    max_concurrent_bookings: 3,
    allow_weekend_booking: true,
    weekend_advance_days: 7,
    allow_prime_time_booking: true,
    allow_recurring: true,
    max_recurring_weeks: 12,
    require_payment: false,
    require_approval: false,
    cancellation_hours: 24,
    allow_partner_booking: true,
    priority: 0,
  },
  trainer: {
    role: 'trainer',
    max_booking_duration_minutes: 120,
    min_booking_duration_minutes: 30,
    advance_booking_days: 30,
    min_advance_booking_hours: 0,
    max_bookings_per_day: 10,
    max_bookings_per_week: 50,
    max_concurrent_bookings: 20,
    allow_weekend_booking: true,
    weekend_advance_days: 30,
    allow_prime_time_booking: true,
    allow_recurring: true,
    max_recurring_weeks: 52,
    require_payment: false,
    require_approval: false,
    cancellation_hours: 12,
    allow_partner_booking: true,
    priority: 10,
  },
  admin: {
    role: 'admin',
    max_booking_duration_minutes: 240,
    min_booking_duration_minutes: 15,
    advance_booking_days: 365,
    min_advance_booking_hours: 0,
    max_bookings_per_day: 999,
    max_bookings_per_week: 999,
    max_concurrent_bookings: 999,
    allow_weekend_booking: true,
    weekend_advance_days: 365,
    allow_prime_time_booking: true,
    allow_recurring: true,
    max_recurring_weeks: 52,
    require_payment: false,
    require_approval: false,
    cancellation_hours: 0,
    allow_partner_booking: true,
    priority: 100,
  },
  superadmin: {
    role: 'superadmin',
    max_booking_duration_minutes: 999,
    min_booking_duration_minutes: 15,
    advance_booking_days: 999,
    min_advance_booking_hours: 0,
    max_bookings_per_day: 999,
    max_bookings_per_week: 999,
    max_concurrent_bookings: 999,
    allow_weekend_booking: true,
    weekend_advance_days: 999,
    allow_prime_time_booking: true,
    allow_recurring: true,
    max_recurring_weeks: 999,
    require_payment: false,
    require_approval: false,
    cancellation_hours: 0,
    allow_partner_booking: true,
    priority: 999,
  },
  guest: {
    role: 'guest',
    max_booking_duration_minutes: 60,
    min_booking_duration_minutes: 60,
    advance_booking_days: 3,
    min_advance_booking_hours: 2,
    max_bookings_per_day: 1,
    max_bookings_per_week: 2,
    max_concurrent_bookings: 1,
    allow_weekend_booking: false,
    weekend_advance_days: 0,
    allow_prime_time_booking: false,
    allow_recurring: false,
    max_recurring_weeks: 0,
    require_payment: true,
    require_approval: true,
    cancellation_hours: 48,
    allow_partner_booking: false,
    priority: -10,
  },
};
