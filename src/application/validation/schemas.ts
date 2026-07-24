import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
  search: z.string().optional(),
});

// ============================================
// CLUB SCHEMAS
// ============================================

export const createClubSchema = z.object({
  name: z
    .string()
    .min(1, 'Club name is required')
    .max(200, 'Club name cannot exceed 200 characters'),
  maxMembers: z.coerce
    .number()
    .int()
    .positive('Max members must be positive')
    .max(10000, 'Max members cannot exceed 10000'),
  defaultHourlyRate: z.coerce
    .number()
    .nonnegative('Hourly rate cannot be negative')
    .max(1000, 'Hourly rate cannot exceed 1000')
    .optional(),
  openingHours: z.object({
    monday: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    }),
    tuesday: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    }),
    wednesday: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    }),
    thursday: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    }),
    friday: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    }),
    saturday: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    }),
    sunday: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    }),
  }),
});

export const updateClubSchema = createClubSchema.partial().extend({
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  bundesland: z.string().max(50).optional(),
  // Owner-Master-Drawer (Phase 2): mutable via PATCH for the Owner console.
  // `nullable` matches the DB shape so we can explicitly clear a value.
  city: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  logo_url: z.string().url('Logo-URL muss eine gültige URL sein').max(500).nullable().optional(),
  billing_unit_minutes: z.coerce
    .number()
    .int()
    .refine((v) => v === 45 || v === 60, {
      message: 'billing_unit_minutes must be 45 or 60',
    })
    .optional(),
  tax_rate: z.coerce.number().int().min(0).max(19).optional(),
  default_payment_method: z.enum(['sepa', 'transfer', 'cash', 'stripe']).optional(),
  invoice_number_prefix: z.string().max(10).optional(),
});

// ============================================
// TRAINER SCHEMAS
// ============================================

export const createTrainerSchema = z.object({
  name: z
    .string()
    .min(1, 'Trainer name is required')
    .max(100, 'Trainer name cannot exceed 100 characters'),
  email: z.string().email('Valid email is required'),
  specialties: z.array(z.string().min(1)).min(1, 'At least one specialty is required'),
  maxHoursPerWeek: z.coerce
    .number()
    .int()
    .min(1, 'Max hours must be at least 1')
    .max(50, 'Max hours cannot exceed 50'),
});

export const updateTrainerSchema = createTrainerSchema.partial();

// ============================================
// MEMBER SCHEMAS
// ============================================

export const updateMemberSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(100).optional(),
  is_active: z.boolean().optional(),
  role: z.enum(['member', 'trainer', 'admin', 'superadmin']).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  full_name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['member', 'trainer', 'admin']).default('member'),
});

// ============================================
// BILLING / SUBSCRIPTION SCHEMAS
// ============================================

export const assignSubscriptionSchema = z.object({
  memberId: uuidSchema,
  plan: z.enum(['free', 'pro', 'enterprise']),
});

// ============================================
// SESSION / SCHEDULE SCHEMAS
// ============================================

export const createSessionSchema = z.object({
  scheduleId: uuidSchema,
  trainerId: uuidSchema,
  courtId: uuidSchema.optional().nullable(),
  weekNumber: z.coerce.number().int().min(1).max(53),
  timeslotStart: z.string().datetime('Invalid start time'),
  timeslotEnd: z.string().datetime('Invalid end time'),
  maxParticipants: z.coerce.number().int().min(1).max(50),
  notes: z.string().optional().nullable(),
  groupIds: z.array(uuidSchema).min(0).default([]),
});

export const updateSessionSchema = createSessionSchema.partial();

export const createScheduleSchema = z.object({
  clubId: uuidSchema,
  seasonType: z.enum(['spring', 'summer', 'autumn', 'winter', 'year-round']),
  seasonYear: z.coerce.number().int().min(2020).max(2100),
  seasonStartDate: z.string().datetime('Invalid start date'),
  seasonEndDate: z.string().datetime('Invalid end date'),
});

export const optimizeScheduleSchema = z.object({
  clubId: uuidSchema,
  seasonType: z.enum(['spring', 'summer', 'autumn', 'winter', 'year-round']),
  year: z.coerce.number().int().min(2020).max(2100),
  forceRegenerate: z.boolean().optional(),
});

export const updateSessionsSchema = z.object({
  scheduleId: uuidSchema,
  sessions: z.array(
    z.object({
      id: uuidSchema.optional(),
      trainerId: uuidSchema,
      courtId: uuidSchema.optional().nullable(),
      weekNumber: z.coerce.number().int().min(1).max(53),
      timeslotStart: z.string().datetime(),
      timeslotEnd: z.string().datetime(),
      maxParticipants: z.coerce.number().int().min(1).max(50),
      notes: z.string().optional().nullable(),
      groupIds: z.array(uuidSchema).default([]),
    })
  ),
});

// ============================================
// BOOKING SCHEMAS
// ============================================

export const createBookingSchema = z.object({
  memberId: uuidSchema,
  sessionId: uuidSchema,
  clubId: uuidSchema.optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['confirmed', 'cancelled', 'no_show']),
});

export const cancelBookingSchema = z.object({
  reason: z.enum(['trainer_unavailable', 'member_request', 'weather', 'other']),
  notes: z.string().optional().nullable(),
});

// ============================================
// ANALYTICS / DASHBOARD SCHEMAS
// ============================================

export const dateRangeSchema = z.object({
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
});

// ============================================
// USER / AUTH SCHEMAS
// ============================================

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

// ============================================
// EMAIL SCHEMAS
// ============================================

export const sendEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required').max(200),
  html: z.string().min(1, 'Email body is required'),
  text: z.string().optional(),
});

export const bookingConfirmationSchema = z.object({
  bookingId: uuidSchema,
  recipientEmail: z.string().email(),
  sessionStart: z.string().datetime(),
  sessionEnd: z.string().datetime(),
  trainerName: z.string().optional(),
  courtName: z.string().optional(),
});

export const bookingCancellationSchema = z.object({
  bookingId: uuidSchema,
  recipientEmail: z.string().email(),
  reason: z.enum(['trainer_unavailable', 'member_request', 'weather', 'other']),
  notes: z.string().optional().nullable(),
});

export const bookingReminderSchema = z.object({
  bookingId: uuidSchema,
  recipientEmail: z.string().email(),
  sessionStart: z.string().datetime(),
  trainerName: z.string().optional(),
});

// ============================================
// SEARCH & FILTER SCHEMAS
// ============================================

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query required').max(100),
  type: z.enum(['members', 'bookings', 'trainers', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ============================================
// EXPORT SCHEMAS
// ============================================

export const exportFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  clubId: uuidSchema.optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'no_show', 'all']).default('all'),
  format: z.enum(['csv', 'pdf']).default('csv'),
});

// ============================================
// TYPE HELPERS
// ============================================

export type CreateClubInput = z.infer<typeof createClubSchema>;
export type UpdateClubInput = z.infer<typeof updateClubSchema>;
export type CreateTrainerInput = z.infer<typeof createTrainerSchema>;
export type UpdateTrainerInput = z.infer<typeof updateTrainerSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AssignSubscriptionInput = z.infer<typeof assignSubscriptionSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type ExportFilterInput = z.infer<typeof exportFilterSchema>;
