/**
 * Rate Limiting Implementation
 *
 * This implementation uses in-memory storage for development.
 * For production, replace with Upstash Redis or Vercel KV.
 *
 * Usage:
 * import { rateLimit, rateLimitStrict } from '@/lib/rate-limit';
 *
 * const { success, remaining } = await rateLimit(request);
 * if (!success) {
 *   return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 * }
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  interval: number; // in milliseconds
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory storage (replace with Redis for production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

/**
 * Get client identifier from request
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';

  // Include path to allow different limits per endpoint
  const path = new URL(request.url).pathname;

  return `${ip}:${path}`;
}

/**
 * Check rate limit for a request
 */
async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const identifier = getClientIdentifier(request);
  const now = Date.now();

  let entry = rateLimitStore.get(identifier);

  // Create new entry if doesn't exist or expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.interval,
    };
    rateLimitStore.set(identifier, entry);
  }

  // Increment counter
  entry.count++;

  const success = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    success,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Standard rate limit: 100 requests per minute
 * Use for general API endpoints
 */
export async function rateLimit(request: NextRequest) {
  return checkRateLimit(request, {
    interval: 60 * 1000, // 1 minute
    maxRequests: 100,
  });
}

/**
 * Strict rate limit: 10 requests per minute
 * Use for sensitive endpoints (billing, payments, SEPA)
 */
export async function rateLimitStrict(request: NextRequest) {
  return checkRateLimit(request, {
    interval: 60 * 1000, // 1 minute
    maxRequests: 10,
  });
}

/**
 * Generous rate limit: 1000 requests per minute
 * Use for high-frequency endpoints (statistics, dashboards)
 */
export async function rateLimitGenerous(request: NextRequest) {
  return checkRateLimit(request, {
    interval: 60 * 1000, // 1 minute
    maxRequests: 1000,
  });
}

/**
 * Authentication rate limit: 5 attempts per 15 minutes
 * Use for login/auth endpoints to prevent brute force
 */
export async function rateLimitAuth(request: NextRequest) {
  return checkRateLimit(request, {
    interval: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  });
}

/**
 * Middleware to apply rate limiting to API routes
 * Returns 429 if limit exceeded, otherwise continues
 */
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<Response>,
  limiter: (
    req: NextRequest
  ) => Promise<{ success: boolean; remaining: number; resetAt: number }> = rateLimit
): Promise<Response> {
  const { success, remaining, resetAt } = await limiter(request);

  if (!success) {
    const response = new Response(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(
            limiter === rateLimitStrict ? 10 : limiter === rateLimitGenerous ? 1000 : 100
          ),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      }
    );
    return response;
  }

  const response = await handler();

  // Add rate limit headers to response
  response.headers.set(
    'X-RateLimit-Limit',
    String(limiter === rateLimitStrict ? 10 : limiter === rateLimitGenerous ? 1000 : 100)
  );
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)));

  return response;
}

/**
 * Helper to check rate limit and return error response if exceeded
 * Use within API route handlers
 */
export async function checkRateLimitOrFail(
  request: NextRequest,
  limiter: (
    req: NextRequest
  ) => Promise<{ success: boolean; remaining: number; resetAt: number }> = rateLimit
): Promise<NextResponse | null> {
  const { success, remaining, resetAt } = await limiter(request);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil((resetAt - Date.now()) / 1000) },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(remaining),
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  return null; // No error, proceed
}
