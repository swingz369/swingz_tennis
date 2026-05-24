/**
 * IBAN Validation & Formatting
 *
 * Centralized helpers extracted from:
 * - src/application/validation/schemas/sepa-mandate.schema.ts
 * - lib/validation-schemas.ts
 */

/** Basic IBAN format: 2-letter country code + 2 check digits + alphanumeric (15-34 total) */
export const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]+$/;

/**
 * Validate IBAN using modulo 97 check.
 */
export function validateIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();

  if (cleaned.length < 15 || cleaned.length > 34) return false;
  if (!IBAN_REGEX.test(cleaned)) return false;

  // Move first 4 characters to end
  const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);

  // Replace letters with numbers (A=10, B=11, ..., Z=35)
  const numeric = rearranged
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 65 && code <= 90 ? (code - 55).toString() : char;
    })
    .join('');

  // Calculate mod 97 in chunks
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 9) {
    const chunk = remainder.toString() + numeric.substring(i, i + 9);
    remainder = parseInt(chunk, 10) % 97;
  }

  return remainder === 1;
}

/**
 * Format IBAN with spaces every 4 characters.
 */
export function formatIBAN(iban: string): string {
  return iban
    .replace(/\s/g, '')
    .toUpperCase()
    .replace(/(.{4})/g, '$1 ')
    .trim();
}
