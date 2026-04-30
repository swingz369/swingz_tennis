import { z } from 'zod';

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
  email: z.string().min(1, 'Email ist erforderlich').email('Ungültige Email-Adresse'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen haben'),
});

/**
 * Member profile editing schema
 */
export const memberProfileSchema = z.object({
  fullName: z.string().min(2, 'Name muss mindestens 2 Zeichen haben').max(100, 'Name ist zu lang'),
  email: z.string().email('Ungültige Email-Adresse'),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[\d\s-]{10,}$/.test(val), {
      message: 'Ungültige Telefonnummer',
    }),
});

/**
 * Booking creation schema
 */
export const bookingSchema = z.object({
  sessionId: z.string().min(1, 'Session ist erforderlich'),
  memberId: z.string().min(1, 'Mitglied ist erforderlich'),
});

/**
 * Session/Class creation schema (trainer/admin)
 */
export const sessionSchema = z.object({
  dayOfWeek: z.number().min(1).max(7, 'Tag muss zwischen 1-7 sein'),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Ungültige Uhrzeit'),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Ungültige Uhrzeit'),
  maxParticipants: z.number().min(1).max(100, 'Max. 100 Teilnehmer'),
  trainerId: z.string().min(1, 'Trainer ist erforderlich'),
  notes: z.string().max(500, 'Notizen zu lang').optional(),
});

/**
 * Club creation/editing schema
 */
export const clubSchema = z.object({
  name: z
    .string()
    .min(2, 'Vereinsname muss mindestens 2 Zeichen haben')
    .max(100, 'Vereinsname ist zu lang'),
  address: z.string().max(200, 'Adresse ist zu lang').optional(),
  city: z.string().max(100, 'Stadt ist zu lang').optional(),
  postalCode: z.string().max(20, 'PLZ ist zu lang').optional(),
  maxMembers: z.number().min(1).max(1000, 'Max. 1000 Mitglieder').optional(),
  openingHours: z.string().max(500, 'Öffnungszeiten zu lang').optional(),
});

/**
 * Generic form error type
 */
export type FormError = {
  field: string;
  message: string;
};

/**
 * Validate data against a schema and return errors
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: FormError[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return { success: false, errors };
    }
    return {
      success: false,
      errors: [{ field: 'unknown', message: 'Validierungsfehler' }],
    };
  }
}
