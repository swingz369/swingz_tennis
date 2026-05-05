/**
 * Form Validation Utilities
 *
 * Helpers for Zod validation with consistent error handling
 */

import { z } from 'zod';

/**
 * Common Zod validation schemas
 */
export const commonValidations = {
  /**
   * Email validation
   */
  email: z
    .string()
    .min(1, 'E-Mail ist erforderlich')
    .email('Ungültige E-Mail-Adresse')
    .toLowerCase()
    .trim(),

  /**
   * Password validation (minimum security requirements)
   */
  password: z
    .string()
    .min(8, 'Passwort muss mindestens 8 Zeichen lang sein')
    .regex(/[A-Z]/, 'Passwort muss mindestens einen Großbuchstaben enthalten')
    .regex(/[a-z]/, 'Passwort muss mindestens einen Kleinbuchstaben enthalten')
    .regex(/[0-9]/, 'Passwort muss mindestens eine Zahl enthalten'),

  /**
   * Strong password validation
   */
  strongPassword: z
    .string()
    .min(12, 'Passwort muss mindestens 12 Zeichen lang sein')
    .regex(/[A-Z]/, 'Passwort muss mindestens einen Großbuchstaben enthalten')
    .regex(/[a-z]/, 'Passwort muss mindestens einen Kleinbuchstaben enthalten')
    .regex(/[0-9]/, 'Passwort muss mindestens eine Zahl enthalten')
    .regex(/[^A-Za-z0-9]/, 'Passwort muss mindestens ein Sonderzeichen enthalten'),

  /**
   * Phone number validation (German format)
   */
  phone: z
    .string()
    .min(5, 'Telefonnummer ist zu kurz')
    .regex(/^[\d\s+()-]+$/, 'Ungültige Telefonnummer')
    .transform((val) => val.replace(/\s/g, '')),

  /**
   * Postal code validation (German 5-digit)
   */
  postalCode: z
    .string()
    .length(5, 'PLZ muss genau 5 Ziffern haben')
    .regex(/^\d{5}$/, 'PLZ muss aus 5 Ziffern bestehen'),

  /**
   * URL validation
   */
  url: z.string().url('Ungültige URL').trim(),

  /**
   * Required string
   */
  requiredString: (fieldName: string) => z.string().min(1, `${fieldName} ist erforderlich`).trim(),

  /**
   * Optional string
   */
  optionalString: z.string().trim().optional().or(z.literal('')),

  /**
   * IBAN validation
   */
  iban: z
    .string()
    .min(15, 'IBAN ist zu kurz')
    .max(34, 'IBAN ist zu lang')
    .regex(/^[A-Z]{2}\d{2}[A-Z0-9]+$/, 'Ungültige IBAN')
    .transform((val) => val.replace(/\s/g, '').toUpperCase()),

  /**
   * Date in the past
   */
  pastDate: z.coerce.date().max(new Date(), 'Datum darf nicht in der Zukunft liegen'),

  /**
   * Date in the future
   */
  futureDate: z.coerce.date().min(new Date(), 'Datum muss in der Zukunft liegen'),

  /**
   * Positive number
   */
  positiveNumber: z.coerce.number().positive('Muss eine positive Zahl sein'),

  /**
   * Non-negative number
   */
  nonNegativeNumber: z.coerce.number().nonnegative('Muss eine nicht-negative Zahl sein'),

  /**
   * Integer
   */
  integer: z.coerce.number().int('Muss eine ganze Zahl sein'),
};

/**
 * Get error message for a specific field from errors object
 */
export function getFieldError(
  errors: Record<string, { message?: string }>,
  field: string
): string | undefined {
  const error = errors[field];
  if (!error) return undefined;
  return error.message;
}

/**
 * Check if field has error
 */
export function hasFieldError(errors: Record<string, any>, field: string): boolean {
  return !!errors[field];
}

/**
 * Format Zod errors for display
 */
export function formatZodError(error: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    formatted[path] = err.message;
  });

  return formatted;
}

