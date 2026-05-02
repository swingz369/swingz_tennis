export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private observers: PerformanceObserver[] = [];

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initObservers();
    }
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initObservers() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(entry.name, entry.duration);
        }
      });

      observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('PerformanceObserver not supported:', error);
    }
  }

  startMeasure(name: string): void {
    if (typeof window !== 'undefined') {
      performance.mark(`${name}-start`);
    }
  }

  endMeasure(name: string): number {
    if (typeof window !== 'undefined') {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);

      const measure = performance.getEntriesByName(name)[0];
      if (measure) {
        this.recordMetric(name, measure.duration);
        performance.clearMarks(`${name}-start`);
        performance.clearMarks(`${name}-end`);
        performance.clearMeasures(name);
        return measure.duration;
      }
    }
    return 0;
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getMetric(name: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  getAllMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    this.metrics.forEach((values, name) => {
      const sum = values.reduce((a, b) => a + b, 0);
      result[name] = {
        avg: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    });

    return result;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }

  getWebVitals(): {
    FCP?: number;
    LCP?: number;
    CLS?: number;
    FID?: number;
    TTFB?: number;
  } {
    if (typeof window === 'undefined') return {};

    const vitals: any = {};

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      vitals.TTFB = navigation.responseStart - navigation.requestStart;
    }

    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
    if (fcp) {
      vitals.FCP = fcp.startTime;
    }

    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      vitals.LCP = lcpEntries[lcpEntries.length - 1].startTime;
    }

    const clsEntries = performance.getEntriesByType('layout-shift');
    if (clsEntries.length > 0) {
      vitals.CLS = clsEntries.reduce(
        (sum: number, entry: any) => sum + (entry.hadRecentInput ? 0 : entry.value),
        0
      );
    }

    return vitals;
  }

  destroy(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.clearMetrics();
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

export function measurePerformance<T>(name: string, fn: () => T): T {
  performanceMonitor.startMeasure(name);
  try {
    const result = fn();
    performanceMonitor.endMeasure(name);
    return result;
  } catch (error) {
    performanceMonitor.endMeasure(name);
    throw error;
  }
}

export async function measureAsyncPerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  performanceMonitor.startMeasure(name);
  try {
    const result = await fn();
    performanceMonitor.endMeasure(name);
    return result;
  } catch (error) {
    performanceMonitor.endMeasure(name);
    throw error;
  }
}
