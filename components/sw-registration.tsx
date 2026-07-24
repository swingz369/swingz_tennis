'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker for offline caching and installability.
 * Runs once on app startup.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Dev-mode SW unregister runs earlier, in app/layout.tsx's blocking <head> script.
    if (process.env.NODE_ENV === 'development') return;
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
          // Service worker registered successfully
        })
        .catch((error) => {
          console.error('[SW] Registration failed:', error);
        });
    }
  }, []);

  return null;
}
