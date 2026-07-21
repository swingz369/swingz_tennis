/**
 * Sentry Server Configuration
 * Pattern from INTEGRATION_ROADMAP.md Phase 4.1
 *
 * Monitors server-side errors and performance
 * Includes database query tracking and profiling
 */

import * as Sentry from '@sentry/nextjs';

const isProd = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: isProd, // keine Tracing-Pipeline im Dev-RAM

  // Performance Monitoring (10% sampling in prod to reduce cost)
  tracesSampleRate: isProd ? 0.1 : 0,

  // Profiling (captures function-level performance, 10% in prod)
  profilesSampleRate: isProd ? 0.1 : 0,

  integrations: isProd
    ? [
        // PostgreSQL query tracing
        Sentry.postgresIntegration(),
      ]
    : [],

  // Scrub sensitive data before sending
  beforeSend(event) {
    // Remove database URLs (contain passwords)
    if (event.extra) {
      if (event.extra.DATABASE_URL) {
        event.extra.DATABASE_URL = '[REDACTED]';
      }
      if (event.extra.DIRECT_URL) {
        event.extra.DIRECT_URL = '[REDACTED]';
      }
    }

    // Remove sensitive env vars
    if (event.contexts?.runtime?.env) {
      const env = event.contexts.runtime.env as Record<string, unknown>;
      delete env.SUPABASE_SERVICE_ROLE_KEY;
      delete env.STRIPE_SECRET_KEY;
      delete env.ANTHROPIC_API_KEY;
      delete env.UPSTASH_REDIS_REST_TOKEN;
    }

    return event;
  },

  // Filter transactions
  beforeSendTransaction(transaction) {
    // Don't send health check transactions
    if (transaction.transaction?.includes('/api/health')) {
      return null;
    }

    // Don't send static asset requests
    if (transaction.transaction?.match(/\.(css|js|png|jpg|svg|woff|woff2|ttf|ico)$/)) {
      return null;
    }

    return transaction;
  },
});
