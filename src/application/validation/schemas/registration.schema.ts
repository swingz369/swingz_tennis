import { z } from 'zod';

// Personal Information Validation
export const personalInfoSchema = z.object({
  firstName: z
    .string()
    .min(2, 'Vorname muss mindestens 2 Zeichen lang sein')
    .max(50, 'Vorname darf maximal 50 Zeichen lang sein'),
  lastName: z
    .string()
    .min(2, 'Nachname muss mindestens 2 Zeichen lang sein')
    .max(50, 'Nachname darf maximal 50 Zeichen lang sein'),
  email: z
    .string()
    .email('Ungültige E-Mail-Adresse')
    .max(100, 'E-Mail darf maximal 100 Zeichen lang sein'),
  phone: z
    .string()
    .min(10, 'Telefonnummer muss mindestens 10 Zeichen lang sein')
    .max(20, 'Telefonnummer darf maximal 20 Zeichen lang sein')
    .regex(/^\+?[\d\s-()]+$/, 'Ungültiges Telefonformat'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)')
    .refine((date) => {
      const birthDate = new Date(date);
      const now = new Date();
      const minAge = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
      const maxAge = new Date(now.getFullYear() - 6, now.getMonth(), now.getDate());
      return birthDate >= minAge && birthDate <= maxAge;
    }, 'Du musst zwischen 6 und 100 Jahren alt sein'),
});

// Address Validation
export const addressSchema = z.object({
  street: z
    .string()
    .min(3, 'Straße muss mindestens 3 Zeichen lang sein')
    .max(100, 'Straße darf maximal 100 Zeichen lang sein'),
  houseNumber: z
    .string()
    .min(1, 'Hausnummer ist erforderlich')
    .max(10, 'Hausnummer darf maximal 10 Zeichen lang sein'),
  postalCode: z
    .string()
    .regex(/^\d{5}$/, 'Ungültige Postleitzahl (5 Ziffern)'),
  city: z
    .string()
    .min(2, 'Stadt muss mindestens 2 Zeichen lang sein')
    .max(50, 'Stadt darf maximal 50 Zeichen lang sein'),
});

// Tennis Information Validation
export const tennisInfoSchema = z.object({
  experience: z.enum(['beginner', 'intermediate', 'advanced', 'competitive'], {
    errorMap: () => ({ message: 'Bitte wähle eine gültige Erfahrung' }),
  }),
  playingLevel: z.enum(['ntr', 'ntr4', 'ntr6', 'ntr8'], {
    errorMap: () => ({ message: 'Bitte wähle eine gültige Spielstärke' }),
  }),
  preferredDays: z
    .array(z.enum(['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']))
    .min(1, 'Wähle mindestens einen bevorzugten Tag')
    .max(7, 'Wähle maximal 7 Tage'),
  goals: z
    .string()
    .min(10, 'Trainingsziele müssen mindestens 10 Zeichen lang sein')
    .max(500, 'Trainingsziele dürfen maximal 500 Zeichen lang sein'),
  previousClubs: z
    .string()
    .max(500, 'Information zu vorherigen Clubs darf maximal 500 Zeichen lang sein')
    .optional(),
});

// Additional Information Validation
export const additionalInfoSchema = z.object({
  motivation: z
    .string()
    .min(20, 'Motivation muss mindestens 20 Zeichen lang sein')
    .max(1000, 'Motivation darf maximal 1000 Zeichen lang sein'),
  availability: z
    .string()
    .min(10, 'Verfügbarkeit muss mindestens 10 Zeichen lang sein')
    .max(500, 'Verfügbarkeit darf maximal 500 Zeichen lang sein'),
  specialRequirements: z
    .string()
    .max(500, 'Besondere Anforderungen dürfen maximal 500 Zeichen lang sein')
    .optional(),
});

// Agreement Validation
export const agreementSchema = z.object({
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'Du musst die AGB akzeptieren',
  }),
  acceptPrivacy: z.boolean().refine((val) => val === true, {
    message: 'Du musst die Datenschutzrichtlinie akzeptieren',
  }),
  acceptDataProcessing: z.boolean().refine((val) => val === true, {
    message: 'Du musst der Datenverarbeitung zustimmen',
  }),
});

// Complete Registration Schema
export const registrationSchema = personalInfoSchema
  .merge(addressSchema)
  .merge(tennisInfoSchema)
  .merge(additionalInfoSchema)
  .merge(agreementSchema);

// Application Schema (similar but with different requirements)
export const applicationSchema = personalInfoSchema
  .merge(addressSchema)
  .merge(tennisInfoSchema)
  .merge(
    z.object({
      motivation: z
        .string()
        .min(20, 'Motivation muss mindestens 20 Zeichen lang sein')
        .max(1000, 'Motivation darf maximal 1000 Zeichen lang sein'),
      availability: z
        .string()
        .min(10, 'Verfügbarkeit muss mindestens 10 Zeichen lang sein')
        .max(500, 'Verfügbarkeit darf maximal 500 Zeichen lang sein'),
      specialRequirements: z
        .string()
        .max(500, 'Besondere Anforderungen dürfen maximal 500 Zeichen lang sein')
        .optional(),
    })
  )
  .merge(
    z.object({
      acceptTerms: z.boolean().refine((val) => val === true, {
        message: 'Du musst die AGB akzeptieren',
      }),
      acceptPrivacy: z.boolean().refine((val) => val === true, {
        message: 'Du musst die Datenschutzrichtlinie akzeptieren',
      }),
    })
  );

// Booking Validation
export const bookingSchema = z.object({
  sessionId: z.string().uuid('Ungültige Session-ID'),
  memberId: z.string().uuid('Ungültige Member-ID'),
  clubId: z.string().uuid('Ungültige Club-ID'),
});

