/**
 * Rate Limiting Utility with Redis Support
 * Protects API routes from abuse using Upstash Redis + In-Memory Fallback
 * Pattern from INTEGRATION_ROADMAP.md Phase 1.4
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

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

// ============================================
// 1. Initialize Upstash Redis (with graceful degradation)
// ============================================

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Define rate limiters using Redis (if available)
const rateLimiters = redis
  ? {
      // Authentication: Prevent brute force (10 attempts per 5 minutes)
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '5m'),
        analytics: true,
        prefix: 'ratelimit:auth',
      }),

      // API calls: Standard limit (100 requests per minute)
      api: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '60s'),
        analytics: true,
        prefix: 'ratelimit:api',
      }),

      // Strict operations: Sensitive endpoints (5 requests per 15 minutes)
      strict: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '15m'),
        analytics: true,
        prefix: 'ratelimit:strict',
      }),

      // Booking operations: (20 requests per 5 minutes)
      booking: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '5m'),
        analytics: true,
        prefix: 'ratelimit:booking',
      }),

      // AI API calls: Cost protection (5 requests per minute)
      ai: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '60s'),
        analytics: true,
        prefix: 'ratelimit:ai',
      }),

      // File uploads: (10 uploads per hour)
      upload: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1h'),
        analytics: true,
        prefix: 'ratelimit:upload',
      }),
    }
  : null;

// ============================================
// 2. In-Memory Fallback (for dev/testing)
// ============================================

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const memoryStore: RateLimitStore = {};

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(memoryStore).forEach((key) => {
    if (memoryStore[key].resetTime < now) {
      delete memoryStore[key];
    }
  });
}, 60000); // Clean every minute

function inMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const record = memoryStore[key];

  if (!record || now > record.resetTime) {
    memoryStore[key] = { count: 1, resetTime: now + windowMs };
    return {
      success: true,
      remaining: maxRequests - 1,
      reset: now + windowMs,
    };
  }

  if (record.count < maxRequests) {
    record.count++;
    return {
      success: true,
      remaining: maxRequests - record.count,
      reset: record.resetTime,
    };
  }

  return {
    success: false,
    remaining: 0,
    reset: record.resetTime,
  };
}

// ============================================
// 3. Client Identifier Helper
// ============================================

async function getClientIdentifier(request: NextRequest): Promise<string> {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';

  // Add user ID if authenticated (from cookies or headers)
  const userId = request.cookies.get('sb-user-id')?.value;

  return userId ? `${ip}:${userId}` : ip;
}

// ============================================
// 4. Enhanced Rate Limit Checker
// ============================================

type RateLimitType = 'auth' | 'api' | 'strict' | 'booking' | 'ai' | 'upload';

export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'api'
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  if (rateLimiters) {
    // Use Redis
    const result = await rateLimiters[type].limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } else {
    // Fallback to in-memory
    const limits: Record<RateLimitType, { max: number; windowMs: number }> = {
      auth: { max: 10, windowMs: 5 * 60 * 1000 },
      api: { max: 100, windowMs: 60 * 1000 },
      strict: { max: 5, windowMs: 15 * 60 * 1000 },
      booking: { max: 20, windowMs: 5 * 60 * 1000 },
      ai: { max: 5, windowMs: 60 * 1000 },
      upload: { max: 10, windowMs: 60 * 60 * 1000 },
    };

    const config = limits[type];
    const result = inMemoryRateLimit(`${type}:${identifier}`, config.max, config.windowMs);

    return {
      success: result.success,
      limit: config.max,
      remaining: result.remaining,
      reset: result.reset,
    };
  }
}

// ============================================
// 5. Middleware Helper
// ============================================

export async function withRateLimit(
  req: NextRequest,
  type: RateLimitType = 'api'
): Promise<NextResponse | { headers: Record<string, string> }> {
  // Allow test environments to bypass rate limiting
  if (process.env.DISABLE_RATE_LIMITING === 'true') {
    return { headers: {} };
  }

  // Use IP + user ID as identifier
  const identifier = await getClientIdentifier(req);
  const result = await checkRateLimit(identifier, type);

  if (!result.success) {
    return new NextResponse(
      JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.reset.toString(),
          'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // Add rate limit headers to response
  return {
    headers: {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toString(),
    },
  };
}

// ============================================
// 6. Rate Limit decorator for API routes
// ============================================

export function createRateLimitedHandler(
  type: RateLimitType,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async function (request: NextRequest): Promise<NextResponse> {
    const rateLimitResult = await withRateLimit(request, type);

    // If rate limit exceeded, return error response
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // Execute handler
    const response = await handler(request);

    // Add rate limit headers
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

// ============================================
// 7. Legacy API (for backward compatibility)
// ============================================

interface RateLimitResult {
  limited: boolean;
  response?: NextResponse;
}

export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const identifier = await getClientIdentifier(request);
  const key = `${request.nextUrl.pathname}:${identifier}`;
  const now = Date.now();

  // Use in-memory fallback for custom configs
  let entry = memoryStore[key];

  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    memoryStore[key] = entry;
    return { limited: false };
  }

  entry.count++;

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

  return { limited: false };
}

// ============================================
// 8. Predefined rate limit configurations
// ============================================

export const RATE_LIMITS = {
  STRICT: {
    max: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Zu viele Versuche. Bitte warten Sie 15 Minuten.',
  },
  AUTH: {
    max: 10,
    windowMs: 5 * 60 * 1000,
    message: 'Zu viele Login-Versuche. Bitte warten Sie 5 Minuten.',
  },
  STANDARD: {
    max: 100,
    windowMs: 60 * 1000,
    message: 'Zu viele Anfragen. Bitte warten Sie eine Minute.',
  },
  BOOKING: {
    max: 20,
    windowMs: 5 * 60 * 1000,
    message: 'Zu viele Buchungsanfragen. Bitte warten Sie.',
  },
  SEARCH: {
    max: 50,
    windowMs: 60 * 1000,
    message: 'Zu viele Suchanfragen. Bitte warten Sie.',
  },
  UPLOAD: {
    max: 10,
    windowMs: 60 * 60 * 1000,
    message: 'Zu viele Uploads. Bitte warten Sie eine Stunde.',
  },
} as const;

// ============================================
// 9. Convenience helpers for old API routes
// ============================================

/**
 * Rate limit helper that throws an error response on failure
 * (for use in API routes that don't use the createRateLimitedHandler wrapper)
 * @returns null if successful, NextResponse if rate limit exceeded
 */
export async function checkRateLimitOrFail(
  request: NextRequest,
  type: RateLimitType | RateLimitConfig = 'api'
): Promise<NextResponse | null> {
  // Allow test environments to bypass rate limiting
  if (process.env.DISABLE_RATE_LIMITING === 'true') return null;

  if (typeof type === 'object') {
    // Legacy RateLimitConfig usage
    const result = await rateLimit(request, type);
    return result.limited ? result.response! : null;
  }

  // New RateLimitType usage
  const rateLimitResult = await withRateLimit(request, type);

  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
  }

  return null;
}

/**
 * Predefined strict rate limiter (for backward compatibility)
 */
export async function rateLimitStrict(request: NextRequest): Promise<RateLimitResult> {
  return rateLimit(request, RATE_LIMITS.STRICT);
}

/**
 * Example usage in API route:
 *
 * ```ts
 * import { createRateLimitedHandler } from '@/lib/rate-limit';
 *
 * export const POST = createRateLimitedHandler('auth', async (request) => {
 *   // Your API logic here
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
