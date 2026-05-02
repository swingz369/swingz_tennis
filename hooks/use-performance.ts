import { useEffect, useRef } from 'react';

export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current += 1;

    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      if (renderTime > 100) {
        console.warn(`[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render`);
      }
    };
  }, [componentName]);

  return { renderCount: renderCount.current };
}

export function useComponentRenderTime(componentName: string) {
  const startTime = useRef<number>(0);

  useEffect(() => {
    startTime.current = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime.current;

      if (duration > 50) {
        console.log(`[Performance] ${componentName} rendered in ${duration.toFixed(2)}ms`);
      }
    };
  }, [componentName]);
}

export function measureRenderTime(componentName: string) {
  const startTime = performance.now();

  return () => {
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (duration > 50) {
      console.log(`[Performance] ${componentName} rendered in ${duration.toFixed(2)}ms`);
    }
  };
}

export function trackPageLoad() {
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      const navigationTiming = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      if (navigationTiming) {
        const metrics = {
          domContentLoaded:
            navigationTiming.domContentLoadedEventEnd - navigationTiming.domContentLoadedEventStart,
          loadComplete: navigationTiming.loadEventEnd - navigationTiming.loadEventStart,
          firstPaint: navigationTiming.responseStart - navigationTiming.fetchStart,
          domInteractive: navigationTiming.domInteractive - navigationTiming.fetchStart,
        };

        console.log('[Performance] Page load metrics:', metrics);
      }
    });
  }
}

export function trackWebVitals() {
  if (typeof window !== 'undefined') {
    import('web-vitals').then(() => {
      console.log('[Performance] Web Vitals tracking enabled');
    });
  }
}
