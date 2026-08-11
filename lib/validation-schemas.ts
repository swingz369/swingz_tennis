/**
 * API Input Validation Schemas
 *
 * Zod schemas for validating API request payloads
 */

import { z } from 'zod';
import { IBAN_REGEX } from '@/lib/iban';
import { formatZodErrors } from '@/lib/validation-helpers';

// Common patterns
const uuidSchema = z.string().uuid('Invalid UUID format');
const emailSchema = z.string().email('Invalid email address');
const phoneSchema = z.string().regex(/^\+?[\d\s\-()]{10,20}$/, 'Invalid phone number format');
const ibanSchema = z.string().regex(IBAN_REGEX, 'Invalid IBAN format').min(5).max(34);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)');

// Member validation schemas
export const CreateMemberSchema = z.object({
  userId: uuidSchema,
  firstName: z
    .string()
    .min(2, 'First name too short')
    .max(100, 'First name too long')
    .regex(/^[a-zA-ZäöüÄÖÜß\s-]+$/, 'Invalid characters in first name'),
  lastName: z
    .string()
    .min(2, 'Last name too short')
    .max(100, 'Last name too long')
    .regex(/^[a-zA-ZäöüÄÖÜß\s-]+$/, 'Invalid characters in last name'),
  email: emailSchema,
  phone: phoneSchema,
  dateOfBirth: dateSchema,
  address: z
    .object({
      street: z.string().min(2).max(200),
      houseNumber: z.string().min(1).max(20),
      postalCode: z.string().regex(/^\d{5}$/, 'Invalid postal code (expected 5 digits)'),
      city: z.string().min(2).max(100),
    })
    .optional(),
  memberType: z.enum(['member', 'trial', 'inactive'], { message: 'Invalid member type' }),
  membershipStatus: z.enum(['active', 'inactive', 'suspended', 'terminated'], {
    message: 'Invalid membership status',
  }),
  membershipStart: dateSchema.optional(),
  membershipEnd: dateSchema.optional(),
  trainingGroup: z.string().max(100).optional(),
  emergencyContact: z
    .object({
      name: z.string().min(2).max(200),
      phone: phoneSchema,
      relationship: z.string().min(2).max(100),
    })
    .optional(),
  notes: z.string().max(2000, 'Notes too long').optional(),
});

export const UpdateMemberSchema = CreateMemberSchema.partial().extend({
  id: uuidSchema,
});

export const MemberQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended', 'pending']).optional(),
  type: z.enum(['regular', 'junior', 'senior', 'honorary']).optional(),
  trainingGroup: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
  active: z.boolean().optional(),
  statistics: z.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// SEPA Mandate validation schemas
export const CreateSEPAMandateSchema = z.object({
  memberId: uuidSchema,
  accountHolder: z.string().min(2).max(200),
  iban: ibanSchema,
  bic: z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Invalid BIC format'),
  bankName: z.string().min(2).max(200),
  street: z.string().min(2).max(200),
  houseNumber: z.string().min(1).max(20),
  postalCode: z.string().regex(/^\d{5}$/, 'Invalid postal code (expected 5 digits)'),
  city: z.string().min(2).max(100),
  mandateReference: z.string().max(35),
  signatureDate: dateSchema,
});

// Absence validation schemas
export const CreateAbsenceSchema = z
  .object({
    trainerId: uuidSchema,
    trainerName: z.string().min(2).max(200),
    type: z.enum(['vacation', 'sick', 'personal', 'other'], { message: 'Invalid absence type' }),
    startDate: dateSchema,
    endDate: dateSchema,
    reason: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end >= start;
    },
    {
      message: 'End date must be after or equal to start date',
      path: ['endDate'],
    }
  );

// Trial Training validation schemas
export const CreateTrialTrainingSchema = z.object({
  participantName: z.string().min(2).max(200),
  email: emailSchema,
  phone: phoneSchema,
  trainingDate: dateSchema,
  trainingGroup: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  status: z
    .enum(['scheduled', 'completed', 'cancelled', 'no-show', 'requested'])
    .default('scheduled'),
});

// Hours Log validation schemas
const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format (expected HH:MM)');

export const CreateHoursLogSchema = z.object({
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  type: z.string().min(1).max(50),
  sessionId: uuidSchema.optional(),
  notes: z.string().max(1000).optional(),
});

// Statistics query validation
export const StatisticsQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  clubId: uuidSchema.optional(),
});

// Booking validation schemas
export const CreateBookingSchema = z.object({
  sessionId: uuidSchema,
  clubId: uuidSchema,
  memberId: uuidSchema.optional(),
});

// Helper function to validate request body
export function validateRequestBody<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

// Helper function to validate query parameters
export function validateQueryParams<T extends z.ZodType>(
  schema: T,
  searchParams: URLSearchParams
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } {
  const params: Record<string, any> = {};

  for (const [key, value] of searchParams.entries()) {
    // Handle boolean values
    if (value === 'true') params[key] = true;
    else if (value === 'false') params[key] = false;
    else params[key] = value;
  }

  const result = schema.safeParse(params);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

// Re-export for backward compatibility
export { formatZodErrors as formatValidationErrors };
