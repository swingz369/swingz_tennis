/**
 * Cache Service Interface
 * Domain layer interface for caching functionality
 */

export interface CacheOptions {
  /**
   * Time-to-live in seconds
   */
  ttl?: number;

  /**
   * Cache tags for invalidation
   */
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  keys: number;
}

/**
 * Cache Service Interface
 * All caching operations must be done through this interface
 */
export interface ICacheService {
  /**
   * Get a value from cache
   * Returns null if key doesn't exist or is expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<void>;

  /**
   * Delete multiple values from cache
   */
  deleteMany(keys: string[]): Promise<void>;

  /**
   * Invalidate cache by tags
   */
  invalidateByTag(tag: string): Promise<void>;

  /**
   * Invalidate cache by pattern
   */
  invalidateByPattern(pattern: string): Promise<void>;

  /**
   * Clear all cache
   */
  clear(): Promise<void>;

  /**
   * Check if key exists in cache
   */
  has(key: string): Promise<boolean>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;
}
