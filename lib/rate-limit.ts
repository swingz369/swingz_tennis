/**
 * Rate Limiting Utility
 * Protects API routes from abuse
 * Based on IP address and user ID
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  max: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Custom message when rate limit is exceeded
   */
  message?: string;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (in production, use Redis or similar)
const rateLimitStore: RateLimitStore = {};

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach((key) => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
}, 60000); // Clean every minute

/**
 * Get client identifier (IP + User ID if available)
 */
async function getClientIdentifier(request: NextRequest): Promise<string> {
  const headersList = await headers();

  // Try to get IP from various headers
  const forwarded = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';

  // Add user ID if authenticated (from cookies or headers)
  const userId = request.cookies.get('sb-user-id')?.value;

  return userId ? `${ip}:${userId}` : ip;
}

/**
 * Rate limit middleware
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ limited: boolean; response?: NextResponse }> {
  const identifier = await getClientIdentifier(request);
  const key = `${request.nextUrl.pathname}:${identifier}`;
  const now = Date.now();

  // Initialize or get existing entry
  let entry = rateLimitStore[key];

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired one
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore[key] = entry;
    return { limited: false };
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > config.max) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    return {
      limited: true,
      response: NextResponse.json(
        {
          error: config.message || 'Rate limit exceeded',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString(),
          },
        }
      ),
    };
  }

  // Not limited
  return { limited: false };
}

/**
 * Rate limit decorator for API routes
 */
export function withRateLimit(config: RateLimitConfig) {
  return function (handler: (request: NextRequest) => Promise<NextResponse>) {
    return async function (request: NextRequest): Promise<NextResponse> {
      const { limited, response } = await rateLimit(request, config);

      if (limited && response) {
        return response;
      }

      return handler(request);
    };
  };
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  /**
   * Strict: For sensitive operations (login, password reset)
   * 5 requests per 15 minutes
   */
  STRICT: {
    max: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Zu viele Versuche. Bitte warten Sie 15 Minuten.',
  },

  /**
   * Auth: For authentication endpoints
   * 10 requests per 5 minutes
   */
  AUTH: {
    max: 10,
    windowMs: 5 * 60 * 1000,
    message: 'Zu viele Login-Versuche. Bitte warten Sie 5 Minuten.',
  },

  /**
   * Standard: For regular API endpoints
   * 100 requests per minute
   */
  STANDARD: {
    max: 100,
    windowMs: 60 * 1000,
    message: 'Zu viele Anfragen. Bitte warten Sie eine Minute.',
  },

  /**
   * Booking: For booking creation
   * 20 requests per 5 minutes
   */
  BOOKING: {
    max: 20,
    windowMs: 5 * 60 * 1000,
    message: 'Zu viele Buchungsanfragen. Bitte warten Sie.',
  },

  /**
   * Search: For search queries
   * 50 requests per minute
   */
  SEARCH: {
    max: 50,
    windowMs: 60 * 1000,
    message: 'Zu viele Suchanfragen. Bitte warten Sie.',
  },

  /**
   * File Upload: For file uploads
   * 10 uploads per hour
   */
  UPLOAD: {
    max: 10,
    windowMs: 60 * 60 * 1000,
    message: 'Zu viele Uploads. Bitte warten Sie eine Stunde.',
  },
} as const;

/**
 * Helper function to check rate limit and return error response if exceeded
 */
export async function checkRateLimitOrFail(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const { limited, response } = await rateLimit(request, config);
  return limited && response ? response : null;
}

/**
 * Alternative withRateLimit signature for inline usage
 * @deprecated Use the decorator pattern instead
 */
export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const { limited, response } = await rateLimit(request, config);
  if (limited && response) {
    return response;
  }
  return handler();
}

/**
 * Predefined rate limit instances for common use cases
 */
export const rateLimitStrict = RATE_LIMITS.STRICT;
export const rateLimitAuth = RATE_LIMITS.AUTH;

/**
 * Example usage in API route:
 *
 * ```ts
 * import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
 *
 * export const POST = withRateLimit(RATE_LIMITS.AUTH)(
 *   async function handler(request: NextRequest) {
 *     // Your API logic here
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */
