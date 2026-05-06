import { z } from 'zod';

export const sepaMandateSchema = z.object({
  // Account holder information
  accountHolder: z
    .string()
    .min(2, 'Kontoinhaber muss mindestens 2 Zeichen haben')
    .max(100, 'Kontoinhaber darf maximal 100 Zeichen haben')
    .regex(/^[a-zA-ZäöüÄÖÜß\s\-\.]+$/, 'Ungültiger Name'),

  // IBAN validation
  iban: z
    .string()
    .min(15, 'IBAN muss mindestens 15 Zeichen haben')
    .max(34, 'IBAN darf maximal 34 Zeichen haben')
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/, 'Ungültige IBAN')
    .transform((val) => val.replace(/\s/g, '').toUpperCase()),

  // BIC validation
  bic: z
    .string()
    .min(8, 'BIC muss mindestens 8 Zeichen haben')
    .max(11, 'BIC darf maximal 11 Zeichen haben')
    .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Ungültige BIC')
    .transform((val) => val.replace(/\s/g, '').toUpperCase()),

  // Bank name
  bankName: z
    .string()
    .min(2, 'Bankname muss mindestens 2 Zeichen haben')
    .max(100, 'Bankname darf maximal 100 Zeichen haben'),

  // Address information
  street: z
    .string()
    .min(2, 'Straße muss mindestens 2 Zeichen haben')
    .max(100, 'Straße darf maximal 100 Zeichen haben'),

  houseNumber: z
    .string()
    .min(1, 'Hausnummer ist erforderlich')
    .max(20, 'Hausnummer darf maximal 20 Zeichen haben'),

  postalCode: z
    .string()
    .min(5, 'Postleitzahl muss 5 Zeichen haben')
    .max(5, 'Postleitzahl muss 5 Zeichen haben')
    .regex(/^\d+$/, 'Postleitzahl darf nur Zahlen enthalten'),

  city: z
    .string()
    .min(2, 'Stadt muss mindestens 2 Zeichen haben')
    .max(100, 'Stadt darf maximal 100 Zeichen haben'),

  // Mandate information
  mandateReference: z
    .string()
    .min(5, 'Mandatsreferenz muss mindestens 5 Zeichen haben')
    .max(35, 'Mandatsreferenz darf maximal 35 Zeichen haben')
    .regex(/^[A-Z0-9\-]+$/, 'Ungültige Mandatsreferenz'),

  signatureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat')
    .refine((date) => {
      const parsedDate = new Date(date);
      const today = new Date();
      return parsedDate <= today;
    }, 'Unterschriftdatum darf nicht in der Zukunft liegen'),

  // Terms acceptance
  acceptTerms: z.boolean().refine((val) => val === true, 'Du musst die Bedingungen akzeptieren'),

  acceptDirectDebit: z
    .boolean()
    .refine((val) => val === true, 'Du musst der Lastschrift zustimmen'),
});

export type SEPAMandateFormData = z.infer<typeof sepaMandateSchema>;

// Helper function to validate IBAN
export function validateIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();

  // Check basic format
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(cleaned)) {
    return false;
  }

  // Move first 4 characters to end
  const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);

  // Replace letters with numbers
  const numeric = rearranged
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 65 && code <= 90 ? (code - 55).toString() : char;
    })
    .join('');

  // Calculate mod 97
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 9) {
    const chunk = remainder.toString() + numeric.substring(i, i + 9);
    remainder = parseInt(chunk, 10) % 97;
  }

  return remainder === 1;
}

// Helper function to format IBAN
export function formatIBAN(iban: string): string {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

// Helper function to generate mandate reference
export function generateMandateReference(memberId: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SWINGZ-${memberId}-${timestamp}-${random}`.substring(0, 35);
}

// Helper function to extract bank name from BIC
export function getBankNameFromBIC(bic: string): string | null {
  // This is a simplified version - in production, you'd use a BIC database
  const bankCodes: Record<string, string> = {
    COBADEFF: 'Commerzbank',
    DEUTDEFF: 'Deutsche Bank',
    PBNKDEFF: 'Postbank',
    DRESDEFF: 'Dresdner Bank',
    GENODEF1: 'Volksbanken Raiffeisenbanken',
    BYLADEM1: 'Bayerische Landesbank',
    WELADEDD: 'WestLB',
    LANDDEFF: 'Landesbank Berlin',
  };

  const prefix = bic.substring(0, 8);
  return bankCodes[prefix] || null;
}
