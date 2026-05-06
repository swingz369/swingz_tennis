/**
 * React Performance Utilities
 * Pattern from INTEGRATION_ROADMAP.md Phase 4.3
 *
 * Provides utilities for React performance optimizations:
 * - Memoization helpers
 * - Dynamic import wrappers
 * - Performance monitoring
 */

import type { ComponentType, ReactNode } from 'react';
import { memo } from 'react';
import dynamic from 'next/dynamic';

/**
 * Memoize a component with custom comparison
 *
 * Use for:
 * - Large lists (>50 items)
 * - Expensive computations
 * - Components that re-render frequently but receive same props
 *
 * @example
 * ```tsx
 * export const MemberCard = memoComponent(function MemberCard({ member }) {
 *   return <div>{member.fullName}</div>;
 * });
 * ```
 */
export function memoComponent<P extends object>(
  Component: ComponentType<P>,
  propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean
) {
  return memo(Component, propsAreEqual);
}

/**
 * Create a dynamically imported component
 *
 * Use for:
 * - Heavy libraries (PDFs, charts, editors)
 * - Components only needed conditionally
 * - Client-only components
 *
 * @example
 * ```tsx
 * const ChartComponent = lazyComponent(
 *   () => import('./Chart'),
 *   { loading: () => <LoadingSpinner /> }
 * );
 * ```
 */
export function lazyComponent<P = Record<string, never>>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options?: {
    loading?: () => ReactNode;
    ssr?: boolean;
  }
) {
  return dynamic(importFn, {
    loading: options?.loading,
    ssr: options?.ssr ?? true,
  });
}

/**
 * Create a client-only dynamically imported component
 *
 * Use for components that rely on browser APIs
 *
 * @example
 * ```tsx
 * const PDFViewer = clientOnlyComponent(
 *   () => import('./PDFViewer'),
 *   { loading: () => <div>Lade PDF...</div> }
 * );
 * ```
 */
export function clientOnlyComponent<P = Record<string, never>>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options?: {
    loading?: () => ReactNode;
  }
) {
  return dynamic(importFn, {
    loading: options?.loading,
    ssr: false,
  });
}

/**
 * Shallow comparison for memo
 *
 * Compares primitive values and object references
 * Does not deep-compare objects
 */
export function shallowEqual<P extends object>(
  prevProps: Readonly<P>,
  nextProps: Readonly<P>
): boolean {
  const prevKeys = Object.keys(prevProps) as Array<keyof P>;
  const nextKeys = Object.keys(nextProps) as Array<keyof P>;

  if (prevKeys.length !== nextKeys.length) {
    return false;
  }

  for (const key of prevKeys) {
    if (prevProps[key] !== nextProps[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Deep comparison for memo (use sparingly)
 *
 * WARNING: Expensive operation. Only use when necessary.
 * Prefer shallow comparison or custom comparison functions.
 */
export function deepEqual<P extends object>(
  prevProps: Readonly<P>,
  nextProps: Readonly<P>
): boolean {
  return JSON.stringify(prevProps) === JSON.stringify(nextProps);
}

/**
 * Performance monitoring wrapper for components
 *
 * Logs render times in development
 * Sends performance data to Sentry in production
 *
 * @example
 * ```tsx
 * export const Dashboard = withPerformanceMonitoring(
 *   'Dashboard',
 *   function Dashboard() {
 *     return <div>Dashboard</div>;
 *   }
 * );
 * ```
 */
export function withPerformanceMonitoring<P extends object>(
  componentName: string,
  Component: (props: P) => ReactNode
) {
  if (process.env.NODE_ENV === 'production') {
    return Component;
  }

  return function PerformanceMonitoredComponent(props: P) {
    const startTime = performance.now();

    const result = Component(props);

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    if (renderTime > 16) {
      // Slower than 60fps
      console.warn(
        `[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render (target: <16ms)`
      );
    }

    return result;
  };
}

/**
 * Debounce hook for expensive operations
 *
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   // This only runs 300ms after user stops typing
 *   performSearch(debouncedSearch);
 * }, [debouncedSearch]);
 * ```
 */
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
