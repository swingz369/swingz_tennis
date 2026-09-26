/**
 * Sentry Client Configuration
 * Pattern from INTEGRATION_ROADMAP.md Phase 4.1
 *
 * Monitors client-side errors, performance, and session replays
 * Optimized for production with PII masking and sampling
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',

  // Performance Monitoring
  // 100% in dev for debugging, 10% in prod to reduce quota usage
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Session Replay
  // Record 100% of sessions with errors, 10% of normal sessions
  replaysOnErrorSampleRate: 1.0, // Capture all error sessions
  replaysSessionSampleRate: 0.1, // Capture 10% of normal sessions

  integrations: [
    // Browser tracing for performance monitoring
    Sentry.browserTracingIntegration({
      traceFetch: true, // Monitor fetch requests
      traceXHR: true, // Monitor XHR requests
    }),

    // Session replay with PII protection
    Sentry.replayIntegration({
      maskAllText: true, // Mask all text for privacy
      maskAllInputs: true, // Mask form inputs
      blockAllMedia: true, // Don't record images/videos
    }),
  ],

  // Filter out noise
  ignoreErrors: [
    // Browser extension errors
    'top.GLOBALS',
    // Network errors (transient, not actionable)
    'NetworkError',
    'Failed to fetch',
    'Load failed',
    // AbortController expected behavior
    'AbortError',
    // ResizeObserver benign errors
    'ResizeObserver loop',
  ],

  // Scrub sensitive data before sending
  beforeSend(event, hint) {
    // Log in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sentry Client] Event:', event);
      console.log('[Sentry Client] Hint:', hint);
    }

    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers.Authorization;
      delete event.request.headers.Cookie;
    }

    // Remove sensitive query params
    if (event.request?.query_string) {
      const queryString = event.request.query_string;
      if (typeof queryString === 'string') {
        // Remove tokens, keys, passwords from URL
        const sanitized = queryString.replace(
          /([?&])(token|key|password|secret)=[^&]*/gi,
          '$1$2=REDACTED'
        );
        event.request.query_string = sanitized;
      }
    }

    return event;
  },

  // Filter transactions before sending
  beforeSendTransaction(transaction) {
    // Don't send health check transactions (too noisy)
    if (transaction.transaction?.includes('/api/health')) {
      return null;
    }

    return transaction;
  },
});

// Seitenwechsel im App Router als Navigation-Spans erfassen.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
