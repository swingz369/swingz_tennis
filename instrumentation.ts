import * as Sentry from '@sentry/nextjs';

// Next.js lädt Server-Instrumentation nur über register() — eine
// sentry.server.config.ts allein wird nie ausgeführt.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}

// Fehler aus Server Components, Route Handlers und Proxy an Sentry melden.
export const onRequestError = Sentry.captureRequestError;
