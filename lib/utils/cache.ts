/**
 * Simple in-memory cache with TTL (Time To Live)
 * Use for caching frequently accessed data like trainer lists, club details, etc.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttlMs Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Delete a value from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set a value in the cache
   * If the value exists and is not expired, return it
   * Otherwise, call the factory function and cache the result
   * @param key Cache key
   * @param factory Function to generate the value if not cached
   * @param ttlMs Time to live in milliseconds (default: 5 minutes)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs: number = 5 * 60 * 1000
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Invalidate cache entries matching a pattern
   * @param pattern String to match in cache keys
   */
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Run cleanup every 10 minutes
// ponytail: globalThis-Guard verhindert doppelte Intervalle bei HMR-Reload in Dev
const CACHE_CLEANUP_KEY = '__swingzCacheCleanup';
if (typeof setInterval !== 'undefined' && !(globalThis as any)[CACHE_CLEANUP_KEY]) {
  (globalThis as any)[CACHE_CLEANUP_KEY] = setInterval(
    () => {
      cache.cleanup();
    },
    10 * 60 * 1000
  );
}

/**
 * Cache key builders for common patterns
 */
export const CacheKeys = {
  trainer: (id: string) => `trainer:${id}`,
  trainers: (clubId: string) => `trainers:club:${clubId}`,
  session: (id: string) => `session:${id}`,
  sessionDetails: (id: string) => `session-details:${id}`,
  schedule: (clubId: string) => `schedule:club:${clubId}`,
  club: (id: string) => `club:${id}`,
  member: (id: string) => `member:${id}`,
  bookings: (memberId: string) => `bookings:member:${memberId}`,
} as const;

/**
 * Cache TTLs (Time To Live) in milliseconds
 */
export const CacheTTL = {
  SHORT: 1 * 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
} as const;
