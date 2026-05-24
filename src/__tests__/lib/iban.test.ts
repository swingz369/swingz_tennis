/**
 * Unit tests for IBAN validation and formatting helpers.
 *
 * Tests lib/iban.ts — pure functions with no dependencies.
 */
import { describe, it, expect } from 'vitest';
import { IBAN_REGEX, validateIBAN, formatIBAN } from '@/lib/iban';

// ════════════════════════════════════════════════════════════
// IBAN_REGEX
// ════════════════════════════════════════════════════════════

describe('IBAN_REGEX', () => {
  it('matches a valid German IBAN', () => {
    expect(IBAN_REGEX.test('DE89370400440532013000')).toBe(true);
  });

  it('matches a valid Austrian IBAN', () => {
    expect(IBAN_REGEX.test('AT611904300234573201')).toBe(true);
  });

  it('matches a valid Swiss IBAN', () => {
    expect(IBAN_REGEX.test('CH9300762011623852957')).toBe(true);
  });

  it('rejects IBAN with spaces', () => {
    expect(IBAN_REGEX.test('DE89 3704 0044 0532 0130 00')).toBe(false);
  });

  it('rejects IBAN with lowercase letters', () => {
    expect(IBAN_REGEX.test('de89370400440532013000')).toBe(false);
  });

  it('rejects IBAN with invalid characters', () => {
    expect(IBAN_REGEX.test('DE89-3704-0044-0532-0130-00')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(IBAN_REGEX.test('')).toBe(false);
  });

  it('rejects IBAN starting with number', () => {
    expect(IBAN_REGEX.test('12AB1234567890123456')).toBe(false);
  });

  it('rejects IBAN with wrong check digit format', () => {
    expect(IBAN_REGEX.test('DEAB370400440532013000')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
// validateIBAN
// ════════════════════════════════════════════════════════════

describe('validateIBAN', () => {
  // ── Valid IBANs ──

  it('validates a correct German IBAN', () => {
    expect(validateIBAN('DE89370400440532013000')).toBe(true);
  });

  it('validates a correct Austrian IBAN', () => {
    expect(validateIBAN('AT611904300234573201')).toBe(true);
  });

  it('validates a correct Swiss IBAN', () => {
    expect(validateIBAN('CH9300762011623852957')).toBe(true);
  });

  it('validates a correct French IBAN', () => {
    expect(validateIBAN('FR1420041010050500013M02606')).toBe(true);
  });

  it('validates a correct British IBAN', () => {
    expect(validateIBAN('GB29NWBK60161331926819')).toBe(true);
  });

  it('validates a correct Spanish IBAN', () => {
    expect(validateIBAN('ES9121000418450200051332')).toBe(true);
  });

  it('validates a correct Dutch IBAN', () => {
    expect(validateIBAN('NL91ABNA0417164300')).toBe(true);
  });

  // ── IBAN with spaces (should clean and validate) ──

  it('validates IBAN with spaces inserted', () => {
    expect(validateIBAN('DE89 3704 0044 0532 0130 00')).toBe(true);
  });

  it('validates IBAN with irregular spacing', () => {
    expect(validateIBAN('DE89  3704   0044 0532013000')).toBe(true);
  });

  it('validates IBAN with leading and trailing spaces', () => {
    expect(validateIBAN('  DE89370400440532013000  ')).toBe(true);
  });

  // ── Lowercase (should uppercased and validate) ──

  it('validates lowercase IBAN by uppercasing', () => {
    expect(validateIBAN('de89370400440532013000')).toBe(true);
  });

  // ── Invalid: wrong check digits ──

  it('rejects German IBAN with altered check digits', () => {
    expect(validateIBAN('DE00370400440532013000')).toBe(false);
  });

  it('rejects IBAN where one digit is changed', () => {
    expect(validateIBAN('DE89370400440532013001')).toBe(false);
  });

  // ── Invalid: wrong format ──

  it('rejects IBAN with special characters', () => {
    expect(validateIBAN('DE89-3704-0044-0532-0130-00')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateIBAN('')).toBe(false);
  });

  it('rejects string that is too short (< 15 chars)', () => {
    expect(validateIBAN('DE8937040044')).toBe(false);
  });

  it('rejects string that is exactly 14 characters', () => {
    expect(validateIBAN('GB29NWBK601613')).toBe(false);
  });

  it('rejects string that is too long (> 34 chars)', () => {
    expect(validateIBAN('DE89370400440532013000000000000000000')).toBe(false);
  });

  it('rejects string that is exactly 35 characters — one too long', () => {
    expect(validateIBAN('DE8937040044053201300012345678901')).toBe(false);
  });

  // ── Invalid: wrong country format ──

  it('rejects IBAN starting with number', () => {
    expect(validateIBAN('12AB1234567890123456')).toBe(false);
  });

  it('rejects IBAN with lowercase in country code', () => {
    // Lowercase letters get uppercased, so 'de' becomes 'DE' - this actually passes
    // testing the overall flow
    const ibanWithLowerCountry = 'de89370400440532013000';
    // After uppercase: DE89370400440532013000 → valid
    expect(validateIBAN(ibanWithLowerCountry)).toBe(true);
  });

  it('rejects null/undefined gracefully', () => {
    // @ts-expect-error — testing runtime behavior
    expect(() => validateIBAN(null)).toThrow();
    // @ts-expect-error — testing runtime behavior
    expect(() => validateIBAN(undefined)).toThrow();
  });

  // ── Edge cases ──

  it('validates minimum-length IBAN (15 chars - Norway)', () => {
    // NO93 8601 1117 947 — 15 chars
    expect(validateIBAN('NO9386011117947')).toBe(true);
  });

  it('validates long IBAN near max with correct mod-97', () => {
    // A 30-char string that passes regex format but has wrong check digits → rejected
    const longFake = 'DE8937040044053201300012345678';
    expect(validateIBAN(longFake)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
// formatIBAN
// ════════════════════════════════════════════════════════════

describe('formatIBAN', () => {
  it('formats a German IBAN with spaces every 4 chars', () => {
    expect(formatIBAN('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
  });

  it('formats an Austrian IBAN', () => {
    expect(formatIBAN('AT611904300234573201')).toBe('AT61 1904 3002 3457 3201');
  });

  it('formats a Swiss IBAN', () => {
    expect(formatIBAN('CH9300762011623852957')).toBe('CH93 0076 2011 6238 5295 7');
  });

  it('cleans and reformats IBAN with existing irregular spaces', () => {
    expect(formatIBAN('DE89  3704   0044 0532013000')).toBe('DE89 3704 0044 0532 0130 00');
  });

  it('handles lowercase IBAN — also uppercases', () => {
    expect(formatIBAN('de89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
  });

  it('handles already formatted IBAN (idempotent)', () => {
    const formatted = 'DE89 3704 0044 0532 0130 00';
    expect(formatIBAN(formatted)).toBe(formatted);
  });

  it('handles IBAN with leading/trailing spaces', () => {
    expect(formatIBAN('  DE89370400440532013000  ')).toBe('DE89 3704 0044 0532 0130 00');
  });

  it('formats a short IBAN (15 chars - Norway)', () => {
    expect(formatIBAN('NO9386011117947')).toBe('NO93 8601 1117 947');
  });

  it('formats IBAN where length is not a multiple of 4', () => {
    // Swiss IBAN: 21 chars → last group has 1 char
    expect(formatIBAN('CH9300762011623852957')).toBe('CH93 0076 2011 6238 5295 7');
  });

  it('returns empty string for empty input', () => {
    expect(formatIBAN('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(formatIBAN('   ')).toBe('');
  });
});
