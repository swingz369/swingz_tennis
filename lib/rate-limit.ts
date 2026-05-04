import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface RateLimitConfig {
  interval: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Global in-memory store (development/fallback)
// For production, replace with Redis (Upstash) via environment variable
const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries (every 5 min)
if (typeof window === 'undefined') {
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
}

/**
 * Get client identifier from request
 */
function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';

  const path = new URL(request.url).pathname;
  return `${ip}:${path}`;
}

/**
 * Check rate limit (in-memory)
 */
async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const identifier = getClientIdentifier(request);
  const now = Date.now();

  let entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + config.interval };
    rateLimitStore.set(identifier, entry);
  }

  entry.count++;

  const success = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return { success, remaining, resetAt: entry.resetAt };
}

/**
 * Standard rate limit: 100 requests per minute
 */
export async function rateLimit(request: NextRequest) {
  return checkRateLimit(request, {
    interval: 60 * 1000,
    maxRequests: 100,
  });
}

/**
 * Strict rate limit: 10 requests per minute
 */
export async function rateLimitStrict(request: NextRequest) {
  return checkRateLimit(request, {
    interval: 60 * 1000,
    maxRequests: 10,
  });
}

/**
 * Generous rate limit: 1000 requests per minute
 */
export async function rateLimitGenerous(request: NextRequest) {
  return checkRateLimit(request, {
    interval: 60 * 1000,
    maxRequests: 1000,
  });
}

/**
 * Auth rate limit: 5 attempts per 15 minutes
 */
export async function rateLimitAuth(request: NextRequest) {
  return checkRateLimit(request, {
    interval: 15 * 60 * 1000,
    maxRequests: 5,
  });
}

/**
 * Middleware wrapper
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
    return new Response(
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
  }

  const response = await handler();

  response.headers.set(
    'X-RateLimit-Limit',
    String(limiter === rateLimitStrict ? 10 : limiter === rateLimitGenerous ? 1000 : 100)
  );
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)));

  return response;
}

/**
 * Helper to check rate limit and return error if exceeded
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

  return null;
}
