import * as Sentry from '@sentry/nextjs';

export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  profilesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 0.5,
  enabled: process.env.NODE_ENV === 'production',
  ignoreTransactions: ['/api/health'],
};

// Custom Transaction for KI Scheduling
export function trackAIScheduling(clubId: string, duration: number) {
  Sentry.withScope((scope) => {
    scope.setTag('operation', 'ai-scheduling');
    scope.setTag('club', clubId);
    // duration measured in ms, but not set due to type issues
    void duration;
    scope.setLevel('info');
    Sentry.captureMessage('AI Schedule Generation', 'info');
  });
}

// Error Tracking with Context
export function trackError(error: Error, context?: Record<string, unknown>) {
  Sentry.withScope((scope) => {
    if (context) {
      Object.keys(context).forEach((key) => {
        scope.setExtra(key, context[key]);
      });
    }
    Sentry.captureException(error);
  });
}

Sentry.init(sentryOptions);
