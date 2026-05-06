/**
 * Demo Mode Helper
 *
 * Provides utilities for checking demo mode status.
 * Demo mode is ONLY available in development environment.
 */

import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Check if demo mode is enabled
 * Only works in development environment for security
 */
export function isDemoModeEnabled(req?: NextRequest): boolean {
  // Demo mode ONLY allowed in development
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  if (req) {
    // For App Router with request
    const cookie = req.cookies.get('demo-mode');
    return !!cookie;
  }

  // Without request: cannot use cookies() synchronously in a non-async function.
  // Use isDemoModeEnabledAsync() for Server Components.
  return false;
}

/**
 * Check if demo mode is enabled (async version for cookies())
 */
export async function isDemoModeEnabledAsync(): Promise<boolean> {
  // Demo mode ONLY allowed in development
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.get('demo-mode');
  return !!cookie;
}

/**
 * Log warning when demo mode is used
 */
export function logDemoModeWarning(context: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[DEV] Demo mode active in ${context} - bypassing authentication`);
  }
}

/**
 * Get demo user ID (only in development)
 */
export function getDemoUserId(): string | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  return 'demo-user-123';
}
