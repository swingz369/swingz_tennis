import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { ZodError } from 'zod';

/**
 * Validate request body against a Zod schema.
 * Returns parsed data or null with appropriate error response.
 */
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown
): { data: z.infer<T> } | null {
  try {
    const parsed = schema.parse(body);
    return { data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMap: Record<string, string> = {};
      for (const issue of error.errors) {
        const path = issue.path.join('.');
        errorMap[path] = issue.message;
      }
      return null;
    }
    return null;
  }
}

/**
 * Validate query parameters against a Zod schema.
 */
export function validateQuery<T extends z.ZodSchema>(
  schema: T,
  params: URLSearchParams
): { data: z.infer<T> } | null {
  try {
    const parsed = schema.parse(Object.fromEntries(params.entries()));
    return { data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return null;
    }
    return null;
  }
}

/**
 * Middleware to validate request body and return error response on failure.
 */
export function withValidation<T extends z.ZodSchema>(
  schema: T,
  handler: (data: z.infer<T>) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const body = await req.json();
      const parsed = schema.parse(body);
      return handler(parsed);
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return NextResponse.json(
          { error: 'Validation failed', details: formatted },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  };
}
