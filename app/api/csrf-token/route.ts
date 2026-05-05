/**
 * CSRF Token Generation Endpoint
 * GET /api/csrf-token
 *
 * Returns a CSRF token that must be included in all mutation requests
 */

import { getCSRFTokenHandler } from '@/lib/csrf';

export async function GET() {
  return getCSRFTokenHandler();
}
