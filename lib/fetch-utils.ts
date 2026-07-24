/**
 * Fetch Utilities with Timeout and Error Handling
 *
 * Provides standardized fetch functions with:
 * - Automatic timeouts
 * - Retry logic with exponential backoff
 * - Consistent error handling
 * - Request cancellation support
 */

import { isApiError } from './api-error';
import { extractErrorMessage } from '@/lib/typed-helpers';

export interface FetchOptions extends RequestInit {
  timeout?: number; // milliseconds
  retry?: {
    maxAttempts?: number;
    initialDelay?: number; // milliseconds
    maxDelay?: number; // milliseconds
    backoffMultiplier?: number;
  };
}

export interface FetchError extends Error {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Default configuration
 */
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Enhanced fetch with timeout and retry
 */
export async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retry = DEFAULT_RETRY_CONFIG,
    signal: externalSignal,
    ...fetchOptions
  } = options;

  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retry };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    // Caller's signal (e.g. React Query's cancellation on unmount) must actually
    // reach fetch() — otherwise a cancelled query's request keeps running in the
    // background and a remount fires a second, real request against the server.
    const signal = combineAbortSignals(externalSignal ?? undefined, controller.signal);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal,
      });

      clearTimeout(timeoutId);

      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry on 5xx errors or rate limiting
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

        // Wait before retry (except on last attempt)
        if (attempt < retryConfig.maxAttempts - 1) {
          await sleep(calculateBackoff(attempt, retryConfig));
          continue;
        }
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error(`Request timeout after ${timeout}ms`);
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Don't retry on last attempt
      if (attempt < retryConfig.maxAttempts - 1) {
        await sleep(calculateBackoff(attempt, retryConfig));
        continue;
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('Request failed');
}

/**
 * Fetch JSON with automatic error handling
 */
export async function fetchJSON<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Parse JSON response
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error}`);
  }

  // Handle API errors
  if (!response.ok) {
    if (isApiError(data)) {
      const error: FetchError = new Error(data.error.message);
      error.status = response.status;
      error.code = data.error.code;
      error.details = data.error.details;
      throw error;
    }

    // Fallback for non-standardized errors
    const errorMessage = extractErrorMessage(data) || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

/**
 * POST request with JSON body
 */
export async function postJSON<T = unknown>(
  url: string,
  body: unknown,
  options: FetchOptions = {}
): Promise<T> {
  return fetchJSON<T>(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT request with JSON body
 */
export async function putJSON<T = unknown>(
  url: string,
  body: unknown,
  options: FetchOptions = {}
): Promise<T> {
  return fetchJSON<T>(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * PATCH request with JSON body
 */
export async function patchJSON<T = unknown>(
  url: string,
  body: unknown,
  options: FetchOptions = {}
): Promise<T> {
  return fetchJSON<T>(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request
 */
export async function deleteJSON<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  return fetchJSON<T>(url, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(
  attempt: number,
  config: Required<NonNullable<FetchOptions['retry']>>
): number {
  const delay = Math.min(
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  );

  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract a readable error message from an unknown response body.
 * Handles common shapes: { error: string }, { message: string }, strings.
 *
 * Re-exported from `@/lib/typed-helpers` so existing call-sites keep working.
 */
export { extractErrorMessage };

/**
 * Create an AbortController that auto-aborts after timeout
 */
export function createTimeoutController(timeout: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller;
}

/**
 * Combine multiple abort signals
 */
export function combineAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal?.aborted) {
      controller.abort();
      break;
    }
    signal?.addEventListener('abort', () => controller.abort());
  }

  return controller.signal;
}
