'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker for offline caching and installability.
 * Runs once on app startup.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // In development, unregister any existing service worker to avoid stale Turbopack chunk caching
    if (process.env.NODE_ENV === 'development') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Registered:', registration.scope);
        })
        .catch((error) => {
          console.error('[SW] Registration failed:', error);
        });
    }
  }, []);

  return null;
}
