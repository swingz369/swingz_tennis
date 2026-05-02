import * as Sentry from '@sentry/nextjs';

export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();

  startMark(name: string) {
    this.marks.set(name, performance.now());
  }

  endMark(name: string): number {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`Mark "${name}" not found`);
      return 0;
    }
    const duration = performance.now() - startTime;
    this.marks.delete(name);
    return duration;
  }

  measure(name: string, callback: () => Promise<any> | any): Promise<any> {
    this.startMark(name);
    return Promise.resolve(callback()).finally(() => {
      const duration = this.endMark(name);
      Sentry.addBreadcrumb({
        category: 'performance',
        message: `${name} completed`,
        level: 'info',
        data: { duration: `${duration.toFixed(2)}ms` },
      });
    });
  }

  trackPageLoad() {
    if (typeof window !== 'undefined') {
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

        Sentry.addBreadcrumb({
          category: 'performance',
          message: 'Page load metrics',
          level: 'info',
          data: metrics,
        });
      }
    }
  }

  trackApiCall(endpoint: string, method: string) {
    const callId = `${method}:${endpoint}`;
    this.startMark(callId);

    return {
      end: () => {
        const duration = this.endMark(callId);
        Sentry.addBreadcrumb({
          category: 'api',
          message: `${method} ${endpoint}`,
          level: 'info',
          data: { duration: `${duration.toFixed(2)}ms` },
        });
      },
    };
  }

  trackComponentRender(componentName: string) {
    return {
      start: () => {
        this.startMark(`render:${componentName}`);
      },
      end: () => {
        const duration = this.endMark(`render:${componentName}`);
        if (duration > 100) {
          Sentry.addBreadcrumb({
            category: 'performance',
            message: `Slow render: ${componentName}`,
            level: 'warning',
            data: { duration: `${duration.toFixed(2)}ms` },
          });
        }
      },
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();
