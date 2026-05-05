/**
 * Performance Optimization Utilities
 *
 * Helpers for caching, query optimization, and performance monitoring
 */

import { unstable_cache } from 'next/cache';

/**
 * Cache configuration presets
 */
export const CACHE_PRESETS = {
  short: { revalidate: 60 }, // 1 minute
  medium: { revalidate: 300 }, // 5 minutes
  long: { revalidate: 3600 }, // 1 hour
  day: { revalidate: 86400 }, // 24 hours
};

/**
 * Cache wrapper with tags for invalidation
 */
export function withCache<T>(
  fn: () => Promise<T>,
  options: {
    tags: string[];
    revalidate?: number;
    key?: string;
  }
): Promise<T> {
  const cacheKey = options.key || fn.toString();

  return unstable_cache(fn, [cacheKey], {
    tags: options.tags,
    revalidate: options.revalidate,
  })();
}

/**
 * Batch query helper to reduce N+1 queries
 */
export async function batchQuery<T, K>(
  items: T[],
  keyExtractor: (item: T) => K,
  queryFn: (keys: K[]) => Promise<Map<K, any>>
): Promise<Map<K, any>> {
  if (items.length === 0) return new Map();

  const keys = items.map(keyExtractor);
  const uniqueKeys = Array.from(new Set(keys));

  return queryFn(uniqueKeys);
}

/**
 * DataLoader-style batching for Supabase queries
 */
export class QueryBatcher<K, V> {
  private queue: Array<{
    key: K;
    resolve: (value: V | null) => void;
    reject: (error: any) => void;
  }> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private batchDelay = 10; // ms

  constructor(
    private batchFn: (keys: K[]) => Promise<Map<K, V>>,
    private maxBatchSize = 100
  ) {}

  load(key: K): Promise<V | null> {
    return new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject });

      if (this.queue.length >= this.maxBatchSize) {
        this.dispatchBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.dispatchBatch(), this.batchDelay);
      }
    });
  }

  private async dispatchBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batch = this.queue.splice(0, this.maxBatchSize);
    if (batch.length === 0) return;

    try {
      const keys = batch.map((item) => item.key);
      const results = await this.batchFn(keys);

      batch.forEach((item) => {
        const result = results.get(item.key);
        item.resolve(result || null);
      });
    } catch (error) {
      batch.forEach((item) => item.reject(error));
    }
  }
}

/**
 * Memoization helper
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);

    // Clear cache after 5 minutes
    setTimeout(() => cache.delete(key), 300000);

    return result;
  }) as T;
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>();

  static start(label: string): void {
    this.timers.set(label, performance.now());
  }

  static end(label: string): number {
    const start = this.timers.get(label);
    if (!start) return 0;

    const duration = performance.now() - start;
    this.timers.delete(label);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  static async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      return await fn();
    } finally {
      this.end(label);
    }
  }
}

/**
 * Optimized pagination helper
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export async function paginate<T>(
  query: any,
  options: PaginationOptions
): Promise<PaginatedResult<T>> {
  const { page, pageSize, orderBy, orderDirection = 'desc' } = options;
  const offset = (page - 1) * pageSize;

  // Get total count
  const { count } = await query.select('*', { count: 'exact', head: true });

  // Get paginated data
  let dataQuery = query.select('*').range(offset, offset + pageSize - 1);

  if (orderBy) {
    dataQuery = dataQuery.order(orderBy, { ascending: orderDirection === 'asc' });
  }

  const { data } = await dataQuery;

  const totalPages = Math.ceil((count || 0) / pageSize);

  return {
    data: data || [],
    pagination: {
      page,
      pageSize,
      totalPages,
      totalItems: count || 0,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