/**
 * Validate form data against schema
 */
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: formatZodError(error) };
    }
    return {
      success: false,
      errors: { _root: 'Ein unerwarteter Fehler ist aufgetreten' },
    };
  }
}

/**
 * Common form schemas
 */
export const formSchemas = {
  /**
   * Login form
   */
  login: z.object({
    email: commonValidations.email,
    password: z.string().min(1, 'Passwort ist erforderlich'),
  }),

  /**
   * Registration form
   */
  register: z
    .object({
      email: commonValidations.email,
      password: commonValidations.password,
      confirmPassword: z.string().min(1, 'Passwort-Bestätigung ist erforderlich'),
      firstName: commonValidations.requiredString('Vorname'),
      lastName: commonValidations.requiredString('Nachname'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwörter stimmen nicht überein',
      path: ['confirmPassword'],
    }),

  /**
   * Member form
   */
  member: z.object({
    firstName: commonValidations.requiredString('Vorname'),
    lastName: commonValidations.requiredString('Nachname'),
    email: commonValidations.email,
    phone: commonValidations.phone.optional(),
    dateOfBirth: commonValidations.pastDate.optional(),
    street: commonValidations.optionalString,
    city: commonValidations.optionalString,
    postalCode: commonValidations.postalCode.optional(),
  }),

  /**
   * Session form
   */
  session: z.object({
    trainerId: z.string().uuid('Ungültige Trainer-ID'),
    scheduleId: z.string().uuid('Ungültige Schedule-ID'),
    courtId: z.string().uuid('Ungültige Court-ID').optional(),
    timeslotStart: z.coerce.date(),
    timeslotEnd: z.coerce.date(),
    maxParticipants: z.coerce
      .number()
      .int()
      .min(1, 'Mindestens 1 Teilnehmer')
      .max(50, 'Maximal 50 Teilnehmer'),
    notes: commonValidations.optionalString,
  }),

  /**
   * Booking form
   */
  booking: z.object({
    sessionId: z.string().uuid('Ungültige Session-ID'),
    memberId: z.string().uuid('Ungültige Member-ID'),
  }),

  /**
   * Invoice form
   */
  invoice: z.object({
    memberId: z.string().uuid('Ungültige Member-ID'),
    dueDate: commonValidations.futureDate,
    notes: commonValidations.optionalString,
    items: z
      .array(
        z.object({
          description: commonValidations.requiredString('Beschreibung'),
          quantity: commonValidations.positiveNumber,
          unitPrice: commonValidations.nonNegativeNumber,
          taxRate: z.coerce.number().min(0).max(100),
        })
      )
      .min(1, 'Mindestens ein Posten erforderlich'),
  }),

  /**
   * SEPA mandate form
   */
  sepaMandate: z.object({
    accountHolder: commonValidations.requiredString('Kontoinhaber'),
    iban: commonValidations.iban,
    acceptedTerms: z.boolean().refine((val) => val === true, {
      message: 'Bitte akzeptiere die Bedingungen',
    }),
  }),

  /**
   * Settings form
   */
  settings: z.object({
    clubName: commonValidations.requiredString('Vereinsname'),
    email: commonValidations.email,
    phone: commonValidations.phone.optional(),
    website: commonValidations.url.optional(),
    maxMembers: commonValidations.positiveNumber,
  }),
};

/**
 * Error message translations
 */
export const errorMessages = {
  required: 'Dieses Feld ist erforderlich',
  invalid: 'Ungültige Eingabe',
  tooShort: (min: number) => `Muss mindestens ${min} Zeichen lang sein`,
  tooLong: (max: number) => `Darf maximal ${max} Zeichen lang sein`,
  min: (min: number) => `Muss mindestens ${min} sein`,
  max: (max: number) => `Darf maximal ${max} sein`,
  email: 'Ungültige E-Mail-Adresse',
  url: 'Ungültige URL',
  phone: 'Ungültige Telefonnummer',
  date: 'Ungültiges Datum',
  unique: 'Dieser Wert existiert bereits',
  mismatch: 'Die Werte stimmen nicht überein',
} as const;
