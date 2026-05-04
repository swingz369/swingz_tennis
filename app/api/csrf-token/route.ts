import { getCSRFTokenHandler } from '@/lib/csrf';

/**
 * GET /api/csrf-token
 *
 * Returns a new CSRF token for the client
 * The token is also set as an httpOnly cookie
 *
 * Client should include the token in X-CSRF-Token header for all
 * POST, PUT, PATCH, DELETE requests
 */
export async function GET() {
  return getCSRFTokenHandler();
}
