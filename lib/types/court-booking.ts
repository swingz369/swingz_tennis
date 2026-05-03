import { z } from 'zod';

export const CourtSurfaceType = z.enum(['clay', 'hard', 'grass', 'carpet', 'artificial_grass']);
export type CourtSurfaceType = z.infer<typeof CourtSurfaceType>;

export const CourtStatus = z.enum(['available', 'maintenance', 'closed', 'reserved']);
export type CourtStatus = z.infer<typeof CourtStatus>;

export const BookingStatus = z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']);
export type BookingStatus = z.infer<typeof BookingStatus>;

export const BookingType = z.enum(['regular', 'lesson', 'tournament', 'maintenance', 'blocked']);
export type BookingType = z.infer<typeof BookingType>;

export const PaymentStatus = z.enum(['unpaid', 'paid', 'refunded', 'waived']);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const WaitlistStatus = z.enum(['waiting', 'offered', 'accepted', 'declined', 'expired']);
export type WaitlistStatus = z.infer<typeof WaitlistStatus>;

export const CourtTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  surface_type: CourtSurfaceType,
  is_indoor: z.boolean(),
  is_outdoor: z.boolean(),
  requires_lighting: z.boolean(),
  max_players: z.number().int().positive(),
  hourly_rate: z.number().nonnegative(),
  is_active: z.boolean(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type CourtType = z.infer<typeof CourtTypeSchema>;

export const CourtSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  court_type_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  number: z.number().int().positive(),
  location: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  status: CourtStatus,
  has_lighting: z.boolean(),
  lighting_hours_start: z.string().nullable().optional(),
  lighting_hours_end: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type Court = z.infer<typeof CourtSchema>;

export const BookingRuleSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  max_booking_duration_minutes: z.number().int().positive(),
  min_booking_duration_minutes: z.number().int().positive(),
  advance_booking_days: z.number().int().positive(),
  max_bookings_per_day: z.number().int().positive(),
  max_bookings_per_week: z.number().int().positive(),
  allow_recurring: z.boolean(),
  max_recurring_weeks: z.number().int().positive(),
  require_payment: z.boolean(),
  cancellation_hours: z.number().int().nonnegative(),
  is_active: z.boolean(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type BookingRule = z.infer<typeof BookingRuleSchema>;

export const BookingSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  court_id: z.string().uuid(),
  user_id: z.string().uuid(),
  booking_number: z.string().min(1),
  start_time: z.string().or(z.date()),
  end_time: z.string().or(z.date()),
  status: BookingStatus,
  booking_type: BookingType,
  is_recurring: z.boolean(),
  recurring_pattern: z.record(z.any()).nullable().optional(),
  number_of_players: z.number().int().min(1).max(4),
  notes: z.string().nullable().optional(),
  payment_status: PaymentStatus,
  payment_id: z.string().uuid().nullable().optional(),
  cancelled_at: z.string().or(z.date()).nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type Booking = z.infer<typeof BookingSchema>;

export const WaitlistEntrySchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  court_id: z.string().uuid().nullable().optional(),
  user_id: z.string().uuid(),
  start_time: z.string().or(z.date()),
  end_time: z.string().or(z.date()),
  number_of_players: z.number().int().min(1).max(4),
  status: WaitlistStatus,
  priority: z.number().int().nonnegative(),
  notes: z.string().nullable().optional(),
  offered_at: z.string().or(z.date()).nullable().optional(),
  expires_at: z.string().or(z.date()).nullable().optional(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type WaitlistEntry = z.infer<typeof WaitlistEntrySchema>;

export const CourtAvailabilitySchema = z.object({
  id: z.string().uuid(),
  court_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  is_available: z.boolean(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type CourtAvailability = z.infer<typeof CourtAvailabilitySchema>;

export const CreateCourtTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  surface_type: CourtSurfaceType,
  is_indoor: z.boolean(),
  is_outdoor: z.boolean(),
  requires_lighting: z.boolean(),
  max_players: z.number().int().positive().default(4),
  hourly_rate: z.number().nonnegative(),
});

export type CreateCourtType = z.infer<typeof CreateCourtTypeSchema>;

export const CreateCourtSchema = z.object({
  club_id: z.string().uuid(),
  court_type_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  number: z.number().int().positive(),
  location: z.string().max(100).optional(),
  description: z.string().optional(),
  has_lighting: z.boolean().default(false),
  lighting_hours_start: z.string().optional(),
  lighting_hours_end: z.string().optional(),
});

export type CreateCourt = z.infer<typeof CreateCourtSchema>;

export const CreateBookingSchema = z.object({
  court_id: z.string().uuid(),
  start_time: z.string().or(z.date()),
  end_time: z.string().or(z.date()),
  booking_type: BookingType.default('regular'),
  is_recurring: z.boolean().default(false),
  recurring_pattern: z.record(z.any()).optional(),
  number_of_players: z.number().int().min(1).max(4).default(2),
  notes: z.string().optional(),
});

export type CreateBooking = z.infer<typeof CreateBookingSchema>;

export const CreateWaitlistEntrySchema = z.object({
  court_id: z.string().uuid().optional(),
  start_time: z.string().or(z.date()),
  end_time: z.string().or(z.date()),
  number_of_players: z.number().int().min(1).max(4).default(2),
  priority: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
});

export type CreateWaitlistEntry = z.infer<typeof CreateWaitlistEntrySchema>;

export const CreateBookingRuleSchema = z.object({
  club_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  max_booking_duration_minutes: z.number().int().positive().default(90),
  min_booking_duration_minutes: z.number().int().positive().default(30),
  advance_booking_days: z.number().int().positive().default(7),
  max_bookings_per_day: z.number().int().positive().default(2),
  max_bookings_per_week: z.number().int().positive().default(10),
  allow_recurring: z.boolean().default(true),
  max_recurring_weeks: z.number().int().positive().default(12),
  require_payment: z.boolean().default(false),
  cancellation_hours: z.number().int().nonnegative().default(24),
});

export type CreateBookingRule = z.infer<typeof CreateBookingRuleSchema>;

export const UpdateBookingSchema = z.object({
  status: BookingStatus.optional(),
  notes: z.string().optional(),
  cancellation_reason: z.string().optional(),
});

export type UpdateBooking = z.infer<typeof UpdateBookingSchema>;

export const CourtWithAvailabilitySchema = CourtSchema.extend({
  court_type: CourtTypeSchema,
  availability: z.array(CourtAvailabilitySchema),
});

export type CourtWithAvailability = z.infer<typeof CourtWithAvailabilitySchema>;

export const BookingWithDetailsSchema = BookingSchema.extend({
  court: CourtSchema,
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    user_metadata: z.object({
      full_name: z.string().optional(),
    }),
  }),
});

export type BookingWithDetails = z.infer<typeof BookingWithDetailsSchema>;

export const BookingConflict = z.object({
  booking_id: z.string().uuid(),
  court_id: z.string().uuid(),
  start_time: z.string().or(z.date()),
  end_time: z.string().or(z.date()),
  user_id: z.string().uuid(),
  status: BookingStatus,
});

export type BookingConflict = z.infer<typeof BookingConflict>;

export const TimeSlot = z.object({
  start_time: z.string(),
  end_time: z.string(),
  is_available: z.boolean(),
  booking: BookingSchema.optional(),
});

export type TimeSlot = z.infer<typeof TimeSlot>;

export const DayAvailability = z.object({
  date: z.string(),
  day_of_week: z.number().int().min(0).max(6),
  time_slots: z.array(TimeSlot),
});

export type DayAvailability = z.infer<typeof DayAvailability>;

export const CourtSchedule = z.object({
  court_id: z.string().uuid(),
  court_name: z.string(),
  court_type: CourtTypeSchema,
  days: z.array(DayAvailability),
});

export type CourtSchedule = z.infer<typeof CourtSchedule>;
