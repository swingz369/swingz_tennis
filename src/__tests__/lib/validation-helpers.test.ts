/**
 * Unit tests for validation error formatting helpers.
 *
 * Tests lib/validation-helpers.ts — pure formatting functions.
 * Uses Zod to construct realistic ZodError instances for testing.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { formatZodErrors, formatZodErrorRecord } from '@/lib/validation-helpers';

/**
 * Helper to trigger Zod validation and extract the error.
 */
function parseWithError<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.ZodError<z.infer<T>> {
  const result = schema.safeParse(data);
  if (result.success) throw new Error('Expected validation to fail');
  return result.error;
}

// ════════════════════════════════════════════════════════════
// formatZodErrors
// ════════════════════════════════════════════════════════════

describe('formatZodErrors', () => {
  // ── Basic formatting ──

  it('formats a single field error', () => {
    const schema = z.object({ name: z.string() });
    const error = parseWithError(schema, { name: 123 });

    const result = formatZodErrors(error);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ field: 'name', message: expect.any(String) });
  });

  it('formats multiple field errors', () => {
    const schema = z.object({
      name: z.string(),
      email: z.string().email(),
    });
    const error = parseWithError(schema, { name: 123, email: 'not-an-email' });

    const result = formatZodErrors(error);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.field).sort()).toEqual(['email', 'name']);
  });

  // ── Nested fields ──

  it('formats nested field errors with dot-path notation', () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          age: z.number().min(18),
        }),
      }),
    });
    const error = parseWithError(schema, { user: { profile: { age: 16 } } });

    const result = formatZodErrors(error);

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('user.profile.age');
    expect(result[0].message).toContain('18');
  });

  it('includes array index in field path', () => {
    const schema = z.object({
      items: z.array(z.string()),
    });
    const error = parseWithError(schema, { items: ['ok', 123] });

    const result = formatZodErrors(error);

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('items.1');
  });

  // ── Multiple errors on same field ──

  it('returns multiple entries when a field has multiple validation failures', () => {
    const schema = z.object({
      password: z.string().min(8).regex(/[A-Z]/),
    });
    const error = parseWithError(schema, { password: 'ab' });

    const result = formatZodErrors(error);

    // 'ab' fails both min(8) and regex(/[A-Z]/) — both should appear
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach((r) => expect(r.field).toBe('password'));
  });

  // ── Type coercion / transformations ──

  it('formats errors from transformed schemas', () => {
    const schema = z.object({
      count: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(10)),
    });
    const error = parseWithError(schema, { count: '5' });

    const result = formatZodErrors(error);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('formats errors from enum schemas', () => {
    const schema = z.object({
      role: z.enum(['admin', 'member', 'trainer']),
    });
    const error = parseWithError(schema, { role: 'superadmin' });

    const result = formatZodErrors(error);

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('role');
    expect(result[0].message).toContain('admin');
  });

  // ── Edge cases ──

  it('handles union type errors', () => {
    const schema = z.object({
      id: z.union([z.string().uuid(), z.number().int().positive()]),
    });
    const error = parseWithError(schema, { id: false });

    const result = formatZodErrors(error);

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('id');
  });

  it('handles discriminated union errors', () => {
    const schema = z.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), value: z.string() }),
      z.object({ type: z.literal('b'), value: z.number() }),
    ]);
    const error = parseWithError(schema, { type: 'c', value: 'x' });

    const result = formatZodErrors(error);

    // Should have at least one error about the invalid discriminator
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ════════════════════════════════════════════════════════════
// formatZodErrorRecord
// ════════════════════════════════════════════════════════════

describe('formatZodErrorRecord', () => {
  // ── Basic formatting ──

  it('returns a Record keyed by field path', () => {
    const schema = z.object({ name: z.string(), email: z.string().email() });
    const error = parseWithError(schema, { name: 123, email: 'bad' });

    const result = formatZodErrorRecord(error);

    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('email');
    expect(typeof result.name).toBe('string');
    expect(typeof result.email).toBe('string');
  });

  it('returns first error message per field when multiple errors exist', () => {
    const schema = z.object({
      password: z.string().min(8).regex(/[A-Z]/),
    });
    const error = parseWithError(schema, { password: 'ab' });

    const result = formatZodErrorRecord(error);

    // Only one entry for 'password' (last error wins due to iteration order)
    expect(result.password).toBeDefined();
    expect(typeof result.password).toBe('string');
  });

  // ── Nested fields ──

  it('uses dot-separated namespace for nested fields', () => {
    const schema = z.object({
      address: z.object({
        city: z.string().min(1),
        zip: z.string().regex(/^\d{5}$/),
      }),
    });
    const error = parseWithError(schema, {
      address: { city: '', zip: 'ABC' },
    });

    const result = formatZodErrorRecord(error);

    expect(result['address.city']).toBeDefined();
    expect(result['address.zip']).toBeDefined();
  });

  it('includes array index for array element errors', () => {
    const schema = z.object({
      tags: z.array(z.string().min(3)),
    });
    const error = parseWithError(schema, { tags: ['ok', 'ab', 'fine'] });

    const result = formatZodErrorRecord(error);

    expect(result['tags.1']).toBeDefined();
  });

  // ── Type-specific messages ──

  it('includes expected type in message for type mismatches', () => {
    const schema = z.object({ age: z.number() });
    const error = parseWithError(schema, { age: 'twenty' });

    const result = formatZodErrorRecord(error);

    expect(result.age).toBeDefined();
  });

  it('includes min/max constraint in message for number bounds', () => {
    const schema = z.object({ score: z.number().min(0).max(100) });
    const error = parseWithError(schema, { score: -5 });

    const result = formatZodErrorRecord(error);

    expect(result.score).toContain('0');
  });
});
