/**
 * Centralized Validation Helpers
 *
 * Shared formatting utilities for Zod validation errors,
 * extracted from lib/validation-schemas.ts
 */

import type { z } from 'zod';

/**
 * Format Zod errors as an array of { field, message } objects.
 */
export function formatZodErrors(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

/**
 * Format Zod errors as a flat Record<string, string> keyed by field path.
 */
export function formatZodErrorRecord(error: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    formatted[path] = err.message;
  });
  return formatted;
}