// Cancellation Validation
export const cancellationSchema = z.object({
  bookingId: z.string().uuid('Ungültige Booking-ID'),
  reason: z.enum(['trainer_unavailable', 'member_request', 'weather', 'other'], {
    errorMap: () => ({ message: 'Bitte wähle einen gültigen Grund' }),
  }),
  notes: z
    .string()
    .max(500, 'Bemerkungen dürfen maximal 500 Zeichen lang sein')
    .optional(),
});

// Status Update Validation
export const statusUpdateSchema = z.object({
  bookingId: z.string().uuid('Ungültige Booking-ID'),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'no_show'], {
    errorMap: () => ({ message: 'Bitte wähle einen gültigen Status' }),
  }),
});

// Profile Update Validation
export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name muss mindestens 2 Zeichen lang sein')
    .max(100, 'Name darf maximal 100 Zeichen lang sein')
    .optional(),
  phone: z
    .string()
    .min(10, 'Telefonnummer muss mindestens 10 Zeichen lang sein')
    .max(20, 'Telefonnummer darf maximal 20 Zeichen lang sein')
    .regex(/^\+?[\d\s-()]+$/, 'Ungültiges Telefonformat')
    .optional(),
  address: z
    .string()
    .max(200, 'Adresse darf maximal 200 Zeichen lang sein')
    .optional(),
  city: z
    .string()
    .max(50, 'Stadt darf maximal 50 Zeichen lang sein')
    .optional(),
  postalCode: z
    .string()
    .regex(/^\d{5}$/, 'Ungültige Postleitzahl (5 Ziffern)')
    .optional(),
  bio: z
    .string()
    .max(500, 'Bio darf maximal 500 Zeichen lang sein')
    .optional(),
  emergencyContact: z
    .string()
    .max(100, 'Notfallkontakt darf maximal 100 Zeichen lang sein')
    .optional(),
  emergencyPhone: z
    .string()
    .regex(/^\+?[\d\s-()]+$/, 'Ungültiges Telefonformat')
    .optional(),
});

// Group Change Request Validation
export const groupChangeRequestSchema = z.object({
  currentGroupId: z.string().uuid('Ungültige aktuelle Gruppen-ID'),
  requestedGroupId: z.string().uuid('Ungültige gewünschte Gruppen-ID'),
  reason: z
    .string()
    .min(10, 'Grund muss mindestens 10 Zeichen lang sein')
    .max(500, 'Grund darf maximal 500 Zeichen lang sein'),
  preferredStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)')
    .optional(),
});

// SEPA Mandate Validation
export const sepaMandateSchema = z.object({
  accountHolder: z
    .string()
    .min(2, 'Kontoinhaber muss mindestens 2 Zeichen lang sein')
    .max(100, 'Kontoinhaber darf maximal 100 Zeichen lang sein'),
  iban: z
    .string()
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/, 'Ungültiges IBAN-Format')
    .max(34, 'IBAN darf maximal 34 Zeichen lang sein'),
  bic: z
    .string()
    .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Ungültiges BIC-Format')
    .max(11, 'BIC darf maximal 11 Zeichen lang sein'),
  mandateReference: z
    .string()
    .min(1, 'Mandatsreferenz ist erforderlich')
    .max(35, 'Mandatsreferenz darf maximal 35 Zeichen lang sein'),
  signatureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)'),
});

// Trial Training Registration Validation
export const trialTrainingSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name muss mindestens 2 Zeichen lang sein')
    .max(100, 'Name darf maximal 100 Zeichen lang sein'),
  email: z
    .string()
    .email('Ungültige E-Mail-Adresse')
    .max(100, 'E-Mail darf maximal 100 Zeichen lang sein'),
  phone: z
    .string()
    .min(10, 'Telefonnummer muss mindestens 10 Zeichen lang sein')
    .max(20, 'Telefonnummer darf maximal 20 Zeichen lang sein')
    .regex(/^\+?[\d\s-()]+$/, 'Ungültiges Telefonformat'),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)')
    .optional(),
  preferredTime: z
    .string()
    .max(20, 'Bevorzugte Uhrzeit darf maximal 20 Zeichen lang sein')
    .optional(),
  experience: z.enum(['beginner', 'intermediate', 'advanced', 'competitive'], {
    errorMap: () => ({ message: 'Bitte wähle eine gültige Erfahrung' }),
  }),
  goals: z
    .string()
    .min(10, 'Trainingsziele müssen mindestens 10 Zeichen lang sein')
    .max(500, 'Trainingsziele dürfen maximal 500 Zeichen lang sein'),
  notes: z
    .string()
    .max(500, 'Bemerkungen dürfen maximal 500 Zeichen lang sein')
    .optional(),
});

// Export types
export type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;
export type AddressFormData = z.infer<typeof addressSchema>;
export type TennisInfoFormData = z.infer<typeof tennisInfoSchema>;
export type AdditionalInfoFormData = z.infer<typeof additionalInfoSchema>;
export type AgreementFormData = z.infer<typeof agreementSchema>;
export type RegistrationFormData = z.infer<typeof registrationSchema>;
export type ApplicationFormData = z.infer<typeof applicationSchema>;
export type BookingFormData = z.infer<typeof bookingSchema>;
export type CancellationFormData = z.infer<typeof cancellationSchema>;
export type StatusUpdateFormData = z.infer<typeof statusUpdateSchema>;
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
export type GroupChangeRequestFormData = z.infer<typeof groupChangeRequestSchema>;
export type SepaMandateFormData = z.infer<typeof sepaMandateSchema>;
export type TrialTrainingFormData = z.infer<typeof trialTrainingSchema>;