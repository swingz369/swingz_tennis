/**
 * Health Check Endpoint
 * Pattern from INTEGRATION_ROADMAP.md Phase 4.4
 *
 * Used by uptime monitoring services (Better Stack, UptimeRobot, etc.)
 * Returns 200 OK if all critical services are operational
 * Returns 503 Service Unavailable if any service is down
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { db } from '@/infrastructure/persistence/db';
import { sql } from 'drizzle-orm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Health check response format
 */
interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  checks: {
    database: 'ok' | 'error';
    supabase: 'ok' | 'error';
    redis?: 'ok' | 'error' | 'not_configured';
  };
  responseTime: string;
  version?: string;
  environment?: string;
}

/**
 * GET /api/health
 *
 * Returns health status of all critical services
 */
export async function GET() {
  const startTime = Date.now();
  const checks: HealthCheckResponse['checks'] = {
    database: 'error',
    supabase: 'error',
  };

  try {
    // Check 1: Database connectivity (Drizzle ORM)
    try {
      await db.execute(sql`SELECT 1 as health`);
      checks.database = 'ok';
    } catch (dbError) {
      console.error('[Health] Database check failed:', dbError);
      checks.database = 'error';
    }

    // Check 2: Supabase connectivity
    try {
      const supabase = await createClient();
      const { error } = await supabase.from('clubs').select('id').limit(1);

      if (error) {
        console.error('[Health] Supabase check failed:', error);
        checks.supabase = 'error';
      } else {
        checks.supabase = 'ok';
      }
    } catch (supabaseError) {
      console.error('[Health] Supabase check failed:', supabaseError);
      checks.supabase = 'error';
    }

    // Check 3: Redis (optional - rate limiting)
    if (process.env.UPSTASH_REDIS_REST_URL) {
      try {
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });

        await redis.ping();
        checks.redis = 'ok';
      } catch (redisError) {
        console.error('[Health] Redis check failed:', redisError);
        checks.redis = 'error';
      }
    } else {
      checks.redis = 'not_configured';
    }

    // Calculate overall status
    const allOk = checks.database === 'ok' && checks.supabase === 'ok';
    const anyError = checks.database === 'error' || checks.supabase === 'error';

    const status: HealthCheckResponse['status'] = anyError ? 'error' : allOk ? 'ok' : 'degraded';

    const responseTime = Date.now() - startTime;

    const response: HealthCheckResponse = {
      status,
      timestamp: new Date().toISOString(),
      checks,
      responseTime: `${responseTime}ms`,
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
    };

    // Return 503 if critical services are down
    if (status === 'error') {
      return NextResponse.json(response, {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    // Return 200 OK with health data
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error('[Health] Health check failed:', error);

    const errorResponse: HealthCheckResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'error',
        supabase: 'error',
      },
      responseTime: `${responseTime}ms`,
    };

    return NextResponse.json(errorResponse, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }
}
