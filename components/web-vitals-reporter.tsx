'use client';

import { useEffect } from 'react';

/**
 * Web Vitals reporting component.
 * Reports Core Web Vitals (LCP, FID, CLS, INP, TTFB) to analytics.
 */
export function WebVitalsReporter() {
  useEffect(() => {
    // Dynamically import web-vitals only on client side
    const reportVitals = async () => {
      try {
        const { onLCP, onCLS, onINP, onTTFB } = await import('web-vitals');

        const sendToAnalytics = ({
          name,
          value,
          id,
          rating,
        }: {
          name: string;
          value: number;
          id: string;
          rating: string;
        }) => {
          // Log in development
          if (process.env.NODE_ENV === 'development') {
            console.log(`[WebVitals] ${name}: ${value} (${rating})`);
          }

          // Send to analytics endpoint
          const body = JSON.stringify({ name, value, id, rating, page: window.location.pathname });

          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/analytics/vitals', body);
          } else {
            fetch('/api/analytics/vitals', {
              body,
              method: 'POST',
              keepalive: true,
            }).catch(() => {});
          }
        };

        onCLS(sendToAnalytics);
        onLCP(sendToAnalytics);
        onINP(sendToAnalytics);
        onTTFB(sendToAnalytics);
      } catch {
        // web-vitals package not installed — skip silently
      }
    };

    reportVitals();
  }, []);

  return null;
}
